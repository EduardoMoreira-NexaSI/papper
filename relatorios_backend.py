"""Relatórios Papper. Instale com registrar_relatorios(app, obter_usuario_atual).

Consultas ficam em memória por 15 minutos: use um processo Uvicorn.
Reiniciar a API ou esgotar o cache exige consultar novamente antes do PDF.
Nenhuma tabela é criada ou alterada por este módulo.
"""
from collections import OrderedDict, defaultdict
from copy import deepcopy
from datetime import date, datetime, time, timezone
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from secrets import token_urlsafe
from threading import Lock
from time import monotonic
from typing import Literal
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database import obter_banco
from models import (IgrejaBanco, MembroBanco, FuncaoBanco, GrupoBanco,
                    AtividadeBanco, PresencaBanco, MovimentacaoFinanceiraBanco,
                    DepositoEnvelopeBanco, UsuarioBanco)

TODOS = ("membros", "financeiro", "atividades", "frequencia", "funcoes", "grupos")
# Política explícita para exportação em massa; cargos de membros não são perfis.
PERFIS = {
    "master": TODOS,
    "administrador": TODOS,
    "pastor": TODOS,
    "secretaria": ("membros", "atividades", "frequencia", "funcoes", "grupos"),
    "tesoureiro": ("financeiro",),
}
LIMITE = 5000
ZERO = Decimal("0.00")
FONT_LOCK = Lock()


class FiltrosRelatorio(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    tipo_relatorio: Literal["membros", "financeiro", "atividades", "frequencia", "funcoes", "grupos"]
    titulo: str = Field(min_length=1, max_length=120)
    data_inicio: date | None = None
    data_fim: date | None = None
    pdf_orientacao: Literal["retrato", "paisagem"] = "retrato"
    pdf_assinatura: Literal["nenhuma", "responsavel", "pastor", "tesoureiro"] = "nenhuma"
    pdf_observacoes: str = Field(default="", max_length=1000)
    membros_situacao: Literal["todos", "ativos", "inativos"] = "todos"
    membros_pesquisa: str = Field(default="", max_length=150)
    membros_funcao: str = ""
    membros_grupo: str = ""
    membros_estado: str = Field(default="", max_length=2)
    membros_cidade: str = Field(default="", max_length=100)
    membros_bairro: str = Field(default="", max_length=100)
    membros_logradouro: str = Field(default="", max_length=180)
    membros_idade_minima: int | None = Field(default=None, ge=0, le=130)
    membros_idade_maxima: int | None = Field(default=None, ge=0, le=130)
    membros_mes_aniversario: int | None = Field(default=None, ge=1, le=12)
    membros_ordenacao: Literal["nome", "bairro", "cidade", "nascimento"] = "nome"
    membros_incluir_contato: bool = False
    membros_incluir_endereco: bool = False
    membros_incluir_nascimento: bool = False
    membros_exibicao_cpf: Literal["oculto", "mascarado", "completo"] = "oculto"
    financeiro_modelo: Literal["resumo", "extrato", "fluxo", "categorias", "membro", "envelopes"] = "resumo"
    financeiro_tipo: Literal["", "entrada", "saida"] = ""
    financeiro_categoria: Literal["", "dizimo", "oferta", "doacao", "despesa", "outro"] = ""
    financeiro_forma_pagamento: str = Field(default="", max_length=30)
    financeiro_membro: str = ""
    financeiro_atividade: str = ""
    financeiro_agrupamento: Literal["dia", "mes"] = "dia"
    financeiro_identificar_membros: bool = False
    atividades_tipo: str = Field(default="", max_length=50)
    atividades_status: str = Field(default="", max_length=30)
    atividades_pesquisa: str = Field(default="", max_length=150)
    atividades_local: str = Field(default="", max_length=150)
    atividades_incluir_observacoes: bool = False
    frequencia_modelo: Literal["atividade", "membro", "resumo"] = "atividade"
    frequencia_atividade: str = ""
    frequencia_membro: str = ""
    frequencia_status: Literal["", "presente", "ausente", "justificado", "confirmado"] = ""
    frequencia_grupo: str = ""
    frequencia_funcao: str = ""
    funcoes_situacao: Literal["todas", "ativas", "inativas"] = "todas"
    funcoes_selecao: str = ""
    funcoes_situacao_membro: Literal["todos", "ativos", "inativos"] = "todos"
    funcoes_incluir_membros: bool = True
    grupos_situacao: Literal["todos", "ativos", "inativos"] = "todos"
    grupos_selecao: str = ""
    grupos_lideranca: Literal["todos", "com_lider", "sem_lider"] = "todos"
    grupos_situacao_membro: Literal["todos", "ativos", "inativos"] = "todos"
    grupos_incluir_integrantes: bool = True

    @field_validator("data_inicio", "data_fim", "membros_idade_minima",
                     "membros_idade_maxima", "membros_mes_aniversario", mode="before")
    @classmethod
    def vazio_para_none(cls, valor):
        return None if valor == "" else valor

    @model_validator(mode="after")
    def validar_intervalos(self):
        if self.tipo_relatorio in ("financeiro", "atividades", "frequencia"):
            if not self.data_inicio or not self.data_fim:
                raise ValueError("Informe as duas datas do período.")
        if self.data_inicio and self.data_fim and self.data_inicio > self.data_fim:
            raise ValueError("A data inicial não pode superar a final.")
        if (self.membros_idade_minima is not None and self.membros_idade_maxima is not None
                and self.membros_idade_minima > self.membros_idade_maxima):
            raise ValueError("A idade mínima não pode superar a máxima.")
        return self


class PedidoPDF(BaseModel):
    model_config = ConfigDict(extra="forbid")
    consulta_id: str = Field(min_length=20, max_length=100)


def permissoes(usuario):
    return {
        "cpf_completo": usuario.perfil in ("master", "administrador", "pastor", "secretaria"),
        "identificar_membros_financeiro": usuario.perfil in ("master", "administrador", "pastor", "tesoureiro"),
        "observacoes_internas": usuario.perfil in ("master", "administrador", "pastor"),
    }


def autorizar(banco, usuario, igreja_id, tipo=None):
    if not usuario.ativo or (
        usuario.perfil != "master" and usuario.igreja_id != igreja_id
    ):
        raise HTTPException(403, "Você não tem acesso aos relatórios desta igreja.")
    tipos = PERFIS.get(usuario.perfil, ())
    if not tipos or (tipo is not None and tipo not in tipos):
        raise HTTPException(403, "Seu perfil não pode emitir este relatório.")
    igreja = banco.get(IgrejaBanco, igreja_id)
    if igreja is None:
        raise HTTPException(404, "Igreja não encontrada.")
    return igreja


def registros(banco, comando):
    itens = banco.scalars(comando.limit(LIMITE + 1)).all()
    if len(itens) > LIMITE:
        raise HTTPException(422, "Consulta excede 5.000 registros. Refine os filtros; nenhum resultado foi truncado.")
    return itens


def vinculo(banco, modelo, valor, igreja_id, especial=""):
    if valor in ("", especial):
        return None
    if not valor.isdecimal() or int(valor) < 1:
        raise HTTPException(422, "Identificador de filtro inválido.")
    obj = banco.scalar(select(modelo).where(modelo.id == int(valor), modelo.igreja_id == igreja_id))
    if obj is None:
        raise HTTPException(404, "Vínculo do filtro não encontrado nesta igreja.")
    return obj


def moeda(valor):
    return "R$ " + f"{valor:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")


