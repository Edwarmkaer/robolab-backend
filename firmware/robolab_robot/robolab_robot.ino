// RoboLab: el robot pide su programa por wifi y lo ejecuta.
//
// Cada medio segundo pregunta al backend si hay un programa para él.
// Recibe texto con una letra por paso (los bucles ya vienen desplegados):
//   A avanzar · R retroceder · D girar a la derecha · Z girar a la izquierda
// Al terminar avisa con POST /robot/hecho para que la app muestre "¡El robot terminó!".
//
// Lo único que hay que completar son las 4 funciones de movimiento con el
// código de motores que ya tienen (el del kit de 2025 usa las mismas letras).

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ---- Configuración ----
const char* WIFI_NOMBRE = "NOMBRE_DEL_WIFI";
const char* WIFI_CLAVE = "CLAVE_DEL_WIFI";
// En la nube: "https://<despliegue>.convex.site".
// En pruebas locales: "http://<IP de la PC>:3211" (PC y robot en el mismo wifi).
const char* SERVIDOR = "https://DESPLIEGUE.convex.site";
const char* ROBOT_CODIGO = "CODIGO";  // el de la etiqueta (lo da robot:register)
const char* ROBOT_CLAVE = "CLAVE";    // la clave que da robot:register; no la publiques

const unsigned long ESPERA_MS = 500;       // cada cuánto pregunta
const unsigned long PAUSA_ENTRE_PASOS = 150;

WiFiClientSecure clienteSeguro;
WiFiClient clienteSimple;

// ---- Movimientos: completar con los motores del robot ----
void avanzar() {
  // Una casilla hacia adelante.
}

void retroceder() {
  // Una casilla hacia atrás, sin girar.
}

void girarDerecha() {
  // 90 grados a la derecha, sin avanzar.
}

void girarIzquierda() {
  // 90 grados a la izquierda, sin avanzar.
}

void ejecutar(const String& programa) {
  for (size_t i = 0; i < programa.length(); i++) {
    switch (programa[i]) {
      case 'A': avanzar(); break;
      case 'R': retroceder(); break;
      case 'D': girarDerecha(); break;
      case 'Z': girarIzquierda(); break;
      default: continue;  // salto de línea u otro carácter: se ignora
    }
    delay(PAUSA_ENTRE_PASOS);
  }
}

// Prepara la petición con la clave en el encabezado (no en la dirección).
bool abrir(HTTPClient& http, const char* ruta) {
  String url = String(SERVIDOR) + ruta + "?codigo=" + ROBOT_CODIGO;
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

void avisarQueTermino() {
  HTTPClient http;
  if (abrir(http, "/robot/hecho")) {
    http.POST("");
    http.end();
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
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(1000);
    return;
  }

  HTTPClient http;
  if (abrir(http, "/robot/siguiente")) {
    int estado = http.GET();
    if (estado == 200) {  // hay un programa
      String programa = http.getString();
      http.end();
      programa.trim();
      Serial.println("Programa: " + programa);
      ejecutar(programa);
      avisarQueTermino();
    } else {
      // 204: no hay nada nuevo. 401: código o clave incorrectos.
      if (estado == 401) Serial.println("Codigo o clave del robot incorrectos");
      else if (estado < 0) Serial.println("Sin respuesta del servidor");
      http.end();
    }
  }
  delay(ESPERA_MS);
}
