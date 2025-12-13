/**
 * MODÜL B: Ticket Page - Mahalle Su Gerçekliği
 * 
 * WhatsApp bot'tan gelen bilet linki: https://uludagflow.app/ticket/{ticket_id}
 * 
 * İki blok:
 * 1. Şikayet Kartı (Ticket Block) - Kullanıcının kendi bileti
 * 2. Mahalle Gerçeklik Kartı (Neighborhood Block) - Herkese açık metrikler
 * 
 * Amaç: Kullanıcı kendi ticket'ının durumunu ekstra login olmadan takip eder
 *       + mahallesinin genel su performansını görür.
 */

import React, { useState, useEffect } from 'react';
import type { 
  Ticket, 
  NeighborhoodMetrics, 
  TicketPageData,
  TicketStatus,
  IssueType,
  PerformanceVsCity,
  RiskBand,
  TrendDirection
} from './types';

// ============================================
// MOCK DATA - Gerçek projede API'den gelecek
// ============================================

// Her tipten 5'er şikayet örneği
const TICKET_TEMPLATES: Record<IssueType, Array<{description: string; neighborhood: string; district: string; status: TicketStatus}>> = {
  'su_kesintisi': [
    { description: 'Sabah 6\'dan beri su yok, işe gidemedim.', neighborhood: 'Beşevler Mahallesi', district: 'Nilüfer', status: 'sahada' },
    { description: '2 gündür su gelmiyor, çocuklar okula hazırlanamıyor.', neighborhood: 'Görükle Merkez', district: 'Nilüfer', status: 'atanmis' },
    { description: 'Akşam 8\'den beri kesik, ne zaman gelecek?', neighborhood: 'Demirtaş Dumlupınar', district: 'Osmangazi', status: 'alindi' },
    { description: 'Hastamız var evde, su şart lütfen acil.', neighborhood: 'Çekirge Mahallesi', district: 'Osmangazi', status: 'cozuluyor' },
    { description: 'Tüm apartman susuz, 15 daire etkilendi.', neighborhood: 'Kükürtlü Mahallesi', district: 'Yıldırım', status: 'sahada' },
  ],
  'dusuk_basinc': [
    { description: 'Sabahları duş alırken su basıncı çok düşük, 3 gündür böyle.', neighborhood: 'Beşevler Mahallesi', district: 'Nilüfer', status: 'sahada' },
    { description: '5. katta oturuyorum, su damla damla geliyor.', neighborhood: 'Fethiye Mahallesi', district: 'Nilüfer', status: 'atanmis' },
    { description: 'Kombi çalışmıyor basınç düşük diye, sıcak su alamıyoruz.', neighborhood: 'Altıparmak', district: 'Osmangazi', status: 'cozuluyor' },
    { description: 'Çamaşır makinesi dolmuyor, basınç çok az.', neighborhood: 'Yiğitler Mahallesi', district: 'Osmangazi', status: 'alindi' },
    { description: 'Bahçe sulayamıyorum, hortum işe yaramıyor.', neighborhood: 'Esentepe Mahallesi', district: 'Nilüfer', status: 'sahada' },
  ],
  'su_kalitesi': [
    { description: 'Su sarı renkte geliyor, içilecek gibi değil.', neighborhood: 'Mudanya Merkez', district: 'Mudanya', status: 'sahada' },
    { description: 'Suda kireç çok fazla, armatürler beyazladı.', neighborhood: 'Görükle Merkez', district: 'Nilüfer', status: 'atanmis' },
    { description: 'Çeşmeden pas kokusu geliyor, endişeliyiz.', neighborhood: 'Demirtaş Organize', district: 'Osmangazi', status: 'alindi' },
    { description: 'Bardağa koyunca dibe tortu çöküyor.', neighborhood: 'Kestel Merkez', district: 'Kestel', status: 'cozuluyor' },
    { description: 'Bebek maması yapamıyoruz, su bulanık.', neighborhood: 'Çekirge Mahallesi', district: 'Osmangazi', status: 'sahada' },
  ],
  'diger': [
    { description: 'Sayaç yanlış ölçüyor, fatura çok yüksek geldi.', neighborhood: 'Beşevler Mahallesi', district: 'Nilüfer', status: 'atanmis' },
    { description: 'Sokakta su borusu patlamış, yol su içinde.', neighborhood: 'İhsaniye Mahallesi', district: 'Nilüfer', status: 'sahada' },
    { description: 'Vana kapağı kırık, kapatamıyoruz.', neighborhood: 'Yıldırım Merkez', district: 'Yıldırım', status: 'alindi' },
    { description: 'Yeni taşındık, abone işlemi için bilgi lazım.', neighborhood: 'Görükle Üniversite', district: 'Nilüfer', status: 'cozuluyor' },
    { description: 'Fatura adresim yanlış, düzeltilmeli.', neighborhood: 'Altıparmak', district: 'Osmangazi', status: 'atanmis' },
  ],
};

