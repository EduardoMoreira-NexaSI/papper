# Contas de teste — Papper

## Desenvolvimento local

| Usuário | Senha | Perfil |
|---|---|---|
| `user01` | `<definida em TEST_USER_PASSWORD>` | administrador |
| `user02` | `<definida em TEST_USER_PASSWORD>` | administrador |
| `user03` | `<definida em TEST_USER_PASSWORD>` | administrador |
| `user04` | `<definida em TEST_USER_PASSWORD>` | administrador |
| `user05` | `<definida em TEST_USER_PASSWORD>` | administrador |
| `user06` | `<definida em TEST_USER_PASSWORD>` | administrador |
| `user07` | `<definida em TEST_USER_PASSWORD>` | administrador |
| `user08` | `<definida em TEST_USER_PASSWORD>` | administrador |
| `user09` | `<definida em TEST_USER_PASSWORD>` | administrador |
| `user10` | `<definida em TEST_USER_PASSWORD>` | administrador |
| `useradm` | `<definida em MASTER_PASSWORD>` | master |

## Hospedagem

As senhas são controladas pelas variáveis de ambiente:

- `MASTER_PASSWORD` → senha de `useradm` na primeira criação;
- `TEST_USER_PASSWORD` → senha inicial de `user01` a `user10`.

O seed não sobrescreve a senha depois que a conta já existe. Portanto, uma senha alterada pela área de Administração permanece após reiniciar/redeployar a aplicação.
