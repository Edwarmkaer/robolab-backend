import type { MissionProvider } from "../contracts";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Qué proveedor usa el asistente, según las variables del despliegue.
 * `AGENT_PROVIDER` (gemini | anthropic) lo fija; si no, se usa Gemini cuando
 * hay GEMINI_API_KEY y, si no, Anthropic cuando hay ANTHROPIC_API_KEY.
 * Sin clave del proveedor elegido devuelve null: el asistente queda «no activado».
 */
export function chooseProvider(env: Env): MissionProvider | null {
  const gemini = env.GEMINI_API_KEY?.trim();
  const anthropic = env.ANTHROPIC_API_KEY?.trim();
  const wanted = env.AGENT_PROVIDER?.trim().toLowerCase();
  const kind = wanted === "gemini" || wanted === "anthropic" ? wanted : gemini ? "gemini" : anthropic ? "anthropic" : null;
  if (kind === "gemini" && gemini) return new GeminiProvider(gemini, env.GEMINI_MODEL?.trim() || undefined);
  if (kind === "anthropic" && anthropic) return new AnthropicProvider(anthropic, env.ANTHROPIC_MODEL?.trim() || undefined);
  return null;
}
