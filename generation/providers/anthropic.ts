import type { MissionProvider } from "../contracts";
import { generationPrompt, repairPrompt } from "../prompts/activity-v2";
import { ProviderError } from "./errors";
import { MAX_GROQ_RESPONSE_BYTES as MAX_RESPONSE_BYTES, limitedText } from "./groq";

/** Rápido y barato: el servidor verifica cada propuesta, así que no hace falta el modelo más grande. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";
const TOOL = "propose_mission";

/**
 * Solo servidor. Messages API oficial por fetch, sin SDK ni reintentos ocultos.
 * La misión llega como entrada de una herramienta forzada: es JSON ya separado
 * del texto, pero igual de no confiable (el orquestador la valida y la resuelve).
 */
export class AnthropicProvider implements MissionProvider {
  readonly name = "anthropic" as const;
  constructor(
    private readonly apiKey: string,
    readonly model = DEFAULT_ANTHROPIC_MODEL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async propose(input: Parameters<MissionProvider["propose"]>[0]): Promise<unknown> {
    const fail = (code: ConstructorParameters<typeof ProviderError>[0]) => new ProviderError(code, "anthropic");
    if (!this.apiKey.trim()) throw fail("PROVIDER_NOT_CONFIGURED");
    try {
      const messages = [
        { role: "user", content: generationPrompt(input.request) },
        ...(input.previousIssues.length
          ? [{ role: "user", content: repairPrompt(input.previousIssues, input.previousProposal) }]
          : []),
      ];
      const response = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        signal: input.signal,
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          temperature: 0.4,
          system: input.systemPrompt,
          // Dos mensajes de usuario seguidos no se admiten: se unen en uno.
          messages: [{ role: "user", content: messages.map((m) => m.content).join("\n\n") }],
          tools: [
            {
              name: TOOL,
              description: "Entrega la misión completa (Mission v1) como objeto. El servidor la valida y la resuelve.",
              input_schema: { type: "object", additionalProperties: true },
            },
          ],
          tool_choice: { type: "tool", name: TOOL },
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) throw fail("PROVIDER_AUTH");
        if (response.status === 429) throw fail("PROVIDER_RATE_LIMIT");
        if (response.status === 400 || response.status === 422) throw fail("SCHEMA_INVALID");
        throw fail("PROVIDER_UNAVAILABLE");
      }
      const text = await limitedText(response, input.signal);
      let envelope: unknown;
      try {
        envelope = JSON.parse(text);
      } catch {
        throw fail("SCHEMA_INVALID");
      }
      const body = envelope as { stop_reason?: unknown; content?: unknown } | null;
      if (!body || body.stop_reason !== "tool_use" || !Array.isArray(body.content)) throw fail("SCHEMA_INVALID");
      const block = body.content.find(
        (b: { type?: unknown; name?: unknown }) => b?.type === "tool_use" && b?.name === TOOL,
      ) as { input?: unknown } | undefined;
      if (!block || !block.input || typeof block.input !== "object" || Array.isArray(block.input)) throw fail("SCHEMA_INVALID");
      return block.input;
    } catch (error) {
      if (input.signal.aborted) throw fail("PROVIDER_TIMEOUT");
      if (error instanceof ProviderError) throw error;
      throw fail("PROVIDER_UNAVAILABLE");
    }
  }
}

export { MAX_RESPONSE_BYTES };
