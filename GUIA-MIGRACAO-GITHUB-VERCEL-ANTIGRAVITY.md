# TagD Smart — GitHub, Vercel, banco e migração para outra IA

## 1. Arquitetura recomendada

O GitHub armazena o código, mas não substitui a hospedagem nem o banco de dados:

```text
GitHub privado
  ├── código React/Express/tRPC
  ├── migrations Drizzle
  └── testes

Vercel ou outro host Node
  └── aplicação publicada

MySQL/TiDB gerenciado
  └── empresas, tags, destinos e métricas

Hostinger
  └── domínio e DNS
```

**Atenção:** o projeto atual usa Express, tRPC e um processo Node completo (`pnpm start`). A importação direta na Vercel pode exigir adaptação para funções serverless. Se o objetivo for executar o projeto atual com o mínimo de alteração, use Railway, Render, Fly.io, Cloud Run ou VPS compatível com Node. Na Vercel, valide primeiro em preview antes de migrar o domínio e os clientes.

## 2. Antes de migrar

1. Não altere o DNS da Hostinger ainda.
2. Confirme o repositório privado:
   `https://github.com/monautomacoes/tagd-smart-manager`
3. Faça backup do banco atual.
4. Anote o commit estável atualmente publicado.
5. Liste as variáveis de ambiente sem registrar os valores.
6. Confirme que existe um banco MySQL/TiDB de destino.
7. Não distribua QR Codes definitivos até o domínio final responder em HTTPS.

## 3. Conectar o GitHub à Vercel

1. Acesse `https://vercel.com` e entre na conta correta.
2. No dashboard, clique em **Add New Project**.
3. Escolha **Import Git Repository**.
4. Autorize a integração GitHub, se solicitado.
5. Selecione `monautomacoes/tagd-smart-manager`.
6. Use o branch `main`.
7. Configure o projeto, inicialmente sem alterar o domínio de produção:

```text
Framework Preset: Other
Root Directory: ./
Install Command: pnpm install --frozen-lockfile
Build Command: pnpm build
Output Directory: deixe o padrão ou confirme o resultado do build
```

8. Cadastre as variáveis em **Settings → Environment Variables** para `Preview`, antes de testar:

```text
DATABASE_URL
JWT_SECRET
VITE_APP_ID
OAUTH_SERVER_URL
VITE_OAUTH_PORTAL_URL
OWNER_OPEN_ID
OWNER_NAME
```

9. Clique em **Deploy**.
10. Abra a URL de preview da Vercel.
11. Teste login, painel, consulta ao banco, cadastro de empresa, criação de tag, geração de QR, rota `/t/CODIGO`, edição de destino e MultiLink.

Se o frontend abrir, mas login/tRPC/rotas do servidor falharem, não altere o DNS. Isso indica que o Express atual precisa ser adaptado para o modelo serverless da Vercel ou que outro host Node deve ser usado.

## 4. Verificar compatibilidade com Vercel

O projeto atual possui:

```json
"build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
"start": "NODE_ENV=production node dist/index.js"
```

A Vercel não deve ser tratada como um servidor Node tradicional que mantém `node dist/index.js` permanentemente. Para usar Vercel com segurança, faça uma destas opções:

### Opção A — adaptar o backend

1. Criar uma entrada serverless em `api/`.
2. Exportar o handler Express no formato aceito pela Vercel.
3. Criar `vercel.json` com os rewrites `/api/*`.
4. Garantir que o cliente tRPC use o domínio `/api/trpc`.
5. Separar arquivos estáticos Vite das funções serverless.
6. Testar OAuth, cookies, CORS, tRPC e conexão MySQL em preview.
7. Aplicar migrations fora do request serverless, usando pipeline controlado.

### Opção B — usar um host Node tradicional

