# Robot por wifi

La app no se conecta directo al robot: una página publicada con HTTPS no
puede llamar a un aparato de la red local por HTTP (el navegador lo bloquea).
Por eso el programa pasa por el backend y el robot lo recoge:

```
App ── "Enviar al robot" ──▶ Convex ◀── GET /robot/siguiente (cada 0,5 s) ── ESP32
                                    ◀── POST /robot/hecho (al terminar) ─────
```

Así funciona con la app publicada y desde cualquier red, siempre que el robot
tenga wifi con internet.

## 1. Registrar el robot (una vez)

```bash
npx convex run robot:register '{"name":"Kusi"}'
```

Devuelve:

- `code`: 6 caracteres (por ejemplo `SR965H`). Va en una etiqueta del robot;
  es lo que se escribe en la app en "Conectar un robot".
- `key`: la clave del robot. Va solo en el firmware. Se guarda cifrada en el
  backend, así que si se pierde hay que registrar el robot otra vez.

## 2. Lo que recibe el robot

| Petición | Respuesta |
|---|---|
| `GET /robot/siguiente?codigo=SR965H` con encabezado `X-Clave: <clave>` | `200` con el programa en texto, por ejemplo `AADAA` · `204` si no hay nada · `401` si el código o la clave no corresponden |
| `POST /robot/hecho?codigo=SR965H` con `X-Clave` | `200`: la app muestra "¡El robot terminó!" |

El programa usa una letra por paso, con los bucles ya desplegados (el mismo
formato del kit de 2025): `A` avanzar, `R` retroceder, `D` girar a la
derecha, `Z` girar a la izquierda. Si se envían dos programas seguidos, el
robot recibe solo el último.

La dirección base es la de las rutas HTTP de Convex: en la nube,
`https://<despliegue>.convex.site`; en pruebas locales,
`http://<IP de la PC>:3211` con la PC y el robot en el mismo wifi (el
firewall de Windows puede pedir permiso para ese puerto).

## 3. Firmware

`firmware/robolab_robot/robolab_robot.ino` ya hace la conexión, la consulta
cada medio segundo, la lectura de letras y el aviso de fin. Solo falta
completar `avanzar()`, `retroceder()`, `girarDerecha()` y `girarIzquierda()`
con los motores. Usa `WiFi`, `HTTPClient` y `WiFiClientSecure`, que vienen
con el soporte de ESP32 de Arduino. No está compilado ni probado en una placa:
compílalo en el Arduino IDE antes del evento.

## Probar sin robot

Se puede simular el robot desde la PC:

```bash
curl -i -H "X-Clave: <clave>" "http://127.0.0.1:3211/robot/siguiente?codigo=SR965H"
```
