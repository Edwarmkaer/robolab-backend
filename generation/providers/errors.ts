import type { GenerationErrorCode, ProviderName } from "../contracts";

const NAMES: Record<ProviderName, string> = { groq: "Groq", anthropic: "Anthropic", gemini: "Gemini", ollama: "Ollama" };

function messages(provider: ProviderName): Partial<Record<GenerationErrorCode, string>> {
  const name = NAMES[provider];
  return {
    SCHEMA_INVALID: "La respuesta no contiene una misión JSON válida.",
    PROVIDER_TIMEOUT: `${name} no respondió dentro del tiempo permitido.`,
    PROVIDER_AUTH: `La clave de ${name} no autoriza esta solicitud. Revisa la configuración del servidor.`,
    PROVIDER_RATE_LIMIT: `${name} alcanzó su límite de solicitudes. Intenta más tarde.`,
    PROVIDER_UNAVAILABLE: `No pudimos conectar con ${name} o el modelo no está disponible.`,
    PROVIDER_RESPONSE_TOO_LARGE: "La respuesta del proveedor excedió el límite permitido.",
    PROVIDER_NOT_CONFIGURED: `Falta configurar ${name} en el servidor. Puedes usar las plantillas.`,
  };
}

/** Nunca incluye cuerpo HTTP, claves ni mensajes crudos del proveedor. */
export class ProviderError extends Error {
  constructor(
    readonly code: GenerationErrorCode,
    provider: ProviderName = "groq",
  ) {
    super(messages(provider)[code] ?? "No se pudo completar la generación.");
    this.name = "ProviderError";
  }
}
