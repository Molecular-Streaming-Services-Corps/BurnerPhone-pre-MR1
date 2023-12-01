/*
     _       _                 _ _       ____                            _     _   _
  __| | ___ | | ___  _ __ ___ (_| |_ ___|  _ \ _   _ _ __ __ _ _ __ ___ (_) __| | (_)_ __   ___
 / _` |/ _ \| |/ _ \| '_ ` _ \| | __/ _ | |_) | | | | '__/ _` | '_ ` _ \| |/ _` | | | '_ \ / _ \
| (_| | (_) | | (_) | | | | | | | ||  __|  __/| |_| | | | (_| | | | | | | | (_| |_| | | | | (_) |
 \__,_|\___/|_|\___/|_| |_| |_|_|\__\___|_|    \__, |_|  \__,_|_| |_| |_|_|\__,_(_|_|_| |_|\___/
                                               |___/
Program to burn nanopores using a computer or a phone as a controller interface
uses ADS1115 ADC and 
Date: 10.06.2023
Programmer: KJC                                               
*/

#include <WiFi.h>         //
#include <WiFiClient.h>   //
#include <WebServer.h>    //
#include <ESPmDNS.h>      //
#include <SPIFFS.h>       //
#include <SPI.h>          //
#include <Wire.h>         //
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ADS1115_WE.h>   // libraries for the ADC
#include <driver/gpio.h>  // libraries to provide the pulse width ISR
#include <driver/timer.h>

const char *ssid = "NETGEAR13";
const char *password = "dynamicnest700";

WebServer server(80);

// const int led = 2;
// const int led2 = 13;
// const int led1 =  5;
// const int led0 =  4;

#define DAC_PIN1 25
#define DAC_PIN2 26

#define I2C_ADDRESS 0x48

#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels

#define RELAY_PIN 5 // pin to change relay when pulse is being delivered
#define PULSE_PIN (gpio_num_t)4 // pin to actually turn on the battery pulse for burning a hole

ADS1115_WE adc(I2C_ADDRESS);

#define OLED_RESET     -1 // Reset pin # (or -1 if sharing Arduino reset pin)
#define SCREEN_ADDRESS 0x3C ///< See datasheet for Address; 0x3D for 128x64, 0x3C for 128x32
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

uint8_t KeithleyButton = 0; // The button on the Keithley front panel
uint8_t TimePulseButton = 0; // the uS, mS, S button(s)
uint16_t TimePulseMagnitude = 10; // this is the value in the browser text box ~ set when browser "pulse" is pressed
uint32_t magnitude = 0;
bool PulseService = false; // this bit is set when a TimePulseMagnitude is set. It is reset by the ISR that creates the pulse
uint16_t globalPulseWidth = 0; // This can be used by the ISR that actually creates the pulse and resets "PulseService"

float voltage = 0.0; // variable used to evaluate voltage input

const int ledPin = BUILTIN_LED; 
const int freq = 5000;  // PWM frequency: 5kHz
const int ledChannel = 0;
const int resolution = 8;  // 8-bit resolution
uint8_t ledPinBrightness = 0;
uint8_t ledPinDirection = 1;

const int taskCount = 16;
unsigned long currentMicros[taskCount];
unsigned long previousMicros[taskCount];
unsigned long intervalMicros[taskCount] = {   1250,  101000,   17000,   19531, 
                                            193000,  317000,  443000,  431000, 
                                            199000,  313000,  437000,  499000, 
                                            823000,  997000,  701000,  883000, }; 

