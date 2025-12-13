/**
 * Risk Bildirim Servisi
 * OpenAI/Gemini API ile otomatik bildirim oluşturma
 * PDF rapor üretimi
 */

import { GoogleGenAI } from "@google/genai";
import { NetworkPrediction } from './networkPredictionModel';

const apiKey = process.env.API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

// Kritik bölge verileri - daha inandırıcı simülasyon için
export const CRITICAL_ZONES = [
  {
    district: 'Osmangazi',
    neighborhood: 'Hüdavendigar Mahallesi',
    riskLevel: 'CRITICAL' as const,
    issue: 'Ana boru hattında ciddi basınç düşüşü tespit edildi',
    affectedPopulation: 12500,
    estimatedRepairTime: 4,
    coordinates: { lat: 40.1845, lng: 29.0712 }
  },
  {
    district: 'Nilüfer',
    neighborhood: 'Ataevler Mahallesi',
    riskLevel: 'HIGH' as const,
    issue: 'Şebeke yaşlanması nedeniyle sızıntı riski yüksek',
    affectedPopulation: 8200,
    estimatedRepairTime: 6,
    coordinates: { lat: 40.2156, lng: 28.9823 }
  },
  {
    district: 'Yıldırım',
    neighborhood: 'Esenevler Mahallesi',
    riskLevel: 'HIGH' as const,
    issue: 'Akış anomalisi - olası boru kırığı',
    affectedPopulation: 6700,
    estimatedRepairTime: 3,
    coordinates: { lat: 40.1978, lng: 29.1345 }
  },
  {
    district: 'Gemlik',
    neighborhood: 'Hisar Mahallesi',
    riskLevel: 'MEDIUM' as const,
    issue: 'Planlı bakım nedeniyle kısmi kesinti',
    affectedPopulation: 4300,
    estimatedRepairTime: 2,
    coordinates: { lat: 40.4289, lng: 29.1534 }
  },
  {
    district: 'İnegöl',
    neighborhood: 'Yenice Mahallesi',
    riskLevel: 'MEDIUM' as const,
    issue: 'Pompa istasyonu bakımı gerekli',
    affectedPopulation: 3100,
    estimatedRepairTime: 5,
    coordinates: { lat: 40.0812, lng: 29.5078 }
  }
];

// Gerçek zamanlı kesinti verileri
export const ACTIVE_OUTAGES = [
  {
    id: 'OUT-001',
    district: 'Osmangazi',
    neighborhoods: ['Hüdavendigar', 'Demirtaş', 'Çekirge'],
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 saat önce
    estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 saat sonra
    reason: 'Ana besleme hattında arıza onarımı',
    affectedHouseholds: 3200,
    status: 'ONGOING' as const,
    severity: 'HIGH' as const
  },
  {
    id: 'OUT-002',
    district: 'Nilüfer',
    neighborhoods: ['Görükle', 'Beşevler'],
    startTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 saat sonra
    estimatedEndTime: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(), // 10 saat sonra
    reason: 'Planlı şebeke bakım çalışması',
    affectedHouseholds: 1800,
    status: 'PLANNED' as const,
    severity: 'MEDIUM' as const
  }
];

/**
 * AI ile vatandaş bildirimi oluştur
 */
