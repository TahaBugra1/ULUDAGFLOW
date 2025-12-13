"""
ULUDAGFLOW WhatsApp Webhook Server
===================================

FastAPI tabanlı webhook server.
Whapi.cloud'dan gelen mesajları işler ve otomatik yanıt verir.

Çalıştırma:
  uvicorn whatsapp_server:app --reload --port 8000

Webhook URL (ngrok ile):
  ngrok http 8000
  Sonra Whapi.cloud panelinde webhook URL'i ayarla
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import requests
import json
import os
import asyncio
import threading
import time

app = FastAPI(title="ULUDAGFLOW WhatsApp Bot", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# CONFIGURATION
# ============================================

WHAPI_TOKEN = 'oL7ufkJw70Bq6gCbhI2xtHJyUhrXWl6R'
WHAPI_BASE_URL = 'https://gate.whapi.cloud'
APP_BASE_URL = os.getenv('APP_BASE_URL', 'http://localhost:3000')

# ============================================
# IN-MEMORY STATE (Production'da Redis kullan)
# ============================================

conversations: Dict[str, Dict] = {}
tickets: Dict[str, Dict] = {}
ticket_counter = 1542
processed_message_ids: Dict[str, set] = {}  # {phone: {msg_id1, msg_id2, ...}}
active_chats: set = set()  # Aktif chat ID'leri
last_message_timestamp: Dict[str, int] = {}  # Son mesaj zamanı
listening_mode: Dict[str, bool] = {}  # {phone: True/False} - Şikayet dinleme modu
user_tickets: Dict[str, List[str]] = {}  # {phone: [ticket_id1, ticket_id2, ...]}
pending_complaints: Dict[str, str] = {}  # {phone: complaint_text} - NLP onayı bekleyen şikayetler

# Polling ayarları
POLLING_INTERVAL = 10  # saniye

# ============================================
# KOMUT SİSTEMİ
# ============================================

COMMANDS = {
    '/sikayet': 'Şikayet modunu başlat',
    '/iptal': 'Şikayet modunu kapat',
    '/sil': 'Son şikayeti sil',
    '/listele': 'Şikayetlerini listele',
    '/yardim': 'Komutları göster',
}


def handle_command(phone: str, command: str, full_text: str) -> Optional[str]:
    """
    Özel komutları işle
    Returns: Yanıt mesajı veya None (komut değilse)
    """
    cmd = command.lower().strip()
    
    # /sikayet - Şikayet modunu başlat
    if cmd == '/sikayet':
        listening_mode[phone] = True
        if phone not in user_tickets:
            user_tickets[phone] = []
        
        return """📝 *Şikayet Modu Açıldı*

Şikayetinizi dinliyorum. Lütfen sorununuzu detaylı bir şekilde yazın.

Örnek:
• "3 gündür su gelmiyor"
• "Su sarı renkte akıyor"
• "Sokakta boru patladı"

❌ İptal etmek için: /iptal
📋 Şikayetlerinizi görmek için: /listele"""
    
    # /iptal - Dinlemeyi kapat
    elif cmd == '/iptal':
        listening_mode[phone] = False
        pending_complaints.pop(phone, None)
        
        # Konuşma durumunu sıfırla
        if phone in conversations:
            conversations[phone]['step'] = 'INIT'
        
        return """🔇 *Şikayet Modu Kapatıldı*

Artık mesajlarınızı dinlemiyorum.

Yeni şikayet için: /sikayet
Şikayetlerinizi görmek için: /listele"""
    
    # /sil - Son şikayeti sil
    elif cmd == '/sil':
        if phone not in user_tickets or len(user_tickets[phone]) == 0:
            return "❌ Silinecek şikayetiniz bulunmuyor."
        
        last_ticket_id = user_tickets[phone].pop()
        deleted_ticket = tickets.pop(last_ticket_id, None)
        
        if deleted_ticket:
            return f"""🗑️ *Şikayet Silindi*