def data_br(valor):
    if not valor:
        return "Não informado"
    return valor.strftime("%d/%m/%Y %H:%M" if isinstance(valor, datetime) else "%d/%m/%Y")


def coluna(chave, rotulo, numerica=False):
    return {"chave": chave, "rotulo": rotulo, "alinhamento": "direita" if numerica else "esquerda"}


def periodo(comando, campo, f):
    return comando.where(campo >= datetime.combine(f.data_inicio, time.min),
                         campo <= datetime.combine(f.data_fim, time.max))


def situacao(comando, campo, valor):
    if valor in ("ativos", "ativas"):
        return comando.where(campo.is_(True))
    if valor in ("inativos", "inativas"):
        return comando.where(campo.is_(False))
    return comando


def contem(campo, texto):
    # Escape os curingas SQL: pesquisar '%' não deve retornar todos os membros.
    texto = texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return campo.ilike("%" + texto + "%", escape="\\")


def filtro_associacao(banco, comando, fvalor, modelo, relacao, igreja_id, especial):
    obj = vinculo(banco, modelo, fvalor, igreja_id, especial)
    if fvalor == especial:
        return comando.where(~relacao.any(modelo.igreja_id == igreja_id))
    if obj:
        return comando.where(relacao.any(modelo.id == obj.id))
    return comando


