"""Gestão de sede, filiais, transferências e autoridade pastoral."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from database import obter_banco
from models import (
    AtividadeBanco,
    HistoricoVinculoMembroBanco,
    IgrejaBanco,
    MembroBanco,
    MovimentacaoFinanceiraBanco,
    UsuarioBanco,
)
from tempo import agora_local_naive


class PastorDefinir(BaseModel):
    pastor_usuario_id: int = Field(gt=0)


class FilialCriar(BaseModel):
    nome: str = Field(min_length=3, max_length=150)
    endereco: str = Field(min_length=3, max_length=250)
    pastor_responsavel_id: int = Field(gt=0)


class FilialAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=3, max_length=150)
    endereco: str | None = Field(default=None, min_length=3, max_length=250)


class FilialStatusAtualizar(BaseModel):
    ativo: bool


class MembroTransferir(BaseModel):
    membro_id: int = Field(gt=0)
    destino_igreja_id: int = Field(gt=0)
    observacao: str | None = Field(default=None, max_length=500)


def registrar_filiais(app, obter_usuario_atual):
    router = APIRouter(tags=["Sede e filiais"])

    def usuario_dict(usuario: UsuarioBanco | None):
        if usuario is None:
            return None
        return {
            "id": usuario.id,
            "nome": usuario.nome,
            "username": usuario.username,
            "perfil": usuario.perfil,
            "igreja_id": usuario.igreja_id,
        }

    def metricas_unidade(banco: Session, igreja: IgrejaBanco):
        agora = agora_local_naive()
        inicio_mes = datetime(agora.year, agora.month, 1)
        if agora.month == 12:
            inicio_proximo = datetime(agora.year + 1, 1, 1)
        else:
            inicio_proximo = datetime(agora.year, agora.month + 1, 1)

        membros_ativos = banco.scalar(
            select(func.count()).select_from(MembroBanco).where(
                MembroBanco.igreja_id == igreja.id,
                MembroBanco.status.is_(True),
            )
        ) or 0
        usuarios_ativos = banco.scalar(
            select(func.count()).select_from(UsuarioBanco).where(
                UsuarioBanco.igreja_id == igreja.id,
                UsuarioBanco.ativo.is_(True),
            )
        ) or 0
        atividades_mes = banco.scalar(
            select(func.count()).select_from(AtividadeBanco).where(
                AtividadeBanco.igreja_id == igreja.id,
                AtividadeBanco.data_hora_inicio >= inicio_mes,
                AtividadeBanco.data_hora_inicio < inicio_proximo,
            )
        ) or 0
        movimentos = banco.scalars(
            select(MovimentacaoFinanceiraBanco).where(
                MovimentacaoFinanceiraBanco.igreja_id == igreja.id,
                MovimentacaoFinanceiraBanco.data_movimentacao >= inicio_mes,
                MovimentacaoFinanceiraBanco.data_movimentacao < inicio_proximo,
            )
        ).all()
        entradas = sum(
            (m.valor for m in movimentos if m.tipo == "entrada"),
            0,
        )
        saidas = sum(
            (m.valor for m in movimentos if m.tipo == "saida"),
            0,
        )
        return {
            "membros_ativos": membros_ativos,
            "usuarios_ativos": usuarios_ativos,
            "atividades_mes": atividades_mes,
            "entradas_mes": str(entradas),
            "saidas_mes": str(saidas),
            "resultado_mes": str(entradas - saidas),
        }

    def igreja_dict(banco: Session, igreja: IgrejaBanco, incluir_metricas: bool = False):
        pastor = (
            banco.get(UsuarioBanco, igreja.pastor_responsavel_id)
            if igreja.pastor_responsavel_id
            else None
        )
        dados = {
            "id": igreja.id,
            "nome": igreja.nome,
            "endereco": igreja.endereco,
            "presidente": pastor.nome if pastor else igreja.presidente,
            "igreja_sede_id": igreja.igreja_sede_id,
            "tipo": "filial" if igreja.igreja_sede_id else "sede",
            "ativo": igreja.ativo,
            "pastor_responsavel": usuario_dict(pastor),
        }
        if incluir_metricas:
            dados["metricas"] = metricas_unidade(banco, igreja)
        return dados

    def obter_sede(banco: Session, igreja: IgrejaBanco) -> IgrejaBanco:
        if igreja.igreja_sede_id is None:
            return igreja
        sede = banco.get(IgrejaBanco, igreja.igreja_sede_id)
        if sede is None:
            raise HTTPException(409, "A sede vinculada a esta filial não foi encontrada.")
        return sede

    def autorizar_visualizacao(usuario: UsuarioBanco, igreja: IgrejaBanco):
        if usuario.perfil == "master":
            return
        if usuario.igreja_id != igreja.id:
            raise HTTPException(403, "Você não possui acesso a esta unidade.")

    def eh_presidente(usuario: UsuarioBanco, sede: IgrejaBanco) -> bool:
        return (
            usuario.perfil == "pastor"
            and usuario.id == sede.pastor_responsavel_id
            and usuario.igreja_id == sede.id
        )

    def exigir_presidente(usuario: UsuarioBanco, sede: IgrejaBanco):
        if not eh_presidente(usuario, sede):
            raise HTTPException(
                403,
                "Somente o pastor presidente da sede pode administrar filiais.",
            )

    def unidades_da_estrutura(banco: Session, sede_id: int):
        return banco.scalars(
            select(IgrejaBanco).where(
                or_(
                    IgrejaBanco.id == sede_id,
                    IgrejaBanco.igreja_sede_id == sede_id,
                )
            ).order_by(IgrejaBanco.id)
        ).all()

    def registrar_transferencia(
        banco: Session,
        membro: MembroBanco,
        destino: IgrejaBanco,
        executor: UsuarioBanco,
        motivo: str,
        observacao: str | None = None,
    ):
        origem_id = membro.igreja_id
        if origem_id == destino.id:
            return

        membro.funcoes.clear()
        membro.grupos.clear()
        banco.add(
            HistoricoVinculoMembroBanco(
                membro_id=membro.id,
                igreja_origem_id=origem_id,
                igreja_destino_id=destino.id,
                usuario_executor_id=executor.id,
                motivo=motivo,
                observacao=(observacao or "").strip() or None,
            )
        )
        membro.igreja_id = destino.id

    def transferir_membro_da_conta(
        banco: Session,
        conta: UsuarioBanco,
        destino: IgrejaBanco,
        executor: UsuarioBanco,
        motivo: str,
    ):
        if conta.membro_id is None:
            return
        membro = banco.get(MembroBanco, conta.membro_id)
        if membro is None:
            return
        registrar_transferencia(
            banco,
            membro,
            destino,
            executor,
            motivo,
            f"Transferência automática vinculada ao usuário {conta.username}.",
        )

    def pastor_disponivel(
        banco: Session,
        usuario_id: int,
        sede_id: int,
        filial_atual_id: int | None = None,
    ) -> UsuarioBanco:
        pastor = banco.get(UsuarioBanco, usuario_id)
        if pastor is None or not pastor.ativo or pastor.perfil != "pastor":
            raise HTTPException(422, "Selecione um usuário ativo com perfil pastor.")

        igrejas_validas = {sede_id}
        if filial_atual_id is not None:
            igrejas_validas.add(filial_atual_id)

        if pastor.igreja_id not in igrejas_validas:
            raise HTTPException(
                422,
                "O pastor precisa estar vinculado à sede antes de ser designado para uma filial.",
            )

        responsavel_outra = banco.scalar(
            select(IgrejaBanco).where(
                IgrejaBanco.pastor_responsavel_id == pastor.id,
                IgrejaBanco.id != (filial_atual_id or -1),
            )
        )
        if responsavel_outra is not None:
            raise HTTPException(409, "Este pastor já é responsável por outra unidade.")
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
        autorizar_visualizacao(usuario, atual)
        sede = obter_sede(banco, atual)
        filiais = banco.scalars(
            select(IgrejaBanco)
            .where(IgrejaBanco.igreja_sede_id == sede.id)
            .order_by(IgrejaBanco.nome, IgrejaBanco.id)
        ).all()
        return {
            "unidade_atual": igreja_dict(banco, atual, incluir_metricas=True),
            "sede": igreja_dict(banco, sede, incluir_metricas=True),
            "filiais": [
                igreja_dict(banco, filial, incluir_metricas=True)
                for filial in filiais
            ],
            "pode_gerenciar": eh_presidente(usuario, sede),
            "precisa_configurar_presidente": sede.pastor_responsavel_id is None,
        }

    @router.get("/igrejas/{igreja_id}/filiais/visao-consolidada")
    def visao_consolidada(
        igreja_id: int,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        sede = banco.get(IgrejaBanco, igreja_id)
        if sede is None or sede.igreja_sede_id is not None:
            raise HTTPException(404, "Igreja sede não encontrada.")
        if usuario.perfil != "master":
            exigir_presidente(usuario, sede)

        unidades = unidades_da_estrutura(banco, sede.id)
        return {
            "sede_id": sede.id,
            "unidades": [
                igreja_dict(banco, unidade, incluir_metricas=True)
                for unidade in unidades
            ],
        }

    @router.get("/igrejas/{igreja_id}/filiais/pastores-disponiveis")
    def pastores_disponiveis(
        igreja_id: int,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        sede = banco.get(IgrejaBanco, igreja_id)
        if sede is None:
            raise HTTPException(404, "Igreja sede não encontrada.")
        if sede.igreja_sede_id is not None:
            raise HTTPException(422, "A operação deve ser feita pela igreja sede.")
        exigir_presidente(usuario, sede)

        candidatos = banco.scalars(
            select(UsuarioBanco).where(
                UsuarioBanco.perfil == "pastor",
                UsuarioBanco.ativo.is_(True),
                UsuarioBanco.igreja_id == sede.id,
                UsuarioBanco.id != sede.pastor_responsavel_id,
            ).order_by(UsuarioBanco.nome, UsuarioBanco.id)
        ).all()
        usados = set(
            banco.scalars(
                select(IgrejaBanco.pastor_responsavel_id).where(
                    IgrejaBanco.pastor_responsavel_id.is_not(None)
                )
            ).all()
        )
        return [usuario_dict(p) for p in candidatos if p.id not in usados]

    @router.post("/igrejas/{igreja_id}/filiais/configurar-presidente")
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
            raise HTTPException(404, "Igreja não encontrada.")
        if sede.igreja_sede_id is not None:
            raise HTTPException(422, "O pastor presidente só pode ser definido na igreja sede.")
        if sede.pastor_responsavel_id is not None:
            raise HTTPException(409, "Esta sede já possui pastor presidente configurado.")

        pastor = banco.get(UsuarioBanco, dados.pastor_usuario_id)
        if pastor is None or not pastor.ativo or pastor.perfil != "pastor":
            raise HTTPException(422, "Selecione um usuário ativo com perfil pastor.")
        if pastor.igreja_id not in (None, sede.id):
            raise HTTPException(422, "Este pastor já pertence a outra unidade.")

        sede.pastor_responsavel_id = pastor.id
        sede.presidente = pastor.nome
        pastor.igreja_id = sede.id
        transferir_membro_da_conta(
            banco,
            pastor,
            sede,
            usuario,
            "designacao_presidente",
        )
        banco.commit()
        banco.refresh(sede)
        return igreja_dict(banco, sede, incluir_metricas=True)

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
        sede = banco.get(IgrejaBanco, igreja_id)
        if sede is None:
            raise HTTPException(404, "Igreja não encontrada.")
        if sede.igreja_sede_id is not None:
            raise HTTPException(422, "Uma filial não pode cadastrar outra filial.")
        exigir_presidente(usuario, sede)

        nome = dados.nome.strip()
        existente = banco.scalar(
            select(IgrejaBanco).where(
                or_(IgrejaBanco.id == sede.id, IgrejaBanco.igreja_sede_id == sede.id),
                IgrejaBanco.nome.ilike(nome),
            )
        )
        if existente is not None:
            raise HTTPException(409, "Já existe uma unidade com esse nome nesta estrutura.")

        pastor = pastor_disponivel(banco, dados.pastor_responsavel_id, sede.id)
        filial = IgrejaBanco(
            nome=nome,
            presidente=pastor.nome,
            endereco=dados.endereco.strip(),
            igreja_sede_id=sede.id,
            pastor_responsavel_id=pastor.id,
            ativo=True,
        )
        banco.add(filial)
        banco.flush()

        pastor.igreja_id = filial.id
        transferir_membro_da_conta(
            banco,
            pastor,
            filial,
            usuario,
            "designacao_pastor_filial",
        )
        banco.commit()
        banco.refresh(filial)
        return igreja_dict(banco, filial, incluir_metricas=True)

    @router.patch("/igrejas/{igreja_id}/filiais/{filial_id}")
    def atualizar_filial(
        igreja_id: int,
        filial_id: int,
        dados: FilialAtualizar,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        sede = banco.get(IgrejaBanco, igreja_id)
        if sede is None or sede.igreja_sede_id is not None:
            raise HTTPException(404, "Igreja sede não encontrada.")
        exigir_presidente(usuario, sede)

        filial = banco.scalar(
            select(IgrejaBanco).where(
                IgrejaBanco.id == filial_id,
                IgrejaBanco.igreja_sede_id == sede.id,
            )
        )
        if filial is None:
            raise HTTPException(404, "Filial não encontrada.")

        recebidos = dados.model_dump(exclude_unset=True)
        if "nome" in recebidos:
            nome = recebidos["nome"].strip()
            duplicada = banco.scalar(
                select(IgrejaBanco).where(
                    IgrejaBanco.id != filial.id,
                    or_(
                        IgrejaBanco.id == sede.id,
                        IgrejaBanco.igreja_sede_id == sede.id,
                    ),
                    IgrejaBanco.nome.ilike(nome),
                )
            )
            if duplicada is not None:
                raise HTTPException(409, "Já existe outra unidade com esse nome.")
            filial.nome = nome
        if "endereco" in recebidos:
            filial.endereco = recebidos["endereco"].strip()

        banco.commit()
        banco.refresh(filial)
        return igreja_dict(banco, filial, incluir_metricas=True)

    @router.patch("/igrejas/{igreja_id}/filiais/{filial_id}/status")
    def alterar_status_filial(
        igreja_id: int,
        filial_id: int,
        dados: FilialStatusAtualizar,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        sede = banco.get(IgrejaBanco, igreja_id)
        if sede is None or sede.igreja_sede_id is not None:
            raise HTTPException(404, "Igreja sede não encontrada.")
        exigir_presidente(usuario, sede)

        filial = banco.scalar(
            select(IgrejaBanco).where(
                IgrejaBanco.id == filial_id,
                IgrejaBanco.igreja_sede_id == sede.id,
            )
        )
        if filial is None:
            raise HTTPException(404, "Filial não encontrada.")

        filial.ativo = dados.ativo
        banco.commit()
        banco.refresh(filial)
        return igreja_dict(banco, filial, incluir_metricas=True)

    @router.patch("/igrejas/{igreja_id}/filiais/{filial_id}/pastor")
    def alterar_pastor_filial(
        igreja_id: int,
        filial_id: int,
        dados: PastorDefinir,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        sede = banco.get(IgrejaBanco, igreja_id)
        if sede is None or sede.igreja_sede_id is not None:
            raise HTTPException(404, "Igreja sede não encontrada.")
        exigir_presidente(usuario, sede)

        filial = banco.scalar(
            select(IgrejaBanco).where(
                IgrejaBanco.id == filial_id,
                IgrejaBanco.igreja_sede_id == sede.id,
            )
        )
        if filial is None:
            raise HTTPException(404, "Filial não encontrada nesta sede.")

        novo = pastor_disponivel(
            banco,
            dados.pastor_usuario_id,
            sede.id,
            filial_atual_id=filial.id,
        )
        anterior = (
            banco.get(UsuarioBanco, filial.pastor_responsavel_id)
            if filial.pastor_responsavel_id
            else None
        )

        if anterior is not None and anterior.id != novo.id:
            anterior.igreja_id = sede.id
            transferir_membro_da_conta(
                banco,
                anterior,
                sede,
                usuario,
                "retorno_pastor_sede",
            )

        filial.pastor_responsavel_id = novo.id
        filial.presidente = novo.nome
        novo.igreja_id = filial.id
        transferir_membro_da_conta(
            banco,
            novo,
            filial,
            usuario,
            "designacao_pastor_filial",
        )

        banco.commit()
        banco.refresh(filial)
        return igreja_dict(banco, filial, incluir_metricas=True)

    @router.post("/igrejas/{igreja_id}/filiais/transferir-membro")
    def transferir_membro(
        igreja_id: int,
        dados: MembroTransferir,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        sede = banco.get(IgrejaBanco, igreja_id)
        if sede is None or sede.igreja_sede_id is not None:
            raise HTTPException(404, "Igreja sede não encontrada.")
        exigir_presidente(usuario, sede)

        unidades = {u.id: u for u in unidades_da_estrutura(banco, sede.id)}
        destino = unidades.get(dados.destino_igreja_id)
        if destino is None:
            raise HTTPException(422, "A unidade de destino não pertence a esta sede.")
        if not destino.ativo:
            raise HTTPException(409, "A unidade de destino está desativada.")

        membro = banco.get(MembroBanco, dados.membro_id)
        if membro is None or membro.igreja_id not in unidades:
            raise HTTPException(404, "Membro não encontrado na estrutura desta sede.")
        if membro.igreja_id == destino.id:
            raise HTTPException(409, "O membro já pertence à unidade de destino.")

        conta = banco.scalar(
            select(UsuarioBanco).where(UsuarioBanco.membro_id == membro.id)
        )
        if conta is not None and conta.perfil != "master":
            unidade_responsavel = banco.scalar(
                select(IgrejaBanco).where(
                    IgrejaBanco.pastor_responsavel_id == conta.id
                )
            )
            if unidade_responsavel is not None and unidade_responsavel.id != destino.id:
                raise HTTPException(
                    409,
                    "Este membro possui uma conta pastoral responsável por outra unidade. "
                    "Altere o pastor responsável antes da transferência.",
                )

        origem_id = membro.igreja_id
        registrar_transferencia(
            banco,
            membro,
            destino,
            usuario,
            "transferencia_membro",
            dados.observacao,
        )
        if conta is not None and conta.perfil != "master":
            conta.igreja_id = destino.id

        banco.commit()
        return {
            "membro_id": membro.id,
            "igreja_origem_id": origem_id,
            "igreja_destino_id": destino.id,
            "mensagem": "Membro transferido com histórico preservado.",
        }

    app.include_router(router)
