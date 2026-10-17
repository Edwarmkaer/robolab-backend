/**
 * Variables del despliegue de Convex (`npx convex env set NOMBRE valor`).
 *
 * Se leen desde globalThis para no depender de los tipos de Node: la app del
 * navegador también revisa estos archivos al importar los tipos generados.
 */
export type Env = Readonly<Record<string, string | undefined>>;

export const deploymentEnv = (): Env => (globalThis as { process?: { env?: Env } }).process?.env ?? {};
