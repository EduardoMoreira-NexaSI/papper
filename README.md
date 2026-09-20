# Papper — Painel Gerencial Pastoral

Versão preparada para teste e hospedagem. O FastAPI serve **API + frontend** no mesmo processo.

## Estrutura principal

- `api.py` — API principal e autenticação.
- `admin_backend.py` — rotas exclusivas do usuário `master`.
- `models.py` / `schemas.py` — banco e contratos da API.
- `relatorios_backend.py` — consultas e geração de PDF.
- `frontend/` — telas HTML, CSS, JavaScript e assets.
- `alembic/` — migration baseline limpa.
- `inicializar_banco.py` — aplica migrations e cria os dados iniciais.
- `seed.py` — cria `useradm` e `user01` a `user10` de forma idempotente.
- `render.yaml` / `start.sh` — preparação para deploy no Render.

## Banco inicial

Um banco novo começa somente com:

- 1 igreja: `Igreja de Teste Papper`;
- 10 contas de teste: `user01` a `user10`;
- 1 conta master: `useradm`;
- 0 membros;
- 0 atividades;
- 0 movimentações financeiras.

Nenhum dado do banco antigo foi levado para esta versão.

## Contas locais

Para desenvolvimento local:

- `user01` ... `user10`
  - senha: `<definida em TEST_USER_PASSWORD>`
  - perfil: `administrador`
- `useradm`
  - senha local padrão: `<definida em MASTER_PASSWORD>`
  - perfil: `master`

No deploy PostgreSQL, defina `MASTER_PASSWORD` e `TEST_USER_PASSWORD` nas variáveis de ambiente. A senha local do master não deve ser usada na internet.

## Área master

Depois do login com `useradm`, o sistema abre `admin.html`.

A área master permite:

- visualizar totais do sistema;
- listar todas as igrejas;
- abrir o painel de qualquer igreja;
- cadastrar nova igreja;
- listar usuários de todas as igrejas;
- criar usuários;
- ativar/desativar usuários;
- redefinir senhas;
- visualizar qual banco está conectado.

As rotas `/admin/*` são protegidas no backend. Um usuário comum recebe HTTP `403`, mesmo que tente chamar a API manualmente.

## Rodar localmente

Recomendado: não use Live Server. Deixe o próprio FastAPI servir o frontend.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
bash start.sh
```

Depois abra:

```text
http://127.0.0.1:8000
```

Se a porta 8000 já estiver ocupada:

```bash
python inicializar_banco.py
python -m uvicorn api:app --reload --port 8001
```

E abra:

```text
http://127.0.0.1:8001
```

O frontend funciona no mesmo domínio/porta do FastAPI.

## Variáveis de ambiente

Use `.env.example` como referência. Não envie `.env` para o GitHub.

Principais variáveis:

- `DATABASE_URL`
- `SECRET_KEY`
- `SETUP_TOKEN`
- `MASTER_USERNAME`
- `MASTER_EMAIL`
- `MASTER_PASSWORD`
- `SEED_TEST_USERS`
- `TEST_USER_PASSWORD`
- `TEST_CHURCH_NAME`

## Banco no deploy

O código suporta:

- SQLite para desenvolvimento local;
- PostgreSQL para hospedagem.

Para hospedagem, use PostgreSQL persistente. O arquivo `igreja.db` está no ZIP apenas para facilitar teste local e está ignorado pelo Git.

Na primeira inicialização de um PostgreSQL vazio, `start.sh` executa automaticamente:

1. `alembic upgrade head`;
2. criação da baseline completa;
3. seed do `useradm`;
4. seed de `user01` a `user10`.

Executar novamente é seguro: o seed não duplica as contas e não redefine as senhas existentes.

## Testes já executados nesta versão

Foram validados:

- criação do banco do zero;
- login `user01`;
- login `user10`;
- login `useradm`;
- isolamento entre igrejas;
- bloqueio de `/admin/*` para usuário comum;
- acesso global do master;
- criação de igreja pelo master;
- criação de usuário pelo master;
- ativação/desativação de usuário;
- redefinição de senha;
- cadastro e listagem de membro;
- atividade;
- presença;
- financeiro;
- funções;
- grupos;
- relatório;
- geração de PDF;
- sintaxe de todos os arquivos Python;
- sintaxe de todos os arquivos JavaScript.

## Segurança

- Senhas são armazenadas com Argon2.
- JWT usa `SECRET_KEY` externa em produção.
- Dados de igreja exigem autenticação.
- Contas comuns continuam restritas à sua igreja.
- O perfil `master` possui acesso global por regra explícita no backend.
- `.env`, bancos locais e backups estão no `.gitignore`.

Antes de disponibilizar o Papper publicamente para clientes reais, remova ou desative as contas genéricas de teste e use senhas fortes e exclusivas.