export async function generateCitizenNotification(
  district: string,
  issue: string,
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  estimatedTime?: number
): Promise<string> {
  if (!ai) {
    return fallbackNotification(district, issue, riskLevel, estimatedTime);
  }

  try {
    const prompt = `
      Sen BUSKİ (Bursa Su ve Kanalizasyon İdaresi) olarak vatandaşlara bildirim gönderiyorsun.
      
      Bildirim Detayları:
      - Bölge: ${district}
      - Sorun: ${issue}
      - Risk Seviyesi: ${riskLevel}
      ${estimatedTime ? `- Tahmini Çözüm Süresi: ${estimatedTime} saat` : ''}
      
      Gereksinimler:
      - Profesyonel ve güven verici ton kullan
      - Vatandaşları panik yapmadan bilgilendir
      - Somut bilgiler ver (ne zaman, nasıl çözülecek)
      - Maksimum 4 cümle, Türkçe
      - Su tasarrufu önerisi ekle (uygunsa)
      
      Sadece bildirim metnini yaz, başka açıklama ekleme.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || fallbackNotification(district, issue, riskLevel, estimatedTime);
  } catch (error) {
    console.error('AI notification generation failed:', error);
    return fallbackNotification(district, issue, riskLevel, estimatedTime);
  }
}

/**
 * Fallback bildirim oluştur
 */
function fallbackNotification(
  district: string,
  issue: string,
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  estimatedTime?: number
): string {
  const urgencyPrefix = {
    'CRITICAL': '🚨 ACİL BİLDİRİM:',
    'HIGH': '⚠️ ÖNEMLİ DUYURU:',
    'MEDIUM': '📢 BİLGİLENDİRME:',
    'LOW': 'ℹ️ DUYURU:'
  };

  let message = `${urgencyPrefix[riskLevel]} ${district} bölgesinde ${issue.toLowerCase()}. `;
  
  if (estimatedTime) {
    message += `Sorunun yaklaşık ${estimatedTime} saat içinde çözülmesi planlanmaktadır. `;
  }
  
  message += 'Anlayışınız için teşekkür ederiz. Acil durumlarda 185 Su Arıza hattını arayabilirsiniz.';
  
  return message;
}

/**
 * AI ile risk raporu özeti oluştur
 */
export async function generateRiskReportSummary(predictions: NetworkPrediction[]): Promise<string> {
  if (!ai) {
    return fallbackReportSummary(predictions);
  }

  try {
    const criticalCount = predictions.filter(p => p.predictedStatus === 'CRITICAL').length;
    const warningCount = predictions.filter(p => p.predictedStatus === 'WARNING').length;
    const avgRisk = predictions.reduce((sum, p) => sum + p.riskScore, 0) / predictions.length;
    
    const criticalDistricts = predictions
      .filter(p => p.predictedStatus === 'CRITICAL')
      .map(p => p.districtName)
      .join(', ');

    const prompt = `
      Sen BUSKİ Veri Analiz Birimi uzmanısın. Aşağıdaki verilere göre yöneticiler için kısa bir risk özeti hazırla.
      
      Veriler:
      - Kritik Bölge Sayısı: ${criticalCount}
      - Uyarı Altındaki Bölge: ${warningCount}
      - Ortalama Risk Skoru: ${avgRisk.toFixed(0)}/100
      - Kritik Bölgeler: ${criticalDistricts || 'Yok'}
      
      Gereksinimler:
      - 3-4 cümle ile özetle
      - Somut öneriler sun
      - Profesyonel ton
      - Türkçe
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || fallbackReportSummary(predictions);
  } catch (error) {
    console.error('AI report summary failed:', error);
    return fallbackReportSummary(predictions);
  }
}

function fallbackReportSummary(predictions: NetworkPrediction[]): string {
  const criticalCount = predictions.filter(p => p.predictedStatus === 'CRITICAL').length;
  const warningCount = predictions.filter(p => p.predictedStatus === 'WARNING').length;
  const healthyCount = predictions.filter(p => p.predictedStatus === 'HEALTHY').length;
  
  let summary = `Bursa Su Şebekesi Günlük Durum Özeti: `;
  summary += `${healthyCount} bölge normal, ${warningCount} bölge uyarı altında`;
  
  if (criticalCount > 0) {
    summary += `, ${criticalCount} bölge kritik durumda. Acil müdahale önerilir.`;
  } else {
    summary += `. Genel durum stabil.`;
  }
  
  return summary;
}

/**
 * PDF rapor verisi oluştur (HTML formatında)
 */
