import { useConvexConnectionState } from "convex/react";
import { useEffect, useState } from "react";
import { connectionNotice } from "../connection";
import { Icon } from "./Icon";

/** Aviso fijo arriba cuando no hay conexión con el servidor o responde muy lento. */
export function ConnectionBanner() {
  const state = useConvexConnectionState();
  const [now, setNow] = useState(() => Date.now());
  const waiting = state.hasInflightRequests || !state.isWebSocketConnected;

  // Solo avanza el reloj mientras hay algo pendiente, para detectar pedidos lentos.
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  const notice = connectionNotice(state, now);
  if (!notice) return null;
  return (
    <div className="connection-banner" data-kind={notice.kind} role="status">
      <Icon name="alert" size={18} />
      <span>{notice.message}</span>
    </div>
  );
}
