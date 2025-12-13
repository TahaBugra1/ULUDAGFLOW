/**
 * OpenAI Service - Teknik Rapor Hazırlama
 * 
 * Teknisyenler için detaylı boru risk raporları üretir.
 */

import type { PipeRiskScore } from '../core/types';

// OpenAI API key - env'den gelecek
const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY || '';

export interface TechnicalReportData {
  pipe: PipeRiskScore;
  historicalFailures?: FailureRecord[];
  nearbyPipes?: PipeRiskScore[];
  environmentalFactors?: EnvironmentalFactors;
}

export interface FailureRecord {
  id: string;
  date: string;
  type: 'patlak' | 'sizinti' | 'tikaniklik' | 'bilinmiyor';
  repairDuration: number; // saat
  cost: number; // TL
  description: string;
  technician: string;
}

export interface EnvironmentalFactors {
  soilType: string;
  trafficLoad: 'low' | 'medium' | 'high';
  groundwaterLevel: number; // metre
  seismicZone: string;
}

// Mock geçmiş arıza kayıtları
function generateMockHistory(pipe: PipeRiskScore): FailureRecord[] {
  const failures: FailureRecord[] = [];
  const failureTypes = ['patlak', 'sizinti', 'tikaniklik'] as const;
  const technicians = ['Ali Yılmaz', 'Mehmet Kaya', 'Ahmet Demir', 'Hasan Öztürk', 'Mustafa Çelik'];
  
  const count = pipe.failure_count_last_12m + Math.floor(Math.random() * 3);
  
  for (let i = 0; i < count; i++) {
    const daysAgo = i === 0 && pipe.time_since_last_failure_days 
      ? pipe.time_since_last_failure_days 
      : Math.floor(Math.random() * 365 * 3) + (i * 90);
    
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    
    failures.push({
      id: `F-${pipe.pipe_id}-${String(i + 1).padStart(3, '0')}`,
      date: date.toISOString().split('T')[0],
      type: failureTypes[Math.floor(Math.random() * failureTypes.length)],
      repairDuration: Math.floor(Math.random() * 8) + 2,
      cost: Math.floor(Math.random() * 15000) + 2000,
      description: getRandomDescription(failureTypes[Math.floor(Math.random() * failureTypes.length)]),
      technician: technicians[Math.floor(Math.random() * technicians.length)]
    });
  }
  
  return failures.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function getRandomDescription(type: string): string {
  const descriptions: Record<string, string[]> = {
    patlak: [
      'Boru ek yerinde ani basınç artışı sonucu patlama',
      'Korozyon kaynaklı zayıflama sonucu patlak',
      'Dış etken (kazı çalışması) nedeniyle hasar',
      'Malzeme yorulması sonucu çatlak ve patlak',
      'Don olayı sonrası genleşme kaynaklı patlak'
    ],
    sizinti: [
      'Conta bozulması kaynaklı sızıntı',
      'Mikro çatlaktan yavaş sızıntı',
      'Bağlantı noktasında gevşeme',
      'Toprak hareketinden kaynaklı sızıntı',
      'Ek parça korozyonu sonucu sızıntı'
    ],
    tikaniklik: [
      'Tortu birikimi sonucu daralma',
      'Kireç birikmesi kaynaklı tıkanma',
      'Yabancı madde girişi',
      'İç yüzey korozyonu sonucu daralma'
    ]
  };
  
  const list = descriptions[type] || descriptions['patlak'];
  return list[Math.floor(Math.random() * list.length)];
}

function getMockEnvironmentalFactors(): EnvironmentalFactors {
  const soilTypes = ['Killi', 'Kumlu', 'Kayalık', 'Balçık', 'Çakıllı'];
  const zones = ['1. Derece', '2. Derece', '3. Derece'];
  
  return {
    soilType: soilTypes[Math.floor(Math.random() * soilTypes.length)],
    trafficLoad: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
    groundwaterLevel: Math.floor(Math.random() * 10) + 2,
    seismicZone: zones[Math.floor(Math.random() * zones.length)]
  };
}

/**
 * OpenAI ile detaylı teknik rapor üretir
 */
export const generateTechnicalReport = async (data: TechnicalReportData): Promise<string> => {
  const { pipe } = data;
  const history = data.historicalFailures || generateMockHistory(pipe);
  const env = data.environmentalFactors || getMockEnvironmentalFactors();
  
  // Rapor tarihi
  const reportDate = new Date().toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Geçmiş arıza özeti
  const historyText = history.map(f => 
    `- ${f.date}: ${f.type.toUpperCase()} - ${f.description} (Onarım: ${f.repairDuration} saat, Maliyet: ${f.cost.toLocaleString('tr-TR')} TL, Teknisyen: ${f.technician})`
  ).join('\n');

  // Risk faktörleri
  const riskFactors = pipe.top_factors.join(', ');

  if (apiKey) {
    try {
      const prompt = `
Sen BUSKİ (Bursa Su ve Kanalizasyon İdaresi) için çalışan bir su şebekesi mühendisisin.
Aşağıdaki boru hattı için saha teknisyenine yönelik DETAYLI bir teknik rapor hazırla.

BORU BİLGİLERİ:
- Boru ID: ${pipe.pipe_id}
- DMA: ${pipe.dma_id}
- İlçe: ${pipe.district}
- Malzeme: ${pipe.material}
- Yaş: ${pipe.pipe_age_years} yıl
- Risk Skoru: ${(pipe.risk_score * 100).toFixed(0)}/100 (${pipe.risk_band.toUpperCase()})
- Son 12 ayda arıza sayısı: ${pipe.failure_count_last_12m}
- Son arızadan bu yana: ${pipe.time_since_last_failure_days ? pipe.time_since_last_failure_days + ' gün' : 'Kayıt yok'}
- Beklenen arıza tipi: ${pipe.expected_failure_type}
- Risk faktörleri: ${riskFactors}

ÇEVRESEL FAKTÖRLER:
- Zemin tipi: ${env.soilType}
- Trafik yükü: ${env.trafficLoad === 'high' ? 'Yoğun' : env.trafficLoad === 'medium' ? 'Orta' : 'Hafif'}
- Yeraltı su seviyesi: ${env.groundwaterLevel} metre
- Deprem bölgesi: ${env.seismicZone}

ARIZA GEÇMİŞİ:
${historyText || 'Kayıtlı arıza bulunmamaktadır.'}

Rapor şu bölümlerden oluşmalı:
1. YÖNETİCİ ÖZETİ (2-3 cümle)
2. RİSK ANALİZİ (risk skoru yorumu, neden yüksek/orta/düşük)
3. TEKNİK DURUM DEĞERLENDİRMESİ (malzeme, yaş, çevresel faktörler)
4. ARIZA GEÇMİŞİ ANALİZİ (pattern, tekrarlayan sorunlar)
5. ÖNERİLEN AKSIYONLAR (öncelik sırasına göre, spesifik)
6. GÜVENLİK UYARILARI (saha ekibi için)
7. MALZEME VE EKİPMAN LİSTESİ (tahmini ihtiyaçlar)

Rapor profesyonel, teknik ve saha ekibinin anlayacağı dilde olsun.
Türkçe yaz. Markdown formatında yaz.
`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Sen deneyimli bir su şebekesi mühendisisin. Teknik raporlar hazırlıyorsun.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result.choices?.[0]?.message?.content || generateFallbackReport(pipe, history, env, reportDate);
      }
      
      return generateFallbackReport(pipe, history, env, reportDate);
    } catch (error) {
      console.error('OpenAI API error:', error);
      return generateFallbackReport(pipe, history, env, reportDate);
    }
  }
  
  return generateFallbackReport(pipe, history, env, reportDate);
};

