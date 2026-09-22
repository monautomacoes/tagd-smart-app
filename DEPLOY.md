# TagD Smart — publicação e operação

## Estado atual

O projeto é uma aplicação full-stack com React, Express, tRPC, Drizzle, banco MySQL/TiDB, autenticação Manus OAuth e redirecionamento público de tags. O domínio de preview/publicação atual é `https://tagdsmart-zxea2bug.manus.space`.

O QR Code de demonstração está em:

```text
https://tagdsmart-zxea2bug.manus.space/modelo
```

Esse endereço é apenas um modelo visual. Para uma tag real, o painel gera um código aleatório e o QR aponta para `/t/SEU-CODIGO`. O destino pode ser alterado no painel sem regravar o QR ou a tag NFC.

## O que está no GitHub

O repositório contém o código-fonte, schema Drizzle, migrações, testes e configuração de build. O repositório deve permanecer privado. Arquivos de ambiente, credenciais OAuth, senha JWT, conexão de banco e tokens não devem ser enviados ao GitHub.

Repositório: `https://github.com/monautomacoes/tagd-smart-manager`

## O que precisa existir no ambiente online

A hospedagem precisa fornecer as variáveis de ambiente gerenciadas pelo provedor, sem gravá-las no código:

| Variável | Finalidade |
| --- | --- |
| `DATABASE_URL` | Conexão com MySQL/TiDB persistente |
| `JWT_SECRET` | Assinatura segura da sessão |
| `VITE_APP_ID` | Identificação do aplicativo OAuth |
| `OAUTH_SERVER_URL` | Servidor OAuth |
| `VITE_OAUTH_PORTAL_URL` | Portal de login no frontend |
| `OWNER_OPEN_ID` e `OWNER_NAME` | Identificação do administrador inicial |

No ambiente WebDev essas variáveis são fornecidas pelo projeto. Em outro provedor, devem ser cadastradas no gerenciador de secrets do provedor, nunca em um commit.

## Banco de dados

O banco é necessário para manter empresas, tags, destinos, leituras, ofertas e mensagens. Sem banco, o painel não deve ser colocado em produção. As migrações ficam em `drizzle/` e devem ser aplicadas com backup e revisão:

```bash
pnpm drizzle-kit generate
pnpm check
pnpm test
pnpm build
```

Não apagar tabelas em produção sem backup. As tags possuem relacionamento com empresas e as mensagens possuem relacionamento com empresas/ofertas.

## Domínio próprio

1. Adicione o domínio no painel de publicação do projeto.
2. Cadastre no DNS o registro indicado pelo painel, normalmente um `CNAME` para o host informado pela hospedagem.
3. Aguarde a validação DNS e a emissão automática do certificado HTTPS.
4. Teste o painel, uma URL `/t/CODIGO`, o QR e o login antes de distribuir as placas.
5. Depois de o domínio definitivo estar ativo, gere novas tags para que os QR Codes já usem o domínio final.

Não troque o domínio depois de imprimir placas sem planejar uma migração. O código dinâmico continua editável, mas a origem gravada no NFC/QR precisa permanecer disponível.

## Proteção da tag física

O painel protege o cadastro e o destino; a proteção contra gravação indevida precisa ser configurada no chip NFC:

1. Grave somente a URL dinâmica `/t/CODIGO`.
2. Leia a tag para confirmar a URL.
3. No NFC Tools ou aplicativo equivalente, configure senha de escrita, preferencialmente uma senha exclusiva por unidade.
4. Use proteção de escrita, mantendo a leitura pública.
5. Só marque a unidade como protegida no painel depois de concluir e testar a proteção física.
6. Guarde as senhas em cofre seguro; não grave senhas no banco nem no GitHub.

Tags NTAG213 oferecem proteção por senha para uma área configurável, mas não substituem autenticação criptográfica. Para ativos de maior risco, considere NTAG424 DNA ou outro chip com autenticação criptográfica e validação de originalidade.

## Checklist antes de vender

- [ ] Domínio HTTPS definitivo respondendo.
- [ ] Login administrativo funcionando.
- [ ] Banco persistente e backup configurado.
- [ ] Empresa cadastrada.
- [ ] Tag criada com código aleatório.
- [ ] QR PNG/SVG testado.
- [ ] URL NFC gravada e lida em celular real.
- [ ] Destino alterado no painel sem regravar a tag.
- [ ] Tag física protegida contra escrita.
- [ ] Teste com NFC Tools após a proteção.
- [ ] Nenhuma senha ou variável secreta enviada ao GitHub.