/* 
 ____       _
/ ___|  ___| |_ _   _ _ __
\___ \ / _ | __| | | | '_ \
 ___) |  __| |_| |_| | |_) |
|____/ \___|\__|\__,_| .__/
                     |_|
*/
void setup(void) {
  ledcSetup(ledChannel, freq, resolution);  
  ledcAttachPin(ledPin, ledChannel); 

  // pinMode(led0, OUTPUT);
  // pinMode(led1, OUTPUT);
  // pinMode(led2, OUTPUT);
  // digitalWrite(LED_BUILTIN, 0);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(PULSE_PIN, OUTPUT);
  Wire.begin();
  Serial.begin(115200);
  if (!adc.init()) {
    Serial.println("ADS1115 not connected!");
  } else {
    Serial.println("ADS1115 connected successfully!");
  }
 
  adc.setVoltageRange_mV(ADS1115_RANGE_4096); //comment line/change parameter to change range
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.println("");

  // initialize SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("An error has occurred while mounting SPIFFS");
    return;
  } 
  else {
    Serial.println("SPIFFS mounted successfully");
  }

  // Wait for connection
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); // print a dot twice a second until connected...
    Serial.print(".");
  }

  Serial.println("");
  Serial.print("Connected to ");
  Serial.println(ssid);
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  if (MDNS.begin("esp32")) {
    Serial.println("MDNS responder started");
  }

  server.on("/", handleRoot);
  
  server.on("/setVoltage", HTTP_GET, handleSetVoltage);

  server.onNotFound(handleNotFound);

  server.on("/p5.min.js", HTTP_GET, [](){ // the program that handles the cool graphics.
  File file = SPIFFS.open("/p5.min.js", "r");
  server.streamFile(file, "application/javascript");
  file.close();
  });

  server.on("/dolomitePyramid.js", HTTP_GET, [](){ // this is the main sketch function
  File file = SPIFFS.open("/dolomitePyramid.js", "r");
  server.streamFile(file, "application/javascript");
  file.close();
  });

server.on("/setcurrentvalue", HTTP_GET, [](){ // handle the KeithleyButton variable
  if(server.hasArg("value")) {
    String valueReceived = server.arg("value");
    Serial.println("Received Keithley button: " + valueReceived);
    KeithleyButton = valueReceived.toInt();
    server.send(200, "text/plain", "Data received");
  } else {
    server.send(400, "text/plain", "No value received");
  }
});

server.on("/settimerange", HTTP_GET, [](){ // handle the orders of time magnitudes i.e. uS, mS, S 
  if(server.hasArg("value")) {
    String valueReceived = server.arg("value");
    Serial.println("Received time range: " + valueReceived);
    TimePulseButton = valueReceived.toInt();
    server.send(200, "text/plain", "Data received");
  } else {
    server.send(400, "text/plain", "No value received");
  }
});

server.on("/settimevalue", HTTP_GET, [](){ // handle pulse-width text box
  if(server.hasArg("value")) {
    String valueReceived = server.arg("value");
    Serial.println("Received time value: " + valueReceived);
    TimePulseMagnitude = valueReceived.toInt();
    // PulseService |= TRUE;
    server.send(200, "text/plain", "Data received");
  } else {
    server.send(400, "text/plain", "No value received");
  }
});

server.on("/getCurrent", HTTP_GET, []() { // The browser just asked for the ADS1115's Keithley data
    // Use the function you have to read voltage
    float voltage = readChannel(ADS1115_COMP_3_GND); 
    // y=−63.9313⋅x+106.00 is the slope/intercept equation
    voltage *=-17.490; voltage += 29.220;
    // voltage *= -63.9313; voltage += 106.00;
    server.send(200, "text/plain", String(voltage));
});

server.on("/pulseWasPressed", HTTP_GET, [](){
    PulseService = true;

    if(server.hasArg("pulseWidth")) {
        String pulseWidthReceived = server.arg("pulseWidth");
        globalPulseWidth = pulseWidthReceived.toInt(); // Convert string to integer and store it globally
        Serial.print("PULSE WIDTH: ");
        Serial.println(pulseWidthReceived);
        magnitude = globalPulseWidth;
        for(int i = 0; i < TimePulseButton; i++) {
          magnitude *= 1000;
        }

        // You can now convert pulseWidthReceived to an appropriate type and use it.
    }
    // Serial.println("PULSE");
    server.send(200, "text/plain", "Pulse button pressed with value");
});