def relatorio_membros(banco, igreja_id, f):
    m = MembroBanco
    q = select(m).where(m.igreja_id == igreja_id)
    q = situacao(q, m.status, f.membros_situacao)
    if f.membros_pesquisa:
        q = q.where(contem(m.nome, f.membros_pesquisa) | contem(m.cpf, f.membros_pesquisa))
    for campo in ("estado", "cidade", "bairro", "logradouro"):
        valor = getattr(f, "membros_" + campo)
        if valor:
            q = q.where(contem(getattr(m, campo), valor))
    q = filtro_associacao(banco, q, f.membros_funcao, FuncaoBanco, m.funcoes, igreja_id, "sem_funcao")
    q = filtro_associacao(banco, q, f.membros_grupo, GrupoBanco, m.grupos, igreja_id, "sem_grupo")
    # Data de referência explícita para o cálculo da idade.
    hoje = date.today()
    itens = registros(banco, q.order_by(m.nome, m.id))
    def idade(obj):
        d = obj.data_nascimento
        return None if d is None else hoje.year - d.year - ((hoje.month, hoje.day) < (d.month, d.day))
    itens = [x for x in itens if
             (f.membros_idade_minima is None or (idade(x) is not None and idade(x) >= f.membros_idade_minima)) and
             (f.membros_idade_maxima is None or (idade(x) is not None and idade(x) <= f.membros_idade_maxima)) and
             (f.membros_mes_aniversario is None or (x.data_nascimento and x.data_nascimento.month == f.membros_mes_aniversario))]
    campo = "data_nascimento" if f.membros_ordenacao == "nascimento" else f.membros_ordenacao
    itens.sort(key=lambda x: (getattr(x, campo) is None, str(getattr(x, campo) or "").casefold(), x.nome.casefold(), x.id))
    cols = [coluna("id", "ID"), coluna("nome", "Nome"), coluna("situacao", "Situação"), coluna("cargo", "Cargo")]
    if f.membros_exibicao_cpf != "oculto": cols.append(coluna("cpf", "CPF"))
    if f.membros_incluir_contato: cols.append(coluna("contato", "Contato"))
    if f.membros_incluir_nascimento: cols += [coluna("nascimento", "Nascimento"), coluna("idade", "Idade")]
    if f.membros_incluir_endereco: cols.append(coluna("endereco", "Endereço"))
    linhas = []
    for x in itens:
        r = dict(id=x.id, nome=x.nome, situacao="Ativo" if x.status else "Inativo", cargo=x.cargo or "Não informado")
        if f.membros_exibicao_cpf != "oculto":
            r["cpf"] = x.cpf if f.membros_exibicao_cpf == "completo" else "***." + x.cpf[3:6] + ".***-**"
        if f.membros_incluir_contato: r["contato"] = x.contato
        if f.membros_incluir_nascimento: r.update(nascimento=data_br(x.data_nascimento), idade=idade(x))
        if f.membros_incluir_endereco:
            r["endereco"] = ", ".join(v for v in [x.logradouro, x.numero, x.complemento, x.bairro, x.cidade, x.estado, x.cep, x.referencia] if v) or "Não informado"
        linhas.append(r)
    return cols, linhas, [], [f"Idades calculadas em {data_br(hoje)}. Funções e grupos consideram os vínculos atuais."]