// Rastgele şikayet seç
function getRandomTicket(): Ticket {
  const types: IssueType[] = ['su_kesintisi', 'dusuk_basinc', 'su_kalitesi', 'diger'];
  const randomType = types[Math.floor(Math.random() * types.length)];
  const templates = TICKET_TEMPLATES[randomType];
  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
  
  // Rastgele tarih (son 7 gün içinde)
  const daysAgo = Math.floor(Math.random() * 7);
  const hoursAgo = Math.floor(Math.random() * 24);
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - daysAgo);
  createdAt.setHours(createdAt.getHours() - hoursAgo);
  
  // Rastgele ticket ID
  const ticketNum = Math.floor(Math.random() * 9000) + 1000;
  
  return {
    ticket_id: `TKT-2024-00${ticketNum}`,
    created_at: createdAt.toISOString(),
    issue_type: randomType,
    description: randomTemplate.description,
    location: {
      lat: 40.19 + Math.random() * 0.05,
      lng: 28.85 + Math.random() * 0.1,
      neighborhood: randomTemplate.neighborhood,
      district: randomTemplate.district,
      dma_id: `DMA-${randomTemplate.district.substring(0, 3).toUpperCase()}-0${Math.floor(Math.random() * 9) + 1}`,
    },
    status: randomTemplate.status,
    assigned_unit: `${randomTemplate.district} Saha Ekibi ${Math.floor(Math.random() * 5) + 1}`,
    eta_hours: Math.floor(Math.random() * 8) + 1,
  };
}

// Her sayfa yüklemesinde farklı şikayet
const MOCK_TICKET: Ticket = getRandomTicket();

// Mahalle bilgisi ticket'a göre dinamik
const MOCK_NEIGHBORHOOD: NeighborhoodMetrics = {
  neighborhood: MOCK_TICKET.location.neighborhood,
  district: MOCK_TICKET.location.district,
  dma_id: MOCK_TICKET.location.dma_id,
  outage_count_30d: Math.floor(Math.random() * 5) + 1,
  avg_outage_duration_30d_hours: Math.round((Math.random() * 4 + 1) * 10) / 10,
  bursts_12m: Math.floor(Math.random() * 10) + 2,
  bursts_30d: Math.floor(Math.random() * 3),
  failure_count_12m: Math.floor(Math.random() * 12) + 3,
  risk_band_current: (['low', 'medium', 'high'] as const)[Math.floor(Math.random() * 3)],
  performance_vs_city: (['daha_iyi', 'benzer', 'daha_kotu'] as const)[Math.floor(Math.random() * 3)],
  // Şehir ortalamaları
  city_avg_outage_count_30d: 2.8,
  city_avg_outage_duration_30d_hours: 3.1,
  city_avg_bursts_12m: 5.2,
  // Risk motoru detayları - gerçekçi ve doğrudan
  risk_summary: `Bu DMA'da son 12 ayda ${Math.floor(Math.random() * 10) + 3} patlak oldu. MNF halen ${Math.random() > 0.5 ? 'yüksek' : 'orta'} (%${Math.floor(Math.random() * 15) + 10}).`,
  risk_action: Math.random() > 0.5 ? '30 gün içinde saha kontrolü önerilir.' : '15 gün içinde acil müdahale gerekli.',
  risk_factors: [`${Math.floor(Math.random() * 10) + 2} patlak/12 ay`, `MNF %${Math.floor(Math.random() * 15) + 10}`, `${Math.floor(Math.random() * 3) + 1} eski boru (30+ yaş)`],
  risk_trend: (['improving', 'stable', 'worsening'] as const)[Math.floor(Math.random() * 3)],
  // Trend bilgileri
  trend_vs_last_month: (['improving', 'stable', 'worsening'] as const)[Math.floor(Math.random() * 3)],
  mnf_current: Math.round((Math.random() * 20 + 8) * 10) / 10,
  mnf_city_avg: 22.5,
};

