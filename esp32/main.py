import time
import urequests
import network
from machine import Pin, SoftI2C
import mpu6050

# ========================
# CONFIGURAÇÕES
# ========================
API_URL = "http://d94d5a39f76e.ngrok-free.app/fall-alerts"  # sem espaço
DEVICE_SERIAL = "ESP32_001"
API_KEY = "abcd1234efgh5678"

# ========================
# CONEXÃO REAL COM Wi-Fi WOKWI
# ========================
print("[LOG] Conectando ao Wi-Fi Wokwi-GUEST...")
sta = network.WLAN(network.STA_IF)
sta.active(True)
sta.connect("Wokwi-GUEST", "")  # sem senha

tentativas = 0
while not sta.isconnected():
    tentativas += 1
    print(f"[LOG] Tentando conectar... ({tentativas})")
    time.sleep(0.5)

print("[LOG] Conectado! IP:", sta.ifconfig())

# ========================
# CONFIGURAÇÃO DO MPU6050
# ========================
print("[LOG] Inicializando MPU6050...")
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
mpu = mpu6050.accel(i2c)
print("[LOG] MPU6050 pronto!")

# LEDs
led_verde = Pin(26, Pin.OUT)
led_azul = Pin(14, Pin.OUT)
led_vermelho = Pin(13, Pin.OUT)

# ========================
# FUNÇÃO PARA ENVIAR ALERTA
# ========================
def enviar_alerta(latitude=0.0, longitude=0.0):
    payload = {
        "serial": DEVICE_SERIAL,
        "apiKey": API_KEY,
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": int(time.time() * 1000)
    }
    print("[LOG] Payload:", payload)
    try:
        print(f"[LOG] Enviando POST para {API_URL}...")
        r = urequests.post(API_URL, json=payload)
        print("[LOG] Status:", r.status_code)
        print("[LOG] Resposta:", r.text)
        r.close()
    except Exception as e:
        print("[ERRO] Falha ao enviar alerta:", e)

# ========================
# DETECÇÃO DE QUEDA
# ========================
def detectar_queda():
    valores = mpu.get_values()
    acel_z = valores["AcZ"] / 16384.0
    print(f"[LOG] Leitura do sensor - AcZ: {acel_z:.2f}g")
    if acel_z < 0.4:
        print("[ALERTA] Possível queda detectada!")
        led_vermelho.on()
        enviar_alerta(-23.5505, -46.6333)
        time.sleep(2)
        led_vermelho.off()

# ========================
# LOOP PRINCIPAL
# ========================
print("[LOG] Iniciando monitoramento...")
while True:
    detectar_queda()
    time.sleep(0.5)