def relatorio_financeiro(banco, igreja_id, f):
    m = MovimentacaoFinanceiraBanco

    if f.financeiro_modelo == "envelopes":
        e = DepositoEnvelopeBanco
        q = periodo(select(e).where(e.igreja_id == igreja_id), e.data_deposito, f).order_by(e.data_deposito, e.numero)
        itens = registros(banco, q)
        ids_usuarios = {x.criado_por_id for x in itens} | {x.aprovado_por_id for x in itens if x.aprovado_por_id}
        nomes = dict(banco.execute(select(UsuarioBanco.id, UsuarioBanco.nome).where(UsuarioBanco.id.in_(ids_usuarios))).all()) if ids_usuarios else {}
        total = sum((x.valor for x in itens if x.status != "rejeitado"), ZERO)
        pendente = sum((x.valor for x in itens if x.status == "aguardando_visto"), ZERO)
        cols = [coluna("envelope", "Envelope"), coluna("data", "Data"), coluna("valor", "Valor", True),
                coluna("status", "Status"), coluna("lancado_por", "Lançado por"), coluna("visto_por", "Visto por"),
                coluna("observacao", "Observação")]
        linhas = [dict(envelope=f"ENV-{x.numero:06d}", data=data_br(x.data_deposito), valor=moeda(x.valor),
                       status=x.status.replace("_", " ").capitalize(), lancado_por=nomes.get(x.criado_por_id, "Não disponível"),
                       visto_por=nomes.get(x.aprovado_por_id, "Aguardando") if x.aprovado_por_id else "Aguardando",
                       observacao=x.observacao or "") for x in itens]
        indicadores = [dict(rotulo="Transferido ao cofre no período", valor=moeda(total), classe="saldo"),
                       dict(rotulo="Aguardando visto pastoral", valor=moeda(pendente)),
                       dict(rotulo="Envelopes", valor=len(itens))]
        notas = ["Depósitos em envelope são transferências internas do caixa físico para o cofre; não são receita nem despesa.",
                 "Envelopes rejeitados permanecem no histórico de auditoria, mas não compõem o total transferido ao cofre."]
        return cols, linhas, indicadores, notas

    base = select(m).where(m.igreja_id == igreja_id)
    for campo in ("tipo", "categoria"):
        valor = getattr(f, "financeiro_" + campo)
        if valor:
            base = base.where(getattr(m, campo) == valor)
    if f.financeiro_forma_pagamento == "sem_informacao":
        base = base.where((m.forma_pagamento.is_(None)) | (m.forma_pagamento == ""))
    elif f.financeiro_forma_pagamento:
        base = base.where(m.forma_pagamento == f.financeiro_forma_pagamento)

    membro_filtrado = None
    atividade_filtrada = None
    for campo, modelo in (("membro", MembroBanco), ("atividade", AtividadeBanco)):
        valor = getattr(f, "financeiro_" + campo)
        obj = vinculo(banco, modelo, valor, igreja_id, "sem_vinculo")
        col = getattr(m, campo + "_id")
        if valor == "sem_vinculo":
            base = base.where(col.is_(None))
        elif obj:
            base = base.where(col == obj.id)
            if campo == "membro": membro_filtrado = obj
            else: atividade_filtrada = obj

    if f.financeiro_modelo == "membro" and membro_filtrado is None:
        raise HTTPException(422, "Selecione um membro específico para emitir o extrato individual.")

    itens = registros(banco, periodo(base, m.data_movimentacao, f).order_by(m.data_movimentacao, m.id))
    if any(x.tipo not in ("entrada", "saida") for x in itens):
        raise HTTPException(422, "Há movimentações com tipo inválido. Corrija-as antes de emitir o relatório.")

    entradas = sum((x.valor for x in itens if x.tipo == "entrada"), ZERO)
    saidas = sum((x.valor for x in itens if x.tipo == "saida"), ZERO)
    categorias = {
        categoria: sum((x.valor for x in itens if x.tipo == "entrada" and x.categoria == categoria), ZERO)
        for categoria in ("dizimo", "oferta", "doacao")
    }
    indicadores = [
        dict(rotulo="Entradas do período filtrado", valor=moeda(entradas), classe="entrada"),
        dict(rotulo="Saídas do período filtrado", valor=moeda(saidas), classe="saida"),
        dict(rotulo="Resultado do período filtrado", valor=moeda(entradas-saidas), classe="saldo"),
        dict(rotulo="Dízimos", valor=moeda(categorias["dizimo"])),
        dict(rotulo="Ofertas", valor=moeda(categorias["oferta"])),
        dict(rotulo="Doações", valor=moeda(categorias["doacao"])),
        dict(rotulo="Movimentações", valor=len(itens)),
    ]
    if membro_filtrado:
        indicadores.insert(0, dict(rotulo="Membro", valor=membro_filtrado.nome))
    if atividade_filtrada:
        indicadores.insert(0, dict(rotulo="Atividade", valor=atividade_filtrada.titulo))

    notas = ["Valores baseados nos lançamentos registrados. O resultado do período não é o saldo bancário conciliado."]

    if f.financeiro_modelo in ("extrato", "membro"):
        ids_membros = {x.membro_id for x in itens if x.membro_id}
        ids_atividades = {x.atividade_id for x in itens if x.atividade_id}
        nomes = dict(banco.execute(select(MembroBanco.id, MembroBanco.nome).where(MembroBanco.igreja_id == igreja_id, MembroBanco.id.in_(ids_membros))).all()) if ids_membros else {}
        atividades = dict(banco.execute(select(AtividadeBanco.id, AtividadeBanco.titulo).where(AtividadeBanco.igreja_id == igreja_id, AtividadeBanco.id.in_(ids_atividades))).all()) if ids_atividades else {}
        cols = [coluna("id", "ID"), coluna("data", "Data"), coluna("tipo", "Tipo"), coluna("categoria", "Categoria"),
                coluna("descricao", "Descrição"), coluna("membro", "Membro"), coluna("atividade", "Atividade"),
                coluna("forma", "Pagamento"), coluna("valor", "Valor", True), coluna("saldo", "Saldo do recorte", True)]
        saldo_recorte = ZERO
        linhas = []
        for x in itens:
            saldo_recorte += x.valor if x.tipo == "entrada" else -x.valor
            linhas.append(dict(id=x.id, data=data_br(x.data_movimentacao), tipo=x.tipo.capitalize(), categoria=x.categoria.capitalize(),
                              descricao=x.descricao or "", membro=nomes.get(x.membro_id, "Sem vínculo"),
                              atividade=atividades.get(x.atividade_id, "Sem vínculo"), forma=x.forma_pagamento or "Não informada",
                              valor=moeda(x.valor), saldo=moeda(saldo_recorte)))
        notas.append("Saldo do recorte inicia em zero e demonstra a sequência exata dos lançamentos filtrados.")
        if f.financeiro_modelo == "membro":
            notas.append("Extrato individual: somente movimentações vinculadas diretamente ao membro selecionado.")
    elif f.financeiro_modelo == "fluxo":
        anteriores = registros(banco, base.where(m.data_movimentacao < datetime.combine(f.data_inicio, time.min)))
        if any(x.tipo not in ("entrada", "saida") for x in anteriores):
            raise HTTPException(422, "Há tipos inválidos no histórico financeiro.")
        saldo = sum((x.valor if x.tipo == "entrada" else -x.valor for x in anteriores), ZERO)
        indicadores.append(dict(rotulo="Saldo anterior do recorte", valor=moeda(saldo)))
        agrupados = defaultdict(lambda: [ZERO, ZERO])
        for x in itens:
            chave = x.data_movimentacao.strftime("%Y-%m" if f.financeiro_agrupamento == "mes" else "%Y-%m-%d")
            agrupados[chave][0 if x.tipo == "entrada" else 1] += x.valor
        cols = [coluna("periodo", "Período"), coluna("entradas", "Entradas", True), coluna("saidas", "Saídas", True), coluna("resultado", "Resultado", True), coluna("saldo", "Saldo acumulado", True)]
        linhas = []
        for chave, (e, s) in sorted(agrupados.items()):
            saldo += e - s
            rotulo = datetime.strptime(chave, "%Y-%m" if len(chave) == 7 else "%Y-%m-%d").strftime("%m/%Y" if len(chave) == 7 else "%d/%m/%Y")
            linhas.append(dict(periodo=rotulo, entradas=moeda(e), saidas=moeda(s), resultado=moeda(e-s), saldo=moeda(saldo)))
        indicadores.append(dict(rotulo="Saldo final do recorte", valor=moeda(saldo)))
        notas.append("Saldo anterior = entradas menos saídas registradas antes do período, com os mesmos filtros. Não inclui projeções nem saldo inicial não lançado.")
    elif f.financeiro_modelo == "categorias":
        agrupados = defaultdict(lambda: ZERO)
        for x in itens: agrupados[(x.tipo, x.categoria)] += x.valor
        cols = [coluna("tipo", "Tipo"), coluna("categoria", "Categoria"), coluna("quantidade", "Lançamentos", True), coluna("valor", "Total", True)]
        contagens = defaultdict(int)
        for x in itens: contagens[(x.tipo, x.categoria)] += 1
        linhas = [dict(tipo=t.capitalize(), categoria=c.capitalize(), quantidade=contagens[(t,c)], valor=moeda(v)) for (t, c), v in sorted(agrupados.items())]
    else:
        cols = [coluna("descricao", "Indicador"), coluna("valor", "Valor", True)]
        linhas = [dict(descricao="Entradas", valor=moeda(entradas)), dict(descricao="Saídas", valor=moeda(saidas)), dict(descricao="Resultado do período", valor=moeda(entradas-saidas))]
        for categoria in ("dizimo", "oferta", "doacao"):
            linhas.append(dict(descricao=categoria.capitalize(), valor=moeda(categorias[categoria])))
    return cols, linhas, indicadores, notas

