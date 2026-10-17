/// <reference types="vite/client" />
// Módulos de funciones para convex-test: todo convex/ salvo tests y declaraciones.
export const modules = import.meta.glob(["./**/*.ts", "./**/*.js", "!./**/*.test.ts", "!./**/*.d.ts"]);
