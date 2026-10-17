import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";

type Tone = "ok" | "error" | "info";
type Action = { readonly label: string; readonly onClick: () => void };
type Toast = { readonly id: number; readonly message: string; readonly tone: Tone; readonly action?: Action };
type Show = (message: string, options?: { tone?: Tone; action?: Action }) => void;

const ToastContext = createContext<Show | null>(null);

const DURATION_MS = 5000;
const WITH_ACTION_MS = 8000;

/** Avisos breves al pie de la pantalla ("Se agregaron 3 alumnos", "Deshacer"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<Show>(
    (message, options) => {
      const id = ++nextId.current;
      const toast: Toast = { id, message, tone: options?.tone ?? "ok", ...(options?.action ? { action: options.action } : {}) };
      setToasts((list) => [...list.slice(-2), toast]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), options?.action ? WITH_ACTION_MS : DURATION_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" data-tone={t.tone}>
            <Icon name={t.tone === "error" ? "alert" : "checkCircle"} />
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="toast-close" aria-label="Cerrar aviso" onClick={() => dismiss(t.id)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast necesita un ToastProvider más arriba.");
  return show;
}