// ============================================
// REUSABLE RISK ANALYSIS BLOCK
// ============================================

export interface RiskAnalysisData {
  risk_band: RiskBand;
  risk_summary: string;
  risk_action: string;
  risk_factors: string[];
  risk_trend?: TrendDirection;
  mnf_current?: number;
  mnf_city_avg?: number;
}

interface RiskAnalysisBlockProps {
  data: RiskAnalysisData;
  showMNF?: boolean;
  compact?: boolean;
}

export const RiskAnalysisBlock: React.FC<RiskAnalysisBlockProps> = ({ 
  data, 
  showMNF = false,
  compact = false 
}) => {
  const riskInfo = getRiskBandInfo(data.risk_band);
  
  return (
    <div 
      className={`rounded-lg ${compact ? 'p-3' : 'p-4'}`}
      style={{ backgroundColor: riskInfo.color + '08', border: `1px solid ${riskInfo.color}30` }}
    >
      {/* Üst: Risk Seviyesi + Trend */}
      <div className="flex items-center justify-between mb-2">
        <span className={`font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>Risk Durumu</span>
        <div className="flex items-center gap-2">
          <span 
            className={`px-2 py-0.5 rounded font-bold ${compact ? 'text-xs' : 'text-sm'}`}
            style={{ backgroundColor: riskInfo.color + '20', color: riskInfo.color }}
          >
            {riskInfo.label}
          </span>
          {data.risk_trend === 'worsening' && (
            <span className="text-xs text-red-600 font-medium">↑</span>
          )}
          {data.risk_trend === 'improving' && (
            <span className="text-xs text-green-600 font-medium">↓</span>
          )}
        </div>
      </div>
      
      {/* Özet */}
      <p className={`text-gray-800 mb-2 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
        {data.risk_summary}
      </p>
      
      {/* Öneri */}
      <div 
        className={`flex items-start gap-2 rounded mb-2 ${compact ? 'p-2' : 'p-3'}`}
        style={{ backgroundColor: riskInfo.color + '10' }}
      >
        <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: riskInfo.color }}>
          Öneri:
        </span>
        <span className={`text-gray-800 ${compact ? 'text-xs' : 'text-sm'}`}>{data.risk_action}</span>
      </div>
      
      {/* Faktörler */}
      <div className="flex flex-wrap gap-1.5">
        {data.risk_factors.map((factor, i) => (
          <span 
            key={i} 
            className="text-xs px-2 py-0.5 bg-white rounded border border-gray-200 text-gray-700 font-medium"
          >
            {factor}
          </span>
        ))}
      </div>
      
      {/* MNF Göstergesi (opsiyonel) */}
      {showMNF && data.mnf_current !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-600">MNF</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">%{data.mnf_current.toFixed(1)}</span>
            {data.mnf_city_avg && (
              <span className="text-xs text-gray-500">(şehir: %{data.mnf_city_avg.toFixed(1)})</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getStatusInfo(status: TicketStatus): { label: string; color: string; icon: string } {
  switch (status) {
    case 'alindi':
      return { label: 'Alındı', color: '#6B7280', icon: '○' };
    case 'atanmis':
      return { label: 'Ekibe Atandı', color: '#3B82F6', icon: '●' };
    case 'sahada':
      return { label: 'Sahada', color: '#c27803', icon: '◐' };
    case 'cozuluyor':
      return { label: 'Çözülüyor', color: '#8B5CF6', icon: '◑' };
    case 'kapandi':
      return { label: 'Kapandı', color: '#276749', icon: '◉' };
  }
}

function getIssueTypeLabel(type: IssueType): string {
  switch (type) {
    case 'su_kesintisi': return 'Su Kesintisi';
    case 'dusuk_basinc': return 'Düşük Basınç';
    case 'su_kalitesi': return 'Su Kalitesi';
    case 'diger': return 'Diğer';
  }
}

function getRiskBandInfo(band: RiskBand): { label: string; color: string } {
  switch (band) {
    case 'high': return { label: 'Yüksek', color: '#c0392b' };
    case 'medium': return { label: 'Orta', color: '#d4a520' };
    case 'low': return { label: 'Düşük', color: '#27ae60' };
  }
}

function getPerformanceInfo(perf: PerformanceVsCity): { label: string; color: string; icon: string } {
  switch (perf) {
    case 'daha_iyi': return { label: 'Daha İyi', color: '#27ae60', icon: '↑' };
    case 'benzer': return { label: 'Benzer', color: '#6B7280', icon: '→' };
    case 'daha_kotu': return { label: 'Daha Kötü', color: '#c0392b', icon: '↓' };
  }
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// COMPONENTS
// ============================================

interface TicketCardProps {
  ticket: Ticket;
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket }) => {
  const statusInfo = getStatusInfo(ticket.status);
  
  // Status timeline steps
  const steps: TicketStatus[] = ['alindi', 'atanmis', 'sahada', 'cozuluyor', 'kapandi'];
  const currentStep = steps.indexOf(ticket.status);
  
  return (
    <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
      {/* Header - Sade */}
      <div className="bg-slate-800 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-70 uppercase tracking-wide">Bilet No</p>
            <h2 className="text-lg font-semibold">{ticket.ticket_id}</h2>
          </div>
          <div 
            className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 bg-white/10"
          >
            {statusInfo.label}
          </div>
        </div>
      </div>
      
      {/* Timeline */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          {steps.map((step, i) => {
            const info = getStatusInfo(step);
            const isActive = i <= currentStep;
            const isCurrent = i === currentStep;
            
            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center">
                  <div 
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                      isCurrent 
                        ? 'ring-2 ring-slate-200' 
                        : ''
                    }`}
                    style={{ 
                      backgroundColor: isActive ? '#2c7da0' : '#E5E7EB',
                      color: isActive ? 'white' : '#9CA3AF'
                    }}
                  >
                    {i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>
                    {info.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div 
                    className="flex-1 h-0.5 mx-2 rounded"
                    style={{ backgroundColor: i < currentStep ? '#27ae60' : '#E5E7EB' }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      
      {/* Content */}
      <div className="px-6 py-4 space-y-4">
        {/* Issue Type & Date */}
        <div className="flex items-center justify-between">
          <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium">
            {getIssueTypeLabel(ticket.issue_type)}
          </span>
          <span className="text-sm text-gray-500">
            {formatDate(ticket.created_at)}
          </span>
        </div>
        
        {/* Description */}
        <div>
          <p className="text-sm text-gray-500 mb-1">Açıklama</p>
          <p className="text-gray-800">{ticket.description}</p>
        </div>
        
        {/* Location */}
        <div className="flex items-start gap-2">
          <span className="text-lg text-gray-400">◎</span>
          <div>
            <p className="text-gray-800 font-medium">{ticket.location.neighborhood}</p>
            <p className="text-sm text-gray-500">{ticket.location.district}</p>
          </div>
        </div>
        
        {/* Assigned Unit & ETA */}
        {ticket.assigned_unit && (
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">Atanan Ekip</p>
              <p className="text-gray-800 font-medium">{ticket.assigned_unit}</p>
            </div>
            {ticket.eta_hours && ticket.status !== 'kapandi' && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Tahmini Süre</p>
                <p className="text-cyan-600 font-bold">{ticket.eta_hours} saat</p>
              </div>
            )}
          </div>
        )}
        
        {/* Resolved Duration */}
        {ticket.status === 'kapandi' && ticket.actual_duration_hours && (
          <div className="flex items-center justify-center py-3 px-4 bg-emerald-50 rounded-lg">
            <span className="text-emerald-600 font-medium">
              {ticket.actual_duration_hours} saatte çözüldü
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

interface NeighborhoodCardProps {
  metrics: NeighborhoodMetrics;
  currentIssueType: IssueType;
}

// Benzer şikayet tipi (KVKK uyumlu - kişisel bilgi yok)
interface SimilarComplaint {
  id: string;
  type: IssueType;
  date: string;
  status: TicketStatus;
}

// Mock benzer şikayetler üretici
function generateSimilarComplaints(neighborhood: string, currentType: IssueType): SimilarComplaint[] {
  const types: IssueType[] = ['su_kesintisi', 'dusuk_basinc', 'su_kalitesi', 'diger'];
  const statuses: TicketStatus[] = ['alindi', 'atanmis', 'sahada', 'cozuluyor', 'kapandi'];
  
  const complaints: SimilarComplaint[] = [];
  
  // Kullanıcının şikayet tipinden daha fazla üret (önce görünsün)
  const sameTypeCount = Math.floor(Math.random() * 4) + 2; // 2-5 arası aynı tip
  for (let i = 0; i < sameTypeCount; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    
    // Aynı tip şikayetler farklı durumlarda olabilir
    complaints.push({
      id: `SC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      type: currentType,
      date: date.toISOString(),
      status: statuses[Math.floor(Math.random() * statuses.length)]
    });
  }
  
  // Diğer tiplerden rastgele ekle
  const otherTypes = types.filter(t => t !== currentType);
  const otherCount = Math.floor(Math.random() * 6) + 2; // 2-7 arası diğer tipler
  
  for (let i = 0; i < otherCount; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const randomType = otherTypes[Math.floor(Math.random() * otherTypes.length)];
    
    complaints.push({
      id: `SC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      type: randomType,
      date: date.toISOString(),
      status: statuses[Math.floor(Math.random() * statuses.length)]
    });
  }
  
  return complaints.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Şikayet tipi renk
function getIssueTypeColor(type: IssueType): string {
  switch (type) {
    case 'su_kesintisi': return '#DC2626';
    case 'dusuk_basinc': return '#F59E0B';
    case 'su_kalitesi': return '#8B5CF6';
    case 'diger': return '#6B7280';
  }
}

// Trend ikonu yardımcısı
const getTrendIcon = (trend?: TrendDirection): { icon: string; color: string } => {
  switch (trend) {
    case 'improving': return { icon: '↓', color: '#10B981' };
    case 'worsening': return { icon: '↑', color: '#DC2626' };
    case 'stable': return { icon: '→', color: '#6B7280' };
    default: return { icon: '', color: '#6B7280' };
  }
};

const NeighborhoodCard: React.FC<NeighborhoodCardProps> = ({ metrics, currentIssueType }) => {
  const [showSimilarComplaints, setShowSimilarComplaints] = useState(false);
  const [similarComplaints, setSimilarComplaints] = useState<SimilarComplaint[]>([]);
  
  const riskInfo = getRiskBandInfo(metrics.risk_band_current);
  const perfInfo = getPerformanceInfo(metrics.performance_vs_city);
  
  // Benzer şikayetleri yükle - her tıklamada yeniden üret
  const handleShowSimilar = () => {
    const complaints = generateSimilarComplaints(metrics.neighborhood, currentIssueType);
    setSimilarComplaints(complaints);
    setShowSimilarComplaints(true);
  };
  
  // Şehir kıyası hesaplama
  const outageVsCity = metrics.outage_count_30d - metrics.city_avg_outage_count_30d;
  const durationVsCity = metrics.avg_outage_duration_30d_hours - metrics.city_avg_outage_duration_30d_hours;
  const burstsVsCity = metrics.bursts_12m - metrics.city_avg_bursts_12m;
  
  const formatDiff = (diff: number, unit: string) => {
    if (Math.abs(diff) < 0.1) return 'şehir ortalamasında';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)} ${unit}`;
  };
  
  const getDiffColor = (diff: number, higherIsBad: boolean = true) => {
    if (Math.abs(diff) < 0.1) return '#6B7280';
    if (higherIsBad) return diff > 0 ? '#c0392b' : '#27ae60';
    return diff > 0 ? '#27ae60' : '#c0392b';
  };
  
  // Şikayet tipine göre grupla
  const complaintsByTypeRaw = similarComplaints.reduce((acc, c) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push(c);
    return acc;
  }, {} as Record<IssueType, SimilarComplaint[]>);
  
  // Kullanıcının şikayet tipi en başta olsun
  const sortedTypes = Object.keys(complaintsByTypeRaw).sort((a, b) => {
    if (a === currentIssueType) return -1;
    if (b === currentIssueType) return 1;
    return (complaintsByTypeRaw[b as IssueType]?.length || 0) - (complaintsByTypeRaw[a as IssueType]?.length || 0);
  }) as IssueType[];
  
  const complaintsByType = sortedTypes.reduce((acc, type) => {
    acc[type] = complaintsByTypeRaw[type];
    return acc;
  }, {} as Record<IssueType, SimilarComplaint[]>);
  
  return (
    <>
      {/* Benzer Şikayetler Modal */}
      {showSimilarComplaints && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]"
          onClick={() => setShowSimilarComplaints(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-800 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Benzer Şikayetler</h3>
                  <p className="text-sm opacity-70">{metrics.neighborhood} • Son 90 Gün</p>
                </div>
                <button
                  onClick={() => setShowSimilarComplaints(false)}
                  className="text-white/70 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* KVKK Uyarısı */}
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
              <p className="text-xs text-blue-700">
                🔒 KVKK gereği kişisel bilgiler (isim, adres, şikayet detayı) gösterilmemektedir.
              </p>
            </div>
            
            {/* Özet */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Toplam Benzer Şikayet</span>
                <span className="text-2xl font-bold text-slate-800">{similarComplaints.length}</span>
              </div>
            </div>
            
            {/* Tipe Göre Gruplar */}
            <div className="px-6 py-4 overflow-y-auto max-h-[40vh]">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Şikayet Tipine Göre</h4>
              
              {Object.entries(complaintsByType).map(([type, complaints]) => (
                <div key={type} className="mb-4">
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ backgroundColor: getIssueTypeColor(type as IssueType) + '15' }}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getIssueTypeColor(type as IssueType) }}
                      />
                      <span 
                        className="font-medium text-sm"
                        style={{ color: getIssueTypeColor(type as IssueType) }}
                      >
                        {getIssueTypeLabel(type as IssueType)}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-slate-800">{complaints.length}</span>
                  </div>
                  
                  {/* Tarih Listesi */}
                  <div className="mt-2 pl-5 space-y-1">
                    {complaints.slice(0, 5).map((c) => {
                      const statusInfo = getStatusInfo(c.status);
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            {new Date(c.date).toLocaleDateString('tr-TR', { 
                              day: 'numeric', 
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ 
                              backgroundColor: statusInfo.color + '20',
                              color: statusInfo.color
                            }}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                      );
                    })}
                    {complaints.length > 5 && (
                      <p className="text-xs text-slate-400 italic">
                        +{complaints.length - 5} daha...
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setShowSimilarComplaints(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    
    <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
      {/* Header - Sade */}
      <div className="bg-slate-800 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-70 uppercase tracking-wide">Mahalle Su Gerçekliği</p>
            <h2 className="text-lg font-semibold">{metrics.neighborhood}</h2>
            <p className="text-sm opacity-70">{metrics.district} • {metrics.dma_id}</p>
          </div>
        </div>
      </div>
      
      {/* Şehir Kıyası Banner */}
      <div 
        className="px-6 py-3 border-b border-slate-100 bg-slate-50"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Bursa Ortalamasına Göre</p>
            <p className="text-xs text-gray-500">Kesinti sayısı ve süresi bazında</p>
          </div>
          <button 
            onClick={handleShowSimilar}
            className="flex items-center gap-2 px-4 py-2 rounded-full font-bold cursor-pointer hover:opacity-80 transition"
            style={{ backgroundColor: perfInfo.color + '15', color: perfInfo.color }}
          >
            <span className="text-xl">{perfInfo.icon}</span>
            {perfInfo.label}
          </button>
        </div>
      </div>
      
      {/* Son 30 Gün Metrikleri */}
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Son 30 Gün</h3>
        <div className="grid grid-cols-3 gap-3">
          {/* Kesinti Sayısı */}
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-gray-800">{metrics.outage_count_30d}</span>
              {metrics.outage_trend && (
                <span style={{ color: getTrendIcon(metrics.outage_trend).color }} className="text-lg">
                  {getTrendIcon(metrics.outage_trend).icon}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">Kesinti</div>
            <div className="text-xs mt-1 font-medium" style={{ color: getDiffColor(outageVsCity) }}>
              {formatDiff(outageVsCity, '')}
            </div>
          </div>
          
          {/* Ortalama Süre */}
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{metrics.avg_outage_duration_30d_hours.toFixed(1)}</div>
            <div className="text-xs text-gray-500">Ort. Süre (sa)</div>
            <div className="text-xs mt-1 font-medium" style={{ color: getDiffColor(durationVsCity) }}>
              {formatDiff(durationVsCity, 'sa')}
            </div>
          </div>
          
          {/* Patlak */}
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{metrics.bursts_30d}</div>
            <div className="text-xs text-gray-500">Patlak</div>
            <div className="text-xs mt-1 text-gray-400">bu ay</div>
          </div>
        </div>
      </div>
      
      {/* Son 12 Ay Metrikleri */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Son 12 Ay</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-gray-800">{metrics.bursts_12m}</span>
              {metrics.burst_trend && (
                <span style={{ color: getTrendIcon(metrics.burst_trend).color }} className="text-lg">
                  {getTrendIcon(metrics.burst_trend).icon}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">Toplam Patlak</div>
            <div className="text-xs mt-1 font-medium" style={{ color: getDiffColor(burstsVsCity) }}>
              şehir ort: {metrics.city_avg_bursts_12m.toFixed(1)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{metrics.failure_count_12m}</div>
            <div className="text-xs text-gray-500">Toplam Arıza</div>
            <div className="text-xs mt-1 text-gray-400">tüm tipler</div>
          </div>
        </div>
      </div>
      
      {/* Risk Motoru Analizi - Yeniden Kullanılabilir Bileşen */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Risk Motoru Analizi</h3>
        <RiskAnalysisBlock 
          data={{
            risk_band: metrics.risk_band_current,
            risk_summary: metrics.risk_summary,
            risk_action: metrics.risk_action,
            risk_factors: metrics.risk_factors,
            risk_trend: metrics.risk_trend,
            mnf_current: metrics.mnf_current,
            mnf_city_avg: metrics.mnf_city_avg,
          }}
          showMNF={true}
        />
      </div>
    </div>
    </>
  );
};

// ============================================
// MAIN PAGE COMPONENT
// ============================================

interface TicketPageProps {
  ticketId?: string;
}

// WhatsApp backend URL
const WHATSAPP_API_URL = 'http://localhost:8000';

export const TicketPage: React.FC<TicketPageProps> = ({ ticketId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TicketPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Önce WhatsApp backend'den gerçek veri çekmeyi dene
        const response = await fetch(`${WHATSAPP_API_URL}/api/ticket/${ticketId}`);
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.data) {
            // Backend'den gelen veriyi TicketPageData formatına dönüştür
            const ticket = result.data.ticket;
            const neighborhood = result.data.neighborhood;
            
            setData({
              ticket: {
                ticket_id: ticket.ticket_id,
                created_at: ticket.created_at,
                issue_type: ticket.issue_type,
                description: ticket.description,
                status: ticket.status || 'open',
                location: ticket.location || {
                  lat: 40.1885,
                  lng: 29.0610,
                  address: 'Bursa',
                },
                media_urls: ticket.media_urls || [],
                detected_keywords: ticket.detected_keywords || [],
                confidence: ticket.confidence || 0.5,
              },
              neighborhood: {
                neighborhood: neighborhood?.neighborhood || 'Merkez',
                district: neighborhood?.district || 'Osmangazi',
                dma_id: neighborhood?.dma_id || 'DMA-OSM-01',
                outage_count_30d: neighborhood?.outage_count_30d || 0,
                avg_outage_duration_30d_hours: neighborhood?.avg_outage_duration_30d_hours || 0,
                bursts_12m: neighborhood?.bursts_12m || 0,
                risk_band_current: neighborhood?.risk_band_current || 'low',
                performance_vs_city: neighborhood?.performance_vs_city || 'iyi',
                risk_summary: `Bu bölgede son 30 günde ${neighborhood?.outage_count_30d || 0} kesinti yaşandı.`,
                risk_action: 'Öneri: Şebeke izleme devam ediyor.',
                risk_trend: 'stable',
              },
            });
            setLoading(false);
            return;
          }
        }
        
        // Backend'den veri alınamazsa mock data kullan
        console.log('Backend erişilemedi, mock data kullanılıyor');
        await new Promise(resolve => setTimeout(resolve, 500));
        setData({
          ticket: MOCK_TICKET,
          neighborhood: MOCK_NEIGHBORHOOD,
        });
        
      } catch (e) {
        console.error('Ticket fetch error:', e);
        // Hata durumunda da mock data göster
        setData({
          ticket: MOCK_TICKET,
          neighborhood: MOCK_NEIGHBORHOOD,
        });
      } finally {
        setLoading(false);
      }
    };
    
    if (ticketId) {
      fetchData();
    } else {
      // ticketId yoksa mock data göster
      setData({
        ticket: MOCK_TICKET,
        neighborhood: MOCK_NEIGHBORHOOD,
      });
      setLoading(false);
    }
  }, [ticketId]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Yükleniyor...</p>
        </div>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 text-gray-400">—</div>
          <p className="text-gray-600">{error || 'Bilet bulunamadı.'}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg font-bold">UF</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-800">ULUDAGFLOW</h1>
            <p className="text-xs text-gray-500">BUSKİ Şikayet Takip</p>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Ticket Card */}
        <TicketCard ticket={data.ticket} />
        
        {/* Neighborhood Card */}
        <NeighborhoodCard metrics={data.neighborhood} currentIssueType={data.ticket.issue_type} />
      </main>
      
      {/* Footer / Disclaimer */}
      <footer className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">Bilgilendirme</p>
          <p className="text-amber-700 text-xs">
            Gösterilen veriler BUSKİ operasyon kayıtlarına ve istatistiksel modellere dayanır. 
            Tahminler karar destek amaçlıdır; hukuken bağlayıcı taahhüt değildir.
          </p>
        </div>
        
        <p className="text-center text-xs text-gray-400 mt-4">
          © 2024 BUSKİ • ULUDAGFLOW
        </p>
      </footer>
    </div>
  );
};

export default TicketPage;
