"""Rotas exclusivas do administrador master do Papper."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from database import engine, obter_banco
from models import (
    AtividadeBanco,
    IgrejaBanco,
    MembroBanco,
    MovimentacaoFinanceiraBanco,
    UsuarioBanco,
)
from schemas import (
    AdminIgrejaCriar,
    AdminResumo,
    AdminSenhaUsuarioAtualizar,
    AdminStatusUsuarioAtualizar,
    IgrejaResposta,
    UsuarioCriar,
    UsuarioResposta,
)
from seguranca import criar_hash_senha


def registrar_admin(app, obter_usuario_atual):
    router = APIRouter(prefix="/admin", tags=["Admin master"])

    def exigir_master(
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ) -> UsuarioBanco:
        if usuario.perfil != "master":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso exclusivo do administrador master.",
            )
        return usuario

    @router.get("/resumo", response_model=AdminResumo)
    def resumo(
        banco: Session = Depends(obter_banco),
        _: UsuarioBanco = Depends(exigir_master),
    ):
        def contar(modelo):
            return banco.scalar(select(func.count()).select_from(modelo)) or 0

        usuarios_ativos = banco.scalar(
            select(func.count())
            .select_from(UsuarioBanco)
            .where(UsuarioBanco.ativo.is_(True))
        ) or 0

        return {
            "total_igrejas": contar(IgrejaBanco),
            "total_usuarios": contar(UsuarioBanco),
            "usuarios_ativos": usuarios_ativos,
            "total_membros": contar(MembroBanco),
            "total_atividades": contar(AtividadeBanco),
            "total_movimentacoes": contar(MovimentacaoFinanceiraBanco),
            "banco": engine.dialect.name,
        }

    @router.get("/igrejas", response_model=list[IgrejaResposta])
    def listar_igrejas(
        banco: Session = Depends(obter_banco),
        _: UsuarioBanco = Depends(exigir_master),
    ):
        return banco.scalars(
            select(IgrejaBanco).order_by(IgrejaBanco.nome, IgrejaBanco.id)
        ).all()

    @router.post(
        "/igrejas",
        response_model=IgrejaResposta,
        status_code=status.HTTP_201_CREATED,
    )
    def criar_igreja(
        dados: AdminIgrejaCriar,
        banco: Session = Depends(obter_banco),
        _: UsuarioBanco = Depends(exigir_master),
    ):
        nome = dados.nome.strip()
        existente = banco.scalar(
            select(IgrejaBanco).where(IgrejaBanco.nome.ilike(nome))
        )
        if existente is not None:
            raise HTTPException(409, "Já existe uma igreja com esse nome.")

        igreja = IgrejaBanco(
            nome=nome,
            presidente=dados.presidente.strip(),
            endereco=dados.endereco.strip(),
        )
        banco.add(igreja)
        banco.commit()
        banco.refresh(igreja)
        return igreja

    @router.get("/usuarios", response_model=list[UsuarioResposta])
    def listar_usuarios(
        igreja_id: int | None = None,
        banco: Session = Depends(obter_banco),
        _: UsuarioBanco = Depends(exigir_master),
    ):
        comando = select(UsuarioBanco)
        if igreja_id is not None:
            comando = comando.where(UsuarioBanco.igreja_id == igreja_id)
        return banco.scalars(
            comando.order_by(UsuarioBanco.username, UsuarioBanco.id)
        ).all()

    @router.post(
        "/usuarios",
        response_model=UsuarioResposta,
        status_code=status.HTTP_201_CREATED,
    )
    def criar_usuario(
        dados: UsuarioCriar,
        banco: Session = Depends(obter_banco),
        _: UsuarioBanco = Depends(exigir_master),
    ):
        igreja = banco.get(IgrejaBanco, dados.igreja_id)
        if igreja is None:
            raise HTTPException(404, "Igreja não encontrada.")

        username = dados.username.strip().lower()
        email = str(dados.email).strip().lower() if dados.email else None

        existente = banco.scalar(
            select(UsuarioBanco).where(
                or_(
                    UsuarioBanco.username == username,
                    UsuarioBanco.email == email if email else False,
                )
            )
        )
        if existente is not None:
            raise HTTPException(409, "Usuário ou e-mail já cadastrado.")

        if dados.membro_id is not None:
            membro = banco.scalar(
                select(MembroBanco).where(
                    MembroBanco.id == dados.membro_id,
                    MembroBanco.igreja_id == dados.igreja_id,
                )
            )
            if membro is None:
                raise HTTPException(404, "Membro não encontrado nesta igreja.")

        usuario = UsuarioBanco(
            nome=dados.nome.strip(),
            username=username,
            email=email,
            senha_hash=criar_hash_senha(dados.senha),
            perfil=dados.perfil,
            igreja_id=dados.igreja_id,
            membro_id=dados.membro_id,
            ativo=True,
        )
        banco.add(usuario)
        banco.commit()
        banco.refresh(usuario)
        return usuario

    @router.patch(
        "/usuarios/{usuario_id}/status",
        response_model=UsuarioResposta,
    )
    def alterar_status_usuario(
        usuario_id: int,
        dados: AdminStatusUsuarioAtualizar,
        banco: Session = Depends(obter_banco),
        master: UsuarioBanco = Depends(exigir_master),
    ):
        alvo = banco.get(UsuarioBanco, usuario_id)
        if alvo is None:
            raise HTTPException(404, "Usuário não encontrado.")

        if alvo.id == master.id and not dados.ativo:
            raise HTTPException(400, "O usuário master não pode desativar a própria conta.")

        alvo.ativo = dados.ativo
        banco.commit()
        banco.refresh(alvo)
        return alvo

    @router.post(
        "/usuarios/{usuario_id}/redefinir-senha",
        status_code=status.HTTP_204_NO_CONTENT,
    )
    def redefinir_senha(
        usuario_id: int,
        dados: AdminSenhaUsuarioAtualizar,
        banco: Session = Depends(obter_banco),
        _: UsuarioBanco = Depends(exigir_master),
    ):
        alvo = banco.get(UsuarioBanco, usuario_id)
        if alvo is None:
            raise HTTPException(404, "Usuário não encontrado.")
        alvo.senha_hash = criar_hash_senha(dados.nova_senha)
        banco.commit()
        return None

    @router.get("/health")
    def health_admin(
        _: UsuarioBanco = Depends(exigir_master),
    ):
        return {"status": "ok", "database": engine.dialect.name}

    app.include_router(router)