Use o repositório GitHub em Railway, Render, Cloud Run ou VPS. Configure:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm drizzle-kit migrate
pnpm start
```

Essa opção preserva melhor o desenho atual do projeto e costuma ser a migração mais simples.

## 5. Backup seguro do banco atual

O backup deve ser feito com `mysqldump` em uma máquina segura. Não coloque o arquivo no GitHub.

Crie temporariamente `mysql-backup.cnf`:

```ini
[client]
host=HOST_ATUAL
port=3306
user=USUARIO_ATUAL
password=SENHA_ATUAL
database=BANCO_ATUAL
```

Proteja-o:

```bash
chmod 600 mysql-backup.cnf
```

Gere o dump consistente:

```bash
mysqldump \
  --defaults-extra-file=mysql-backup.cnf \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  > tagd-smart-backup.sql
```

Comprima e criptografe:

```bash
gzip tagd-smart-backup.sql
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 600000 \
  -in tagd-smart-backup.sql.gz \
  -out tagd-smart-backup.sql.gz.enc
```

Remova os temporários:

```bash
rm -f tagd-smart-backup.sql.gz mysql-backup.cnf
```

Calcule o hash:

```bash
sha256sum tagd-smart-backup.sql.gz.enc
```

Guarde o arquivo criptografado e a senha em locais separados. Não envie o dump para GitHub, WhatsApp ou pasta pública.

## 6. Restaurar no novo banco

Crie primeiro um banco MySQL/TiDB vazio. Use credenciais diferentes das antigas e, se o provedor oferecer, force TLS.

Descriptografe somente em máquina segura:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in tagd-smart-backup.sql.gz.enc \
  -out tagd-smart-backup.sql.gz

gunzip tagd-smart-backup.sql.gz
```

Crie um novo `mysql-backup.cnf` com o banco de destino, proteja-o com `chmod 600` e restaure:

```bash
mysql \
  --defaults-extra-file=mysql-backup.cnf \
  --default-character-set=utf8mb4 \
  < tagd-smart-backup.sql
```

Verifique tabelas, contagens e relações. Depois remova os arquivos descriptografados:

```bash
rm -f tagd-smart-backup.sql mysql-backup.cnf
```

Não faça migration destrutiva antes do backup. Para o schema futuro, prefira:

```bash
pnpm drizzle-kit generate
# revisar o SQL gerado
pnpm drizzle-kit migrate
```

## 7. Variáveis de ambiente na nova hospedagem

Na Vercel: **Project → Settings → Environment Variables**. Cadastre os nomes e valores por ambiente, preferencialmente primeiro em `Preview`.

```text
DATABASE_URL       # somente servidor
JWT_SECRET         # somente servidor
VITE_APP_ID        # público por definição do Vite, se realmente necessário
OAUTH_SERVER_URL   # conferir se é seguro expor ou usar versão server-only
VITE_OAUTH_PORTAL_URL
OWNER_OPEN_ID
OWNER_NAME
```

Nunca commite valores. No GitHub, mantenha somente um `.env.example` sem segredos, caso o projeto precise de documentação:

```text
DATABASE_URL=
JWT_SECRET=
VITE_APP_ID=
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=
OWNER_OPEN_ID=
OWNER_NAME=
```

Depois de configurar, faça novo deploy. Variáveis de ambiente normalmente só entram em novos deployments.

## 8. Resolver o domínio

Primeiro faça o preview funcionar. Depois, na Vercel, vá a **Project → Settings → Domains** e adicione:

```text
financasai.com.br
www.financasai.com.br
```

A Vercel exibirá os registros exatos para cada host. Use os valores mostrados pela Vercel; não invente IPs.

Na Hostinger:

- `www` normalmente será um CNAME para o destino indicado pela Vercel.
- O domínio raiz `@` pode exigir um registro A, ALIAS ou nameservers, conforme a instrução da Vercel.
- Não mantenha simultaneamente o A antigo da Vercel se ele pertencer ao site antigo.
- Remova o TXT `_vercel` antigo somente depois de confirmar que ele não é usado por outro projeto.
- Não remova MX, SPF ou DKIM de e-mail.
- Não clique em redefinir DNS.

Aguarde a propagação e o SSL. Valide:

```bash
dig +short financasai.com.br
dig +short www.financasai.com.br
curl -I https://financasai.com.br
curl -I https://www.financasai.com.br
```

