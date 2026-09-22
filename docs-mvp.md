# TagD Smart — arquitetura do MVP

## Objetivo

O MVP gerencia empresas, tags NFC, QR Codes dinâmicos, destinos editáveis, acessos e prospecção comercial. A tag física não deve conter o link final do Google, WhatsApp, Instagram ou TikTok. Ela contém uma URL curta e estável da TagD Smart.

Exemplo:

```text
https://dominio-da-alf.com/t/TDK7A2Q9ZP
```

O servidor consulta o código, registra o acesso e redireciona para o destino configurado no painel.

## Stack

| Camada | Implementação |
| --- | --- |
| Interface | React, TypeScript, Tailwind e componentes Radix/shadcn |
| Servidor | Node.js, Express e tRPC |
| Banco | MySQL/TiDB com Drizzle ORM |
| Autenticação | Manus OAuth já integrado ao scaffold |
| URL pública | `GET /t/:code` |
| Proteção de destino | Apenas `http` e `https`, sem credenciais na URL |

## Entidades principais

- `businesses`: empresas clientes e empresas prospectadas.
- `tags`: código físico, cliente, destino, status, local de instalação e contador de acessos.
- `offers`: ofertas comerciais com descrição, CTA e validade.
- `outreachMessages`: rascunhos, fila e histórico de mensagens comerciais.
- `users`: autenticação e permissões do painel.

## Fluxo para cadastrar uma tag

1. Cadastre a empresa em **Prospecção**.
2. Crie uma tag para a empresa.
3. Informe um destino final HTTPS, como o link de avaliação do Google ou um link `https://wa.me/...`.
4. O backend cria um código aleatório, como `TDK7A2Q9ZP`.
5. Grave na tag NFC a URL pública `/t/TDK7A2Q9ZP`.
6. Gere um QR Code com a mesma URL.
7. Aplique o NFC e o QR Code na placa, cartão ou adesivo.
8. Teste aproximação, leitura do QR e destino final.
9. Proteja a memória NFC contra gravação com senha.
10. Marque a unidade como ativa e registre o local físico.

## Fluxo de leitura

```text
Celular
  │
  ├── NFC
  └── QR Code
        │
        ▼
GET /t/TDK7A2Q9ZP
        │
        ├── procura a tag ativa
        ├── valida o destino HTTP/HTTPS
        ├── incrementa o contador
        └── responde 302 para o destino final
```

A URL dinâmica permite mudar o destino sem regravar a tag física. Se uma placa for perdida ou substituída, o administrador pode pausar a tag.

## Segurança

A proteção da tag NFC e a segurança do sistema são camadas diferentes.

A proteção NFC impede regravação física não autorizada. Ela não impede que alguém copie a URL pública. Por isso, o servidor deve usar códigos aleatórios, autenticação no painel, status ativo/pausado e validação do destino.

O MVP rejeita destinos com protocolos perigosos, como `javascript:`, e não aceita credenciais embutidas na URL. O redirecionamento deve continuar limitado a tags ativas.

A senha individual das tags não deve ser armazenada em texto aberto em uma versão de produção. A próxima fase deve incluir uma tabela de credenciais protegida, acesso somente para administradores e procedimento de recuperação.

## API interna

As operações principais estão em `server/routers.ts`:

- `dashboard`: carrega empresas, tags, ofertas e mensagens.
- `business.create`: cadastra uma empresa prospectada.
- `business.updateStage`: atualiza a etapa do funil.
- `tag.create`: gera código aleatório e cria a URL dinâmica.
- `tag.toggle`: ativa, pausa ou coloca uma tag em rascunho.
- `offer.create`: cria oferta com validade.
- `outreach.createDraft`: cria uma mensagem para revisão antes do envio.
- `outreach.markOptedOut`: registra que o contato não deseja receber novas mensagens.

## Automação comercial responsável

O sistema deve preparar mensagens e follow-ups, mas não deve disparar mensagens em massa para contatos sem autorização. O fluxo recomendado é:

1. cadastrar o prospect;
2. registrar a origem do contato;
3. marcar consentimento como desconhecido, permitido ou bloqueado;
4. criar uma mensagem em rascunho;
5. revisar a oferta e a validade;
6. enviar manualmente ou por integração aprovada;
7. registrar resposta, interesse ou opt-out;
8. interromper novos contatos após opt-out.

## Próximas extensões

1. Gerar QR Code PNG/SVG no backend ou na interface.
2. Criar tela de cadastro e edição de tags com teste de destino.
3. Adicionar tabela de campanhas e métricas por origem.
4. Implementar permissões por cliente empresarial.
5. Adicionar domínio definitivo e HTTPS.
6. Integrar um provedor autorizado de WhatsApp ou e-mail, respeitando consentimento e opt-out.
7. Criar relatório de entrega e manutenção das placas.

## Checklist de teste físico do MVP

### Materiais

