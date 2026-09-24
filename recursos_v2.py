"""Recursos da versão 2 do Papper.

Inclui recorrência de atividades, dashboard consolidado, logo da igreja
persistida no banco e depósitos internos por envelope com visto pastoral.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from io import BytesIO
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import obter_banco
from models import (
    AtividadeBanco,
    DepositoEnvelopeBanco,
    IgrejaBanco,
    MembroBanco,
    MovimentacaoFinanceiraBanco,
    UsuarioBanco,
)

DIAS_SEMANA = {
    "segunda": 0,
    "terca": 1,
    "quarta": 2,
    "quinta": 3,
    "sexta": 4,
    "sabado": 5,
    "domingo": 6,
}

TIPOS_ARQUIVO = {"application/pdf", "image/png", "image/jpeg"}
TIPOS_LOGO = {"image/png", "image/jpeg", "image/webp"}
MAX_COMPROVANTE = 5 * 1024 * 1024
MAX_LOGO = 2 * 1024 * 1024


class AtividadeRecorrenteCriar(BaseModel):
    titulo: str = Field(min_length=3, max_length=150)
    tipo: str = Field(min_length=2, max_length=50)
    descricao: str | None = Field(default=None, max_length=2000)
    data_hora_inicio: datetime
    data_hora_fim: datetime | None = None
    local: str | None = Field(default=None, max_length=150)
    observacoes: str | None = Field(default=None, max_length=2000)
    igreja_id: int
    dias_semana: list[Literal[
        "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"
    ]] = Field(min_length=1, max_length=7)
    data_fim_recorrencia: date

    @model_validator(mode="after")
    def validar_datas(self):
        if self.data_hora_fim and self.data_hora_fim < self.data_hora_inicio:
            raise ValueError("A data final da atividade não pode ser anterior ao início.")
        if self.data_fim_recorrencia < self.data_hora_inicio.date():
            raise ValueError("O fim da recorrência não pode ser anterior à primeira atividade.")
        if (self.data_fim_recorrencia - self.data_hora_inicio.date()).days > 370:
            raise ValueError("A recorrência pode ser criada por no máximo 370 dias de cada vez.")
        return self


class VistoEnvelope(BaseModel):
    observacao: str | None = Field(default=None, max_length=1000)


def _atividade_dict(item: AtividadeBanco) -> dict:
    return {
        "id": item.id,
        "titulo": item.titulo,
        "tipo": item.tipo,
        "descricao": item.descricao,
        "data_hora_inicio": item.data_hora_inicio,
        "data_hora_fim": item.data_hora_fim,
        "local": item.local,
        "status": item.status,
        "observacoes": item.observacoes,
        "igreja_id": item.igreja_id,
        "serie_recorrencia_id": item.serie_recorrencia_id,
    }


def _envelope_dict(item: DepositoEnvelopeBanco, nomes: dict[int, str] | None = None) -> dict:
    nomes = nomes or {}
    return {
        "id": item.id,
        "numero": item.numero,
        "codigo": f"ENV-{item.numero:06d}",
        "valor": str(item.valor),
        "data_deposito": item.data_deposito,
        "status": item.status,
        "observacao": item.observacao,
        "visto_observacao": item.visto_observacao,
        "criado_em": item.criado_em,
        "aprovado_em": item.aprovado_em,
        "igreja_id": item.igreja_id,
        "criado_por_id": item.criado_por_id,
        "criado_por": nomes.get(item.criado_por_id),
        "aprovado_por_id": item.aprovado_por_id,
        "aprovado_por": nomes.get(item.aprovado_por_id) if item.aprovado_por_id else None,
        "comprovante_nome": item.comprovante_nome,
        "tem_comprovante": bool(item.comprovante_dados),
    }


def registrar_recursos_v2(app, obter_usuario_atual, validar_igreja_do_usuario, exigir_perfis):
    router = APIRouter(tags=["Gestão v2"])

    @router.post("/atividades/recorrentes", status_code=status.HTTP_201_CREATED)
    def criar_atividades_recorrentes(
        dados: AtividadeRecorrenteCriar,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(
            exigir_perfis("administrador", "pastor", "secretaria", "lider")
        ),
    ):
        validar_igreja_do_usuario(usuario, dados.igreja_id)
        if banco.get(IgrejaBanco, dados.igreja_id) is None:
            raise HTTPException(404, "Igreja não encontrada.")

        dias = {DIAS_SEMANA[dia] for dia in dados.dias_semana}
        duracao = None
        if dados.data_hora_fim:
            duracao = dados.data_hora_fim - dados.data_hora_inicio

        serie = str(uuid4())
        cursor = dados.data_hora_inicio.date()
        atividades = []

        while cursor <= dados.data_fim_recorrencia:
            if cursor.weekday() in dias:
                inicio = datetime.combine(cursor, dados.data_hora_inicio.time())
                fim = inicio + duracao if duracao is not None else None
                item = AtividadeBanco(
                    titulo=dados.titulo,
                    tipo=dados.tipo,
                    descricao=dados.descricao,
                    data_hora_inicio=inicio,
                    data_hora_fim=fim,
                    local=dados.local,
                    observacoes=dados.observacoes,
                    igreja_id=dados.igreja_id,
                    serie_recorrencia_id=serie,
                )
                banco.add(item)
                atividades.append(item)
                if len(atividades) > 100:
                    raise HTTPException(422, "A recorrência gerou mais de 100 atividades. Reduza o período.")
            cursor += timedelta(days=1)

        if not atividades:
            raise HTTPException(422, "Nenhuma ocorrência corresponde aos dias escolhidos.")

        banco.commit()
        for item in atividades:
            banco.refresh(item)

        return {
            "serie_recorrencia_id": serie,
            "quantidade": len(atividades),
            "atividades": [_atividade_dict(item) for item in atividades],
        }

    @router.patch("/igrejas/{igreja_id}/atividades/{atividade_id}/realizar")
    def realizar_atividade(
        igreja_id: int,
        atividade_id: int,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(
            exigir_perfis("administrador", "pastor", "secretaria", "lider")
        ),
    ):
        validar_igreja_do_usuario(usuario, igreja_id)
        atividade = banco.scalar(
            select(AtividadeBanco).where(
                AtividadeBanco.id == atividade_id,
                AtividadeBanco.igreja_id == igreja_id,
            )
        )
        if atividade is None:
            raise HTTPException(404, "Atividade não encontrada nesta igreja.")
        if atividade.status == "cancelado":
            raise HTTPException(409, "Uma atividade cancelada não pode ser marcada como realizada.")
        atividade.status = "realizado"
        banco.commit()
        banco.refresh(atividade)
        return _atividade_dict(atividade)

    @router.get("/igrejas/{igreja_id}/logo")
    def obter_logo(
        igreja_id: int,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        validar_igreja_do_usuario(usuario, igreja_id)
        igreja = banco.get(IgrejaBanco, igreja_id)
        if igreja is None or not igreja.logo_dados:
            raise HTTPException(404, "Logo não cadastrada.")
        return Response(
            content=igreja.logo_dados,
            media_type=igreja.logo_mime or "image/png",
            headers={"Cache-Control": "private, max-age=300"},
        )

    @router.post("/igrejas/{igreja_id}/logo")
    async def atualizar_logo(
        igreja_id: int,
        arquivo: UploadFile = File(...),
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(exigir_perfis("administrador", "pastor")),
    ):
        validar_igreja_do_usuario(usuario, igreja_id)
        igreja = banco.get(IgrejaBanco, igreja_id)
        if igreja is None:
            raise HTTPException(404, "Igreja não encontrada.")
        if arquivo.content_type not in TIPOS_LOGO:
            raise HTTPException(422, "A logo deve ser PNG, JPG/JPEG ou WEBP.")
        dados = await arquivo.read(MAX_LOGO + 1)
        if len(dados) > MAX_LOGO:
            raise HTTPException(422, "A logo deve possuir no máximo 2 MB.")
        if not dados:
            raise HTTPException(422, "O arquivo da logo está vazio.")
        igreja.logo_dados = dados
        igreja.logo_mime = arquivo.content_type
        banco.commit()
        return {"mensagem": "Logo atualizada.", "tem_logo": True}

    @router.get("/igrejas/{igreja_id}/dashboard")
    def dashboard(
        igreja_id: int,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        validar_igreja_do_usuario(usuario, igreja_id)
        igreja = banco.get(IgrejaBanco, igreja_id)
        if igreja is None:
            raise HTTPException(404, "Igreja não encontrada.")

        agora = datetime.now()
        inicio_mes = datetime(agora.year, agora.month, 1)
        if agora.month == 12:
            inicio_proximo = datetime(agora.year + 1, 1, 1)
        else:
            inicio_proximo = datetime(agora.year, agora.month + 1, 1)
        inicio_fluxo = (agora - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
        fim_calendario = agora + timedelta(days=45)

        membros_ativos = banco.scalar(
            select(func.count()).select_from(MembroBanco).where(
                MembroBanco.igreja_id == igreja_id,
                MembroBanco.status.is_(True),
            )
        ) or 0
        membros_novos = banco.scalar(
            select(func.count()).select_from(MembroBanco).where(
                MembroBanco.igreja_id == igreja_id,
                MembroBanco.criado_em >= inicio_mes,
                MembroBanco.criado_em < inicio_proximo,
            )
        ) or 0
        novos_lista = banco.scalars(
            select(MembroBanco).where(
                MembroBanco.igreja_id == igreja_id,
                MembroBanco.criado_em >= inicio_mes,
            ).order_by(MembroBanco.criado_em.desc()).limit(6)
        ).all()

        atividades_calendario = banco.scalars(
            select(AtividadeBanco).where(
                AtividadeBanco.igreja_id == igreja_id,
                AtividadeBanco.data_hora_inicio >= agora.replace(hour=0, minute=0, second=0, microsecond=0),
                AtividadeBanco.data_hora_inicio <= fim_calendario,
                AtividadeBanco.status != "cancelado",
            ).order_by(AtividadeBanco.data_hora_inicio).limit(30)
        ).all()
        proximas = [a for a in atividades_calendario if a.data_hora_inicio >= agora][:8]

        visitas_mes = banco.scalars(
            select(AtividadeBanco).where(
                AtividadeBanco.igreja_id == igreja_id,
                func.lower(AtividadeBanco.tipo) == "visita",
                AtividadeBanco.data_hora_inicio >= inicio_mes,
                AtividadeBanco.data_hora_inicio < inicio_proximo,
            ).order_by(AtividadeBanco.data_hora_inicio.desc())
        ).all()
        visitas_realizadas = sum(1 for v in visitas_mes if v.status == "realizado")
        visitas_agendadas = sum(1 for v in visitas_mes if v.status == "agendado")

        financeiro_permitido = usuario.perfil in ("master", "administrador", "pastor", "tesoureiro")
        total_entradas = Decimal("0.00")
        total_saidas = Decimal("0.00")
        fluxo = []
        recentes = []
        caixa_fisico = Decimal("0.00")
        cofre = Decimal("0.00")
        envelopes_pendentes = Decimal("0.00")

        if financeiro_permitido:
            mov_mes = banco.scalars(
                select(MovimentacaoFinanceiraBanco).where(
                    MovimentacaoFinanceiraBanco.igreja_id == igreja_id,
                    MovimentacaoFinanceiraBanco.data_movimentacao >= inicio_mes,
                    MovimentacaoFinanceiraBanco.data_movimentacao < inicio_proximo,
                ).order_by(MovimentacaoFinanceiraBanco.data_movimentacao.desc())
            ).all()
            total_entradas = sum((m.valor for m in mov_mes if m.tipo == "entrada"), Decimal("0.00"))
            total_saidas = sum((m.valor for m in mov_mes if m.tipo == "saida"), Decimal("0.00"))

            mov_fluxo = banco.scalars(
                select(MovimentacaoFinanceiraBanco).where(
                    MovimentacaoFinanceiraBanco.igreja_id == igreja_id,
                    MovimentacaoFinanceiraBanco.data_movimentacao >= inicio_fluxo,
                ).order_by(MovimentacaoFinanceiraBanco.data_movimentacao)
            ).all()
            agrupado = defaultdict(lambda: [Decimal("0.00"), Decimal("0.00")])
            for mov in mov_fluxo:
                chave = mov.data_movimentacao.date().isoformat()
                agrupado[chave][0 if mov.tipo == "entrada" else 1] += mov.valor
            fluxo = [
                {"data": chave, "entradas": str(valores[0]), "saidas": str(valores[1])}
                for chave, valores in sorted(agrupado.items())
            ]

            recentes = [
                {
                    "id": m.id,
                    "data": m.data_movimentacao,
                    "tipo": m.tipo,
                    "categoria": m.categoria,
                    "descricao": m.descricao,
                    "valor": str(m.valor),
                }
                for m in mov_mes[:8]
            ]

            mov_dinheiro = banco.scalars(
                select(MovimentacaoFinanceiraBanco).where(
                    MovimentacaoFinanceiraBanco.igreja_id == igreja_id,
                    func.lower(MovimentacaoFinanceiraBanco.forma_pagamento) == "dinheiro",
                )
            ).all()
            saldo_dinheiro = sum(
                (m.valor if m.tipo == "entrada" else -m.valor for m in mov_dinheiro),
                Decimal("0.00"),
            )
            envelopes = banco.scalars(
                select(DepositoEnvelopeBanco).where(
                    DepositoEnvelopeBanco.igreja_id == igreja_id,
                    DepositoEnvelopeBanco.status != "rejeitado",
                )
            ).all()
            transferido = sum((e.valor for e in envelopes), Decimal("0.00"))
            caixa_fisico = saldo_dinheiro - transferido
            cofre = transferido
            envelopes_pendentes = sum(
                (e.valor for e in envelopes if e.status == "aguardando_visto"),
                Decimal("0.00"),
            )

        return {
            "igreja": {
                "id": igreja.id,
                "nome": igreja.nome,
                "presidente": igreja.presidente,
                "tem_logo": bool(igreja.logo_dados),
                "logo_url": f"/igrejas/{igreja.id}/logo" if igreja.logo_dados else None,
            },
            "membros_ativos": membros_ativos,
            "membros_novos_mes": membros_novos,
            "novos_membros": [
                {"id": m.id, "nome": m.nome, "contato": m.contato, "criado_em": m.criado_em}
                for m in novos_lista
            ],
            "proximas_atividades": [_atividade_dict(a) for a in proximas],
            "calendario": [_atividade_dict(a) for a in atividades_calendario],
            "visitas_agendadas_mes": visitas_agendadas,
            "visitas_realizadas_mes": visitas_realizadas,
            "visitas": [_atividade_dict(v) for v in visitas_mes[:8]],
            "financeiro_permitido": financeiro_permitido,
            "financeiro": {
                "entradas_mes": str(total_entradas),
                "saidas_mes": str(total_saidas),
                "resultado_mes": str(total_entradas - total_saidas),
                "caixa_fisico_estimado": str(caixa_fisico),
                "cofre_estimado": str(cofre),
                "envelopes_aguardando_visto": str(envelopes_pendentes),
                "fluxo_30_dias": fluxo,
                "movimentacoes_recentes": recentes,
            },
        }

    @router.post("/igrejas/{igreja_id}/financeiro/envelopes", status_code=status.HTTP_201_CREATED)
    async def criar_envelope(
        igreja_id: int,
        valor: Decimal = Form(...),
        data_deposito: datetime = Form(...),
        observacao: str | None = Form(default=None),
        comprovante: UploadFile = File(...),
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(exigir_perfis("administrador", "pastor", "tesoureiro")),
    ):
        validar_igreja_do_usuario(usuario, igreja_id)
        igreja = banco.scalar(
            select(IgrejaBanco).where(IgrejaBanco.id == igreja_id).with_for_update()
        )
        if igreja is None:
            raise HTTPException(404, "Igreja não encontrada.")
        if valor <= 0:
            raise HTTPException(422, "O valor do envelope deve ser maior que zero.")
        if comprovante.content_type not in TIPOS_ARQUIVO:
            raise HTTPException(422, "O comprovante deve ser PDF, PNG ou JPG/JPEG.")
        conteudo = await comprovante.read(MAX_COMPROVANTE + 1)
        if len(conteudo) > MAX_COMPROVANTE:
            raise HTTPException(422, "O comprovante deve possuir no máximo 5 MB.")
        if not conteudo:
            raise HTTPException(422, "O comprovante é obrigatório.")

        atual = banco.scalar(
            select(func.max(DepositoEnvelopeBanco.numero)).where(
                DepositoEnvelopeBanco.igreja_id == igreja_id
            )
        ) or 0
        envelope = DepositoEnvelopeBanco(
            numero=atual + 1,
            valor=valor,
            data_deposito=data_deposito,
            observacao=(observacao or "").strip() or None,
            comprovante_nome=(comprovante.filename or "comprovante")[0:255],
            comprovante_mime=comprovante.content_type,
            comprovante_dados=conteudo,
            igreja_id=igreja_id,
            criado_por_id=usuario.id,
        )
        banco.add(envelope)
        banco.commit()
        banco.refresh(envelope)
        return _envelope_dict(envelope, {usuario.id: usuario.nome})

    @router.get("/igrejas/{igreja_id}/financeiro/envelopes")
    def listar_envelopes(
        igreja_id: int,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(exigir_perfis("administrador", "pastor", "tesoureiro")),
    ):
        validar_igreja_do_usuario(usuario, igreja_id)
        itens = banco.scalars(
            select(DepositoEnvelopeBanco).where(
                DepositoEnvelopeBanco.igreja_id == igreja_id
            ).order_by(DepositoEnvelopeBanco.numero.desc()).limit(300)
        ).all()
        ids = {i.criado_por_id for i in itens} | {i.aprovado_por_id for i in itens if i.aprovado_por_id}
        nomes = dict(banco.execute(select(UsuarioBanco.id, UsuarioBanco.nome).where(UsuarioBanco.id.in_(ids))).all()) if ids else {}
        return [_envelope_dict(i, nomes) for i in itens]

    @router.get("/igrejas/{igreja_id}/financeiro/envelopes/{envelope_id}/comprovante")
    def comprovante_envelope(
        igreja_id: int,
        envelope_id: int,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(exigir_perfis("administrador", "pastor", "tesoureiro")),
    ):
        validar_igreja_do_usuario(usuario, igreja_id)
        item = banco.scalar(
            select(DepositoEnvelopeBanco).where(
                DepositoEnvelopeBanco.id == envelope_id,
                DepositoEnvelopeBanco.igreja_id == igreja_id,
            )
        )
        if item is None:
            raise HTTPException(404, "Envelope não encontrado.")
        return Response(
            content=item.comprovante_dados,
            media_type=item.comprovante_mime,
            headers={
                "Content-Disposition": f'inline; filename="{item.comprovante_nome}"',
                "Cache-Control": "no-store",
            },
        )

    def _buscar_envelope(banco: Session, igreja_id: int, envelope_id: int):
        item = banco.scalar(
            select(DepositoEnvelopeBanco).where(
                DepositoEnvelopeBanco.id == envelope_id,
                DepositoEnvelopeBanco.igreja_id == igreja_id,
            )
        )
        if item is None:
            raise HTTPException(404, "Envelope não encontrado.")
        return item

    def _exigir_responsavel_unidade(
        banco: Session,
        usuario: UsuarioBanco,
        igreja_id: int,
    ) -> IgrejaBanco:
        igreja = banco.get(IgrejaBanco, igreja_id)
        if igreja is None:
            raise HTTPException(404, "Igreja não encontrada.")

        if (
            usuario.perfil != "pastor"
            or igreja.pastor_responsavel_id is None
            or igreja.pastor_responsavel_id != usuario.id
        ):
            raise HTTPException(
                403,
                "Somente o pastor responsável por esta unidade pode dar o visto no envelope.",
            )

        return igreja

    @router.post("/igrejas/{igreja_id}/financeiro/envelopes/{envelope_id}/aprovar")
    def aprovar_envelope(
        igreja_id: int,
        envelope_id: int,
        dados: VistoEnvelope,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        validar_igreja_do_usuario(usuario, igreja_id)
        _exigir_responsavel_unidade(banco, usuario, igreja_id)
        item = _buscar_envelope(banco, igreja_id, envelope_id)
        if item.status != "aguardando_visto":
            raise HTTPException(409, "Este envelope já foi analisado.")
        item.status = "aprovado"
        item.visto_observacao = dados.observacao
        item.aprovado_por_id = usuario.id
        item.aprovado_em = datetime.now()
        banco.commit()
        banco.refresh(item)
        return _envelope_dict(item, {usuario.id: usuario.nome})

    @router.post("/igrejas/{igreja_id}/financeiro/envelopes/{envelope_id}/rejeitar")
    def rejeitar_envelope(
        igreja_id: int,
        envelope_id: int,
        dados: VistoEnvelope,
        banco: Session = Depends(obter_banco),
        usuario: UsuarioBanco = Depends(obter_usuario_atual),
    ):
        validar_igreja_do_usuario(usuario, igreja_id)
        _exigir_responsavel_unidade(banco, usuario, igreja_id)
        item = _buscar_envelope(banco, igreja_id, envelope_id)
        if item.status != "aguardando_visto":
            raise HTTPException(409, "Este envelope já foi analisado.")
        item.status = "rejeitado"
        item.visto_observacao = dados.observacao
        item.aprovado_por_id = usuario.id
        item.aprovado_em = datetime.now()
        banco.commit()
        banco.refresh(item)
        return _envelope_dict(item, {usuario.id: usuario.nome})

    app.include_router(router)