def relatorio_atividades(banco, igreja_id, f):
    a = AtividadeBanco
    q = periodo(select(a).where(a.igreja_id == igreja_id), a.data_hora_inicio, f)
    for campo in ("tipo", "status"):
        valor = getattr(f, "atividades_" + campo)
        if valor: q = q.where(getattr(a, campo) == valor)
    if f.atividades_pesquisa: q = q.where(contem(a.titulo, f.atividades_pesquisa))
    if f.atividades_local: q = q.where(contem(a.local, f.atividades_local))
    itens = registros(banco, q.order_by(a.data_hora_inicio, a.id))
    cols = [coluna("id", "ID"), coluna("titulo", "Atividade"), coluna("tipo", "Tipo"), coluna("inicio", "Início"), coluna("fim", "Fim"), coluna("local", "Local"), coluna("status", "Situação")]
    if f.atividades_incluir_observacoes: cols.append(coluna("observacoes", "Observações internas"))
    linhas = []
    for x in itens:
        r = dict(id=x.id, titulo=x.titulo, tipo=x.tipo, inicio=data_br(x.data_hora_inicio), fim=data_br(x.data_hora_fim), local=x.local or "Não informado", status=x.status)
        if f.atividades_incluir_observacoes: r["observacoes"] = x.observacoes or ""
        linhas.append(r)
    return cols, linhas, [], ["O período considera o início da atividade. Atividades canceladas são incluídas quando não há filtro de situação."]


