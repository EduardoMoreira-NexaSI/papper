"""Gestão de igreja sede, filiais e autoridade pastoral por unidade."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from database import obter_banco
from models import IgrejaBanco, UsuarioBanco


class PastorDefinir(BaseModel):
    pastor_usuario_id: int = Field(gt=0)


class FilialCriar(BaseModel):
    nome: str = Field(min_length=3, max_length=150)
    endereco: str = Field(min_length=3, max_length=250)
    pastor_responsavel_id: int = Field(gt=0)


def registrar_filiais(app, obter_usuario_atual):
    router = APIRouter(tags=["Sede e filiais"])

    def _usuario_dict(usuario: UsuarioBanco | None):
        if usuario is None:
            return None

        return {
            "id": usuario.id,
            "nome": usuario.nome,
            "username": usuario.username,
            "perfil": usuario.perfil,
            "igreja_id": usuario.igreja_id,
        }

    def _igreja_dict(banco: Session, igreja: IgrejaBanco):
        pastor = (
            banco.get(UsuarioBanco, igreja.pastor_responsavel_id)
            if igreja.pastor_responsavel_id
            else None
        )

        return {
            "id": igreja.id,
            "nome": igreja.nome,
            "endereco": igreja.endereco,
            "presidente": igreja.presidente,
            "igreja_sede_id": igreja.igreja_sede_id,
            "tipo": "filial" if igreja.igreja_sede_id else "sede",
            "pastor_responsavel": _usuario_dict(pastor),
        }

    def _sede(banco: Session, igreja: IgrejaBanco) -> IgrejaBanco:
        if igreja.igreja_sede_id is None:
            return igreja

        sede = banco.get(IgrejaBanco, igreja.igreja_sede_id)

        if sede is None:
            raise HTTPException(
                409,
                "A sede vinculada a esta filial não foi encontrada.",
            )

        return sede

    def _autorizar_visualizacao(
        usuario: UsuarioBanco,
        igreja: IgrejaBanco,
    ):
        if usuario.perfil == "master":
            return

        if usuario.igreja_id != igreja.id:
            raise HTTPException(
                403,
                "Você não possui acesso a esta unidade.",
            )

    def _pode_gerenciar(
        usuario: UsuarioBanco,
        sede: IgrejaBanco,
    ) -> bool:
        if usuario.perfil == "master":
            return True

        return (
            usuario.perfil == "pastor"
            and usuario.id == sede.pastor_responsavel_id
            and usuario.igreja_id == sede.id
        )

    def _exigir_gerencia(
        usuario: UsuarioBanco,
        sede: IgrejaBanco,
    ):
        if not _pode_gerenciar(usuario, sede):
            raise HTTPException(
                403,
                "Somente o pastor presidente da sede pode administrar filiais.",
            )

    def _pastor_valido(
        banco: Session,
        usuario_id: int,
        sede_id: int,
        aceitar_filial_id: int | None = None,
    ) -> UsuarioBanco:
        pastor = banco.get(UsuarioBanco, usuario_id)

        if (
            pastor is None
            or not pastor.ativo
            or pastor.perfil != "pastor"
        ):
            raise HTTPException(
                422,
                "Selecione um usuário ativo com perfil pastor.",
            )

        igrejas_validas = {sede_id}

        if aceitar_filial_id is not None:
            igrejas_validas.add(aceitar_filial_id)

        if pastor.igreja_id not in igrejas_validas:
            raise HTTPException(
                422,
                "O pastor precisa estar vinculado à sede antes de ser designado para uma filial.",
            )

        return pastor

    @router.get("/igrejas/{igreja_id}/filiais/contexto")
    def contexto(
        igreja_id: int,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        atual = banco.get(IgrejaBanco, igreja_id)

        if atual is None:
            raise HTTPException(404, "Igreja não encontrada.")

        _autorizar_visualizacao(usuario, atual)

        sede = _sede(banco, atual)

        filiais = banco.scalars(
            select(IgrejaBanco)
            .where(IgrejaBanco.igreja_sede_id == sede.id)
            .order_by(IgrejaBanco.nome, IgrejaBanco.id)
        ).all()

        return {
            "unidade_atual": _igreja_dict(banco, atual),
            "sede": _igreja_dict(banco, sede),
            "filiais": [
                _igreja_dict(banco, item)
                for item in filiais
            ],
            "pode_gerenciar": _pode_gerenciar(
                usuario,
                sede,
            ),
            "precisa_configurar_presidente":
                sede.pastor_responsavel_id is None,
        }

    @router.get(
        "/igrejas/{igreja_id}/filiais/pastores-disponiveis"
    )
    def pastores_disponiveis(
        igreja_id: int,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        igreja = banco.get(IgrejaBanco, igreja_id)

        if igreja is None:
            raise HTTPException(404, "Igreja não encontrada.")

        sede = _sede(banco, igreja)
        _exigir_gerencia(usuario, sede)

        comando = select(UsuarioBanco).where(
            UsuarioBanco.perfil == "pastor",
            UsuarioBanco.ativo.is_(True),
            UsuarioBanco.igreja_id == sede.id,
        )

        if sede.pastor_responsavel_id:
            comando = comando.where(
                UsuarioBanco.id != sede.pastor_responsavel_id
            )

        pastores = banco.scalars(
            comando.order_by(
                UsuarioBanco.nome,
                UsuarioBanco.id,
            )
        ).all()

        return [
            _usuario_dict(pastor)
            for pastor in pastores
        ]

    @router.post(
        "/igrejas/{igreja_id}/filiais/configurar-presidente"
    )
    def configurar_presidente(
        igreja_id: int,
        dados: PastorDefinir,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        if usuario.perfil != "master":
            raise HTTPException(
                403,
                "A configuração inicial do pastor presidente é exclusiva do master.",
            )

        sede = banco.get(IgrejaBanco, igreja_id)

        if sede is None:
            raise HTTPException(
                404,
                "Igreja não encontrada.",
            )

        if sede.igreja_sede_id is not None:
            raise HTTPException(
                422,
                "O pastor presidente só pode ser definido na igreja sede.",
            )

        pastor = banco.get(
            UsuarioBanco,
            dados.pastor_usuario_id,
        )

        if (
            pastor is None
            or not pastor.ativo
            or pastor.perfil != "pastor"
        ):
            raise HTTPException(
                422,
                "Selecione um usuário ativo com perfil pastor.",
            )

        if pastor.igreja_id not in (
            None,
            sede.id,
        ):
            raise HTTPException(
                422,
                "Este pastor já pertence a outra unidade.",
            )

        sede.pastor_responsavel_id = pastor.id
        sede.presidente = pastor.nome
        pastor.igreja_id = sede.id

        banco.commit()
        banco.refresh(sede)

        return _igreja_dict(
            banco,
            sede,
        )

    @router.post(
        "/igrejas/{igreja_id}/filiais",
        status_code=status.HTTP_201_CREATED,
    )
    def criar_filial(
        igreja_id: int,
        dados: FilialCriar,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        sede = banco.get(
            IgrejaBanco,
            igreja_id,
        )

        if sede is None:
            raise HTTPException(
                404,
                "Igreja não encontrada.",
            )

        if sede.igreja_sede_id is not None:
            raise HTTPException(
                422,
                "Uma filial não pode cadastrar outra filial.",
            )

        _exigir_gerencia(
            usuario,
            sede,
        )

        nome = dados.nome.strip()

        existente = banco.scalar(
            select(IgrejaBanco).where(
                or_(
                    IgrejaBanco.id == sede.id,
                    IgrejaBanco.igreja_sede_id == sede.id,
                ),
                IgrejaBanco.nome.ilike(nome),
            )
        )

        if existente is not None:
            raise HTTPException(
                409,
                "Já existe uma unidade com esse nome nesta estrutura.",
            )

        pastor = _pastor_valido(
            banco,
            dados.pastor_responsavel_id,
            sede.id,
        )

        if pastor.id == sede.pastor_responsavel_id:
            raise HTTPException(
                422,
                "O pastor presidente não pode ser designado como responsável de uma filial.",
            )

        filial = IgrejaBanco(
            nome=nome,
            presidente=pastor.nome,
            endereco=dados.endereco.strip(),
            igreja_sede_id=sede.id,
            pastor_responsavel_id=pastor.id,
        )

        banco.add(filial)
        banco.flush()

        pastor.igreja_id = filial.id

        banco.commit()
        banco.refresh(filial)

        return _igreja_dict(
            banco,
            filial,
        )

    @router.patch(
        "/igrejas/{igreja_id}/filiais/{filial_id}/pastor"
    )
    def alterar_pastor_filial(
        igreja_id: int,
        filial_id: int,
        dados: PastorDefinir,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        sede = banco.get(
            IgrejaBanco,
            igreja_id,
        )

        if sede is None:
            raise HTTPException(
                404,
                "Igreja sede não encontrada.",
            )

        if sede.igreja_sede_id is not None:
            raise HTTPException(
                422,
                "A operação deve ser feita pela igreja sede.",
            )

        _exigir_gerencia(
            usuario,
            sede,
        )

        filial = banco.scalar(
            select(IgrejaBanco).where(
                IgrejaBanco.id == filial_id,
                IgrejaBanco.igreja_sede_id == sede.id,
            )
        )

        if filial is None:
            raise HTTPException(
                404,
                "Filial não encontrada nesta sede.",
            )

        novo = _pastor_valido(
            banco,
            dados.pastor_usuario_id,
            sede.id,
            aceitar_filial_id=filial.id,
        )

        if novo.id == sede.pastor_responsavel_id:
            raise HTTPException(
                422,
                "O pastor presidente não pode ser responsável por uma filial.",
            )

        anterior = (
            banco.get(
                UsuarioBanco,
                filial.pastor_responsavel_id,
            )
            if filial.pastor_responsavel_id
            else None
        )

        if (
            anterior is not None
            and anterior.id != novo.id
        ):
            anterior.igreja_id = sede.id

        filial.pastor_responsavel_id = novo.id
        filial.presidente = novo.nome
        novo.igreja_id = filial.id

        banco.commit()
        banco.refresh(filial)

        return _igreja_dict(
            banco,
            filial,
        )

    app.include_router(router)
