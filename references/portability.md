{
  "specification": {
    "name": "TagD Smart — Especificação portátil do sistema",
    "version": "2.0.0",
    "language": "pt-BR",
    "purpose": "Reconstruir o sistema de gestão de tags NFC, QR Codes dinâmicos, links MultiLink e prospecção comercial em outra plataforma.",
    "sourceProject": "tagd-smart-manager",
    "sourceCheckpoint": "ac080f95",
    "portable": true,
    "generatedAt": "2026-09-15T18:22:00Z"
  },
  "brand": {
    "company": "ALF Automações Digitais",
    "product": "TagD Smart",
    "category": "NFC, QR Code dinâmico e gestão de links para empresas locais",
    "promise": "Facilitar que clientes encontrem, sigam, contatem e avaliem empresas por aproximação ou escaneamento.",
    "products": [
      { "id": "google", "name": "TagD Google", "description": "Acesso rápido ao link oficial de avaliação da empresa no Google." },
      { "id": "whatsapp", "name": "TagD WhatsApp", "description": "Abertura de conversa com a empresa." },
      { "id": "social", "name": "TagD Social", "description": "Acesso a Instagram, TikTok e outras redes." },
      { "id": "multi", "name": "TagD Multi", "description": "Página pública estilo Bento/Linktree com links ativáveis." },
      { "id": "card", "name": "TagD Card", "description": "Cartão de visita digital com URL editável." },
      { "id": "management", "name": "TagD Gestão", "description": "Painel de empresas, tags, QR Codes, acessos, ofertas e prospecção." }
    ],
    "claimsAllowed": [
      "Facilita o acesso à avaliação.",
      "Permite editar links sem trocar a placa.",
      "Um toque ou escaneamento abre o canal certo.",
      "Mostra métricas básicas de acesso."
    ],
    "claimsForbidden": [
      "Garantir cinco estrelas.",
      "Garantir primeiro lugar no Google.",
      "Aumentar avaliações automaticamente.",
      "Oferecer benefício em troca de avaliação positiva.",
      "Afirmar ser produto oficial do Google, Instagram, TikTok ou WhatsApp."
    ]
  },
  "architecture": {
    "frontend": "React + TypeScript + Vite + Tailwind ou equivalente",
    "backend": "Node.js + Express ou API server equivalente",
    "apiStyle": "tRPC, REST ou GraphQL tipado",
    "database": "MySQL/TiDB/PostgreSQL com ORM ou migrations",
    "authentication": "OAuth ou sessão segura com papéis admin/user",
    "storage": "Object storage para logos e arquivos; não armazenar bytes grandes no banco",
    "deploymentRequirements": ["HTTPS", "domínio próprio", "variáveis de ambiente", "backup do banco", "monitoramento", "logs"]
  },
  "environmentVariables": [
    { "name": "DATABASE_URL", "required": true, "secret": true, "purpose": "Conexão com banco relacional" },
    { "name": "JWT_SECRET", "required": true, "secret": true, "purpose": "Assinatura de sessão" },
    { "name": "OAUTH_SERVER_URL", "required": true, "secret": false, "purpose": "Servidor OAuth" },
    { "name": "OAUTH_CLIENT_ID", "required": true, "secret": false, "purpose": "Identificador OAuth, se aplicável" },
    { "name": "OAUTH_CLIENT_SECRET", "required": true, "secret": true, "purpose": "Segredo OAuth, se aplicável" },
    { "name": "PUBLIC_APP_URL", "required": true, "secret": false, "purpose": "Origem usada para gerar URLs NFC/QR" },
    { "name": "STORAGE_BUCKET", "required": false, "secret": false, "purpose": "Armazenamento de logos" },
    { "name": "WEBHOOK_SECRET", "required": false, "secret": true, "purpose": "Integrações futuras" }
  ],
  "database": {
    "migrationRules": [
      "Criar tabelas antes das foreign keys dependentes.",
      "Aplicar migrations versionadas e não destrutivas.",
      "Guardar timestamps em UTC.",
      "Criar índice único para tags.code.",
      "Criar índices para tags.status, tags.businessId e tags.lastScannedAt.",
      "Nunca armazenar senha NFC em texto aberto."
    ],
    "tables": {
      "users": {
        "purpose": "Usuários e permissões",
        "fields": {
          "id": "integer primary key auto_increment",
          "openId": "string unique",
          "name": "string nullable",
          "email": "string nullable",
          "loginMethod": "string nullable",
          "role": "enum(user,admin) default user",
          "createdAt": "timestamp",
          "updatedAt": "timestamp",
          "lastSignedIn": "timestamp"
        }
      },
      "businesses": {
        "purpose": "Empresas clientes e prospects",
        "fields": {
          "id": "integer primary key auto_increment",
          "name": "string required",
          "segment": "string nullable",
          "city": "string nullable",
          "contactName": "string nullable",
          "phone": "string nullable",
          "email": "string nullable",
          "notes": "text nullable",
          "stage": "enum(lead,contacted,demo,proposal,won,lost) default lead",
          "consentStatus": "enum(unknown,allowed,blocked) default unknown",
          "createdAt": "timestamp",
          "updatedAt": "timestamp"
        }
      },
      "tags": {
        "purpose": "Unidades físicas NFC/QR e seus destinos dinâmicos",
        "fields": {
          "id": "integer primary key auto_increment",
          "businessId": "foreign key businesses.id on delete cascade",
          "code": "string unique random public code",
          "label": "string required",
          "material": "string nullable",
          "placement": "string nullable",
          "destinationType": "enum(google,whatsapp,instagram,tiktok,multilink,custom)",
          "destinationUrl": "string required for direct tags; placeholder allowed for multilink",
          "multilinkConfig": "JSON/text nullable",
          "whatsappMessage": "text nullable",
          "status": "enum(active,paused,draft) default active",
          "programmingStatus": "enum(not_programmed,programmed,protected) default not_programmed",
          "nfcModel": "string nullable",
          "protectionNote": "text nullable",
          "programmedAt": "timestamp nullable",
          "protectedAt": "timestamp nullable",
          "scans": "integer default 0",
          "lastScannedAt": "timestamp nullable",
          "createdAt": "timestamp",
          "updatedAt": "timestamp"
        }
      },
      "offers": {
        "purpose": "Ofertas comerciais com validade",
        "fields": {
          "id": "integer primary key auto_increment",
          "title": "string required",
          "segment": "string nullable",
          "description": "text required",
          "cta": "string default Quero uma demonstração",
          "validUntil": "timestamp nullable",
          "active": "boolean/integer default true",
          "createdAt": "timestamp"
        }
      },
      "outreachMessages": {
        "purpose": "Rascunhos e histórico de prospecção",
        "fields": {
          "id": "integer primary key auto_increment",
          "businessId": "foreign key businesses.id",
          "offerId": "foreign key offers.id nullable",
          "channel": "enum(whatsapp,email,instagram,manual)",
          "subject": "string nullable",
          "body": "text required",
          "status": "enum(draft,queued,sent,replied,opted_out)",
          "scheduledFor": "timestamp nullable",
          "sentAt": "timestamp nullable",
          "createdAt": "timestamp"
        }
      }
    }
  },
  "publicUrlSystem": {
    "route": "GET /t/:code",
    "physicalPayloadTemplate": "${PUBLIC_APP_URL}/t/${code}",
    "codeGeneration": "Prefixo TD + bytes criptograficamente aleatórios codificados em base64url; não usar ID sequencial.",
    "resolutionAlgorithm": [
      "Localizar tag pelo code.",
      "Exigir status active.",
      "Registrar e incrementar scans.",
      "Validar destino novamente no momento da resolução.",
      "Se destinationType for multilink, renderizar página pública sanitizada.",
      "Caso contrário, responder HTTP 302 para destinationUrl.",
      "Em tag inexistente, pausada ou inválida, responder erro seguro sem revelar dados internos."
    ],
    "dynamicBenefit": "Alterar o destino no painel sem regravar NFC ou QR.",
    "pauseBehavior": "Tag pausada não resolve publicamente.",
    "headers": ["HTTPS", "Content-Security-Policy adequada", "X-Content-Type-Options", "Referrer-Policy"]
  },
  "multilink": {
    "purpose": "Página pública de vários links estilo Bento/Linktree",
    "items": [
      { "key": "instagram", "label": "Instagram", "enabled": true, "url": "https://instagram.com/..." },
      { "key": "google", "label": "Avalie no Google", "enabled": true, "url": "https://g.page/.../review" },
      { "key": "whatsapp", "label": "Fale no WhatsApp", "enabled": true, "url": "https://wa.me/..." },
      { "key": "site", "label": "Nosso site", "enabled": true, "url": "https://..." }
    ],
    "themeFields": ["title", "subtitle", "accent", "background", "buttonColor", "buttonTextColor", "logoUrl"],
    "validation": ["URLs somente http/https", "logo somente HTTPS", "cores somente hexadecimais", "sanitizar texto antes de renderizar", "renderizar somente itens enabled"],
    "preview": "Mostrar os valores atuais dentro de uma moldura de celular antes de gravar NFC."
  },
  "qrCode": {
    "generation": "Local, sem depender de serviço externo",
    "libraryOptions": ["qrcode", "equivalente compatível com PNG e SVG"],
    "formats": ["PNG", "SVG"],
    "download": true,
    "samePayloadAsNfc": true,
    "rule": "QR e NFC devem apontar para exatamente a mesma URL dinâmica /t/:code."
  },
  "nfc": {
    "dataFormat": "NDEF URL record",
    "webApi": "NDEFReader",
    "requirements": ["Android compatível", "Chrome compatível", "HTTPS", "NFC ativado", "tela desbloqueada", "página visível", "gesto do usuário", "tag NDEF compatível"],
    "writeFlow": [
      "Exibir URL dinâmica.",
      "Tentar NDEFReader.write em clique do usuário.",
      "Preferir overwrite:false para não apagar conteúdo existente acidentalmente.",
      "Mostrar estado writing e instrução para aproximar cartão.",
      "Mostrar sucesso somente após a Promise resolver.",
      "Oferecer cópia da URL quando Web NFC não existir."
    ],
    "readFlow": [
      "Iniciar NDEFReader.scan em clique do usuário.",
      "Registrar readingerror.",
      "Decodificar DataView/String dos registros NDEF.",
      "Comparar URL normalizada com a URL esperada.",
      "Mostrar confirmação ou divergência do conteúdo lido."
    ],
    "fallback": {
      "apps": ["NFC Tools", "NXP TagWriter"],
      "steps": ["Copiar URL", "Abrir aplicativo Android", "Gravar", "Adicionar registro URL/URI", "Colar URL", "Aproximar cartão", "Ler para conferir"]
    },
    "protection": {
      "chips": ["NTAG213", "NTAG215", "NTAG216"],
      "goal": "Proteger escrita mantendo leitura pública",
      "mechanisms": ["PWD_AUTH", "PWD", "PACK", "AUTH0", "AUTHLIM"],
      "rules": ["Configurar pelo aplicativo NFC", "Não armazenar senha em URL, QR ou banco em texto aberto", "Não usar lock permanente no piloto", "Confirmar leitura após proteção", "Registrar somente status e nota operacional"],
      "important": "Senha NFC física é diferente da senha do painel."
    },
    "physicalApproval": ["leitura NFC", "leitura QR", "redirecionamento", "troca de destino sem regravação", "falha de regravação sem senha", "leitura continua funcionando após proteção"]
  },
  "apiContract": {
    "auth": ["auth.me", "auth.logout"],
    "dashboard": ["dashboard"],
    "business": ["business.create", "business.updateStage"],
    "tag": ["tag.create", "tag.updateDestination", "tag.updateMultilink", "tag.updatePhysicalStatus", "tag.resetPhysicalStatus", "tag.toggle"],
    "offer": ["offer.create"],
    "outreach": ["outreach.createDraft", "outreach.markOptedOut"],
    "authorization": "Todas as operações de cadastro, alteração e status exigem usuário admin.",
    "createTagResponse": { "success": true, "code": "TDABC123", "id": 123 },
    "validation": ["IDs inteiros positivos", "campos com limites de tamanho", "URL opcional vazia normalizada", "destino obrigatório em tags diretas", "destino vazio permitido somente em multilink"]
  },
  "adminInterface": {
    "route": "/",
    "tabs": ["Visão geral", "Programador NFC", "Tags e links", "Prospecção", "Ofertas"],
    "tagActions": ["criar", "copiar URL", "testar URL", "baixar PNG", "baixar SVG", "gravar NFC", "ler/verificar NFC", "editar destino", "editar MultiLink", "pré-visualizar mobile", "pausar/ativar", "marcar programada", "marcar protegida", "resetar status físico"],
    "mobileRules": ["uma coluna", "botões mínimos de 48-56px", "URL quebrável", "loading visual", "sucesso/erro destacado", "instruções NFC próximas das ações"],
    "emptyStates": ["nenhuma empresa", "nenhuma tag", "nenhuma oferta", "nenhuma mensagem"]
  },
  "commercialCrm": {
    "pipeline": ["lead", "contacted", "demo", "proposal", "won", "lost"],
    "messagePolicy": ["criar rascunho", "revisar antes de enviar", "usar canal autorizado", "registrar consentimento/origem", "respeitar opt-out", "não enviar massa sem base legal"],
    "googlePolicy": ["usar link oficial de avaliação", "pedir experiência autêntica", "não oferecer incentivo por avaliação", "não filtrar somente clientes satisfeitos", "não prometer nota ou posição"]
  },
  "security": {
    "allowedDestinationProtocols": ["http:", "https:"],
    "blockedDestinationPatterns": ["javascript:", "data:", "file:", "credenciais embutidas", "URL inválida"],
    "publicData": "A URL pública pode ser copiada; não tratá-la como segredo.",
    "privateData": ["sessão", "segredos OAuth", "DATABASE_URL", "JWT_SECRET", "senhas NFC"],
    "retention": "Não coletar IP/user-agent por padrão; usar retenção limitada para eventos se necessário.",
    "ownership": "Permitir pausar tags e manter controle administrativo do domínio e banco."
  },
  "deployment": {
    "recommendedProductionUrl": "https://tags.financasai.com.br",
    "dns": { "type": "CNAME", "host": "tags", "target": "tagdsmart-zxea2bug.manus.space", "ttl": 14400 },
    "requiredSteps": [
      "Configurar CNAME no provedor DNS.",
      "Vincular tags.financasai.com.br à hospedagem da aplicação.",
      "Emitir e confirmar certificado HTTPS.",
      "Atualizar callback OAuth para https://tags.financasai.com.br/api/oauth/callback.",
      "Definir PUBLIC_APP_URL como https://tags.financasai.com.br.",
      "Executar migrations no banco de produção.",
      "Fazer backup antes do primeiro cliente.",
      "Testar login, cadastro, /t/:code, QR e NFC.",
      "Somente então gravar cartões comerciais."
    ],
    "hostingNote": "A aplicação é full-stack; não basta enviar apenas o frontend. A plataforma destino precisa suportar servidor/API, banco, variáveis de ambiente, HTTPS e rotas públicas dinâmicas.",
    "migrationWarning": "Se migrar para Vercel ou outra plataforma serverless, adaptar o servidor Express, o callback OAuth, o banco e as rotas /t/:code antes de produção."
  },
  "qaChecklist": {
    "commands": ["pnpm check", "pnpm test", "pnpm build"],
    "browser": ["login", "criar empresa", "criar tag Google", "criar tag MultiLink", "copiar URL", "baixar QR PNG/SVG", "prévia mobile", "trocar destino", "pausar tag", "contador"],
    "physical": ["Android com NFC", "Chrome compatível", "NFC Tools", "NTAG213/215 não protegida", "gravar NDEF", "ler NDEF", "abrir URL", "testar QR", "trocar destino sem regravar", "proteger escrita", "testar leitura após proteção"],
    "definitionOfDone": "Uma unidade somente é comercializada após passar por leitura NFC, leitura QR, redirecionamento, troca de destino sem regravação e proteção de escrita sem impedir leitura."
  },
  "migrationChecklist": [
    "Criar projeto na plataforma destino.",
    "Importar frontend e backend.",
    "Criar banco e aplicar schema/migrations.",
    "Configurar variáveis de ambiente.",
    "Configurar storage de logos.",
    "Configurar OAuth e callback.",
    "Configurar domínio e HTTPS.",
    "Definir PUBLIC_APP_URL antes de criar tags.",
    "Criar usuário administrador.",
    "Migrar registros de businesses, tags, offers e outreachMessages se necessário.",
    "Testar rota pública e contadores.",
    "Regenerar QR somente se o domínio físico mudar.",
    "Não regravar cartões se a URL dinâmica e o domínio permanecerem iguais."
  ],
  "knownLimitations": [
    "Web NFC não funciona em todos os navegadores e não substitui NFC Tools.",
    "O servidor não consegue aproximar nem gravar fisicamente um cartão.",
    "A senha NFC depende do chip e aplicativo compatíveis.",
    "Mensagens comerciais automáticas não devem ser habilitadas sem integração autorizada, consentimento e opt-out.",
    "Gestão multi-tenant completa e cobrança recorrente são extensões futuras.",
    "A troca do domínio depois de gravar cartões exige regravação física das URLs."
  ],
  "rebuildOrder": [
    "configuração e autenticação",
    "schema e migrations",
    "validador de URLs",
    "CRUD de empresas",
    "CRUD de tags",
    "rota pública /t/:code",
    "contador de acessos",
    "MultiLink e sanitização",
    "QR PNG/SVG",
    "Programador NFC e fallback",
    "CRM/ofertas/prospecção",
    "testes automatizados",
    "testes físicos",
    "domínio e produção"
  ]
}
