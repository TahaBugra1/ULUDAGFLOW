// PDF Risk Raporu Servisi
// jspdf ve jspdf-autotable kullanarak profesyonel PDF raporları oluşturur

import { NodeSensorData, predictBurstRisk } from './sensorDataService';
import { Complaint } from '../types';

export interface RiskReportData {
  generatedAt: Date;
  reportPeriod: string;
  summary: {
    totalSensors: number;
    criticalAlerts: number;
    highRiskAreas: number;
    activeComplaints: number;
    resolvedIssues: number;
  };
  sensorData: NodeSensorData[];
  complaints: Complaint[];
  criticalZones: Array<{
    name: string;
    riskScore: number;
    issue: string;
    recommendations: string[];
  }>;
}

// HTML to PDF using browser print functionality (no external dependencies)
export const generateRiskReportPDF = async (data: RiskReportData): Promise<void> => {
  const { summary, sensorData, complaints, criticalZones, generatedAt, reportPeriod } = data;
  
  // Calculate high risk sensors
  const highRiskSensors = sensorData.filter(s => {
    const risk = predictBurstRisk(s);
    return risk.risk_level === 'CRITICAL' || risk.risk_level === 'HIGH';
  });
  
  // Create HTML content for the report
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>BUSKİ Risk Analiz Raporu</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          color: #1f2937;
          line-height: 1.6;
          background: white;
        }
        .container { max-width: 800px; margin: 0 auto; padding: 40px; }
        
        /* Header */
        .header {
          text-align: center;
          padding-bottom: 30px;
          border-bottom: 3px solid #3b82f6;
          margin-bottom: 30px;
        }
        .logo { font-size: 32px; font-weight: bold; color: #1e40af; margin-bottom: 8px; }
        .subtitle { color: #6b7280; font-size: 14px; }
        .report-title { font-size: 24px; color: #111827; margin-top: 20px; }
        .report-date { color: #6b7280; font-size: 12px; margin-top: 8px; }
        
        /* Summary Cards */
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 30px;
        }
        .summary-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }
        .summary-card.critical { background: #fef2f2; border-color: #fecaca; }
        .summary-card.warning { background: #fffbeb; border-color: #fde68a; }
        .summary-card.success { background: #f0fdf4; border-color: #bbf7d0; }
        .summary-value { font-size: 28px; font-weight: bold; color: #1f2937; }
        .summary-card.critical .summary-value { color: #dc2626; }
        .summary-card.warning .summary-value { color: #f59e0b; }
        .summary-card.success .summary-value { color: #16a34a; }
        .summary-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
        
        /* Sections */
        .section { margin-bottom: 30px; }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          padding-bottom: 12px;
          border-bottom: 2px solid #e5e7eb;
          margin-bottom: 16px;
        }
        
        /* Tables */
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { 
          background: #f1f5f9; 
          padding: 12px; 
          text-align: left; 
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }
        td { 
          padding: 10px 12px; 
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
        }
        tr:hover { background: #f8fafc; }
        
        /* Risk Badge */
        .risk-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .risk-critical { background: #fee2e2; color: #dc2626; }
        .risk-high { background: #ffedd5; color: #ea580c; }
        .risk-medium { background: #fef3c7; color: #d97706; }
        .risk-low { background: #dcfce7; color: #16a34a; }
        
        /* Critical Zones */
        .zone-card {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
        }
        .zone-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .zone-name { font-weight: 600; color: #991b1b; }
        .zone-score { 
          background: #dc2626; 
          color: white; 
          padding: 4px 12px; 
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .zone-issue { font-size: 13px; color: #7f1d1d; margin-bottom: 8px; }
        .zone-recommendations {
          font-size: 12px;
          color: #6b7280;
          padding-left: 16px;
        }
        .zone-recommendations li { margin-bottom: 4px; }
        
        /* Footer */
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 11px;
          color: #9ca3af;
        }
        
        /* Print Styles */
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .container { max-width: 100%; padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="logo">🌊 BUSKİ</div>
          <div class="subtitle">Bursa Su ve Kanalizasyon İdaresi</div>
          <h1 class="report-title">Risk Analiz Raporu</h1>
          <div class="report-date">
            Rapor Tarihi: ${generatedAt.toLocaleString('tr-TR')} | 
            Dönem: ${reportPeriod}
          </div>
        </div>
        
        <!-- Summary -->
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-value">${summary.totalSensors}</div>
            <div class="summary-label">Toplam Sensör</div>
          </div>
          <div class="summary-card critical">
            <div class="summary-value">${summary.criticalAlerts}</div>
            <div class="summary-label">Kritik Uyarı</div>
          </div>
          <div class="summary-card warning">
            <div class="summary-value">${summary.highRiskAreas}</div>
            <div class="summary-label">Yüksek Riskli Bölge</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${summary.activeComplaints}</div>
            <div class="summary-label">Aktif Şikayet</div>
          </div>
          <div class="summary-card success">
            <div class="summary-value">${summary.resolvedIssues}</div>
            <div class="summary-label">Çözülen Sorun</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${highRiskSensors.length}</div>
            <div class="summary-label">Riskli Sensör</div>
          </div>
        </div>
        
        <!-- Critical Zones -->
        <div class="section">
          <h2 class="section-title">🚨 Kritik Risk Bölgeleri</h2>
          ${criticalZones.map(zone => `
            <div class="zone-card">
              <div class="zone-header">
                <span class="zone-name">${zone.name}</span>
                <span class="zone-score">${zone.riskScore}% Risk</span>
              </div>
              <div class="zone-issue">⚠️ ${zone.issue}</div>
              <ul class="zone-recommendations">
                ${zone.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
        
        <!-- Sensor Analysis -->
        <div class="section">
          <h2 class="section-title">📡 Sensör Analizi (Yüksek Risk)</h2>
          <table>
            <thead>
              <tr>
                <th>Bölge</th>
                <th>Basınç</th>
                <th>Debi</th>
                <th>Kalite</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              ${highRiskSensors.slice(0, 10).map(sensor => {
                const risk = predictBurstRisk(sensor);
                return `
                  <tr>
                    <td>${sensor.node_name}</td>
                    <td>${sensor.current_pressure.toFixed(2)} bar</td>
                    <td>${sensor.current_flow.toFixed(1)} L/s</td>
                    <td>${sensor.anomaly_score}%</td>
                    <td>
                      <span class="risk-badge risk-${risk.risk_level.toLowerCase()}">
                        ${risk.risk_level}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- Recent Complaints -->
        <div class="section">
          <h2 class="section-title">📋 Son Şikayetler</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Konum</th>
                <th>Kategori</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              ${complaints.slice(0, 10).map(c => `
                <tr>
                  <td>#${c.id}</td>
                  <td>${c.district || 'Bilinmiyor'}</td>
                  <td>${c.category}</td>
                  <td>
                    <span class="risk-badge ${
                      c.status === 'RESOLVED' ? 'risk-low' : 'risk-high'
                    }">
                      ${c.status === 'RESOLVED' ? 'Çözüldü' : 'Açık'}
                    </span>
                  </td>
                  <td>${new Date(c.created_at).toLocaleDateString('tr-TR')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p>Bu rapor BUSKİ Akıllı Su Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.</p>
          <p>© ${new Date().getFullYear()} Bursa Büyükşehir Belediyesi - Tüm hakları saklıdır.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  // Open in new window for printing/saving as PDF
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }
};

// Generate and download report
export const downloadRiskReport = async (
  sensorData: NodeSensorData[],
  complaints: Complaint[],
  criticalZones: Array<{ name: string; riskScore: number; issue: string; recommendations: string[] }>
): Promise<void> => {
  const criticalAlerts = sensorData.filter(s => {
    const risk = predictBurstRisk(s);
    return risk.risk_level === 'CRITICAL';
  }).length;
  
  const highRiskAreas = criticalZones.filter(z => z.riskScore > 70).length;
  const activeComplaints = complaints.filter(c => c.status !== 'RESOLVED').length;
  const resolvedIssues = complaints.filter(c => c.status === 'RESOLVED').length;
  
  const reportData: RiskReportData = {
    generatedAt: new Date(),
    reportPeriod: 'Son 7 Gün',
    summary: {
      totalSensors: sensorData.length,
      criticalAlerts,
      highRiskAreas,
      activeComplaints,
      resolvedIssues
    },
    sensorData,
    complaints,
    criticalZones
  };
  
  await generateRiskReportPDF(reportData);
};

// Quick report for specific area
export const generateAreaReport = async (
  areaName: string,
  sensors: NodeSensorData[],
  riskScore: number,
  issues: string[]
): Promise<string> => {
  const now = new Date();
  
  return `
# ${areaName} Bölge Raporu

**Rapor Tarihi:** ${now.toLocaleString('tr-TR')}

## Özet
- **Risk Skoru:** ${riskScore}%
- **Aktif Sensör:** ${sensors.length}
- **Tespit Edilen Sorunlar:** ${issues.length}

## Sensör Durumu
${sensors.map(s => {
  const risk = predictBurstRisk(s);
  return `- **${s.node_name}:** Basınç ${s.current_pressure.toFixed(2)} bar, Risk: ${risk.risk_level}`;
}).join('\n')}

## Sorunlar
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

---
*BUSKİ Akıllı Su Yönetim Sistemi*
  `;
};

export default {
  generateRiskReportPDF,
  downloadRiskReport,
  generateAreaReport
};
