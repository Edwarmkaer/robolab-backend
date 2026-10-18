# Asistente de misiones (Anthropic)

El docente describe qué quiere que aprendan; el servidor le pide propuestas a
Claude, las **valida y resuelve** (`validate_mission`) y solo ofrece las que pasan.
Guardar vuelve a validar. Nada de esto llega al alumno todavía: guardar deja la
misión como borrador del docente (`agentMissions`).

## Funciones (Convex)

| Función | Qué hace |
| --- | --- |
| `agent:status` (query) | `{ configured }`: si el servidor tiene la clave. No la revela. |
| `agent:generate` (action) | Propone una misión por grado (1 a 3, entre 2.º y 4.º). Devuelve `{ status: "not_configured" }` o `{ status: "ok", proposals, failed }`. |
| `agent:save` (mutation) | Revalida y guarda una propuesta elegida como borrador. |
| `agent:listMine` (query) | Las misiones guardadas del docente. |

`failed` trae el grado y un **código** (`SCHEMA_INVALID`, `UNSOLVABLE`,
`PROVIDER_*`…), nunca texto del proveedor. Las plantillas de respaldo del
orquestador no se ofrecen como propuestas del asistente.

## Configurar

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-...        # sin ella: «asistente no activado»
npx convex env set ANTHROPIC_MODEL claude-haiku-5-5    # opcional; este es el valor por defecto
```

La clave solo vive en el despliegue de Convex. No va en la web ni en el repo.

## Control de gasto

- Cada petición hace como máximo 3 grados × 3 intentos (1 + 2 reparaciones) = 9
  llamadas, de 4096 tokens de salida como tope cada una, con 15 s de espera por
  llamada y 90 s en total.
- Por docente: `AGENT_MAX_PER_HOUR` = 5 y `AGENT_MAX_PER_DAY` = 20 peticiones
  (`convex/agent.ts`). Una solicitud inválida no cuenta.
- Los logs guardan solo metadatos (modelo, duración, reparaciones, código de
  error); nunca el objetivo del docente ni la propuesta.

## Privacidad

Solo se envía el texto del aprendizaje, la dificultad y el grado. Se rechazan
correos, teléfonos y «DNI/pasaporte» en el objetivo (bloqueo básico, no un
detector completo). No se envían datos del aula ni de alumnos.