export function generatePDFReportHTML(
  predictions: NetworkPrediction[],
  criticalZones: typeof CRITICAL_ZONES,
  outages: typeof ACTIVE_OUTAGES
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const criticalPredictions = predictions.filter(p => p.predictedStatus === 'CRITICAL');
  const warningPredictions = predictions.filter(p => p.predictedStatus === 'WARNING');
  const avgRisk = predictions.reduce((sum, p) => sum + p.riskScore, 0) / predictions.length;

  return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>BUSKİ Risk Raporu - ${dateStr}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1e293b; line-height: 1.6; padding: 40px; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #0ea5e9; padding-bottom: 20px; }
        .header h1 { color: #0369a1; font-size: 28px; }
        .header p { color: #64748b; margin-top: 8px; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 18px; font-weight: 600; color: #0369a1; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #f8fafc; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #e2e8f0; }
        .stat-value { font-size: 28px; font-weight: 700; }
        .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
        .critical { color: #dc2626; }
        .warning { color: #f59e0b; }
        .healthy { color: #22c55e; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; font-weight: 600; color: #475569; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .badge-critical { background: #fef2f2; color: #dc2626; }
        .badge-high { background: #fff7ed; color: #ea580c; }
        .badge-medium { background: #fefce8; color: #ca8a04; }
        .badge-low { background: #f0fdf4; color: #16a34a; }
        .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🌊 BUSKİ Su Şebekesi Risk Raporu</h1>
        <p>Bursa Su ve Kanalizasyon İdaresi | ${dateStr}</p>
      </div>

      <div class="section">
        <h2 class="section-title">📊 Genel Durum Özeti</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${predictions.length}</div>
            <div class="stat-label">Toplam Bölge</div>
          </div>
          <div class="stat-card">
            <div class="stat-value critical">${criticalPredictions.length}</div>
            <div class="stat-label">Kritik Bölge</div>
          </div>
          <div class="stat-card">
            <div class="stat-value warning">${warningPredictions.length}</div>
            <div class="stat-label">Uyarı</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgRisk.toFixed(0)}</div>
            <div class="stat-label">Ort. Risk Skoru</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">🚨 Kritik Bölgeler</h2>
        ${criticalZones.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Bölge</th>
              <th>Mahalle</th>
              <th>Risk</th>
              <th>Sorun</th>
              <th>Etkilenen Nüfus</th>
            </tr>
          </thead>
          <tbody>
            ${criticalZones.map(zone => `
              <tr>
                <td><strong>${zone.district}</strong></td>
                <td>${zone.neighborhood}</td>
                <td><span class="badge badge-${zone.riskLevel.toLowerCase()}">${zone.riskLevel}</span></td>
                <td>${zone.issue}</td>
                <td>${zone.affectedPopulation.toLocaleString('tr-TR')} kişi</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p>Kritik seviyede bölge bulunmamaktadır.</p>'}
      </div>

      <div class="section">
        <h2 class="section-title">⚡ Aktif Kesintiler</h2>
        ${outages.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Bölge</th>
              <th>Mahalleler</th>
              <th>Durum</th>
              <th>Tahmini Bitiş</th>
            </tr>
          </thead>
          <tbody>
            ${outages.map(outage => `
              <tr>
                <td><strong>${outage.id}</strong></td>
                <td>${outage.district}</td>
                <td>${outage.neighborhoods.join(', ')}</td>
                <td><span class="badge badge-${outage.severity.toLowerCase()}">${outage.status}</span></td>
                <td>${new Date(outage.estimatedEndTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p>Aktif kesinti bulunmamaktadır.</p>'}
      </div>

      <div class="section">
        <h2 class="section-title">📈 Bölge Bazlı Risk Analizi</h2>
        <table>
          <thead>
            <tr>
              <th>Bölge</th>
              <th>Risk Skoru</th>
              <th>Durum</th>
              <th>Güven</th>
              <th>Öneri</th>
            </tr>
          </thead>
          <tbody>
            ${predictions
              .sort((a, b) => b.riskScore - a.riskScore)
              .slice(0, 10)
              .map(pred => `
              <tr>
                <td><strong>${pred.districtName}</strong></td>
                <td>${pred.riskScore.toFixed(0)}/100</td>
                <td><span class="badge badge-${pred.predictedStatus === 'CRITICAL' ? 'critical' : pred.predictedStatus === 'WARNING' ? 'medium' : 'low'}">${pred.predictedStatus}</span></td>
                <td>%${pred.confidenceLevel.toFixed(0)}</td>
                <td style="font-size: 11px;">${pred.recommendedAction.substring(0, 50)}...</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>Bu rapor BUSKİ Akıllı Su Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.</p>
        <p>© ${now.getFullYear()} Bursa Su ve Kanalizasyon İdaresi Genel Müdürlüğü</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * PDF indir (tarayıcıda)
 */
export function downloadPDFReport(htmlContent: string, filename: string = 'buski-risk-raporu.pdf'): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up engelleyici PDF indirmeyi engelliyor olabilir. Lütfen izin verin.');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  // Yazdırma dialogunu aç (PDF olarak kaydet seçeneği ile)
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
