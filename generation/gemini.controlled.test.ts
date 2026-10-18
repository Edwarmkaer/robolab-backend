import process from "node:process";
import { expect, it } from "vitest";
import { generateActivity } from "./orchestrator";
import { GeminiProvider } from "./providers/gemini";

// Solo con aceptación explícita: ROBOLAB_GEMINI_EVAL=1 y GEMINI_API_KEY en el entorno (no se registra su valor).
// Un grado, como máximo 3 llamadas.
const enabled = process.env.ROBOLAB_GEMINI_EVAL === "1";
it.skipIf(!enabled)("evaluación controlada con Gemini real", async () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Configura GEMINI_API_KEY en el entorno.");
  const provider = new GeminiProvider(key, process.env.GEMINI_MODEL || undefined);
  const [entry] = await generateActivity(
    { objective: "Comparar sumas de costos y elegir un recorrido con presupuesto limitado.", grades: [3], difficulty: "balanced" },
    provider,
  );
  console.info(JSON.stringify({ model: entry!.model, calls: entry!.calls, repairs: entry!.repairs, origin: entry!.origin, errorCode: entry!.errorCode, minimumEnergy: entry!.metrics.minimumEnergy }));
  expect(entry!.calls).toBeLessThanOrEqual(3);
  // Una plantilla de respaldo es un fallo de la evaluación, nunca un pase.
  expect(entry!.origin).toBe("ai_generated");
}, 95000);
