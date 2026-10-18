import type { MissionProvider } from "../contracts";
import { generationPrompt, repairPrompt } from "../prompts/activity-v2";
import { ProviderError } from "./errors";
import { limitedText } from "./groq";

/** Flash-Lite: el más rápido en las pruebas reales (gemini-2.5-flash ya no está para cuentas nuevas y los Flash 3.5/3.8 pasaban los 15 s de espera). El servidor verifica la propuesta. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

/**
 * Solo servidor. API REST oficial (generateContent) por fetch, sin SDK ni
 * reintentos ocultos. La clave va en la cabecera, nunca en la URL. La respuesta
 * llega como JSON (responseMimeType), igual de no confiable: el orquestador la
 * valida y la resuelve.
 */
export class GeminiProvider implements MissionProvider {
  readonly name = "gemini" as const;
  constructor(
    private readonly apiKey: string,
    readonly model = DEFAULT_GEMINI_MODEL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async propose(input: Parameters<MissionProvider["propose"]>[0]): Promise<unknown> {
    const fail = (code: ConstructorParameters<typeof ProviderError>[0]) => new ProviderError(code, "gemini");
    if (!this.apiKey.trim()) throw fail("PROVIDER_NOT_CONFIGURED");
    try {
      const text = [
        generationPrompt(input.request),
        ...(input.previousIssues.length ? [repairPrompt(input.previousIssues, input.previousProposal)] : []),
      ].join("\n\n");
      const response = await this.fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": this.apiKey, "content-type": "application/json" },
          signal: input.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: input.systemPrompt }] },
            contents: [{ role: "user", parts: [{ text }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 4096, responseMimeType: "application/json" },
          }),
        },
      );
      if (!response.ok) {
        if (response.status === 400) {
          // Una clave inválida llega como 400 (INVALID_ARGUMENT / API_KEY_INVALID): es de autorización, no de la propuesta.
          const body = await limitedText(response, input.signal).catch(() => "");
          throw fail(/API_KEY_INVALID/.test(body) ? "PROVIDER_AUTH" : "SCHEMA_INVALID");
        }
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) throw fail("PROVIDER_AUTH");
        if (response.status === 429) throw fail("PROVIDER_RATE_LIMIT");
        if (response.status === 422) throw fail("SCHEMA_INVALID");
        throw fail("PROVIDER_UNAVAILABLE");
      }
      let envelope: unknown;
      try {
        envelope = JSON.parse(await limitedText(response, input.signal));
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw fail("SCHEMA_INVALID");
      }
      const candidate = (envelope as { candidates?: { finishReason?: unknown; content?: { parts?: { text?: unknown }[] } }[] } | null)?.candidates?.[0];
      const part = candidate?.content?.parts?.[0]?.text;
      if (!candidate || candidate.finishReason !== "STOP" || typeof part !== "string") throw fail("SCHEMA_INVALID");
      let mission: unknown;
      try {
        mission = JSON.parse(part);
      } catch {
        throw fail("SCHEMA_INVALID");
      }
      if (!mission || typeof mission !== "object" || Array.isArray(mission)) throw fail("SCHEMA_INVALID");
      return mission;
    } catch (error) {
      if (input.signal.aborted) throw fail("PROVIDER_TIMEOUT");
      if (error instanceof ProviderError) throw error;
      throw fail("PROVIDER_UNAVAILABLE");
    }
  }
}
