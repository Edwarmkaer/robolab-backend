// RoboLab: el robot recibe su programa por wifi y lo ejecuta (contrato robot-protocol.md).
//
// Cada medio segundo pregunta al relé si hay un programa. Lo recibe como texto
// ("AADZAA") o, con PEDIR_ARRAY, como arreglo JSON (["A","A","D","Z","A","A"]).
// Una letra por paso, con los bucles ya desplegados, máximo 128:
//   A  avanzar 1 casilla
//   R  retroceder 1 casilla (sin girar)
//   D  girar sobre su sitio: dir = (dir + 270) % 360  -> a la IZQUIERDA
//   Z  girar sobre su sitio: dir = (dir + 90)  % 360  -> a la DERECHA
// (dir: 0 arriba, 90 derecha, 180 abajo, 270 izquierda, visto desde arriba).
// Responde OK al recibir, RUN al empezar, DONE al terminar o ERR:<código>.
//
// Lo único que hay que completar son las 4 funciones de movimiento.

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ---- Configuración ----
// El wifi, el servidor y la clave del robot van en secretos.h (copia de
// secretos.ejemplo.h), que no se sube al repo. Sin ese archivo compila igual,
// con los valores de ejemplo.
#if __has_include("secretos.h")
#include "secretos.h"
#else
#include "secretos.ejemplo.h"
#endif

const char* WIFI_NOMBRE = SECRETO_WIFI_NOMBRE;
const char* WIFI_CLAVE = SECRETO_WIFI_CLAVE;
const char* SERVIDOR = SECRETO_SERVIDOR;
const char* ROBOT_CLAVE = SECRETO_ROBOT_CLAVE;

const bool PEDIR_ARRAY = false;  // true: el programa llega como ["A","A","D"]
const unsigned long ESPERA_MS = 500;
const unsigned long PAUSA_ENTRE_PASOS = 150;
const unsigned long MOSTRAR_CODIGO_CADA_MS = 10UL * 60UL * 1000UL;
const size_t MAX_PASOS = 128;

WiFiClientSecure clienteSeguro;
WiFiClient clienteSimple;
unsigned long ultimoCodigoMostrado = 0;

// ---- Movimientos: completar con los motores del robot ----
void avanzar() {
  // Una casilla hacia adelante.
}

void retroceder() {
  // Una casilla hacia atrás, sin girar.
}

void girarIzquierda() {  // letra D
  // 90 grados a la izquierda, sin avanzar.
}

void girarDerecha() {  // letra Z
  // 90 grados a la derecha, sin avanzar.
}

// ---- Comunicación con el relé ----
bool abrir(HTTPClient& http, const String& ruta) {
  String url = String(SERVIDOR) + ruta;
  bool ok;
  if (url.startsWith("https")) {
    clienteSeguro.setInsecure();  // sin verificar el certificado: aceptable para la demo
    ok = http.begin(clienteSeguro, url);
  } else {
    ok = http.begin(clienteSimple, url);
  }
  if (ok) http.addHeader("X-Clave", ROBOT_CLAVE);
  return ok;
}

void responder(const String& mensaje) {  // OK, RUN, DONE o ERR:<código>
  HTTPClient http;
  if (abrir(http, "/robot/estado")) {
    http.addHeader("Content-Type", "text/plain");
    http.POST(mensaje);
    http.end();
  }
}

void mostrarCodigo() {
  HTTPClient http;
  if (!abrir(http, "/robot/codigo")) return;
  const char* encabezados[] = {"X-Vence-En"};
  http.collectHeaders(encabezados, 1);
  if (http.GET() == 200) {
    // Si el robot tiene pantalla, mostrar aquí el código: es el que se escribe en la web.
    Serial.println("Codigo del robot: " + http.getString() + " (vence en " + http.header("X-Vence-En") + " s)");
  } else {
    Serial.println("No se pudo leer el codigo: revisa SERVIDOR y ROBOT_CLAVE");
  }
  http.end();
  ultimoCodigoMostrado = millis();
}

// Extrae las letras del cuerpo: sirve igual para "AADZAA" y para ["A","A","D","Z","A","A"].
String letrasDe(const String& cuerpo, bool& letraInvalida) {
  String letras;
  letraInvalida = false;
  for (size_t i = 0; i < cuerpo.length(); i++) {
    char c = cuerpo[i];
    if (PEDIR_ARRAY && (c == '[' || c == ']' || c == ',' || c == '"' || c == ' ' || c == '\n' || c == '\r')) continue;
    if (!PEDIR_ARRAY && (c == '\n' || c == '\r')) continue;
    if (c == 'A' || c == 'R' || c == 'D' || c == 'Z') {
      letras += c;
    } else {
      letraInvalida = true;
    }
  }
  return letras;
}

void ejecutar(const String& programa) {
  for (size_t i = 0; i < programa.length(); i++) {
    switch (programa[i]) {
      case 'A': avanzar(); break;
      case 'R': retroceder(); break;
      case 'D': girarIzquierda(); break;
      case 'Z': girarDerecha(); break;
    }
    delay(PAUSA_ENTRE_PASOS);
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_NOMBRE, WIFI_CLAVE);
  Serial.print("Conectando al wifi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWifi conectado: " + WiFi.localIP().toString());
  mostrarCodigo();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(1000);
    return;
  }
  if (millis() - ultimoCodigoMostrado > MOSTRAR_CODIGO_CADA_MS) mostrarCodigo();

  HTTPClient http;
  if (abrir(http, PEDIR_ARRAY ? "/robot/siguiente?formato=array" : "/robot/siguiente")) {
    int estado = http.GET();
    if (estado == 200) {  // hay un programa
      String cuerpo = http.getString();
      http.end();
      bool letraInvalida;
      String programa = letrasDe(cuerpo, letraInvalida);
      Serial.println("Programa: " + programa);
      if (letraInvalida || programa.length() == 0) {
        responder("ERR:BAD_CHAR");
      } else if (programa.length() > MAX_PASOS) {
        responder("ERR:TOO_LONG");
      } else {
        responder("OK");
        responder("RUN");
        ejecutar(programa);  // si un motor falla, responder("ERR:MOTOR") en lugar de DONE
        responder("DONE");
      }
    } else {
      // 204: no hay nada nuevo. 401: clave incorrecta. Negativo: sin respuesta del servidor.
      if (estado == 401) Serial.println("Clave del robot incorrecta");
      else if (estado < 0) Serial.println("Sin respuesta del servidor");
      http.end();
    }
  }
  delay(ESPERA_MS);
}
