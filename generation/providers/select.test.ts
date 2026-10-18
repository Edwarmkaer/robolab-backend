import { describe, expect, it } from "vitest";
import { chooseProvider } from "./select";

describe("qué proveedor usa el asistente", () => {
  it("sin ninguna clave no hay proveedor (asistente no activado)", () => {
    expect(chooseProvider({})).toBeNull();
    expect(chooseProvider({ GEMINI_API_KEY: "  ", ANTHROPIC_API_KEY: "" })).toBeNull();
  });
  it("con la clave de Gemini usa Gemini, con su modelo por defecto o el configurado", () => {
    expect(chooseProvider({ GEMINI_API_KEY: "g" })).toMatchObject({ name: "gemini", model: "gemini-3.1-flash-lite" });
    expect(chooseProvider({ GEMINI_API_KEY: "g", GEMINI_MODEL: "gemini-3.5-flash" })).toMatchObject({ model: "gemini-3.5-flash" });
  });
  it("con solo la de Anthropic usa Anthropic", () => {
    expect(chooseProvider({ ANTHROPIC_API_KEY: "a" })).toMatchObject({ name: "anthropic", model: "claude-haiku-5-5" });
  });
  it("con las dos claves prefiere Gemini, salvo que AGENT_PROVIDER diga otra cosa", () => {
    expect(chooseProvider({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" })?.name).toBe("gemini");
    expect(chooseProvider({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", AGENT_PROVIDER: "anthropic" })?.name).toBe("anthropic");
    expect(chooseProvider({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", AGENT_PROVIDER: "GEMINI" })?.name).toBe("gemini");
  });
  it("si AGENT_PROVIDER pide uno sin clave, no cae en el otro en silencio: queda no activado", () => {
    expect(chooseProvider({ GEMINI_API_KEY: "g", AGENT_PROVIDER: "anthropic" })).toBeNull();
  });
  it("un valor desconocido de AGENT_PROVIDER se ignora", () => {
    expect(chooseProvider({ ANTHROPIC_API_KEY: "a", AGENT_PROVIDER: "otro" })?.name).toBe("anthropic");
  });
});
