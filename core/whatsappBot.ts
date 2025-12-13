/**
 * WhatsApp Bot API Service
 * 
 * WhatsApp Business API (Whapi.cloud) ile entegrasyon.
 * 
 * Akış:
 * 1. Kullanıcı WhatsApp'tan mesaj gönderir
 * 2. Webhook bu mesajı alır
 * 3. Bot konum, kategori, açıklama ve opsiyonel medya ister
 * 4. Bilet oluşturulur
 * 5. Kullanıcıya ticket linki gönderilir
 */

import type { Ticket, IssueType, TicketStatus } from './types';

// ============================================
// CONFIGURATION
// ============================================

const WHAPI_TOKEN = 'oL7ufkJw70Bq6gCbhI2xtHJyUhrXWl6R';
const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://uludagflow.app';

// ============================================
// TYPES
// ============================================

interface WhatsAppMessage {
  id: string;
  from: string; // phone number
  type: 'text' | 'location' | 'image' | 'video';
  timestamp: number;
  text?: { body: string };
  location?: { latitude: number; longitude: number };
  image?: { id: string; caption?: string };
}

interface ConversationState {
  phone: string;
  step: 'INIT' | 'AWAITING_LOCATION' | 'AWAITING_CATEGORY' | 'AWAITING_DESCRIPTION' | 'AWAITING_MEDIA' | 'COMPLETE';
  data: Partial<{
    location: { lat: number; lng: number };
    issue_type: IssueType;
    description: string;
    media_urls: string[];
  }>;
  created_at: number;
}

// In-memory state (production'da Redis kullanılmalı)
const conversations = new Map<string, ConversationState>();

// ============================================
// WHAPI API FUNCTIONS
// ============================================

async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHAPI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: to,
      body: message,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${response.status}`);
  }
}

async function sendWhatsAppButtons(to: string, message: string, buttons: string[]): Promise<void> {
  const response = await fetch(`${WHAPI_BASE_URL}/messages/interactive`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHAPI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: to,
      type: 'button',
      body: { text: message },
      action: {
        buttons: buttons.map((text, i) => ({
          type: 'reply',
          reply: { id: `btn_${i}`, title: text.substring(0, 20) }
        }))
      },
    }),
  });
  
  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${response.status}`);
  }
}

// ============================================
// CONVERSATION FLOW
// ============================================

const ISSUE_TYPES: { id: IssueType; label: string }[] = [
  { id: 'su_kesintisi', label: 'Su Kesintisi' },
  { id: 'dusuk_basinc', label: 'Düşük Basınç' },
  { id: 'su_kalitesi', label: 'Su Kalitesi' },
  { id: 'diger', label: 'Diğer' },
];

async function handleInitState(phone: string, message: WhatsAppMessage): Promise<void> {
  // Yeni konuşma başlat
  conversations.set(phone, {
    phone,
    step: 'AWAITING_LOCATION',
    data: {},
    created_at: Date.now(),
  });
  
  await sendWhatsAppMessage(phone, `
🌊 *ULUDAGFLOW - BUSKİ Şikayet Bildirimi*

Merhaba! Su şebekesiyle ilgili bir sorun bildirmek için size yardımcı olacağım.

📍 *Lütfen konumunuzu paylaşın*

WhatsApp'ın konum paylaşma özelliğini kullanarak bulunduğunuz yeri gönderin.
(📎 ataç simgesi → Konum → Mevcut Konum)
  `.trim());
}

async function handleAwaitingLocation(phone: string, message: WhatsAppMessage, state: ConversationState): Promise<void> {
  if (message.type !== 'location' || !message.location) {
    await sendWhatsAppMessage(phone, `
⚠️ Lütfen konum gönderin.

📎 ataç simgesi → Konum → Mevcut Konum

veya "iptal" yazarak işlemi sonlandırın.
    `.trim());
    return;
  }
  
  // Konumu kaydet
  state.data.location = {
    lat: message.location.latitude,
    lng: message.location.longitude,
  };
  state.step = 'AWAITING_CATEGORY';
  conversations.set(phone, state);
  
  await sendWhatsAppButtons(phone, `
✅ Konum alındı!

📋 *Sorun kategorisini seçin:*
  `.trim(), ['Su Kesintisi', 'Düşük Basınç', 'Su Kalitesi', 'Diğer']);
}

