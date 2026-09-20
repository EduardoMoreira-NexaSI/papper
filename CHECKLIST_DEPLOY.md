# Checklist de deploy — Papper

## 1. Antes de subir para o GitHub

- [ ] Trabalhar somente com esta pasta revisada.
- [ ] Não adicionar `.env` ao Git.
- [ ] Não adicionar `igreja.db` ao Git.
- [ ] Confirmar que `git status` não mostra segredos.
- [ ] Criar o repositório e enviar o código.

## 2. PostgreSQL

- [ ] Criar um banco PostgreSQL persistente.
- [ ] Copiar a connection string completa.
- [ ] Guardá-la para `DATABASE_URL`.

## 3. Render

O projeto possui `render.yaml` e `start.sh`.

Na criação do serviço, informar os secrets solicitados:

- [ ] `DATABASE_URL`
- [ ] `MASTER_PASSWORD`
- [ ] `TEST_USER_PASSWORD`

`SECRET_KEY` e `SETUP_TOKEN` podem ser gerados automaticamente pelo Blueprint.

## 4. Depois do primeiro deploy

- [ ] Abrir `/health` e confirmar `{"status":"online"}`.
- [ ] Abrir a página principal.
- [ ] Entrar com `useradm` e a senha configurada em `MASTER_PASSWORD`.
- [ ] Confirmar que `admin.html` abre.
- [ ] Confirmar que existem 11 contas.
- [ ] Entrar com `user01` e a senha de `TEST_USER_PASSWORD`.

## 5. Teste funcional

- [ ] Cadastrar membro.
- [ ] Editar membro.
- [ ] Criar atividade.
- [ ] Registrar presença.
- [ ] Criar entrada financeira.
- [ ] Criar saída financeira.
- [ ] Criar função.
- [ ] Criar grupo.
- [ ] Gerar relatório.
- [ ] Gerar PDF.
- [ ] Sair e entrar novamente.

## 6. Teste do master

- [ ] Criar uma segunda igreja.
- [ ] Criar um usuário para a segunda igreja.
- [ ] Abrir o painel dessa igreja pela Administração.
- [ ] Desativar e reativar um usuário.
- [ ] Redefinir a senha de uma conta de teste.
- [ ] Confirmar que usuário comum não acessa `/admin/resumo`.

## 7. Antes de uso real

- [ ] Trocar a senha do `useradm`.
- [ ] Desativar/remover as contas genéricas que não forem mais necessárias.
- [ ] Definir política de backup do PostgreSQL.
- [ ] Revisar os perfis e permissões para cada cliente real.
