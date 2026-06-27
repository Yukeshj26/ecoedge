#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_INA219.h>
#include <DHT.h>

// ==========================
// WIFI
// ==========================
const char* ssid = "X";
const char* password = "Raaj123@";

// CHANGE TO YOUR PC IP
const char* mqtt_server = "192.168.137.64";
const int mqtt_port = 1883;

const char* mqtt_topic =
"ecoedge/device01/telemetry";

// ==========================
// PINS
// ==========================
#define DHTPIN 4
#define DHTTYPE DHT22

#define ACS712_PIN 35
#define ZMPT_PIN 34

// ==========================
// CALIBRATION
// ==========================
const float ACS_SENSITIVITY = 0.185;
const float ZMPT_CALIBRATION = 385.0;

// ==========================
// OBJECTS
// ==========================
WiFiClient espClient;
PubSubClient client(espClient);

DHT dht(DHTPIN, DHTTYPE);
Adafruit_INA219 ina219;

// ==========================
// WIFI
// ==========================
void setup_wifi() {

  Serial.println();
  Serial.println("Connecting WiFi");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {

    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi Connected");

  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

// ==========================
// MQTT
// ==========================
void reconnect() {

  while (!client.connected()) {

    Serial.println("Connecting MQTT...");

    if (client.connect("EcoEdgeESP32")) {

      Serial.println("MQTT Connected");

    } else {

      Serial.print("MQTT Failed rc=");
      Serial.println(client.state());

      delay(3000);
    }
  }
}

// ==========================
// ZMPT RMS
// ==========================
float getVoltageRMS() {

  int maxVal = 0;
  int minVal = 4095;

  unsigned long start = millis();

  while (millis() - start < 100) {

    int sample = analogRead(ZMPT_PIN);

    if(sample > maxVal)
      maxVal = sample;

    if(sample < minVal)
      minVal = sample;
  }

  int p2p = maxVal - minVal;

  float voltageP2P =
      (p2p * 3.3) / 4095.0;

  float voltageRMS =
      (voltageP2P / 2.828)
      * ZMPT_CALIBRATION;

  if(voltageRMS < 10)
    voltageRMS = 0;

  return voltageRMS;
}

// ==========================
// ACS712 RMS
// ==========================
float getCurrentRMS() {

  int maxVal = 0;
  int minVal = 4095;

  unsigned long start = millis();

  while (millis() - start < 100) {

    int sample =
      analogRead(ACS712_PIN);

    if(sample > maxVal)
      maxVal = sample;

    if(sample < minVal)
      minVal = sample;
  }

  int p2p = maxVal - minVal;

  float voltageP2P =
      (p2p * 3.3) / 4095.0;

  float voltageRMS =
      voltageP2P / 2.828;

  float current =
      voltageRMS /
      ACS_SENSITIVITY;

  if(current < 0.05)
    current = 0;

  return current;
}

// ==========================
// SETUP
// ==========================
void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println("EcoEdge Booting");

  Wire.begin(21,22);

  if(ina219.begin()) {

    Serial.println("INA219 Found");

  } else {

    Serial.println("INA219 NOT Found");
  }

  dht.begin();

  setup_wifi();

  client.setServer(
      mqtt_server,
      mqtt_port);

  Serial.println("System Ready");
}

// ==========================
// LOOP
// ==========================
void loop() {

  if (!client.connected()) {

    reconnect();
  }

  client.loop();

  float temp =
      dht.readTemperature();

  float hum =
      dht.readHumidity();

  if(isnan(temp))
    temp = 0;

  if(isnan(hum))
    hum = 0;

  float acVoltage =
      getVoltageRMS();

  float acCurrent =
      getCurrentRMS();

  float acPower =
      acVoltage *
      acCurrent;

  float dcVoltage =
      ina219.getBusVoltage_V();

  float dcCurrent =
      ina219.getCurrent_mA();

  float dcPower =
      ina219.getPower_mW();

  String payload = "{";

  payload += "\"ac_voltage\":";
  payload += String(acVoltage,1);
  payload += ",";

  payload += "\"ac_current\":";
  payload += String(acCurrent,2);
  payload += ",";

  payload += "\"ac_power\":";
  payload += String(acPower,1);
  payload += ",";

  payload += "\"dc_voltage\":";
  payload += String(dcVoltage,2);
  payload += ",";

  payload += "\"dc_current\":";
  payload += String(dcCurrent,1);
  payload += ",";

  payload += "\"dc_power\":";
  payload += String(dcPower,1);
  payload += ",";

  payload += "\"temperature\":";
  payload += String(temp,1);
  payload += ",";

  payload += "\"humidity\":";
  payload += String(hum,1);

  payload += "}";

  Serial.println();
  Serial.println("==================");
  Serial.println(payload);
  Serial.println("==================");

  client.publish(
      mqtt_topic,
      payload.c_str());

  delay(2000);
}