def relatorio_frequencia(banco, igreja_id, f):
    p, m, a = PresencaBanco, MembroBanco, AtividadeBanco
    q = select(p, m.nome, a.titulo).join(m, p.membro_id == m.id).join(a, p.atividade_id == a.id).where(m.igreja_id == igreja_id, a.igreja_id == igreja_id)
    q = periodo(q, a.data_hora_inicio, f)
    for valor, modelo, campo in ((f.frequencia_membro, m, p.membro_id), (f.frequencia_atividade, a, p.atividade_id)):
        obj = vinculo(banco, modelo, valor, igreja_id)
        if obj: q = q.where(campo == obj.id)
    q = filtro_associacao(banco, q, f.frequencia_funcao, FuncaoBanco, m.funcoes, igreja_id, "__nenhum__")
    q = filtro_associacao(banco, q, f.frequencia_grupo, GrupoBanco, m.grupos, igreja_id, "__nenhum__")
    if f.frequencia_status: q = q.where(p.status == f.frequencia_status)
    itens = banco.execute(q.order_by(a.data_hora_inicio, p.id).limit(LIMITE+1)).all()
    if len(itens) > LIMITE: raise HTTPException(422, "Mais de 5.000 registros de frequência. Refine o período.")
    estados = ("presente", "ausente", "justificado", "confirmado")
    agrupados = {}
    for presenca, nome, titulo in itens:
        if presenca.status not in estados: raise HTTPException(422, "Há registros de presença com situação inválida.")
        chave = presenca.atividade_id if f.frequencia_modelo == "atividade" else presenca.membro_id if f.frequencia_modelo == "membro" else 0
        if chave not in agrupados:
            agrupados[chave] = dict(id=chave, nome=titulo if f.frequencia_modelo == "atividade" else nome if f.frequencia_modelo == "membro" else "Resumo do período", **{s: 0 for s in estados})
        agrupados[chave][presenca.status] += 1
    cols = [coluna("nome", "Atividade" if f.frequencia_modelo == "atividade" else "Membro" if f.frequencia_modelo == "membro" else "Resumo")]
    if f.frequencia_modelo != "resumo": cols.insert(0, coluna("id", "ID"))
    cols += [coluna(s, s.capitalize(), True) for s in estados] + [coluna("percentual", "Comparecimento", True)]
    linhas = list(agrupados.values())
    for r in linhas:
        denominador = r["presente"] + r["ausente"] + r["justificado"]
        r["percentual"] = f'{100 * r["presente"] / denominador:.1f}%'.replace(".", ",") if denominador else "Não calculável"
    notas = ["Comparecimento = presentes / (presentes + ausentes + justificados) dos registros filtrados. Confirmados não entram no cálculo. Sem registro não significa ausência.",
             "Período pelo início da atividade; funções e grupos pelos vínculos atuais. Um filtro de status também altera a base do percentual."]
    return cols, linhas, [dict(rotulo="Registros de frequência", valor=len(itens))], notas


def relatorio_equipes(banco, igreja_id, f):
    grupo = f.tipo_relatorio == "grupos"
    modelo = GrupoBanco if grupo else FuncaoBanco
    prefixo = "grupos" if grupo else "funcoes"
    q = situacao(select(modelo).where(modelo.igreja_id == igreja_id), modelo.ativo, getattr(f, prefixo + "_situacao"))
    obj = vinculo(banco, modelo, getattr(f, prefixo + "_selecao"), igreja_id)
    if obj: q = q.where(modelo.id == obj.id)
    if grupo and f.grupos_lideranca != "todos":
        q = q.where(modelo.lider_id.is_(None) if f.grupos_lideranca == "sem_lider" else modelo.lider_id.is_not(None))
    itens = registros(banco, q.options(selectinload(modelo.membros)).order_by(modelo.nome, modelo.id))
    incluir = f.grupos_incluir_integrantes if grupo else f.funcoes_incluir_membros
    filtro = getattr(f, prefixo + "_situacao_membro")
    cols = [coluna("id", "ID"), coluna("nome", "Grupo" if grupo else "Função"), coluna("situacao", "Situação")]
    if grupo: cols.append(coluna("lider", "Líder"))
    cols.append(coluna("quantidade", "Membros no filtro", True))
    if incluir: cols += [coluna("membro", "Membro"), coluna("situacao_membro", "Situação do membro")]
    linhas = []
    for x in itens:
        membros = sorted((m for m in x.membros if m.igreja_id == igreja_id and (filtro == "todos" or m.status == (filtro == "ativos"))), key=lambda m: (m.nome.casefold(), m.id))
        r = dict(id=x.id, nome=x.nome, situacao="Ativo" if x.ativo else "Inativo", quantidade=len(membros))
        if grupo:
            lider = x.lider
            r["lider"] = lider.nome if lider and lider.igreja_id == igreja_id else "Sem líder disponível"
        if incluir and membros:
            linhas.extend(dict(r, membro=f"{m.nome} (ID {m.id})", situacao_membro="Ativo" if m.status else "Inativo") for m in membros)
        else:
            linhas.append(dict(r, membro="Sem membros no filtro", situacao_membro="") if incluir else r)
        if len(linhas) > LIMITE: raise HTTPException(422, "Mais de 5.000 linhas. Refine a seleção ou desmarque a lista de membros.")
    return cols, linhas, [dict(rotulo="Grupos" if grupo else "Funções", valor=len(itens))], ["Vínculos atuais. O filtro de situação do membro afeta a contagem e a lista, sem excluir equipes vazias. Um membro pode aparecer em mais de uma equipe."]


GERADORES = {"membros": relatorio_membros, "financeiro": relatorio_financeiro,
             "atividades": relatorio_atividades, "frequencia": relatorio_frequencia,
             "funcoes": relatorio_equipes, "grupos": relatorio_equipes}


