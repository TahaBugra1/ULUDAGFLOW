import { GoogleGenAI } from "@google/genai";
import { ComplaintCategory } from "../types";

// Initialize the client. The API_KEY is injected by the environment.
// If no key is present (e.g. dev environment), we will fall back to a mock logic.
const apiKey = process.env.API_KEY || ''; 
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

/**
 * Analyzes the complaint text and returns a category.
 * Uses Gemini 2.5 Flash for speed and efficiency.
 */
export const categorizeComplaint = async (text: string): Promise<ComplaintCategory> => {
  if (!ai) {
    console.warn("Gemini API Key not found. Using fallback keyword matching.");
    return fallbackCategorization(text);
  }

  try {
    const prompt = `
      Sen bir su arıza yönetim sisteminin yapay zeka asistanısın.
      Aşağıdaki vatandaş şikayetini analiz et ve şu 4 kategoriden birine sınıflandır:
      - BASINC (Tazyik sorunu, az akma)
      - KALITE (Bulanık, koku, renk, pis)
      - KESINTI (Su yok, kesildi, akmıyor)
      - DIGER (Fatura, sayaç, vb.)

      Şikayet: "${text}"

      Sadece kategori ismini (örn: KESINTI) döndür. Başka hiçbir şey yazma.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const output = response.text?.trim().toUpperCase();

    if (output && ['BASINC', 'KALITE', 'KESINTI', 'DIGER'].includes(output)) {
      return output as ComplaintCategory;
    }
    
    return 'DIGER';

  } catch (error) {
    console.error("AI Categorization failed:", error);
    return fallbackCategorization(text);
  }
};

/**
 * Content Moderation - Detects offensive or political content
 * Returns true if content should be removed, false if it's acceptable
 */
export const moderateContent = async (text: string): Promise<{ shouldRemove: boolean; reason?: string }> => {
  if (!ai) {
    console.warn("Gemini API Key not found. Using fallback moderation.");
    return fallbackModeration(text);
  }

  try {
    const prompt = `
      Sen bir su sistemi şikayet platformunun içerik denetim asistanısın.
      Aşağıdaki şikayeti analiz et ve şu kriterlere göre değerlendir:
      
      KALDIRMASI GEREKEN İÇERİK:
      - Hakaret, küfür veya kişisel saldırı
      - Siyasi propaganda veya parti/lider desteği
      - Irkçılık, ayrımcılık veya nefret söylemi
      - Spam veya reklam
      
      KABUL EDİLEBİLİR İÇERİK:
      - Su/altyapı ile ilgili meşru şikayetler
      - Yapıcı eleştiri ve geri bildirim
      - Öneriler ve çözüm önerileri

      Şikayet: "${text}"

      Yanıt formatı (Türkçe):
      - "KALDIRMALI: [nedeni]" (örn: "KALDIRMALI: Hakaret içeriyor")
      - "KABUL: Sorun yok" (kabul edilebilirse)
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const output = response.text?.trim();

    if (output?.startsWith('KALDIRMALI:')) {
      const reason = output.replace('KALDIRMALI:', '').trim();
      return { shouldRemove: true, reason };
    }

    return { shouldRemove: false };

  } catch (error) {
    console.error("AI Moderation failed:", error);
    return fallbackModeration(text);
  }
};

/**
 * Admin Response AI - Generates a professional response to a complaint
 */
export const generateAdminResponse = async (complaintText: string, category: ComplaintCategory): Promise<string> => {
  if (!ai) {
    console.warn("Gemini API Key not found. Using fallback response.");
    return fallbackAdminResponse(complaintText, category);
  }

  try {
    const categoryDescriptions: Record<ComplaintCategory, string> = {
      'KESINTI': 'Su kesintisi',
      'BASINC': 'Basınç sorunu',
      'KALITE': 'Su kalitesi sorunu',
      'DIGER': 'Diğer su sistemi sorunu'
    };

    const prompt = `
      Sen BUSKİ (Bursa Su ve Kanalizasyon İdaresi) yetkilisi olarak vatandaş şikayetlerine yanıt veriyorsun.
      Profesyonel, empati dolu ve çözüm odaklı yanıtlar ver.
      
      Şikayet Kategorisi: ${categoryDescriptions[category]}
      Şikayet Metni: "${complaintText}"

      Yanıt gereksinimleri:
      - Vatandaşın sorununun anlaşıldığını göster
      - Özür dile (eğer uygunsuzsa)
      - Somut çözüm adımlarından bahset
      - Maksimum 3 cümle, Türkçe olsun
      - Profesyonel ve güven verici ton kullan

      Sadece yanıt metni yaz, başka açıklama ekleme.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const output = response.text?.trim();
    return output || fallbackAdminResponse(complaintText, category);

  } catch (error) {
    console.error("AI Response generation failed:", error);
    return fallbackAdminResponse(complaintText, category);
  }
};

const fallbackCategorization = (text: string): ComplaintCategory => {
  const t = text.toLowerCase();
  if (t.includes('kesinti') || t.includes('yok') || t.includes('akmıyor') || t.includes('gelmiyor')) return 'KESINTI';
  if (t.includes('basınç') || t.includes('tazyik') || t.includes('az akıyor') || t.includes('yavaş')) return 'BASINC';
  if (t.includes('kirli') || t.includes('bulanık') || t.includes('çamur') || t.includes('kokuyor') || t.includes('renk')) return 'KALITE';
  return 'DIGER';
};

const fallbackModeration = (text: string): { shouldRemove: boolean; reason?: string } => {
  const bannedPatterns = [
    /\b(hakaret|küfür|sikiş|sikim|bok|pis|mal|aptal|salak|ahmak|debilik|aq|ıq|köpek|eşek|should|debe)\b/gi,
    /\b(siyasi|propaganda|chp|akp|iyi|hdp|mhp|cumhuriyet|atatürk)\s*(destek|karşı|oy|seç)/gi,
    /(erdoğan|kılıçdaroğlu|bahçeli|akşener|demirtaş)/gi,
    /\b(ırkçı|nefret|kötü ırk|türksüz)\b/gi
  ];
  
  const t = text.toLowerCase();
  
  for (const pattern of bannedPatterns) {
    if (pattern.test(t)) {
      return { shouldRemove: true, reason: 'Uygunsuz içerik - İçerik politikası ihlali' };
    }
  }
  
  // Çok kısa veya boş şikayet kontrolü
  if (text.trim().length < 5) {
    return { shouldRemove: true, reason: 'Şikayet çok kısa - En az 5 karakter yazınız' };
  }
  
  return { shouldRemove: false };
};

const fallbackAdminResponse = (text: string, category: ComplaintCategory): string => {
  const categoryResponses: Record<ComplaintCategory, string> = {
    'KESINTI': 'Yaşadığınız su kesintisinden dolayı özür dileriz. Ekiplerimiz durumu incelemekte ve en kısa sürede çözüm sağlanacaktır.',
    'BASINC': 'Su basıncı sorununuz hakkında bilgi aldık. Teknik ekibimiz bölgede inceleme yapacak ve çözüme yönelik çalışmalar başlatılacaktır.',
    'KALITE': 'Su kalitesi hakkındaki endişenizi ciddiye alıyoruz. Numune analizi yapılarak sorun belirlenecek ve gerekli önlemler alınacaktır.',
    'DIGER': 'Şikayetinizi kaydettik ve ilgili bölüme ulaştırdık. En kısa sürede geri dönüş yapılacaktır.'
  };
  
  return categoryResponses[category];
};