async function handleAwaitingCategory(phone: string, message: WhatsAppMessage, state: ConversationState): Promise<void> {
  const text = message.text?.body?.toLowerCase() || '';
  
  let issueType: IssueType | null = null;
  
  if (text.includes('kesinti') || text.includes('1')) {
    issueType = 'su_kesintisi';
  } else if (text.includes('basınç') || text.includes('basinc') || text.includes('2')) {
    issueType = 'dusuk_basinc';
  } else if (text.includes('kalite') || text.includes('3')) {
    issueType = 'su_kalitesi';
  } else if (text.includes('diğer') || text.includes('diger') || text.includes('4')) {
    issueType = 'diger';
  }
  
  if (!issueType) {
    await sendWhatsAppButtons(phone, `
⚠️ Lütfen aşağıdaki kategorilerden birini seçin:
    `.trim(), ['Su Kesintisi', 'Düşük Basınç', 'Su Kalitesi', 'Diğer']);
    return;
  }
  
  state.data.issue_type = issueType;
  state.step = 'AWAITING_DESCRIPTION';
  conversations.set(phone, state);
  
  const categoryLabel = ISSUE_TYPES.find(t => t.id === issueType)?.label || 'Diğer';
  
  await sendWhatsAppMessage(phone, `
✅ Kategori: *${categoryLabel}*

📝 *Sorunu kısaca açıklayın:*

Örnek: "3 gündür su gelmiyor" veya "Su sarı renkte akıyor"
  `.trim());
}

async function handleAwaitingDescription(phone: string, message: WhatsAppMessage, state: ConversationState): Promise<void> {
  if (message.type !== 'text' || !message.text?.body) {
    await sendWhatsAppMessage(phone, `⚠️ Lütfen sorunu yazılı olarak açıklayın.`);
    return;
  }
  
  const description = message.text.body.trim();
  
  if (description.length < 10) {
    await sendWhatsAppMessage(phone, `⚠️ Lütfen biraz daha detaylı açıklayın (en az 10 karakter).`);
    return;
  }
  
  state.data.description = description;
  state.step = 'AWAITING_MEDIA';
  conversations.set(phone, state);
  
  await sendWhatsAppMessage(phone, `
✅ Açıklama kaydedildi.

📸 *Fotoğraf/video eklemek ister misiniz?*

Varsa gönderebilirsiniz, yoksa "hayır" yazın.
  `.trim());
}

async function handleAwaitingMedia(phone: string, message: WhatsAppMessage, state: ConversationState): Promise<void> {
  // Medya geldi mi?
  if (message.type === 'image' || message.type === 'video') {
    if (!state.data.media_urls) state.data.media_urls = [];
    state.data.media_urls.push(message.image?.id || '');
    
    await sendWhatsAppMessage(phone, `
✅ Medya alındı. Başka eklemek isterseniz gönderin, yoksa "tamam" yazın.
    `.trim());
    return;
  }
  
  // Medya istemiyorsa veya "tamam"/"hayır" dedi
  const text = message.text?.body?.toLowerCase() || '';
  if (text.includes('hayır') || text.includes('hayir') || text.includes('tamam') || text.includes('yok')) {
    // Bileti oluştur
    const ticket = await createTicket(state);
    
    state.step = 'COMPLETE';
    conversations.set(phone, state);
    
    const ticketUrl = `${APP_BASE_URL}/ticket/${ticket.ticket_id}`;
    
    await sendWhatsAppMessage(phone, `
✅ *Şikayetiniz Alındı!*

🎫 Bilet No: *${ticket.ticket_id}*

📍 Konum kaydedildi
📋 Kategori: ${ISSUE_TYPES.find(t => t.id === ticket.issue_type)?.label}
📝 Açıklama: ${ticket.description.substring(0, 50)}${ticket.description.length > 50 ? '...' : ''}

🔗 *Takip linkiniz:*
${ticketUrl}

Bu linkten biletinizin durumunu ve mahallenizin su performansını takip edebilirsiniz.

BUSKİ ekipleri en kısa sürede dönüş yapacaktır.
    `.trim());
    
    // Konuşmayı temizle
    setTimeout(() => conversations.delete(phone), 60000);
  }
}

