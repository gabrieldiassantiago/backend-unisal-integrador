#include<WiFi.h>
  #include <Wire.h>
  #include <Adafruit_MPU6050.h>
  #include <HTTPClient.h>
  char rede[]="Wokwi-GUEST";    
  char senha[]="";
  int conectado=WL_CONNECTED;

  sensors_event_t a, g, temp;
  Adafruit_MPU6050 mpu;
  bool enviado=false;

  void setup() {
    Serial.begin(115200); 

    while(WiFi.status()!=conectado){

        WiFi.begin(rede, senha);
        Serial.print("Conectando...");
        delay(2000);
    }
    Serial.println("Conectado");

    Serial.print(("Estabelecendo conexão com sensor..."));
    if (!mpu.begin()) {
      Serial.println("Erro ao inicializar o MPU-6050 nos pinos customizados!");
      while (1); 
    }
    Serial.println("Conectado");


  }

  void loop() {
        mpu.getEvent(&a, &g, &temp);
        if(a.acceleration.y>18){
          Serial.println("Queda detectada");
          delay(1000);
          if(WiFi.status()==conectado && enviado==false){
            HTTPClient http;

            String url= "http://167.99.57.166:3002/fall-alerts";
            String jsonPayload =  "{\"serial\":\"DEV-00000\","
                              "\"apiKey\":\"api-key-00000-1759262700148\","
                              "\"latitude\":-23.5505,"
                              "\"longitude\":-46.6333,"
                              "\"timestamp\":\"2024-01-15T10:30:00Z\"}";
            http.begin(url);
            http.addHeader("Content-Type", "application/json"); 
            int httpResponseCode = http.POST(jsonPayload); 
                
                if (httpResponseCode > 0) {
                  Serial.print("HTTP OK. Resposta: ");
                  Serial.println(httpResponseCode);
                  enviado=true;
                } else {
                  Serial.print("Erro no envio HTTP: ");
                  Serial.println(http.errorToString(httpResponseCode));
                }


          }
          else if(enviado==true){
            Serial.println("Ja enviado");
          }
          else{
            Serial.println("Sem conexao");
          }
        }
        else{
          Serial.println("Nada ainda");
          delay(2000);
        }




    delay(10); 
  }
