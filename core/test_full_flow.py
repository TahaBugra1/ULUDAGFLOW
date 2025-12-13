"""
WhatsApp Bot Full Test
======================

Bot akışını simüle eder ve gerçek WhatsApp mesajları gönderir.
"""

import requests
import json
import time

WHAPI_TOKEN = 'oL7ufkJw70Bq6gCbhI2xtHJyUhrXWl6R'
WHAPI_BASE_URL = 'https://gate.whapi.cloud'
TEST_PHONE = '905318407744'


def send_message(phone: str, message: str) -> dict:
    """Mesaj gönder"""
    url = f"{WHAPI_BASE_URL}/messages/text"
    
    headers = {
        'accept': 'application/json',
        'authorization': f'Bearer {WHAPI_TOKEN}',
        'content-type': 'application/json'
    }
    
    data = {
        'to': f'{phone}@s.whatsapp.net',
        'body': message
    }
    
    response = requests.post(url, headers=headers, json=data)
    return response.json() if response.ok else {'error': response.text}


def run_full_flow():
    """Tam bot akışını test et"""
    print("=" * 60)
    print("🤖 ULUDAGFLOW WhatsApp Bot - Full Flow Test")
    print("=" * 60)
    
    # 1. Hoşgeldin mesajı
    print("\n📤 1. Hoşgeldin mesajı gönderiliyor...")
    msg = """🌊 *ULUDAGFLOW - BUSKİ Şikayet Bildirimi*

Merhaba! Su şebekesiyle ilgili bir sorun bildirmek için size yardımcı olacağım.

📍 *Lütfen konumunuzu paylaşın*

WhatsApp'ın konum paylaşma özelliğini kullanarak bulunduğunuz yeri gönderin.
(📎 ataç simgesi → Konum → Mevcut Konum)"""
    
    result = send_message(TEST_PHONE, msg)
    print(f"   ✓ Gönderildi: {result.get('sent', False)}")
    
    time.sleep(2)
    
    # 2. Kategori seçimi (konum geldikten sonra)
    print("\n📤 2. Kategori seçim mesajı gönderiliyor...")
    msg = """✅ Konum alındı!

📋 *Sorun kategorisini seçin:*

1️⃣ Su Kesintisi
2️⃣ Düşük Basınç
3️⃣ Su Kalitesi
4️⃣ Diğer

Numara yazarak veya kategori adını yazarak seçebilirsiniz."""
    
    result = send_message(TEST_PHONE, msg)
    print(f"   ✓ Gönderildi: {result.get('sent', False)}")
    
    time.sleep(2)
    
    # 3. Açıklama isteme
    print("\n📤 3. Açıklama isteme mesajı gönderiliyor...")
    msg = """✅ Kategori: *Düşük Basınç*

📝 *Sorunu kısaca açıklayın:*

Örnek: "3 gündür su gelmiyor" veya "Su sarı renkte akıyor" """
    
    result = send_message(TEST_PHONE, msg)
    print(f"   ✓ Gönderildi: {result.get('sent', False)}")
    
    time.sleep(2)
    
    # 4. Bilet onay mesajı
    print("\n📤 4. Bilet onay mesajı gönderiliyor...")
    ticket_id = "TKT-2024-001543"
    msg = f"""✅ *Şikayetiniz Alındı!*

🎫 Bilet No: *{ticket_id}*

📍 Konum kaydedildi
📋 Kategori: Düşük Basınç
📝 Açıklama: Sabahları su basıncı çok düşük oluyor...

🔗 *Takip linkiniz:*
https://uludagflow.app/ticket/{ticket_id}

Bu linkten biletinizin durumunu ve mahallenizin su performansını takip edebilirsiniz.

BUSKİ ekipleri en kısa sürede dönüş yapacaktır."""
    
    result = send_message(TEST_PHONE, msg)
    print(f"   ✓ Gönderildi: {result.get('sent', False)}")
    
    print("\n" + "=" * 60)
    print("✅ TEST TAMAMLANDI - WhatsApp'ı kontrol edin!")
    print("=" * 60)


if __name__ == '__main__':
    run_full_flow()
