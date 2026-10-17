import { Component, type ReactNode } from "react";
import { userMessage } from "../errors";

type Props = {
  readonly children: ReactNode;
  /** Qué mostrar si algo falla; `reset` vuelve a intentar. */
  readonly fallback: (message: string, reset: () => void) => ReactNode;
};

type State = { readonly error: unknown };

/**
 * Las consultas de Convex lanzan sus errores al renderizar (por ejemplo, una
 * sesión vencida). Este límite los atrapa y muestra un mensaje en vez de una
 * pantalla en blanco.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error !== null) return this.props.fallback(userMessage(this.state.error), this.reset);
    return this.props.children;
  }
}