Silinen bilet: *{last_ticket_id}*
Konu: {deleted_ticket.get('description', 'Bilinmiyor')[:50]}...

Kalan şikayet sayısı: {len(user_tickets[phone])}"""
        else:
            return "❌ Şikayet bulunamadı."
    
    # /listele - Şikayetleri listele
    elif cmd == '/listele':
        if phone not in user_tickets or len(user_tickets[phone]) == 0:
            return """📋 *Şikayetleriniz*

Henüz kayıtlı şikayetiniz bulunmuyor.

Yeni şikayet için: /sikayet"""
        
        ticket_list = []
        for tid in user_tickets[phone]:
            t = tickets.get(tid, {})
            status_emoji = {
                'open': '🟡',
                'in_progress': '🔵',
                'resolved': '✅',
                'closed': '⚫',
            }.get(t.get('status', 'open'), '⚪')
            
            ticket_url = f"{APP_BASE_URL}/ticket/{tid}"
            ticket_list.append(f"{status_emoji} *{tid}*\n   {t.get('description', 'Açıklama yok')[:40]}...\n   🔗 {ticket_url}")
        
        return f"""📋 *Şikayetleriniz* ({len(user_tickets[phone])} adet)

""" + "\n\n".join(ticket_list) + """

🟡 Açık | 🔵 İşlemde | ✅ Çözüldü

Linklere tıklayarak detayları görebilirsiniz."""
    
    # /yardim - Komutları göster
    elif cmd == '/yardim' or cmd == '/yardım':
        return """📚 *Kullanılabilir Komutlar*

/sikayet - Şikayet modunu başlat
/iptal - Şikayet modunu kapat  
/sil - Son şikayeti sil
/listele - Şikayetlerini göster
/yardim - Bu mesajı göster