/**
 * API kullanılamadığında fallback rapor
 */
function generateFallbackReport(
  pipe: PipeRiskScore, 
  history: FailureRecord[], 
  env: EnvironmentalFactors,
  reportDate: string
): string {
  const riskLevel = pipe.risk_band === 'high' ? 'YÜKSEK' : pipe.risk_band === 'medium' ? 'ORTA' : 'DÜŞÜK';
  const urgency = pipe.risk_band === 'high' ? '7 gün' : pipe.risk_band === 'medium' ? '30 gün' : '90 gün';
  
  const totalCost = history.reduce((sum, f) => sum + f.cost, 0);
  const totalHours = history.reduce((sum, f) => sum + f.repairDuration, 0);
  
  return `# TEKNİK İNCELEME RAPORU

**Rapor No:** RPT-${pipe.pipe_id}-${Date.now().toString(36).toUpperCase()}
**Tarih:** ${reportDate}
**Hazırlayan:** BUSKİ Risk Analiz Sistemi

---

## 1. YÖNETİCİ ÖZETİ

${pipe.pipe_id} kodlu boru hattı **${riskLevel} RİSK** kategorisinde değerlendirilmektedir. 
${pipe.pipe_age_years} yıllık ${pipe.material} malzemeli bu hat için **${urgency} içinde** saha kontrolü önerilmektedir.
${history.length > 0 ? `Son 3 yılda ${history.length} arıza kaydı bulunmaktadır.` : 'Kayıtlı arıza bulunmamaktadır.'}

---

## 2. RİSK ANALİZİ

| Parametre | Değer | Değerlendirme |
|-----------|-------|---------------|
| Risk Skoru | **${(pipe.risk_score * 100).toFixed(0)}/100** | ${riskLevel} |
| Risk Bandı | ${pipe.risk_band.toUpperCase()} | ${pipe.risk_band === 'high' ? '🔴 Acil müdahale gerekli' : pipe.risk_band === 'medium' ? '🟡 Yakın takip gerekli' : '🟢 Rutin bakım yeterli'} |
| Beklenen Arıza | ${pipe.expected_failure_type.toUpperCase()} | ${pipe.expected_failure_type === 'patlak' ? 'Ani su kesintisi riski' : pipe.expected_failure_type === 'sizinti' ? 'Su kaybı ve zemin hasarı riski' : 'Belirsiz - ek inceleme gerekli'} |

### Risk Faktörleri:
${pipe.top_factors.map(f => `- ⚠️ ${f}`).join('\n')}

---

## 3. TEKNİK DURUM DEĞERLENDİRMESİ

### Boru Özellikleri
| Özellik | Değer | Durum |
|---------|-------|-------|
| Malzeme | ${pipe.material} | ${['AC', 'FONT'].includes(pipe.material) ? '⚠️ Riskli malzeme' : '✅ Kabul edilebilir'} |
| Yaş | ${pipe.pipe_age_years} yıl | ${pipe.pipe_age_years > 30 ? '⚠️ Ekonomik ömrünü aşmış' : pipe.pipe_age_years > 20 ? '🟡 Yaşlanma belirtileri' : '✅ Normal'} |
| DMA | ${pipe.dma_id} | ${pipe.district} |

### Çevresel Koşullar
| Faktör | Değer | Etki |
|--------|-------|------|
| Zemin Tipi | ${env.soilType} | ${env.soilType === 'Killi' ? 'Korozyon riski yüksek' : 'Normal'} |
| Trafik Yükü | ${env.trafficLoad === 'high' ? 'Yoğun' : env.trafficLoad === 'medium' ? 'Orta' : 'Hafif'} | ${env.trafficLoad === 'high' ? 'Titreşim hasarı olası' : 'Kabul edilebilir'} |
| Yeraltı Su | ${env.groundwaterLevel}m | ${env.groundwaterLevel < 5 ? 'Dış basınç riski' : 'Normal'} |
| Deprem Bölgesi | ${env.seismicZone} | ${env.seismicZone === '1. Derece' ? 'Yüksek sismik risk' : 'Orta-düşük risk'} |

---

## 4. ARIZA GEÇMİŞİ ANALİZİ

${history.length > 0 ? `
### Son 3 Yıl İstatistikleri
- **Toplam Arıza:** ${history.length} adet
- **Toplam Onarım Süresi:** ${totalHours} saat
- **Toplam Maliyet:** ${totalCost.toLocaleString('tr-TR')} TL
- **Ortalama Onarım Süresi:** ${(totalHours / history.length).toFixed(1)} saat/arıza

### Arıza Kronolojisi

| Tarih | Tip | Açıklama | Süre | Maliyet | Teknisyen |
|-------|-----|----------|------|---------|-----------|
${history.slice(0, 10).map(f => 
  `| ${f.date} | ${f.type.toUpperCase()} | ${f.description.substring(0, 40)}... | ${f.repairDuration}s | ${f.cost.toLocaleString('tr-TR')}₺ | ${f.technician} |`
).join('\n')}

### Pattern Analizi
${history.filter(f => f.type === 'patlak').length > history.length / 2 
  ? '⚠️ **UYARI:** Arızaların çoğunluğu PATLAK tipindedir. Malzeme yorgunluğu veya basınç sorunları araştırılmalıdır.'
  : history.filter(f => f.type === 'sizinti').length > history.length / 2
  ? '⚠️ **UYARI:** Tekrarlayan SIZINTI sorunları tespit edilmiştir. Bağlantı noktaları ve contalar kontrol edilmelidir.'
  : '✅ Belirgin bir arıza paterni gözlemlenmemiştir.'}
` : `
> ℹ️ Bu boru hattı için kayıtlı arıza bulunmamaktadır.
> Bu durum borunun sağlıklı olduğu anlamına gelmeyebilir - düzenli kontrol önerilir.
`}

---

## 5. ÖNERİLEN AKSIYONLAR

### Acil (${urgency} içinde)
${pipe.risk_band === 'high' ? `
1. **Saha Kontrolü** - Görsel muayene ve sızıntı tespiti
2. **Basınç Ölçümü** - Hat boyunca basınç profili çıkarılması
3. **Akustik Dinleme** - Sızıntı noktalarının belirlenmesi
4. **Zemin İncelemesi** - Çökme ve nem kontrolü
` : pipe.risk_band === 'medium' ? `
1. **Planlı Kontrol** - Sonraki bakım turunda görsel muayene
2. **Veri Toplama** - Basınç ve debi verilerinin analizi
3. **Komşu Hatlar** - Yakın boruların durumunun değerlendirilmesi
` : `
1. **Rutin Bakım** - Standart bakım programına dahil edilmesi
2. **Kayıt Güncellemesi** - Varlık envanterinin güncellenmesi
`}

### Orta Vadeli (3-6 ay)
${pipe.pipe_age_years > 30 || ['AC', 'FONT'].includes(pipe.material) ? `
- **Yenileme Planlaması** - Hat yenileme bütçesine eklenmesi
- **Alternatif Güzergah** - Acil durumda by-pass imkanının değerlendirilmesi
` : `
- **Standart Takip** - Periyodik kontrol programına dahil edilmesi
`}

---

## 6. GÜVENLİK UYARILARI

${pipe.risk_band === 'high' ? `
⚠️ **YÜKSEK RİSK UYARILARI:**
- Çalışma öncesi hat izolasyonu sağlanmalıdır
- Kazı çalışmalarında dikkatli olunmalı, ek hasar riski yüksektir
- ${pipe.material} malzeme asbest içerebilir (AC ise) - uygun KKD kullanılmalıdır
- Basınç altında müdahale yapılmamalıdır
` : `
✅ **STANDART GÜVENLİK ÖNLEMLERİ:**
- Çalışma alanı işaretlenmeli
- Uygun KKD kullanılmalı
- Trafik güvenliği sağlanmalı
`}

---

## 7. MALZEME VE EKİPMAN LİSTESİ

### Temel Ekipman
- [ ] Sızıntı dedektörü
- [ ] Basınç ölçer (manometre)
- [ ] Akustik dinleme cihazı
- [ ] Zemin nemi ölçer

### Olası Onarım Malzemeleri
| Malzeme | Miktar | Açıklama |
|---------|--------|----------|
| ${pipe.material} boru (DN100-200) | 2-5m | Yedek segment |
| Ek parça/manşon | 4 adet | Bağlantı için |
| Conta seti | 1 takım | Çeşitli çaplar |
| Tamir kelepçesi | 2 adet | Acil müdahale |
| Epoksi dolgu | 1 set | Küçük çatlaklar |

---

## 8. EK BİLGİLER

**Konum Koordinatları:**
- Başlangıç: ${pipe.geom_start[0].toFixed(6)}, ${pipe.geom_start[1].toFixed(6)}
- Bitiş: ${pipe.geom_end[0].toFixed(6)}, ${pipe.geom_end[1].toFixed(6)}

**Sonraki Kontrol Tarihi:** ${new Date(Date.now() + (pipe.risk_band === 'high' ? 7 : pipe.risk_band === 'medium' ? 30 : 90) * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')}

---

*Bu rapor BUSKİ Risk Analiz Sistemi tarafından otomatik olarak üretilmiştir.*
*Saha koşullarına göre güncellenebilir.*
`;
}

