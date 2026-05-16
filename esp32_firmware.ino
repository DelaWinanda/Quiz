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
#include <ArduinoJson.h> // Make sure to install ArduinoJson library in Arduino IDE

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
    digitalWrite(relayPins[i], LOW); // Start with all OFF
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

    // Even if DHT fails, we still want to poll for relay signals
    StaticJsonDocument<200> doc;
    doc["temp"] = isnan(t) ? 0 : t;
    doc["humidity"] = isnan(h) ? 0 : h;
    String json;
    serializeJson(doc, json);

    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(json);

    if (httpResponseCode == 200) {
      String response = http.getString();
      StaticJsonDocument<500> resDoc;
      deserializeJson(resDoc, response);

      // Apply Relay Status from Server to Physical Pins
      JsonArray relays = resDoc["relays"];
      for (int i = 0; i < 4; i++) {
        bool state = relays[i];
        digitalWrite(relayPins[i], state ? HIGH : LOW);
      }
      Serial.println("Relays updated from server");
    } else {
      Serial.print("Error code: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
  delay(3000); // Check every 3 seconds for fast response
}
