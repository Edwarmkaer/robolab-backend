import { useCallback, useState } from "react";

/**
 * Token de sesión del alumno guardado en el navegador. Si el almacenamiento
 * no está disponible (modo privado estricto), la sesión vive solo en memoria.
 */
const KEY = "inrobit.alumno.token";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento: la sesión dura lo que dure la pestaña.
  }
}

export function useStudentToken() {
  const [token, setToken] = useState<string | null>(read);
  const save = useCallback((value: string | null) => {
    write(value);
    setToken(value);
  }, []);
  return [token, save] as const;
}