/**
 * Markdown'ı PDF'e dönüştürmek için HTML oluşturur
 */
export function markdownToHtml(markdown: string): string {
  // Basit markdown -> html dönüşümü
  let html = markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Tables
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.some(c => /^[-:]+$/.test(c.trim()))) return '';
      const cellHtml = cells.map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cellHtml}</tr>`;
    })
    // Lists
    .replace(/^- \[ \] (.*$)/gim, '<li class="unchecked">☐ $1</li>')
    .replace(/^- \[x\] (.*$)/gim, '<li class="checked">☑ $1</li>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>')
    // Blockquotes
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gim, '<hr>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      color: #333;
    }
    h1 { color: #1a365d; border-bottom: 3px solid #2c5282; padding-bottom: 10px; }
    h2 { color: #2c5282; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; }
    h3 { color: #4a5568; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
    th { background: #f7fafc; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    blockquote { border-left: 4px solid #3182ce; padding-left: 16px; color: #4a5568; margin: 15px 0; background: #ebf8ff; padding: 12px 16px; }
    code { background: #edf2f7; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 30px 0; }
    li { margin: 5px 0; }
    .unchecked, .checked { list-style: none; }
    strong { color: #1a202c; }
    @media print {
      body { padding: 20px; }
      h1 { page-break-after: avoid; }
      h2, h3 { page-break-after: avoid; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`;
}