def gerar_pdf(resultado, f, igreja):
    import reportlab
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_RIGHT
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle, PageBreak, Image
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    # Fontes incluídas no próprio ReportLab, incorporadas ao PDF.
    with FONT_LOCK:
        if "PapperVera" not in pdfmetrics.getRegisteredFontNames():
            pasta = Path(reportlab.__file__).parent / "fonts"
            pdfmetrics.registerFont(TTFont("PapperVera", str(pasta / "Vera.ttf")))
            pdfmetrics.registerFont(TTFont("PapperVeraBold", str(pasta / "VeraBd.ttf")))
    saida = BytesIO()
    pagina = landscape(A4) if f.pdf_orientacao == "paisagem" else A4
    doc = SimpleDocTemplate(saida, pagesize=pagina, leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=21*mm, bottomMargin=18*mm, title=f.titulo, author="Papper")
    estilos = getSampleStyleSheet()
    for nome in ("Normal", "Title", "Heading2", "Heading3"):
        estilos[nome].fontName = "PapperVera" if nome == "Normal" else "PapperVeraBold"
    estilo = ParagraphStyle("PapperTexto", parent=estilos["Normal"], fontSize=9, leading=13, spaceAfter=6)
    celula = ParagraphStyle("PapperCelula", parent=estilo, fontSize=8, leading=11, spaceAfter=0, splitLongWords=True)
    direita = ParagraphStyle("PapperDireita", parent=celula, alignment=TA_RIGHT)
    cabecalho = ParagraphStyle("PapperCabecalho", parent=celula, textColor=colors.white, fontName="PapperVeraBold")
    def p(texto, style=estilo):
        return Paragraph(escape(str(texto if texto is not None else "Não informado")).replace("\n", "<br/>"), style)
    conteudo = []
    if igreja.logo_dados:
        try:
            logo = Image(BytesIO(igreja.logo_dados), width=24*mm, height=24*mm)
            logo.hAlign = "LEFT"
            conteudo += [logo, Spacer(1, 2*mm)]
        except Exception:
            pass
    conteudo += [p(igreja.nome, estilos["Heading2"]), p(f.titulo, estilos["Title"]),
                p("Presidente: " + igreja.presidente),
                p("Emitido: " + data_br(datetime.fromisoformat(resultado["gerado_em"])) + " UTC | Responsável: " + resultado["responsavel"]),
                p(f"Total de linhas: {resultado['total_registros']}")]
    conteudo.append(p("Filtros e opções", estilos["Heading3"]))
    conteudo.extend(p(x["rotulo"] + ": " + str(x["valor"])) for x in resultado["filtros_aplicados"])
    conteudo.extend(p(x["rotulo"] + ": " + str(x["valor"])) for x in resultado["indicadores"])
    conteudo.extend(p(n) for n in resultado["notas"])
    cols = resultado["colunas"]
    # Tabelas largas em blocos, repetindo a primeira coluna para identificar a linha.
    maximo = 7 if f.pdf_orientacao == "paisagem" else 5
    blocos = [cols] if len(cols) <= maximo else [[cols[0]] + cols[i:i+maximo-1] for i in range(1, len(cols), maximo-1)]
    for indice, bloco in enumerate(blocos):
        if indice: conteudo.append(PageBreak())
        conteudo.append(p(f"Resultados - bloco {indice+1}/{len(blocos)}", estilos["Heading3"]))
        if not resultado["linhas"]:
            conteudo.append(p("Nenhum registro encontrado para os filtros informados."))
            continue
        dados = [[p(c["rotulo"], cabecalho) for c in bloco]]
        dados += [[p(r.get(c["chave"]), direita if c["alinhamento"] == "direita" else celula) for c in bloco] for r in resultado["linhas"]]
        tabela = LongTable(dados, colWidths=[doc.width / len(bloco)] * len(bloco), repeatRows=1, splitByRow=1, splitInRow=1, hAlign="LEFT")
        tabela.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#102a43")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f5f8")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#d4a63a")),
        ]))
        conteudo.append(tabela)
    if f.pdf_observacoes:
        conteudo += [Spacer(1, 6*mm), p("Observações", estilos["Heading3"]), p(f.pdf_observacoes)]
    if f.pdf_assinatura != "nenhuma":
        conteudo += [Spacer(1, 15*mm), p("________________________________________"), p(f.pdf_assinatura.capitalize() + " - assinatura")]
    def rodape(canvas, documento):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor("#102a43"))
        canvas.setFont("PapperVeraBold", 9)
        canvas.drawString(15*mm, pagina[1]-12*mm, f"{igreja.nome} | PAPPER")
        canvas.setFont("PapperVera", 8)
        canvas.drawString(15*mm, 10*mm, "Uso interno - dados da igreja")
        canvas.drawRightString(pagina[0]-15*mm, 10*mm, f"Página {documento.page}")
        canvas.restoreState()
    doc.build(conteudo, onFirstPage=rodape, onLaterPages=rodape)
    return saida.getvalue()