Só migre QR/NFC de produção depois de ambos os hosts responderem em HTTPS e a rota `/t/CODIGO` funcionar.

## 9. Exportar o sistema inteiro para outra IA

O sistema não é apenas o ZIP do código. Para reproduzir o máximo possível, entregue quatro itens separados:

1. **Código:** repositório GitHub privado ou ZIP sem `node_modules`, `.git`, `dist` e secrets.
2. **Contrato:** `references/tagd-smart-config.json`, schema, migrations e `DEPLOY.md`.
3. **Banco:** dump criptografado enviado por canal privado, nunca no GitHub.
4. **Instruções:** este documento e o prompt de continuidade abaixo.

O código pode ser exportado assim:

```bash
zip -r tagd-smart-code.zip . \
  -x 'node_modules/*' \
  -x '.git/*' \
  -x 'dist/*' \
  -x '.env' \
  -x '.env.*' \
  -x '*.sql' \
  -x '*.sql.gz' \
  -x '*.sql.gz.enc'
```

O resultado não contém os dados do banco. Envie o backup criptografado separadamente e forneça a senha por outro canal.

### Prompt para Antigravity ou outra IA

```text
Continue o projeto TagD Smart a partir do repositório privado:
https://github.com/monautomacoes/tagd-smart-manager

Leia primeiro:
- DEPLOY.md
- GUIA-MIGRACAO-GITHUB-VERCEL-ANTIGRAVITY.md
- references/tagd-smart-config.json
- references/portability.md
- drizzle/schema.ts
- todas as migrations
- testes do servidor

Objetivo: reproduzir o sistema funcionalmente sem mudar a URL dinâmica /t/CODIGO, o modelo de clientes/empresas/tags, a autorização administrativa, a validação de URLs, o MultiLink, o QR Code e as regras de proteção NFC.

Ambiente alvo: [Vercel serverless ou host Node tradicional].
Banco alvo: [MySQL/TiDB].
Domínios: financasai.com.br e www.financasai.com.br.

Não invente secrets. Solicite os nomes das variáveis, mas nunca peça para colocar valores no código ou no GitHub. Não faça migrations destrutivas. Antes de editar, produza uma auditoria. Depois implemente, rode pnpm check, pnpm test e pnpm build, e teste login, cadastro, criação de tag, QR, /t/CODIGO, MultiLink e edição de destino.

A interface deve permanecer visualmente equivalente ao projeto original. Compare as telas de login, dashboard, formulário de tag, QR e MultiLink com screenshots de referência. Qualquer mudança de domínio deve manter redirecionamento das tags antigas.
```

## 10. O que significa “igualzinho”

É possível reproduzir o código, layout, regras e dados, mas não existe garantia de identidade visual ou comportamento sem validação. Para ficar realmente equivalente, compare:

- screenshots de cada tela;
- rotas e respostas tRPC;
- conteúdo do banco após restauração;
- login e cookies;
- QR e redirecionamento;
- estados de erro e loading;
- permissões de usuário;
- mobile e desktop.

A aprovação deve ser feita somente depois de rodar a mesma bateria de testes no ambiente novo.

## 11. Critério final de sucesso

A migração estará concluída quando:

- GitHub estiver privado e sem secrets;
- build, tipos e testes passarem;
- banco novo tiver backup e restauração testados;
- Vercel ou host Node responder em produção;
- login funcionar;
- empresas e tags forem cadastradas;
- `/t/CODIGO` redirecionar corretamente;
- QR e NFC funcionarem;
- domínio raiz e `www` responderem em HTTPS;
- clientes antigos continuarem acessíveis;
- rollback estiver documentado.

## Referências oficiais

- [Vercel — integração com GitHub](https://vercel.com/docs/git/vercel-for-github)
- [Vercel — variáveis de ambiente](https://vercel.com/docs/environment-variables)
- [Vercel — Express](https://vercel.com/docs/frameworks/backend/express)
- [Vercel — domínio personalizado](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
