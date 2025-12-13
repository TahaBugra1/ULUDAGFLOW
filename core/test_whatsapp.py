"""
WhatsApp Bot Test Script
========================

Whapi.cloud API ile mesaj gönderme/alma testi.
"""

import requests
import json

# Configuration
WHAPI_TOKEN = 'oL7ufkJw70Bq6gCbhI2xtHJyUhrXWl6R'
WHAPI_BASE_URL = 'https://gate.whapi.cloud'
TEST_PHONE = '905318407744'  # Test numarası


def get_messages(phone: str, count: int = 5) -> dict:
    """Son mesajları çek"""
    url = f"{WHAPI_BASE_URL}/messages/list/{phone}@s.whatsapp.net"
    
    headers = {
        'accept': 'application/json',
        'authorization': f'Bearer {WHAPI_TOKEN}'
    }
    
    params = {'count': count}
    
    response = requests.get(url, headers=headers, params=params)
    
    if response.ok:
        return response.json()
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return {}


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
    
    if response.ok:
        return response.json()
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return {}


def send_interactive_buttons(phone: str, message: str, buttons: list) -> dict:
    """Butonlu mesaj gönder"""
    url = f"{WHAPI_BASE_URL}/messages/interactive"
    
    headers = {
        'accept': 'application/json',
        'authorization': f'Bearer {WHAPI_TOKEN}',
        'content-type': 'application/json'
    }
    
    data = {
        'to': f'{phone}@s.whatsapp.net',
        'type': 'button',
        'body': {'text': message},
        'action': {
            'buttons': [
                {'type': 'reply', 'reply': {'id': f'btn_{i}', 'title': btn[:20]}}
                for i, btn in enumerate(buttons)
            ]
        }
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.ok:
        return response.json()
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return {}


def send_welcome_message(phone: str) -> dict:
    """ULUDAGFLOW hoşgeldin mesajı gönder"""
    message = """🌊 *ULUDAGFLOW - BUSKİ Şikayet Bildirimi*

Merhaba! Su şebekesiyle ilgili bir sorun bildirmek için size yardımcı olacağım.

📍 *Lütfen konumunuzu paylaşın*

WhatsApp'ın konum paylaşma özelliğini kullanarak bulunduğunuz yeri gönderin.
(📎 ataç simgesi → Konum → Mevcut Konum)"""
    
    return send_message(phone, message)


def send_category_selection(phone: str) -> dict:
    """Kategori seçim mesajı gönder"""
    message = """✅ Konum alındı!

📋 *Sorun kategorisini seçin:*

1️⃣ Su Kesintisi
2️⃣ Düşük Basınç
3️⃣ Su Kalitesi
4️⃣ Diğer

Numara yazarak veya kategori adını yazarak seçebilirsiniz."""
    
    return send_message(phone, message)


def send_ticket_confirmation(phone: str, ticket_id: str, category: str, description: str) -> dict:
    """Bilet onay mesajı gönder"""
    ticket_url = f"https://uludagflow.app/ticket/{ticket_id}"
    
    message = f"""✅ *Şikayetiniz Alındı!*

🎫 Bilet No: *{ticket_id}*

📍 Konum kaydedildi
📋 Kategori: {category}
📝 Açıklama: {description[:50]}{'...' if len(description) > 50 else ''}

🔗 *Takip linkiniz:*
{ticket_url}

Bu linkten biletinizin durumunu ve mahallenizin su performansını takip edebilirsiniz.

BUSKİ ekipleri en kısa sürede dönüş yapacaktır."""
    
    return send_message(phone, message)


def main():
    print("=" * 60)
    print("🔧 ULUDAGFLOW WhatsApp Bot Test")
    print("=" * 60)
    
    # 1. Son mesajları çek
    print("\n📥 Son mesajlar çekiliyor...")
    messages = get_messages(TEST_PHONE, count=3)
    
    if messages.get('messages'):
        for msg in messages['messages']:
            print(f"  - {msg.get('type', 'unknown')}: {msg.get('text', {}).get('body', 'N/A')[:50]}")
    else:
        print("  Mesaj bulunamadı veya hata oluştu.")
    
    # 2. Test mesajı gönder
    print("\n📤 Test mesajı gönderiliyor...")
    
    # Hoşgeldin mesajı gönder
    result = send_welcome_message(TEST_PHONE)
    
    if result.get('sent'):
        print(f"  ✓ Mesaj gönderildi! ID: {result.get('message', {}).get('id', 'N/A')}")
    else:
        print(f"  ✗ Mesaj gönderilemedi.")
        print(f"    {result}")
    
    print("\n" + "=" * 60)
    print("Test tamamlandı.")
    print("=" * 60)


if __name__ == '__main__':
    main()