server.on("/maxine64_7VF_icon.ico", HTTP_GET, [](){
    File file = SPIFFS.open("/maxine64_7VF_icon.ico", "r");
    server.streamFile(file, "image/x-icon");
    file.close();
});


  server.begin();
  Serial.println("HTTP server started");
}
/*
 _
| |    ___   ___  _ __
| |   / _ \ / _ \| '_ \
| |__| (_) | (_) | |_) |
|_____\___/ \___/| .__/
                 |_|
*/
void loop(void) {
  server.handleClient();
  delay(2);//allow the cpu to switch to other tasks
  // if(PulseService) {
  //   relayOn();
  //   PulseService = false;
  //   setupTimer(globalPulseWidth);
  //   relayOff();
  // }
  tasks();
}
/*
 _____                 _   _
|  ____   _ _ __   ___| |_(_) ___  _ __  ___
| |_ | | | | '_ \ / __| __| |/ _ \| '_ \/ __|
|  _|| |_| | | | | (__| |_| | (_) | | | \__ \
|_|   \__,_|_| |_|\___|\__|_|\___/|_| |_|___/

*/
///////////////////////////////////////////////// SERVER FUNCTIONS ////////////////////////////////////////////////
void tasks() {
  for(int i = 0; i < taskCount; i++) {
    currentMicros[i] = micros();
    if(currentMicros[i] - previousMicros[i] >= intervalMicros[i]) {
      previousMicros[i] = currentMicros[i];
        switch(i) {
          case 0:
            ledHeartbeat(); // "System Working" builtin led
          break;
          case 1:
            noop();
          break;
          case 2:
            noop();
          break;
          case 3:
            noop();
          break;
          case 4:
            noop();
          break;
          case 5:
            noop();
          break;
          case 6:
            noop();
          break;
          case 7:
            noop();
          break;
          case 8:
            noop();
          break;
          case 9:
            noop();
          break;
          case 10:
            noop();
          break;
          case 11:
            noop();
          break;
          case 12:
            noop();
          break;
          case 13:
            noop();
          break;
          case 14:
            noop();
          break;
          case 15:
            handlePulse(); // Code to produce a pulse to burn a nanopore
          break;
          default:
            // Serial.println("WTF dude?");
          break;
        }
    }   
  }
}

void noop() {}

// provide a heartbeat-like pulse to the BUILTIN_LED 
void ledHeartbeat() {
  ledPinBrightness += ledPinDirection;
  if (ledPinBrightness >= 255) {
    ledPinBrightness = 255;
    ledPinDirection = -1;
  } 
  if (ledPinBrightness <= 0) {
    ledPinBrightness = 0;
    ledPinDirection = 1;
  }
  ledcWrite(ledChannel, ledPinBrightness); 
}

enum LedState {
    IDLE,
    RELAY_ON, 
    PULSE_ON,
    PULSE_OFF,
    RELAY_OFF
};

LedState currentLedState = IDLE;

void handlePulse() {
    if (PulseService) {
        switch (currentLedState) {
            case IDLE:
                digitalWrite(RELAY_PIN, HIGH);  // Turn on LED1
                intervalMicros[15] = 2000; // Set delay for 2ms
                currentLedState = RELAY_ON;
                break;

            case RELAY_ON:
                digitalWrite(PULSE_PIN, HIGH);  // Turn on LED0
                intervalMicros[15] = magnitude;
                currentLedState = PULSE_ON;
                break;

            case PULSE_ON:
                digitalWrite(PULSE_PIN, LOW);  // Turn off LED0
                intervalMicros[15] = 2000; // Set delay for 2ms
                currentLedState = PULSE_OFF;
                break;

            case PULSE_OFF:
                digitalWrite(RELAY_PIN, LOW);  // Turn off LED1
                intervalMicros[15] = 10000; // Reset to default delay
                currentLedState = IDLE;
                PulseService = false;  // Reset the flag after the process
                break;
        }
    }
}


void handleRoot() {
  // digitalWrite(LED_BUILTIN, HIGH);

  if (SPIFFS.exists("/index.html")) {
    File file = SPIFFS.open("/index.html", "r");
    server.streamFile(file, "text/html");
    file.close();
  } else {
    server.send(404, "text/plain", "File not found");
  }

  // digitalWrite(LED_BUILTIN, LOW);
}

