/*
  Smart Home ESP32 Connection Code
  Connect: 
  - DHT11: Pin 4
  - Relay 1: Pin 5
  - Relay 2: Pin 18
  - Relay 3: Pin 19
  - Relay 4: Pin 23
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "https://YOUR-APP-URL.vercel.app/api/update";

#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

const int relayPins[] = {5, 18, 19, 23};

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  for(int i=0; i<4; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], LOW);
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (!isnan(h) && !isnan(t)) {
      HTTPClient http;
      http.begin(serverUrl);
      http.addHeader("Content-Type", "application/json");

      String json = "{\"temp\":" + String(t) + ",\"humidity\":" + String(h) + "}";
      int httpResponseCode = http.POST(json);

      if (httpResponseCode > 0) {
        Serial.print("Data sent, code: ");
        Serial.println(httpResponseCode);
      }
      http.end();
    }
  }
  delay(5000); // Send data every 5 seconds
}
