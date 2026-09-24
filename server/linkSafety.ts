const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_MULTILINK_ITEMS = 12;

// Bloqueio defensivo de hosts privados para evitar SSRF
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127(?:\.[0-9]+){3}$/,
  /^0\.0\.0\.0$/,
  /^10(?:\.[0-9]+){3}$/,
  /^192\.168(?:\.[0-9]+){2}$/,
  /^172\.(?:1[6-9]|2[0-9]|3[0-1])(?:\.[0-9]+){2}$/,
  /^169\.254(?:\.[0-9]+){2}$/, // AWS/Cloud metadata endpoint
  /^::1$/,
  /^fe80::/i,
  /^fc00::/i,
];

export type MultiLinkItem = {
  key: string;
  label: string;
  url: string;
  enabled: boolean;
};

export type MultiLinkConfig = {
  title: string;
  subtitle: string;
  accent: string;
  background: string;
  buttonColor: string;
  buttonTextColor: string;
  logoUrl: string;
  items: MultiLinkItem[];
};

const FALLBACK_CONFIG: MultiLinkConfig = {
  title: "Acesse nossos links",
  subtitle: "Escolha uma opção",
  accent: "#06b6d4",
  background: "#08111f",
  buttonColor: "#ffffff",
  buttonTextColor: "#08111f",
  logoUrl: "",
  items: [],
};

/**
 * Sanitiza texto de entrada contra ataques de injeção (HTML/script tags, caracteres de controle e quebras de linha indevidas)
 */
export function sanitizeUserInput(raw: unknown, maxLen = 500): string {
  if (raw === null || raw === undefined) return "";
  let str = String(raw).trim();
  // Remove caracteres nulos e de controle perigosos
  str = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  // Remove tags HTML/script para evitar qualquer injeção de código
  str = str.replace(/<[^>]*>?/gm, "");
  return str.slice(0, maxLen);
}

function safeText(raw: unknown, fallback: string, max: number) {
  const cleaned = sanitizeUserInput(raw, max);
  return cleaned || fallback;
}

export function parseMultiLinkConfig(raw: string | null): MultiLinkConfig {
  if (!raw) return FALLBACK_CONFIG;
  try {
    const value = JSON.parse(raw) as Partial<MultiLinkConfig>;
    const rawItems = Array.isArray(value.items) ? value.items.slice(0, MAX_MULTILINK_ITEMS) : [];
    const items = rawItems.map(item => {
      const candidate = item as Partial<MultiLinkItem>;
      try {
        return {
          key: safeText(candidate.key, "link", 40),
          label: safeText(candidate.label, "Abrir link", 120),
          url: validatePublicDestination(String(candidate.url || "")),
          enabled: candidate.enabled !== false,
        };
      } catch {
        return null;
      }
    }).filter((item): item is MultiLinkItem => Boolean(item?.enabled));
    const color = (rawColor: unknown, fallback: string) => {
      const value = String(rawColor || fallback);
      return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
    };
    let logoUrl = "";
    if (value.logoUrl) {
      try { logoUrl = validatePublicDestination(String(value.logoUrl)); } catch { logoUrl = ""; }
    }
    return {
      title: safeText(value.title, FALLBACK_CONFIG.title, 120),
      subtitle: safeText(value.subtitle, FALLBACK_CONFIG.subtitle, 240),
      accent: color(value.accent, FALLBACK_CONFIG.accent),
      background: color(value.background, FALLBACK_CONFIG.background),
      buttonColor: color(value.buttonColor, FALLBACK_CONFIG.buttonColor),
      buttonTextColor: color(value.buttonTextColor, FALLBACK_CONFIG.buttonTextColor),
      logoUrl,
      items,
    };
  } catch {
    return FALLBACK_CONFIG;
  }
}

/**
 * Validação rigorosa de destinos públicos.
 * Bloqueia esquemas perigosos (javascript:, data:, file:, etc.) e endereços de rede privada em produção (SSRF).
 */
export function validatePublicDestination(rawUrl: string, blockPrivateHosts = false): string {
  const value = String(rawUrl || "").trim();
  if (value.length === 0 || value.length > 2048) throw new Error("O destino precisa ser uma URL válida de até 2048 caracteres");
  
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Formato de URL inválido. Utilize o formato completo http:// ou https://");
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error("Protocolo não permitido. O destino precisa usar obrigatoriamente http:// ou https://");
  }

  if (parsed.username || parsed.password) {
    throw new Error("O destino não pode conter credenciais de acesso na URL");
  }

  if (blockPrivateHosts && PRIVATE_HOST_PATTERNS.some(regex => regex.test(parsed.hostname))) {
    throw new Error("Destino bloqueado: endereços locais ou privados não são permitidos");
  }

  return parsed.toString();
}

export function isSafePublicDestination(rawUrl: string): boolean {
  try {
    validatePublicDestination(rawUrl);
    return true;
  } catch {
    return false;
  }
}

export function validateThemeColor(rawColor: string | undefined, fallback: string): string {
  const value = String(rawColor || fallback);
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error("A cor precisa estar no formato hexadecimal #RRGGBB");
  return value;
}

/**
 * Construtor seguro de link para WhatsApp
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone) throw new Error("Informe um número de WhatsApp válido");
  // Adiciona código do Brasil 55 se o usuário digitou apenas DDD + número (10 ou 11 dígitos)
  const fullPhone = cleanPhone.length <= 11 && !cleanPhone.startsWith("55") ? `55${cleanPhone}` : cleanPhone;
  const baseUrl = `https://wa.me/${fullPhone}`;
  if (!message || !message.trim()) return baseUrl;
  const sanitizedMsg = sanitizeUserInput(message, 1000);
  return `${baseUrl}?text=${encodeURIComponent(sanitizedMsg)}`;
}

/**
 * Construtor seguro de link para Instagram
 */
export function buildInstagramUrl(handleOrUrl: string): string {
  const input = sanitizeUserInput(handleOrUrl, 200).trim();
  if (!input) throw new Error("Informe o usuário ou link do Instagram");
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return validatePublicDestination(input);
  }
  const cleanHandle = input.replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "");
  if (!cleanHandle) throw new Error("Nome de usuário do Instagram inválido");
  return `https://www.instagram.com/${cleanHandle}/`;
}

/**
 * Construtor seguro de link para Google Avaliações
 */
export function buildGoogleReviewUrl(inputUrl: string): string {
  const input = sanitizeUserInput(inputUrl, 2048).trim();
  if (!input) throw new Error("Informe o link oficial de avaliação do Google");
  return validatePublicDestination(input);
}