// ============================================
// TICKET CREATION
// ============================================

let ticketCounter = 1542;

async function createTicket(state: ConversationState): Promise<Ticket> {
  ticketCounter++;
  
  // Konum → mahalle/ilçe çözümleme (gerçek projede reverse geocoding)
  const neighborhood = resolveNeighborhood(state.data.location!);
  
  const ticket: Ticket = {
    ticket_id: `TKT-2024-${String(ticketCounter).padStart(6, '0')}`,
    created_at: new Date().toISOString(),
    issue_type: state.data.issue_type || 'diger',
    description: state.data.description || '',
    location: {
      lat: state.data.location!.lat,
      lng: state.data.location!.lng,
      ...neighborhood,
    },
    status: 'alindi',
    media_urls: state.data.media_urls,
  };
  
  // Gerçek projede: database'e kaydet
  console.log('Ticket created:', ticket);
  
  return ticket;
}

function resolveNeighborhood(location: { lat: number; lng: number }): { neighborhood: string; district: string; dma_id: string } {
  // Basit konum → mahalle eşleştirmesi (gerçek projede API kullanılmalı)
  if (location.lat > 40.2 && location.lng < 29.0) {
    return { neighborhood: 'Beşevler Mahallesi', district: 'Nilüfer', dma_id: 'DMA-NIL-03' };
  } else if (location.lat > 40.35) {
    return { neighborhood: 'Güzelyalı Mahallesi', district: 'Mudanya', dma_id: 'DMA-MUD-02' };
  } else if (location.lat < 40.1) {
    return { neighborhood: 'Cuma Mahallesi', district: 'İnegöl', dma_id: 'DMA-İNE-01' };
  }
  return { neighborhood: 'Heykel', district: 'Osmangazi', dma_id: 'DMA-OSM-01' };
}

// ============================================
// WEBHOOK HANDLER
// ============================================

export async function handleWebhook(message: WhatsAppMessage): Promise<void> {
  const phone = message.from;
  
  // "iptal" komutu
  if (message.text?.body?.toLowerCase() === 'iptal') {
    conversations.delete(phone);
    await sendWhatsAppMessage(phone, `❌ İşlem iptal edildi. Yeni şikayet için herhangi bir mesaj gönderin.`);
    return;
  }
  
  // Mevcut konuşma durumunu al
  const state = conversations.get(phone);
  
  try {
    if (!state || state.step === 'COMPLETE') {
      // Yeni konuşma başlat
      await handleInitState(phone, message);
    } else {
      switch (state.step) {
        case 'AWAITING_LOCATION':
          await handleAwaitingLocation(phone, message, state);
          break;
        case 'AWAITING_CATEGORY':
          await handleAwaitingCategory(phone, message, state);
          break;
        case 'AWAITING_DESCRIPTION':
          await handleAwaitingDescription(phone, message, state);
          break;
        case 'AWAITING_MEDIA':
          await handleAwaitingMedia(phone, message, state);
          break;
        default:
          await handleInitState(phone, message);
      }
    }
  } catch (error) {
    console.error('Webhook error:', error);
    await sendWhatsAppMessage(phone, `⚠️ Bir hata oluştu. Lütfen tekrar deneyin veya 185'i arayın.`);
  }
}

// ============================================
// EXPRESS ROUTE (örnek)
// ============================================

/*
import express from 'express';

const router = express.Router();

// Webhook endpoint
router.post('/webhook/whatsapp', async (req, res) => {
  const { messages } = req.body;
  
  if (messages && messages.length > 0) {
    for (const message of messages) {
      await handleWebhook(message);
    }
  }
  
  res.status(200).json({ status: 'ok' });
});

// Ticket page API
router.get('/api/ticket/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  
  // Database'den ticket ve neighborhood metrics çek
  const ticket = await getTicketById(ticketId);
  const neighborhood = await getNeighborhoodMetrics(ticket.location.dma_id);
  
  res.json({
    success: true,
    data: { ticket, neighborhood },
    timestamp: new Date().toISOString(),
  });
});

export default router;
*/