def registrar_relatorios(app, obter_usuario_atual):
    router = APIRouter(prefix="/igrejas/{igreja_id}/relatorios", tags=["Relatórios"])
    cache = OrderedDict()
    lock = Lock()
    validade = 15 * 60

    @router.get("/opcoes")
    def opcoes(igreja_id: int, banco: Session = Depends(obter_banco), usuario=Depends(obter_usuario_atual)):
        igreja = autorizar(banco, usuario, igreja_id)
        permitidos = PERFIS[usuario.perfil]
        def lista(modelo, campo="nome"):
            return [{"id": x.id, campo: getattr(x, campo)} for x in registros(banco, select(modelo).where(modelo.igreja_id == igreja_id).order_by(getattr(modelo, campo), modelo.id))]
        atividades = lista(AtividadeBanco, "titulo")
        financeiro = "financeiro" in permitidos
        def valores(modelo, campo):
            col = getattr(modelo, campo)
            return registros(banco, select(col).where(modelo.igreja_id == igreja_id, col.is_not(None), col != "").distinct().order_by(col))
        return dict(igreja={"id": igreja.id, "nome": igreja.nome}, tipos_permitidos=permitidos,
                    permissoes=permissoes(usuario), membros=lista(MembroBanco), atividades=atividades,
                    funcoes=lista(FuncaoBanco) if "funcoes" in permitidos else [],
                    grupos=lista(GrupoBanco) if "grupos" in permitidos else [],
                    formas_pagamento=valores(MovimentacaoFinanceiraBanco, "forma_pagamento") if financeiro else [],
                    tipos_atividade=valores(AtividadeBanco, "tipo") if "atividades" in permitidos else [],
                    status_atividade=valores(AtividadeBanco, "status") if "atividades" in permitidos else [])

    @router.post("/consultar")
    def consultar(igreja_id: int, f: FiltrosRelatorio, banco: Session = Depends(obter_banco), usuario=Depends(obter_usuario_atual)):
        igreja = autorizar(banco, usuario, igreja_id, f.tipo_relatorio)
        perm = permissoes(usuario)
        if ((f.membros_exibicao_cpf == "completo" and not perm["cpf_completo"]) or
            (f.financeiro_identificar_membros and not perm["identificar_membros_financeiro"]) or
            (f.atividades_incluir_observacoes and not perm["observacoes_internas"])):
            raise HTTPException(403, "Seu perfil não pode incluir os campos solicitados.")
        cols, linhas, indicadores, notas = GERADORES[f.tipo_relatorio](banco, igreja_id, f)
        filtros = []
        for chave, valor in f.model_dump().items():
            if chave.startswith(f.tipo_relatorio + "_") or chave in ("data_inicio", "data_fim"):
                if valor is None or valor == "": continue
                rotulo = chave.removeprefix(f.tipo_relatorio + "_").replace("_", " ").capitalize()
                for antes, depois in (("Situacao", "Situação"), ("Ordenacao", "Ordenação"),
                                       ("funcao", "função"), ("Funcao", "Função"),
                                       ("endereco", "endereço"), ("Exibicao cpf", "Exibição do CPF"),
                                       ("Selecao", "Seleção (ID)"), ("Lideranca", "Liderança"),
                                       ("observacoes", "observações")):
                    rotulo = rotulo.replace(antes, depois)
                exibicao = "Sim" if valor is True else "Não" if valor is False else data_br(valor) if isinstance(valor, date) else str(valor)
                filtros.append(dict(rotulo=rotulo, valor=exibicao))
        resultado = dict(consulta_id=token_urlsafe(32), pdf_disponivel=True,
                         titulo=f.titulo, igreja_nome=igreja.nome, gerado_em=datetime.now(timezone.utc).isoformat(),
                         responsavel=usuario.nome, total_registros=len(linhas), legenda=f.titulo,
                         filtros_aplicados=filtros, indicadores=indicadores, notas=notas, colunas=cols, linhas=linhas)
        with lock:
            agora = monotonic()
            for chave in list(cache):
                if cache[chave][0] <= agora: del cache[chave]
            # Máximo de 32 snapshots, independente da quantidade de usuários.
            while len(cache) >= 32: cache.popitem(last=False)
            cache[resultado["consulta_id"]] = (agora + validade, usuario.id, igreja_id, usuario.perfil, deepcopy(resultado), f.model_copy(deep=True))
        return resultado

    @router.post("/pdf")
    def pdf(igreja_id: int, dados: PedidoPDF, banco: Session = Depends(obter_banco), usuario=Depends(obter_usuario_atual)):
        autorizar(banco, usuario, igreja_id)
        with lock:
            item = cache.get(dados.consulta_id)
            if item is None or item[0] <= monotonic():
                cache.pop(dados.consulta_id, None)
                raise HTTPException(410, "Consulta expirada ou API reiniciada. Consulte o relatório novamente.")
            if item[1:4] != (usuario.id, igreja_id, usuario.perfil):
                raise HTTPException(403, "Esta consulta não pertence à sua sessão autorizada.")
            resultado, f = deepcopy(item[4]), item[5].model_copy(deep=True)
        igreja = autorizar(banco, usuario, igreja_id, f.tipo_relatorio)
        conteudo = gerar_pdf(resultado, f, igreja)
        return Response(conteudo, media_type="application/pdf", headers={
            "Content-Disposition": 'attachment; filename="papper-relatorio.pdf"',
            "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

    app.include_router(router)