// get voltage value and convert it into a number between 0 and 255
// and send that to the appropriate DAC
float mapFloat(float x, float in_min, float in_max, float out_min, float out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}
int handleSetVoltage() {
  if (server.hasArg("value")) {
    String voltageValue = server.arg("value");
    float voltage = voltageValue.toFloat();

    // Map the voltage to a value between 0 and 255
    // to send to the DAC
    int dacValue = mapFloat(voltage, -1.587, 1.587, 0, 255);

    // Clamp the value to ensure it's within the DAC range
    dacValue = constrain(dacValue, 0, 255);

    // Output to the DAC
    dacValue = ~dacValue;
    dacWrite(DAC_PIN1, dacValue); // Replace DAC_PIN with the pin number for your DAC

    // Send a response back to the client
    server.send(200, "text/plain", String(dacValue));

    return dacValue;
  } else {
    server.send(400, "text/plain", "Bad request"); // Error handling for missing "value" parameter
    return -1; // return an error code or any negative number as an indicator of failure
  }
}


void handleNotFound() {
  // digitalWrite(LED_BUILTIN, HIGH);
  String message = "File Not Found\n\n";
  message += "URI: ";
  message += server.uri();
  message += "\nMethod: ";
  message += (server.method() == HTTP_GET) ? "GET" : "POST";
  message += "\nArguments: ";
  message += server.args();
  message += "\n";

  for (uint8_t i = 0; i < server.args(); i++) {
    message += " " + server.argName(i) + ": " + server.arg(i) + "\n";
  }

  server.send(404, "text/plain", message);
  // digitalWrite(LED_BUILTIN, LOW);
}
/////////////////////////////////////////////////// ADC FUNCTIONS /////////////////////////////////////////////////
float readChannel(ADS1115_MUX channel) {
  float voltage = 0.0;
  adc.setCompareChannels(channel);
  adc.startSingleMeasurement();
  while(adc.isBusy()){}
  voltage = adc.getResult_V(); // alternative: getResult_mV for Millivolt
  return voltage;
}

/////////////////////////////////////////////////// INTERRUPT SERVICE ROUTINES ///////////////////////////////////
void IRAM_ATTR start_timer_group0_isr(void *para) {
    gpio_set_level(PULSE_PIN, 1);  // Set the GPIO high immediately
    TIMERG0.int_clr_timers.t0 = 1;     // Clear the interrupt
    TIMERG0.hw_timer[0].config.alarm_en = TIMER_ALARM_EN;  // Enable the alarm to trigger the end pulse
}

void IRAM_ATTR end_timer_group0_isr(void *para) {
    gpio_set_level(PULSE_PIN, 0);  // Set the GPIO low immediately
    TIMERG0.int_clr_timers.t0 = 1;     // Clear the interrupt
    TIMERG0.hw_timer[0].config.alarm_en = 0;  // Disable the alarm
}

void setupTimer(uint32_t timeInMicroseconds) {
    timer_config_t config = {
        .alarm_en = TIMER_ALARM_DIS,  // Initially, the alarm is disabled
        .counter_en = TIMER_PAUSE,
        .intr_type = TIMER_INTR_LEVEL,
        .counter_dir = TIMER_COUNT_UP,
        .auto_reload = TIMER_AUTORELOAD_DIS,
        .divider = 80   // 1 tick = 1us with 80MHz clock
    };

    timer_init(TIMER_GROUP_0, TIMER_0, &config);
    timer_set_counter_value(TIMER_GROUP_0, TIMER_0, 0);
    timer_set_alarm_value(TIMER_GROUP_0, TIMER_0, timeInMicroseconds);
    timer_enable_intr(TIMER_GROUP_0, TIMER_0);
    timer_isr_register(TIMER_GROUP_0, TIMER_0, &end_timer_group0_isr, NULL, ESP_INTR_FLAG_IRAM, NULL);
}

void relayOn() {
  digitalWrite(RELAY_PIN, HIGH);
  delay(2);
}

void relayOff() {
  digitalWrite(RELAY_PIN, LOW);
  delay(2);
}

