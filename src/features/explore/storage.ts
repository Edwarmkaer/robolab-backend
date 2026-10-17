import { useCallback, useSyncExternalStore } from "react";
import { type ExploreProgress, type PlayResult, emptyProgress, parseProgress, recordPlay } from "../../domain/explore/progress";

const PROGRESS_KEY = "robolab.avance";
const DEVICE_KEY = "robolab.dispositivo";

/** El almacenamiento puede no existir (modo privado, datos bloqueados): nunca debe romper la app. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento el avance dura lo que dure la pestaña.
  }
}

let cached: { raw: string | null; value: ExploreProgress } | null = null;
const listeners = new Set<() => void>();

function snapshot(): ExploreProgress {
  const raw = read(PROGRESS_KEY);
  if (!cached || cached.raw !== raw) cached = { raw, value: parseProgress(raw) };
  return cached.value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === PROGRESS_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function save(next: ExploreProgress | null) {
  write(PROGRESS_KEY, next === null ? null : JSON.stringify(next));
  cached = null;
  listeners.forEach((l) => l());
}

/** Avance del modo abierto, guardado solo en este dispositivo. */
export function useExploreProgress() {
  const progress = useSyncExternalStore(subscribe, snapshot, emptyProgress);
  const record = useCallback((challengeId: string, result: PlayResult) => {
    save(recordPlay(snapshot(), challengeId, result, Date.now()));
  }, []);
  const clear = useCallback(() => save(null), []);
  return { progress, record, clear };
}

/** Identificador al azar de este dispositivo, solo para contar partidas sin nombres. */
export function deviceId(): string {
  const saved = read(DEVICE_KEY);
  if (saved && /^[0-9a-f]{32}$/.test(saved)) return saved;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  write(DEVICE_KEY, id);
  return id;
}
