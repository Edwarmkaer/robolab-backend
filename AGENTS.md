# Guía para agentes y colaboradores

RoboLab: retos de programación con un robot (modo abierto, sin cuenta) y
evaluaciones que se juegan (docente + alumnos con código). Vite + React 19 +
TypeScript, backend en Convex. El README explica el producto; aquí van las
reglas para trabajar en el código.

## Comandos

```bash
npm ci                 # instalar (usa el lockfile)
npx convex dev         # backend local; déjalo corriendo (regenera convex/_generated)
npm run setup          # una vez por backend: claves de sesión, SITE_URL y correo en consola
npm run dev            # web en http://localhost:5173
npm run verify         # tipos + lint + pruebas + build: debe pasar antes de cada commit
```

Un agente sin cuenta de Convex puede levantar el backend local sin preguntas con
`CONVEX_AGENT_MODE=anonymous npx convex dev --once` (o sin `--once` para dejarlo vivo).

Útiles: `npx convex run demo:seed '{"email":"…","today":"AAAA-MM-DD"}'` (datos de
ejemplo), `npx convex run robot:register '{"name":"Kusi"}'` (robot por wifi),
`npx convex run explore:stats` (uso anónimo), `npx convex logs` (correos en modo consola).

## Arquitectura (respétala)

- `src/domain/` es TypeScript puro: sin React, sin Convex, sin red. Lo usan el
  navegador y el servidor. Toda regla de negocio nueva va aquí, con su prueba.
- `convex/` son las funciones del backend. Toda consulta del docente pasa por
  `convex/lib/access.ts`; las del alumno, por su token de sesión.
- El servidor es la autoridad: vuelve a simular los programas, cuenta las
  ejecuciones y califica con su reloj. Nunca confíes en lo que manda el navegador.
- Al alumno nunca se le envía la respuesta correcta (`correctOption`).
- Las validaciones (nombres, contraseña, preguntas) están en el dominio y se usan
  igual en el formulario y en el servidor: no las dupliques.
- Pantallas en `src/features/<área>/`; componentes y estilos comunes en
  `src/shared/ui/` (tokens de color en `styles.css`, íconos en `Icon.tsx`).

## Cómo trabajar

- Prueba primero: un error se reproduce con una prueba que falla, y esa prueba
  se queda. Las pruebas del backend usan `convex-test` (no necesitan backend).
- Corre `npm run verify` antes de cada commit; GitHub Actions lo vuelve a correr.
- Textos de la interfaz en español neutro, cortos y pensados para niños o
  docentes. Botones con ícono siempre llevan etiqueta accesible.
- Commits pequeños, en español, que expliquen el porqué. Trabaja en una rama y
  abre un pull request; no hagas `push --force` sobre `main`.

## Cuidado con

- `convex/_generated/` se sube al repo pero no se edita a mano: lo regenera
  `npx convex dev`. Si cambias funciones de `convex/`, corre `convex dev` antes
  del chequeo de tipos.
- Con `convex dev` corriendo, no reescribas historia (rebase): regenera archivos
  a mitad del proceso. Detenlo primero.
- Secretos (claves de API, contraseñas, la clave del robot) nunca van al repo ni
  al código del navegador: van con `npx convex env set`. No subas `.env.local`
  ni `.env.test.local`.
- En Windows PowerShell 5.1, `Get-Content`/`Set-Content` dañan las tildes al
  editar archivos; usa un editor o herramientas que respeten UTF-8.