💡 Şikayet modu açıkken yazdıklarınız analiz edilir ve uygun olanlar kayıt altına alınır."""
    
    return None  # Komut değil

# ============================================
# NLP - SORUN TESPİT SİSTEMİ
# ============================================

# Su/altyapı ile ilgili anahtar kelimeler
WATER_KEYWORDS = [
    'su', 'water', 'kesinti', 'gelmiyor', 'akmıyor', 'akmiyor',
    'basınç', 'basinc', 'düşük', 'dusuk', 'zayıf', 'zayif',
    'sarı', 'sari', 'bulanık', 'bulanik', 'kirli', 'pis', 'koku',
    'sızıntı', 'sizinti', 'patlak', 'boru', 'tesisat',
    'sayaç', 'sayac', 'fatura', 'arıza', 'ariza',
    'şebeke', 'sebeke', 'pompa', 'depo', 'tank',
    'tamir', 'onarım', 'onarim', 'bakım', 'bakim',
    'şikayet', 'sikayet', 'sorun', 'problem', 'sıkıntı', 'sikinti',
    'yardım', 'yardim', 'acil', 'ivedi', 'hızlı', 'hizli',
]

# Selamlama kelimeleri (sorun değil)
GREETING_KEYWORDS = [
    'merhaba', 'selam', 'selamlar', 'günaydın', 'gunaydin',
    'iyi günler', 'iyi akşamlar', 'iyi aksam', 'naber', 'nasılsın',
    'hello', 'hi', 'hey',
]

# Teşekkür/kapanış (sorun değil)
CLOSING_KEYWORDS = [
    'teşekkür', 'tesekkur', 'sağol', 'sagol', 'eyvallah',
    'tamam', 'ok', 'anladım', 'anladim', 'peki', 'tamamdır',
    'görüşürüz', 'gorusuruz', 'hoşçakal', 'hoscakal',
]


def analyze_message_intent(text: str) -> Dict[str, Any]:
    """
    NLP: Mesajın amacını analiz et
    Returns: {
        'is_water_issue': bool,
        'is_greeting': bool,
        'is_closing': bool,
        'confidence': float,
        'detected_keywords': list,
        'issue_category': str | None
    }
    """
    text_lower = text.lower().strip()
    
    result = {
        'is_water_issue': False,
        'is_greeting': False,
        'is_closing': False,
        'confidence': 0.0,
        'detected_keywords': [],
        'issue_category': None,
    }
    
    # Selamlama kontrolü
    for kw in GREETING_KEYWORDS:
        if kw in text_lower:
            result['is_greeting'] = True
            break
    
    # Kapanış kontrolü
    for kw in CLOSING_KEYWORDS:
        if kw in text_lower:
            result['is_closing'] = True
            break
    
    # Su sorunu tespiti
    water_matches = []
    for kw in WATER_KEYWORDS:
        if kw in text_lower:
            water_matches.append(kw)
    
    if water_matches:
        result['is_water_issue'] = True
        result['detected_keywords'] = water_matches
        result['confidence'] = min(len(water_matches) * 0.25, 1.0)
        
        # Kategori tahmini
        if any(k in text_lower for k in ['kesinti', 'gelmiyor', 'akmıyor', 'akmiyor']):
            result['issue_category'] = 'su_kesintisi'
        elif any(k in text_lower for k in ['basınç', 'basinc', 'düşük', 'dusuk', 'zayıf']):
            result['issue_category'] = 'dusuk_basinc'
        elif any(k in text_lower for k in ['sarı', 'bulanık', 'kirli', 'pis', 'koku']):
            result['issue_category'] = 'su_kalitesi'
        elif any(k in text_lower for k in ['sızıntı', 'patlak', 'boru']):
            result['issue_category'] = 'sizinti'
        else:
            result['issue_category'] = 'diger'
    
    # Sadece selamlama ise ve su sorunu yoksa, düşük güven
    if result['is_greeting'] and not result['is_water_issue']:
        result['confidence'] = 0.1
    
    return result

# ============================================
# WHAPI API FUNCTIONS
# ============================================

def fetch_messages(chat_id: str, count: int = 20) -> list:
    """Whapi.cloud'dan mesajları çek"""
    if not chat_id.endswith('@s.whatsapp.net'):
        chat_id = f'{chat_id}@s.whatsapp.net'
    
    url = f"{WHAPI_BASE_URL}/messages/list/{chat_id}?count={count}"
    
    headers = {
        'accept': 'application/json',
        'authorization': f'Bearer {WHAPI_TOKEN}',
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.ok:
            data = response.json()
            return data.get('messages', [])
        return []
    except Exception as e:
        print(f"❌ Mesaj çekme hatası: {e}")
        return []


def poll_chat_messages(chat_id: str):
    """Tek bir chat için mesajları kontrol et ve işle"""
    messages = fetch_messages(chat_id, count=5)
    
    # En yeniden eskiye sıralı, biz eskiden yeniye işleyeceğiz
    messages = sorted(messages, key=lambda m: m.get('timestamp', 0))
    
    # Telefon numarası
    phone = chat_id.replace('@s.whatsapp.net', '')
    
    # Bu numara için işlenmiş mesaj seti
    if phone not in processed_message_ids:
        processed_message_ids[phone] = set()
    
    for msg in messages:
        msg_id = msg.get('id')
        msg_timestamp = msg.get('timestamp', 0)
        
        # Zaten işlenmiş mi? (numara + mesaj ID bazlı kontrol)
        if msg_id in processed_message_ids[phone]:
            continue
        
        # Giden mesajları atla
        if msg.get('from_me', False):
            processed_message_ids[phone].add(msg_id)
            continue
        
        # Eski mesajları atla (son işlenen zamandan önce)
        last_ts = last_message_timestamp.get(phone, 0)
        if msg_timestamp <= last_ts:
            processed_message_ids[phone].add(msg_id)
            continue
        
        # Yeni gelen mesaj!
        msg_text = msg.get('text', {}).get('body', '').strip()
        
        print(f"\n{'='*50}")
        print(f"📨 YENİ MESAJ: {phone}")
        print(f"📝 İçerik: {msg_text[:100]}")
        
        response_text = None
        
        # 1. KOMUT KONTROLÜ - / ile başlıyorsa
        if msg_text.startswith('/'):
            cmd = msg_text.split()[0].lower()
            response_text = handle_command(phone, cmd, msg_text)
            if response_text:
                print(f"🎯 Komut işlendi: {cmd}")
                send_message(phone, response_text)
                processed_message_ids[phone].add(msg_id)
                last_message_timestamp[phone] = msg_timestamp
                print(f"{'='*50}\n")
                continue
        
        # 2. ŞİKAYET MODU AÇIK MI?
        if listening_mode.get(phone, False):
            # NLP Analizi
            intent = analyze_message_intent(msg_text)
            print(f"🧠 NLP Analizi: sorun={intent['is_water_issue']}, güven={intent['confidence']:.0%}, kategori={intent['issue_category']}")
            
            # Su sorunu tespit edildi mi?
            if intent['is_water_issue'] and intent['confidence'] >= 0.25:
                # Şikayeti kaydet
                global ticket_counter
                ticket_counter += 1
                ticket_id = f"TKT-2024-{ticket_counter:06d}"
                
                new_ticket = {
                    'ticket_id': ticket_id,
                    'phone': phone,
                    'description': msg_text,
                    'issue_type': intent['issue_category'],
                    'status': 'open',
                    'created_at': datetime.now().isoformat(),
                    'detected_keywords': intent['detected_keywords'],
                    'confidence': intent['confidence'],
                }
                
                tickets[ticket_id] = new_ticket
                
                # Kullanıcının biletlerine ekle
                if phone not in user_tickets:
                    user_tickets[phone] = []
                user_tickets[phone].append(ticket_id)
                
                category_label = ISSUE_TYPES.get(intent['issue_category'], 'Diğer')
                
                # Takip linki oluştur
                ticket_url = f"{APP_BASE_URL}/ticket/{ticket_id}"
                
                response_text = f"""✅ *Şikayetiniz Kaydedildi!*

🎫 Bilet No: *{ticket_id}*
📋 Kategori: {category_label}
📝 Açıklama: {msg_text[:100]}...

🔗 *Takip Linki:*
{ticket_url}

Bu linkten şikayetinizin durumunu ve mahallenizin su performansını takip edebilirsiniz.

Başka şikayetiniz varsa yazmaya devam edin.
❌ Bitirmek için: /iptal"""
                
                print(f"✅ Şikayet kaydedildi: {ticket_id}")
            
            else:
                # Su sorunu değil - kaydetme
                response_text = f"""⚠️ *Bu Bir Su Sorunu Gibi Görünmüyor*

Yazdığınız: "{msg_text[:50]}..."

Bu mesaj su/altyapı ile ilgili bir sorun içermiyor gibi görünüyor.

💡 Örnek şikayetler:
• "3 gündür su gelmiyor"
• "Su çok düşük basınçla akıyor"
• "Sokakta boru patladı"

Lütfen sorununuzu daha açık yazın veya /iptal ile çıkın."""
                
                print(f"⏭️ NLP: Su sorunu değil, kaydedilmedi")
        
        # 3. ŞİKAYET MODU KAPALI - Bilgilendir
        else:
            # Aktif konuşma varsa devam et
            if phone in conversations and conversations[phone].get('step') not in ['INIT', None]:
                response_text = process_message(phone, msg)
                print(f"✅ Aktif konuşma devam ediyor")
            else:
                # Kullanıcıya komutları bildir
                intent = analyze_message_intent(msg_text)
                
                if intent['is_water_issue']:
                    response_text = f"""📝 Su sorunu tespit ettim!

Şikayetinizi kaydetmek için önce /sikayet yazın.

📚 Komutlar:
/sikayet - Şikayet modunu başlat
/listele - Şikayetlerini göster
/yardim - Tüm komutlar"""
                    print(f"ℹ️ Su sorunu var ama mod kapalı - bilgilendirme")
                
                elif intent['is_greeting']:
                    response_text = """Merhaba! 👋

Ben BUSKİ su şikayetleri botuyum.

📚 Komutlar:
/sikayet - Şikayet bildirmek için
/listele - Şikayetlerini görmek için
/yardim - Tüm komutlar"""
                    print(f"ℹ️ Selamlama - komutları göster")
                
                else:
                    print(f"⏭️ Alakasız mesaj + mod kapalı, yanıt yok")
        
        # Yanıt gönder
        if response_text:
            send_message(phone, response_text)
            print(f"📤 YANIT GÖNDERİLDİ")
        
        # İşlendi olarak işaretle
        processed_message_ids[phone].add(msg_id)
        last_message_timestamp[phone] = msg_timestamp
        
        print(f"{'='*50}\n")


def polling_loop():
    """Sürekli mesaj dinleme döngüsü"""
    print(f"🔄 Polling başlatıldı - Her {POLLING_INTERVAL} saniyede bir kontrol ediliyor...")
    
    while True:
        try:
            # Tüm aktif chatları kontrol et
            for chat_id in list(active_chats):
                poll_chat_messages(chat_id)
            
            # Ayarlanan süre kadar bekle
            time.sleep(POLLING_INTERVAL)
        except Exception as e:
            print(f"❌ Polling hatası: {e}")
            time.sleep(POLLING_INTERVAL * 2)


def send_message(phone: str, message: str) -> dict:
    """Mesaj gönder"""
    # Telefon numarasını düzelt
    if not phone.endswith('@s.whatsapp.net'):
        phone = f'{phone}@s.whatsapp.net'
    
    url = f"{WHAPI_BASE_URL}/messages/text"
    
    headers = {
        'accept': 'application/json',
        'authorization': f'Bearer {WHAPI_TOKEN}',
        'content-type': 'application/json'
    }
    
    data = {
        'to': phone,
        'body': message
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=10)
        return response.json() if response.ok else {'error': response.text}
    except Exception as e:
        return {'error': str(e)}


# ============================================
# CONVERSATION FLOW
# ============================================

ISSUE_TYPES = {
    'su_kesintisi': 'Su Kesintisi',
    'dusuk_basinc': 'Düşük Basınç',
    'su_kalitesi': 'Su Kalitesi',
    'diger': 'Diğer',
}

def get_or_create_conversation(phone: str) -> Dict:
    """Konuşma durumunu al veya oluştur"""
    if phone not in conversations:
        conversations[phone] = {
            'phone': phone,
            'step': 'INIT',
            'data': {},
            'created_at': datetime.now().isoformat(),
        }
    return conversations[phone]


def handle_init(phone: str, message: Dict) -> str:
    """Yeni konuşma başlat"""
    conv = get_or_create_conversation(phone)
    conv['step'] = 'AWAITING_LOCATION'
    
    return """🌊 *ULUDAGFLOW - BUSKİ Şikayet Bildirimi*

Merhaba! Su şebekesiyle ilgili bir sorun bildirmek için size yardımcı olacağım.

📍 *Lütfen konumunuzu paylaşın*

WhatsApp'ın konum paylaşma özelliğini kullanarak bulunduğunuz yeri gönderin.
(📎 ataç simgesi → Konum → Mevcut Konum)"""


def handle_awaiting_location(phone: str, message: Dict) -> str:
    """Konum bekliyor"""
    conv = conversations.get(phone, {})
    
    msg_type = message.get('type', 'text')
    
    if msg_type == 'location':
        # Konum geldi
        location = message.get('location', {})
        conv['data']['location'] = {
            'lat': location.get('latitude', 0),
            'lng': location.get('longitude', 0),
        }
        conv['step'] = 'AWAITING_CATEGORY'
        
        return """✅ Konum alındı!

📋 *Sorun kategorisini seçin:*

1️⃣ Su Kesintisi
2️⃣ Düşük Basınç
3️⃣ Su Kalitesi
4️⃣ Diğer

Numara yazarak veya kategori adını yazarak seçebilirsiniz."""
    
    else:
        return """⚠️ Lütfen konum gönderin.

📎 ataç simgesi → Konum → Mevcut Konum

veya "iptal" yazarak işlemi sonlandırın."""


def handle_awaiting_category(phone: str, message: Dict) -> str:
    """Kategori bekliyor"""
    conv = conversations.get(phone, {})
    
    text = message.get('text', {}).get('body', '').lower()
    
    issue_type = None
    if 'kesinti' in text or text == '1':
        issue_type = 'su_kesintisi'
    elif 'basınç' in text or 'basinc' in text or text == '2':
        issue_type = 'dusuk_basinc'
    elif 'kalite' in text or text == '3':
        issue_type = 'su_kalitesi'
    elif 'diğer' in text or 'diger' in text or text == '4':
        issue_type = 'diger'
    
    if issue_type:
        conv['data']['issue_type'] = issue_type
        conv['step'] = 'AWAITING_DESCRIPTION'
        
        category_label = ISSUE_TYPES.get(issue_type, 'Diğer')
        
        return f"""✅ Kategori: *{category_label}*

📝 *Sorunu kısaca açıklayın:*

Örnek: "3 gündür su gelmiyor" veya "Su sarı renkte akıyor" """
    
    else:
        return """⚠️ Lütfen aşağıdaki kategorilerden birini seçin:

1️⃣ Su Kesintisi
2️⃣ Düşük Basınç
3️⃣ Su Kalitesi
4️⃣ Diğer"""


def handle_awaiting_description(phone: str, message: Dict) -> str:
    """Açıklama bekliyor"""
    conv = conversations.get(phone, {})
    
    text = message.get('text', {}).get('body', '').strip()
    
    if len(text) < 5:
        return "⚠️ Lütfen sorunu biraz daha detaylı açıklayın."
    
    conv['data']['description'] = text
    conv['step'] = 'AWAITING_MEDIA'
    
    return """✅ Açıklama kaydedildi.

📸 *Fotoğraf/video eklemek ister misiniz?*

Varsa gönderebilirsiniz, yoksa "hayır" veya "tamam" yazın."""


def handle_awaiting_media(phone: str, message: Dict) -> str:
    """Medya veya onay bekliyor"""
    global ticket_counter
    
    conv = conversations.get(phone, {})
    
    msg_type = message.get('type', 'text')
    
    # Medya geldi mi?
    if msg_type in ['image', 'video']:
        if 'media_urls' not in conv['data']:
            conv['data']['media_urls'] = []
        conv['data']['media_urls'].append(message.get('id', ''))
        
        return "✅ Medya alındı. Başka eklemek isterseniz gönderin, yoksa \"tamam\" yazın."
    
    # Metin kontrolü
    text = message.get('text', {}).get('body', '').lower()
    
    if any(word in text for word in ['hayır', 'hayir', 'tamam', 'yok', 'bitti']):
        # Bileti oluştur
        ticket_counter += 1
        ticket_id = f"TKT-2024-{str(ticket_counter).padStart(6, '0')}" if hasattr(str, 'padStart') else f"TKT-2024-{ticket_counter:06d}"
        
        # Konum → mahalle çözümleme (basit)
        location = conv['data'].get('location', {'lat': 40.2, 'lng': 29.0})
        neighborhood = resolve_neighborhood(location)
        
        ticket = {
            'ticket_id': ticket_id,
            'created_at': datetime.now().isoformat(),
            'issue_type': conv['data'].get('issue_type', 'diger'),
            'description': conv['data'].get('description', ''),
            'location': {**location, **neighborhood},
            'status': 'alindi',
            'phone': phone,
        }
        
        tickets[ticket_id] = ticket
        
        # Konuşmayı temizle
        conv['step'] = 'COMPLETE'
        
        category_label = ISSUE_TYPES.get(ticket['issue_type'], 'Diğer')
        description = ticket['description']
        ticket_url = f"{APP_BASE_URL}/ticket/{ticket_id}"
        
        return f"""✅ *Şikayetiniz Alındı!*

🎫 Bilet No: *{ticket_id}*

📍 Konum kaydedildi
📋 Kategori: {category_label}
📝 Açıklama: {description[:50]}{'...' if len(description) > 50 else ''}

🔗 *Takip linkiniz:*
{ticket_url}

Bu linkten biletinizin durumunu ve mahallenizin su performansını takip edebilirsiniz.

BUSKİ ekipleri en kısa sürede dönüş yapacaktır."""
    
    return "📸 Fotoğraf gönderebilir veya \"tamam\" yazarak devam edebilirsiniz."


def resolve_neighborhood(location: Dict) -> Dict:
    """Konum → mahalle çözümleme"""
    lat = location.get('lat', 40.2)
    lng = location.get('lng', 29.0)
    
    if lat > 40.2 and lng < 29.0:
        return {'neighborhood': 'Beşevler Mahallesi', 'district': 'Nilüfer', 'dma_id': 'DMA-NIL-03'}
    elif lat > 40.35:
        return {'neighborhood': 'Güzelyalı Mahallesi', 'district': 'Mudanya', 'dma_id': 'DMA-MUD-02'}
    elif lat < 40.1:
        return {'neighborhood': 'Cuma Mahallesi', 'district': 'İnegöl', 'dma_id': 'DMA-İNE-01'}
    return {'neighborhood': 'Heykel', 'district': 'Osmangazi', 'dma_id': 'DMA-OSM-01'}


def process_message(phone: str, message: Dict) -> str:
    """Ana mesaj işleme fonksiyonu"""
    
    # "iptal" komutu
    text = message.get('text', {}).get('body', '').lower()
    if text == 'iptal':
        if phone in conversations:
            del conversations[phone]
        return "❌ İşlem iptal edildi. Yeni şikayet için herhangi bir mesaj gönderin."
    
    # Konuşma durumunu al
    conv = get_or_create_conversation(phone)
    step = conv.get('step', 'INIT')
    
    if step == 'INIT' or step == 'COMPLETE':
        return handle_init(phone, message)
    elif step == 'AWAITING_LOCATION':
        return handle_awaiting_location(phone, message)
    elif step == 'AWAITING_CATEGORY':
        return handle_awaiting_category(phone, message)
    elif step == 'AWAITING_DESCRIPTION':
        return handle_awaiting_description(phone, message)
    elif step == 'AWAITING_MEDIA':
        return handle_awaiting_media(phone, message)
    else:
        return handle_init(phone, message)


# ============================================
# API ENDPOINTS
# ============================================

@app.on_event("startup")
async def startup_event():
    """Uygulama başladığında polling'i başlat"""
    # Varsayılan olarak sizin numaranızı ekle
    active_chats.add("905318407744")
    
    # Polling thread'i başlat
    polling_thread = threading.Thread(target=polling_loop, daemon=True)
    polling_thread.start()
    print("✅ WhatsApp polling başlatıldı!")


@app.get("/")
async def root():
    return {
        "service": "ULUDAGFLOW WhatsApp Bot",
        "status": "running",
        "version": "1.0.0",
        "active_conversations": len(conversations),
        "total_tickets": len(tickets),
        "active_chats": list(active_chats),
        "polling": "active",
    }


@app.post("/webhook")
async def webhook(request: Request):
    """Whapi.cloud webhook endpoint"""
    try:
        body = await request.json()
        
        # 🔴 GELEN WEBHOOK LOG
        print("=" * 50)
        print("📨 WEBHOOK ALINDI!")
        print(f"📦 Body: {json.dumps(body, indent=2, ensure_ascii=False)[:500]}")
        print("=" * 50)
        
        # Mesajları işle
        messages = body.get('messages', [])
        
        for msg in messages:
            # Giden mesajları atla
            if msg.get('from_me', False):
                continue
            
            phone = msg.get('from', '')
            
            # Mesajı işle ve yanıt oluştur
            response_text = process_message(phone, msg)
            
            # Yanıtı gönder
            if response_text:
                send_message(phone, response_text)
                print(f"📤 Yanıt gönderildi: {phone[:10]}...")
        
        return {"status": "ok"}
    
    except Exception as e:
        print(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickets")
async def list_tickets():
    """Tüm biletleri listele"""
    return {
        "success": True,
        "data": list(tickets.values()),
        "total": len(tickets),
    }


@app.get("/api/ticket/{ticket_id}")
async def get_ticket(ticket_id: str):
    """Bilet detayı"""
    ticket = tickets.get(ticket_id)
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Mahalle metrikleri (mock)
    neighborhood = {
        'neighborhood': ticket['location'].get('neighborhood', 'Bilinmiyor'),
        'district': ticket['location'].get('district', 'Bilinmiyor'),
        'dma_id': ticket['location'].get('dma_id', 'DMA-UNK-00'),
        'outage_count_30d': 3,
        'avg_outage_duration_30d_hours': 2.4,
        'bursts_12m': 7,
        'risk_band_current': 'medium',
        'performance_vs_city': 'benzer',
    }
    
    return {
        "success": True,
        "data": {
            "ticket": ticket,
            "neighborhood": neighborhood,
        },
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/conversations")
async def list_conversations():
    """Aktif konuşmaları listele (debug)"""
    return {
        "success": True,
        "data": conversations,
        "total": len(conversations),
    }


@app.post("/api/chat/add/{phone}")
async def add_chat(phone: str):
    """Yeni chat ekle - polling ile dinlenecek"""
    active_chats.add(phone)
    return {
        "success": True,
        "message": f"{phone} polling listesine eklendi",
        "active_chats": list(active_chats),
    }


@app.delete("/api/chat/remove/{phone}")
async def remove_chat(phone: str):
    """Chat'i polling'den kaldır"""
    active_chats.discard(phone)
    return {
        "success": True,
        "message": f"{phone} polling listesinden kaldırıldı",
        "active_chats": list(active_chats),
    }


@app.get("/api/chats")
async def list_chats():
    """Aktif polling chatlarını listele"""
    total_processed = sum(len(ids) for ids in processed_message_ids.values())
    return {
        "success": True,
        "active_chats": list(active_chats),
        "processed_messages_per_chat": {phone: len(ids) for phone, ids in processed_message_ids.items()},
        "total_processed": total_processed,
        "polling_interval": POLLING_INTERVAL,
    }


@app.post("/api/analyze")
async def analyze_text(request: Request):
    """NLP analizi test endpoint"""
    body = await request.json()
    text = body.get('text', '')
    
    result = analyze_message_intent(text)
    
    return {
        "success": True,
        "text": text,
        "analysis": result,
    }


# ============================================
# MANUAL TEST ENDPOINT
# ============================================

class TestMessage(BaseModel):
    phone: str
    text: Optional[str] = None
    type: str = "text"
    location: Optional[Dict] = None


@app.post("/test/message")
async def test_message(msg: TestMessage):
    """Manuel test için simüle mesaj"""
    message = {
        'type': msg.type,
        'text': {'body': msg.text} if msg.text else {},
        'location': msg.location or {},
    }
    
    response_text = process_message(msg.phone, message)
    
    # Gerçek WhatsApp'a gönder
    result = send_message(msg.phone, response_text)
    
    return {
        "response": response_text,
        "whatsapp_result": result,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