- Um celular Android com NFC ativado.
- Uma tag genuína NTAG213 ou NTAG215 ainda não protegida.
- O painel TagD Smart acessível pelo domínio ou preview.
- Um aplicativo de gravação NFC, como NXP TagWriter ou NFC Tools.
- Um QR Code gerado pelo painel.

### Teste inicial

1. Cadastre uma empresa no painel.
2. Abra **Tags e links**.
3. Crie uma tag com um destino HTTPS de teste, como uma página controlada por você.
4. Copie a URL dinâmica exibida na tag.
5. Grave essa URL na tag NFC como registro URL/NDEF.
6. Aproxime o celular e confirme que o destino abre.
7. Abra o QR Code em outro celular e confirme o mesmo destino.
8. Abra a URL pública em um navegador e confirme que o acesso aparece no contador.

### Teste de troca de destino

1. Altere o destino no campo da tag.
2. Clique em **Trocar destino**.
3. Não regrave a tag NFC.
4. Aproxime novamente o celular da mesma tag.
5. Confirme que o novo destino abre.
6. Confirme que a URL física continuou igual.

Esse é o teste que comprova o funcionamento do QR/NFC dinâmico.

### Teste de proteção

1. Faça todos os testes anteriores antes de proteger.
2. No aplicativo NFC, ative proteção de gravação por senha.
3. Mantenha a leitura pública e proteja somente a gravação.
4. Tente gravar uma URL diferente sem autenticar. A operação deve falhar.
5. Leia a tag novamente. Ela deve continuar abrindo a URL TagD.
6. No painel, marque **Programada** e depois **Protegida**.
7. Guarde a senha em local seguro. Não use bloqueio permanente no piloto.

### Teste de recuperação

Antes de vender uma unidade, confirme que a senha permite autenticar e alterar o conteúdo em um teste controlado. Se a senha for perdida, a tag pode continuar funcionando, mas a gravação física poderá ficar inacessível. O destino digital ainda poderá ser alterado no painel enquanto a URL dinâmica continuar gravada.

### Critério de aprovação

Uma unidade está pronta quando passa nos cinco testes: leitura NFC, leitura QR, redirecionamento, troca de destino sem regravação e bloqueio de gravação sem impedir leitura.

## Página pública MultiLink / Bento

Quando a tag tiver vários destinos, escolha **Página MultiLink** ao criar a tag. Depois, no editor **Montar página MultiLink / Bento**, selecione a tag e cadastre os links do cliente:

- Instagram;
- avaliação no Google;
- WhatsApp;
- site próprio.

Cada link possui uma caixa de ativação individual. Salvar a página transforma `/t/CODIGO` em uma página intermediária pública com botões. A tag NFC e o QR Code continuam usando somente `/t/CODIGO`; portanto, ativar, desativar ou alterar links não exige regravar o cartão.

O botão **Gravar NFC** tenta usar Web NFC em navegadores Android compatíveis. Quando Web NFC não estiver disponível, ele copia a URL e orienta o uso do NFC Tools ou NXP TagWriter:

1. Abrir **NFC Tools** no Android.
2. Escolher **Gravar**.
3. Adicionar um registro **URL**.
4. Colar a URL `/t/CODIGO` copiada no painel.
5. Aproximar o cartão NFC e aguardar a confirmação.
6. Ler o cartão para conferir.
7. Voltar ao painel e baixar o QR Code se a placa também tiver QR.
8. Somente depois proteger a gravação com senha.

A gravação física não pode ser feita pelo servidor, porque exige o rádio NFC do celular e a aproximação física do cartão. O sistema fornece a URL, o QR, o botão Web NFC quando suportado e o fallback operacional pelo aplicativo.

## Leitura, gravação e senha NFC

O painel oferece **Gravar NFC** e **Ler NFC** por Web NFC quando aberto em Android compatível, HTTPS e navegador que implemente `NDEFReader`. Esses botões operam registros NDEF, principalmente a URL dinâmica.

A senha dos NTAG213/215/216 é outra camada: ela usa os comandos proprietários `PWD_AUTH`, `PWD` e `PACK` e os registradores de configuração do chip. Para configurar a senha, usar NFC Tools ou NXP TagWriter, selecionar proteção de gravação, definir uma senha individual e manter a leitura pública. Não registrar a senha na URL nem no QR.

Fluxo recomendado:

1. Criar a tag no painel.
2. Copiar a URL `/t/CODIGO`.
3. Gravar a URL pelo botão Web NFC ou pelo NFC Tools/NXP TagWriter.
4. Usar **Ler NFC** ou o aplicativo para conferir a URL.
5. Testar a URL no navegador.
6. Configurar proteção de gravação por senha no aplicativo NFC.
7. Tentar regravar sem autenticação para confirmar que falha.
8. Ler novamente para confirmar que a tag continua funcionando.
9. Alterar os destinos no painel, sem regravar a URL física.

Web NFC não deve ser tratado como mecanismo universal de senha NTAG. Em aparelhos incompatíveis, o painel copia a URL e o aplicativo dedicado faz a gravação e proteção.
