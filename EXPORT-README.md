# Exportação do TagD Smart

Este pacote contém o código necessário para continuar o sistema em outro computador ou provedor de hospedagem.

## Conteúdo incluído

- Frontend React/Vite em `client/`.
- Backend Express/tRPC em `server/`.
- Tipos e constantes compartilhados em `shared/`.
- Schema, relações e migrations Drizzle em `drizzle/`.
- Testes automatizados em `server/*.test.ts`.
- Configuração de TypeScript, Vite, Vitest e Drizzle.
- Dependências fixadas em `package.json` e `pnpm-lock.yaml`.
- Documentação de operação em `DEPLOY.md`.
- Guia de migração para GitHub, Vercel, banco e outras IAs em `GUIA-MIGRACAO-GITHUB-VERCEL-ANTIGRAVITY.md`.
- Contrato agnóstico e orientações de portabilidade da habilidade TagD Smart.

## O que não está incluído

Por segurança, o pacote não contém:

- `.env` ou valores de variáveis secretas;
- `DATABASE_URL`, `JWT_SECRET` ou tokens OAuth;
- dados reais dos clientes;
- dump ou backup do banco;
- senhas de proteção NFC;
- `node_modules`, `dist` ou caches;
- histórico `.git`.

As migrations SQL são estrutura do sistema e estão incluídas. Elas não contêm os dados atuais dos clientes.

## Executar em outro computador

Requisitos: Node.js 22, pnpm 10 e MySQL/TiDB.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Configure as variáveis no gerenciador de secrets da hospedagem. Não crie um `.env` com credenciais e não o envie ao GitHub.

Para um banco vazio, aplique as migrations depois de configurar `DATABASE_URL`:

```bash
pnpm drizzle-kit migrate
```

Para iniciar a aplicação Node:

```bash
pnpm start
```

## Migração dos dados atuais

Os dados dos clientes não fazem parte deste pacote. Para migrá-los, gere separadamente um dump MySQL criptografado, restaure-o no banco de destino e valide as tabelas antes de apontar a aplicação para o novo banco. Consulte `GUIA-MIGRACAO-GITHUB-VERCEL-ANTIGRAVITY.md`.

## Continuidade em outra IA

Forneça o repositório ou este pacote, os documentos de operação e o prompt de continuidade do guia de migração. Envie o backup do banco por canal privado e separado. Nunca forneça senhas ou tokens no prompt.

## Estado de referência

O projeto de referência é o repositório privado:

```text
https://github.com/monautomacoes/tagd-smart-manager
```

A aplicação usa URLs dinâmicas no formato `/t/CODIGO`, portanto a rota pública e os códigos existentes devem ser preservados durante qualquer migração de domínio.
