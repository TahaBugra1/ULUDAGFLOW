/**
 * MODÜL A: RiskListView - BUSKİ İç Kullanım Ekranı
 * 
 * Amaç: Bakım planlama ekibine "önümüzdeki ay nereye önce gidelim?" 
 * sorusuna tek ekranla cevap vermek.
 * 
 * Özellikler:
 * - Filtreler: district, dma_id, material, risk_band
 * - Tablo: pipe_id, dma_id, district, risk_score, risk_band, failure_count_last_12m, 
 *          time_since_last_failure_days, expected_failure_type, top_factors_summary
 * - Harita: Boru segmentleri + risk_band renk kodu
 * - Boru kartı: Detaylı bilgi popup
 */

import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { 
  PipeRiskScore, 
  RiskBand, 
  RiskListFilters,
  ExpectedFailureType 
} from './types';
import { RiskAnalysisBlock, RiskAnalysisData } from './TicketPage';

// ============================================
// MOCK DATA - Gerçek projede API'den gelecek
// ============================================

const MOCK_RISK_SCORES: PipeRiskScore[] = [
  { pipe_id: 'P-MUD-0317', dma_id: 'DMA-MUD-02', district: 'Mudanya', risk_score: 0.81, risk_band: 'high', expected_failure_type: 'patlak', top_factors: ['yüksek boru yaşı (42 yıl)', 'riskli malzeme (AC)', 'son 12 ayda 3 arıza'], pipe_age_years: 42, material: 'AC', failure_count_last_12m: 3, time_since_last_failure_days: 45, geom_start: [40.3760, 28.8830], geom_end: [40.3780, 28.8860] },
  { pipe_id: 'P-OSM-0011', dma_id: 'DMA-OSM-06', district: 'Osmangazi', risk_score: 0.73, risk_band: 'high', expected_failure_type: 'patlak', top_factors: ['yüksek boru yaşı (38 yıl)', 'riskli malzeme (FONT)', 'DMA\'da yüksek gece debisi'], pipe_age_years: 38, material: 'FONT', failure_count_last_12m: 2, time_since_last_failure_days: 90, geom_start: [40.1920, 29.0300], geom_end: [40.1945, 29.0330] },
  { pipe_id: 'P-NIL-0121', dma_id: 'DMA-NIL-03', district: 'Nilüfer', risk_score: 0.73, risk_band: 'high', expected_failure_type: 'patlak', top_factors: ['yüksek boru yaşı (35 yıl)', 'son 12 ayda 2 arıza'], pipe_age_years: 35, material: 'FONT', failure_count_last_12m: 2, time_since_last_failure_days: 120, geom_start: [40.2120, 28.9500], geom_end: [40.2140, 28.9520] },
  { pipe_id: 'P-YIL-0248', dma_id: 'DMA-YIL-02', district: 'Yıldırım', risk_score: 0.69, risk_band: 'medium', expected_failure_type: 'sizinti', top_factors: ['yakın zamanda arıza (60 gün önce)', 'son 12 ayda 2 arıza'], pipe_age_years: 28, material: 'ÇELİK', failure_count_last_12m: 2, time_since_last_failure_days: 60, geom_start: [40.2050, 29.0800], geom_end: [40.2070, 29.0825] },
  { pipe_id: 'P-GEM-0283', dma_id: 'DMA-GEM-01', district: 'Gemlik', risk_score: 0.73, risk_band: 'high', expected_failure_type: 'patlak', top_factors: ['riskli malzeme (AC)', 'yüksek boru yaşı (40 yıl)'], pipe_age_years: 40, material: 'AC', failure_count_last_12m: 1, time_since_last_failure_days: 200, geom_start: [40.4320, 29.1550], geom_end: [40.4340, 29.1580] },
  { pipe_id: 'P-INE-0380', dma_id: 'DMA-İNE-01', district: 'İnegöl', risk_score: 0.73, risk_band: 'high', expected_failure_type: 'patlak', top_factors: ['yüksek boru yaşı (36 yıl)', 'riskli malzeme (FONT)'], pipe_age_years: 36, material: 'FONT', failure_count_last_12m: 1, time_since_last_failure_days: 180, geom_start: [40.0820, 29.5120], geom_end: [40.0845, 29.5150] },
  { pipe_id: 'P-KES-0404', dma_id: 'DMA-KES-01', district: 'Kestel', risk_score: 0.73, risk_band: 'high', expected_failure_type: 'sizinti', top_factors: ['son 12 ayda 2 arıza', 'yüksek boru yaşı (32 yıl)'], pipe_age_years: 32, material: 'FONT', failure_count_last_12m: 2, time_since_last_failure_days: 75, geom_start: [40.2020, 29.2120], geom_end: [40.2040, 29.2150] },
  { pipe_id: 'P-OSM-0044', dma_id: 'DMA-OSM-04', district: 'Osmangazi', risk_score: 0.69, risk_band: 'medium', expected_failure_type: 'bilinmiyor', top_factors: ['yüksek boru yaşı (30 yıl)'], pipe_age_years: 30, material: 'ÇELİK', failure_count_last_12m: 1, time_since_last_failure_days: 250, geom_start: [40.1880, 29.0250], geom_end: [40.1900, 29.0280] },
  { pipe_id: 'P-NIL-0196', dma_id: 'DMA-NIL-02', district: 'Nilüfer', risk_score: 0.69, risk_band: 'medium', expected_failure_type: 'sizinti', top_factors: ['yakın zamanda arıza (90 gün önce)'], pipe_age_years: 25, material: 'PVC', failure_count_last_12m: 1, time_since_last_failure_days: 90, geom_start: [40.2180, 28.9400], geom_end: [40.2200, 28.9430] },
  { pipe_id: 'P-MUD-0331', dma_id: 'DMA-MUD-02', district: 'Mudanya', risk_score: 0.69, risk_band: 'medium', expected_failure_type: 'patlak', top_factors: ['riskli malzeme (FONT)', 'yüksek boru yaşı (28 yıl)'], pipe_age_years: 28, material: 'FONT', failure_count_last_12m: 0, time_since_last_failure_days: null, geom_start: [40.3790, 28.8780], geom_end: [40.3810, 28.8810] },
  { pipe_id: 'P-OSM-0089', dma_id: 'DMA-OSM-06', district: 'Osmangazi', risk_score: 0.55, risk_band: 'medium', expected_failure_type: 'bilinmiyor', top_factors: ['yüksek boru yaşı (22 yıl)'], pipe_age_years: 22, material: 'HDPE', failure_count_last_12m: 0, time_since_last_failure_days: null, geom_start: [40.1950, 29.0400], geom_end: [40.1970, 29.0430] },
  { pipe_id: 'P-NIL-0201', dma_id: 'DMA-NIL-01', district: 'Nilüfer', risk_score: 0.48, risk_band: 'medium', expected_failure_type: 'sizinti', top_factors: ['düşük risk faktörleri'], pipe_age_years: 18, material: 'PVC', failure_count_last_12m: 0, time_since_last_failure_days: null, geom_start: [40.2240, 28.9450], geom_end: [40.2260, 28.9480] },
  { pipe_id: 'P-KAR-0412', dma_id: 'DMA-KAR-01', district: 'Karacabey', risk_score: 0.35, risk_band: 'low', expected_failure_type: 'bilinmiyor', top_factors: ['düşük risk faktörleri'], pipe_age_years: 12, material: 'HDPE', failure_count_last_12m: 0, time_since_last_failure_days: null, geom_start: [40.2180, 28.3620], geom_end: [40.2200, 28.3650] },
  { pipe_id: 'P-NIL-0234', dma_id: 'DMA-NIL-07', district: 'Nilüfer', risk_score: 0.28, risk_band: 'low', expected_failure_type: 'bilinmiyor', top_factors: ['düşük risk faktörleri'], pipe_age_years: 8, material: 'HDPE', failure_count_last_12m: 0, time_since_last_failure_days: null, geom_start: [40.2200, 28.9350], geom_end: [40.2220, 28.9380] },
  { pipe_id: 'P-OSM-0156', dma_id: 'DMA-OSM-03', district: 'Osmangazi', risk_score: 0.22, risk_band: 'low', expected_failure_type: 'bilinmiyor', top_factors: ['düşük risk faktörleri'], pipe_age_years: 5, material: 'PE', failure_count_last_12m: 0, time_since_last_failure_days: null, geom_start: [40.2000, 29.0350], geom_end: [40.2020, 29.0380] },
];

const DISTRICTS = ['Osmangazi', 'Nilüfer', 'Yıldırım', 'Mudanya', 'Gemlik', 'İnegöl', 'Kestel', 'Karacabey'];
const MATERIALS = ['FONT', 'AC', 'ÇELİK', 'PVC', 'HDPE', 'PE'];
const RISK_BANDS: RiskBand[] = ['high', 'medium', 'low'];

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Mat kurumsal renkler
function getRiskColor(band: RiskBand): string {
  switch (band) {
    case 'high': return '#c0392b';   // Koyu kırmızı
    case 'medium': return '#d4a520'; // Koyu sarı/turuncu
    case 'low': return '#27ae60';    // Koyu yeşil
  }
}

function getRiskBandLabel(band: RiskBand): string {
  switch (band) {
    case 'high': return 'Yüksek';
    case 'medium': return 'Orta';
    case 'low': return 'Düşük';
  }
}

function getFailureTypeLabel(type: ExpectedFailureType): string {
  switch (type) {
    case 'patlak': return 'Patlak';
    case 'sizinti': return 'Sızıntı';
    case 'bilinmiyor': return 'Belirsiz';
  }
}

function formatDays(days: number | null): string {
  if (days === null) return '—';
  if (days > 365) return '1+ yıl';
  return `${days} gün`;
}

/** Neden özeti - tek cümlelik açıklama */
function getWhySummary(pipe: PipeRiskScore): string {
  const parts: string[] = [];
  
  if (pipe.pipe_age_years >= 30) {
    parts.push(`${pipe.pipe_age_years} yaş`);
  }
  if (pipe.failure_count_last_12m >= 2) {
    parts.push(`${pipe.failure_count_last_12m} arıza/12ay`);
  } else if (pipe.failure_count_last_12m === 1) {
    parts.push('1 arıza/12ay');
  }
  if (['AC', 'FONT'].includes(pipe.material)) {
    parts.push(`riskli malzeme (${pipe.material})`);
  }
  if (pipe.time_since_last_failure_days !== null && pipe.time_since_last_failure_days < 90) {
    parts.push(`son arıza ${pipe.time_since_last_failure_days}g önce`);
  }
  
  return parts.length > 0 ? parts.join(' + ') : 'düşük risk faktörleri';
}

/** Önerilen aksiyon hesapla */
function getRecommendedAction(pipe: PipeRiskScore): { action: string; days: number; urgency: 'kritik' | 'yakın' | 'planlı' } {
  if (pipe.risk_band === 'high' && pipe.failure_count_last_12m >= 2) {
    return { action: 'Acil saha kontrolü', days: 7, urgency: 'kritik' };
  }
  if (pipe.risk_band === 'high') {
    return { action: 'Öncelikli kontrol', days: 14, urgency: 'yakın' };
  }
  if (pipe.risk_band === 'medium' && pipe.failure_count_last_12m >= 1) {
    return { action: 'Planlı kontrol', days: 30, urgency: 'planlı' };
  }
  return { action: 'İzlemeye devam', days: 90, urgency: 'planlı' };
}

/** Boru için risk analizi datası oluştur */
function getPipeRiskAnalysisData(pipe: PipeRiskScore): RiskAnalysisData {
  const action = getRecommendedAction(pipe);
  
  // Özet oluştur
  const summaryParts: string[] = [];
  if (pipe.failure_count_last_12m > 0) {
    summaryParts.push(`Son 12 ayda ${pipe.failure_count_last_12m} arıza`);
  }
  if (['AC', 'FONT'].includes(pipe.material)) {
    summaryParts.push(`riskli malzeme (${pipe.material})`);
  }
  if (pipe.pipe_age_years >= 30) {
    summaryParts.push(`${pipe.pipe_age_years} yıllık boru`);
  }
  if (pipe.time_since_last_failure_days !== null && pipe.time_since_last_failure_days < 90) {
    summaryParts.push(`son arıza ${pipe.time_since_last_failure_days} gün önce`);
  }
  
  const summary = summaryParts.length > 0 
    ? summaryParts.join('. ') + '.'
    : 'Düşük risk faktörleri. Rutin izleme yeterli.';
  
  // Aksiyon cümlesi
  const actionText = action.days <= 7 
    ? `Acil: ${action.days} gün içinde saha kontrolü gerekli.`
    : action.days <= 30
    ? `${action.days} gün içinde saha kontrolü önerilir.`
    : 'Rutin bakım planına dahil edilsin.';
  
  // Trend tahmini
  let trend: 'improving' | 'stable' | 'worsening' = 'stable';
  if (pipe.failure_count_last_12m >= 2 || (pipe.time_since_last_failure_days !== null && pipe.time_since_last_failure_days < 60)) {
    trend = 'worsening';
  } else if (pipe.failure_count_last_12m === 0 && pipe.pipe_age_years < 20) {
    trend = 'improving';
  }
  
  return {
    risk_band: pipe.risk_band,
    risk_summary: summary,
    risk_action: actionText,
    risk_factors: pipe.top_factors.slice(0, 3),
    risk_trend: trend,
  };
}

// ============================================
// COMPONENTS
// ============================================

// Harita sınırlarını zorlayan bileşen
const BURSA_BOUNDS = L.latLngBounds(
  L.latLng(39.55, 28.0),  // Güneybatı
  L.latLng(40.60, 30.0)   // Kuzeydoğu
);

const MapBoundsEnforcer: React.FC = () => {
  const map = useMap();
  
  useEffect(() => {
    map.setMaxBounds(BURSA_BOUNDS);
    map.setMinZoom(8);
    map.setMaxZoom(16);
    
    // Harita sınır dışına çıkarsa geri çek
    const handleDrag = () => {
      map.panInsideBounds(BURSA_BOUNDS, { animate: true });
    };
    
    map.on('drag', handleDrag);
    map.on('dragend', handleDrag);
    
    return () => {
      map.off('drag', handleDrag);
      map.off('dragend', handleDrag);
    };
  }, [map]);
  
  return null;
};

interface FilterBarProps {
  filters: RiskListFilters;
  onFilterChange: (filters: RiskListFilters) => void;
  stats: { total: number; high: number; medium: number; low: number };
  top20Only: boolean;
  onTop20Toggle: (value: boolean) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange, stats, top20Only, onTop20Toggle }) => {
  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Top 20 Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onTop20Toggle(!top20Only)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition border ${
              top20Only 
                ? 'bg-slate-800 text-white border-slate-800' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            Top 20 Öncelik
          </button>
          
          <div className="h-6 w-px bg-slate-200"></div>
          
          {/* Filtreler */}
          <select
            value={filters.district || ''}
            onChange={(e) => onFilterChange({ ...filters, district: e.target.value || undefined })}
            className="bg-white text-slate-700 text-sm rounded px-3 py-1.5 border border-slate-200 focus:border-slate-400 focus:outline-none"
          >
            <option value="">Tüm İlçeler</option>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          
          <select
            value={filters.material || ''}
            onChange={(e) => onFilterChange({ ...filters, material: e.target.value || undefined })}
            className="bg-white text-slate-700 text-sm rounded px-3 py-1.5 border border-slate-200 focus:border-slate-400 focus:outline-none"
          >
            <option value="">Tüm Malzemeler</option>
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          
          <select
            value={filters.risk_band || ''}
            onChange={(e) => onFilterChange({ ...filters, risk_band: (e.target.value as RiskBand) || undefined })}
            className="bg-white text-slate-700 text-sm rounded px-3 py-1.5 border border-slate-200 focus:border-slate-400 focus:outline-none"
          >
            <option value="">Tüm Risk Seviyeleri</option>
            {RISK_BANDS.map(b => <option key={b} value={b}>{getRiskBandLabel(b)}</option>)}
          </select>
          
          {(filters.district || filters.material || filters.risk_band) && (
            <button
              onClick={() => onFilterChange({})}
              className="text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Temizle
            </button>
          )}
        </div>
        
        {/* İstatistikler */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">
            Toplam: <span className="text-slate-700 font-medium">{stats.total}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: '#c0392b' }}></span>
            <span className="text-slate-600">{stats.high}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: '#d4a520' }}></span>
            <span className="text-slate-600">{stats.medium}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: '#27ae60' }}></span>
            <span className="text-slate-600">{stats.low}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

interface PipeCardProps {
  pipe: PipeRiskScore;
  onClose: () => void;
}

const PipeCard: React.FC<PipeCardProps> = ({ pipe, onClose }) => {
  const action = getRecommendedAction(pipe);
  const urgencyColors = {
    kritik: { bg: '#DC262620', border: '#DC2626', text: '#DC2626' },
    yakın: { bg: '#F59E0B20', border: '#F59E0B', text: '#F59E0B' },
    planlı: { bg: '#6B728020', border: '#6B7280', text: '#9CA3AF' },
  };
  const urgencyStyle = urgencyColors[action.urgency];
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: getRiskColor(pipe.risk_band) + '20', borderBottom: `2px solid ${getRiskColor(pipe.risk_band)}` }}
        >
          <div>
            <h3 className="text-lg font-bold text-white">{pipe.pipe_id}</h3>
            <p className="text-sm text-slate-300">{pipe.dma_id} • {pipe.district}</p>
          </div>
          <div className="text-right">
            <div 
              className="text-3xl font-bold"
              style={{ color: getRiskColor(pipe.risk_band) }}
            >
              {(pipe.risk_score * 100).toFixed(0)}
            </div>
            <div className="text-xs text-slate-400">Risk Skoru</div>
          </div>
        </div>
        
        {/* Önerilen Aksiyon - ÜST BÖLÜM */}
        <div 
          className="px-6 py-4"
          style={{ backgroundColor: urgencyStyle.bg, borderBottom: `1px solid ${urgencyStyle.border}40` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Önerilen Aksiyon</div>
              <div className="text-lg font-bold" style={{ color: urgencyStyle.text }}>
                {action.action}
              </div>
            </div>
            <div 
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{ backgroundColor: urgencyStyle.border + '30', color: urgencyStyle.text }}
            >
              {action.days} gün içinde
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Risk Analizi Bloğu - Standart Bileşen */}
          <div className="bg-white rounded-lg overflow-hidden">
            <RiskAnalysisBlock 
              data={getPipeRiskAnalysisData(pipe)} 
              compact={true}
            />
          </div>
          
          {/* Teknik Bilgiler */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-700/30 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-white">{pipe.material}</div>
              <div className="text-xs text-slate-500">Malzeme</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-white">{pipe.pipe_age_years}</div>
              <div className="text-xs text-slate-500">Yaş (yıl)</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-white">{pipe.failure_count_last_12m}</div>
              <div className="text-xs text-slate-500">Arıza/12ay</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-white">{formatDays(pipe.time_since_last_failure_days)}</div>
              <div className="text-xs text-slate-500">Son Arıza</div>
            </div>
          </div>
          
          {/* Beklenen Arıza Tipi */}
          <div className="flex items-center justify-between py-3 px-4 bg-slate-700/50 rounded-lg">
            <span className="text-sm text-slate-400">Beklenen Arıza Tipi</span>
            <span className="text-white font-medium">{getFailureTypeLabel(pipe.expected_failure_type)}</span>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Konum: {pipe.geom_start[0].toFixed(4)}, {pipe.geom_start[1].toFixed(4)}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const RiskListView: React.FC = () => {
  const [filters, setFilters] = useState<RiskListFilters>({});
  const [view, setView] = useState<'table' | 'map'>('table');
  const [selectedPipe, setSelectedPipe] = useState<PipeRiskScore | null>(null);
  const [top20Only, setTop20Only] = useState(true); // Varsayılan: Top 20 açık
  
  // Filtreleme + Top 20
  const filteredData = useMemo(() => {
    let data = MOCK_RISK_SCORES.filter(pipe => {
      if (filters.district && pipe.district !== filters.district) return false;
      if (filters.material && pipe.material !== filters.material) return false;
      if (filters.risk_band && pipe.risk_band !== filters.risk_band) return false;
      return true;
    });
    
    // Risk skoruna göre sırala
    data = [...data].sort((a, b) => b.risk_score - a.risk_score);
    
    // Top 20 filtresi
    if (top20Only) {
      data = data.slice(0, 20);
    }
    
    return data;
  }, [filters, top20Only]);
  
  // İstatistikler
  const stats = useMemo(() => ({
    total: filteredData.length,
    high: filteredData.filter(p => p.risk_band === 'high').length,
    medium: filteredData.filter(p => p.risk_band === 'medium').length,
    low: filteredData.filter(p => p.risk_band === 'low').length,
  }), [filteredData]);
  
  // Bursa merkez ve sınırlar
  const center: [number, number] = [40.18, 29.0];
  const bursaBounds: [[number, number], [number, number]] = [
    [39.55, 28.0],  // Güneybatı köşe
    [40.60, 30.0]   // Kuzeydoğu köşe
  ];
  
  // Mock trend metrikleri - gerçek projede API'den gelecek
  const trendMetrics = {
    mnf: { value: 23.5, trend: -2.1, unit: '%' },
    ili: { value: 3.8, trend: 0.3, unit: '' },
    monthlyFailures: { value: 12, trend: -3, unit: '/ay' },
  };
  
  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Kurumsal Üst Bar */}
      <div className="bg-slate-900 text-white px-6 py-2 flex items-center justify-between text-xs">
        <span className="font-medium tracking-wide">BUSKİ Dijital Altyapı Birimi</span>
        <span className="text-slate-400">Pipe Risk Motoru v1.0</span>
      </div>
      
      {/* Header - Sade */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Pipe Risk Motoru</h1>
            <p className="text-sm text-slate-500">30 günlük patlak riski tahmini – bakım önceliklendirme</p>
          </div>
          
          {/* Trend Metrikleri - Sade */}
          <div className="flex items-center gap-6">
            <div className="text-center px-3 py-1 bg-slate-50 rounded border border-slate-200">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">MNF</div>
              <div className="flex items-center gap-1">
                <span className="text-base font-semibold text-slate-700">{trendMetrics.mnf.value}{trendMetrics.mnf.unit}</span>
                <span className={`text-xs ${trendMetrics.mnf.trend < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trendMetrics.mnf.trend < 0 ? '↓' : '↑'}{Math.abs(trendMetrics.mnf.trend)}%
                </span>
              </div>
            </div>
            
            <div className="text-center px-3 py-1 bg-slate-50 rounded border border-slate-200">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">ILI</div>
              <div className="flex items-center gap-1">
                <span className="text-base font-semibold text-slate-700">{trendMetrics.ili.value}</span>
                <span className={`text-xs ${trendMetrics.ili.trend < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trendMetrics.ili.trend < 0 ? '↓' : '↑'}{Math.abs(trendMetrics.ili.trend).toFixed(1)}
                </span>
              </div>
            </div>
            
            <div className="text-center px-3 py-1 bg-slate-50 rounded border border-slate-200">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Arıza/Ay</div>
              <div className="flex items-center gap-1">
                <span className="text-base font-semibold text-slate-700">{trendMetrics.monthlyFailures.value}</span>
                <span className={`text-xs ${trendMetrics.monthlyFailures.trend < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trendMetrics.monthlyFailures.trend < 0 ? '↓' : '↑'}{Math.abs(trendMetrics.monthlyFailures.trend)}
                </span>
              </div>
            </div>
            
            <div className="h-8 w-px bg-slate-200"></div>
            
            {/* View Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('table')}
                className={`px-3 py-1.5 text-sm rounded border transition ${
                  view === 'table' 
                    ? 'bg-slate-800 text-white border-slate-800' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                Liste
              </button>
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1.5 text-sm rounded border transition ${
                  view === 'map' 
                    ? 'bg-slate-800 text-white border-slate-800' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                Harita
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Filter Bar */}
      <FilterBar 
        filters={filters} 
        onFilterChange={setFilters} 
        stats={stats}
        top20Only={top20Only}
        onTop20Toggle={setTop20Only}
      />
      
      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-white">
        {view === 'table' ? (
          /* Tablo Görünümü */
          <div className="h-full overflow-auto">
            {top20Only && (
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-sm text-slate-600 flex items-center gap-2">
                <span className="font-medium">Bakım Öncelik Listesi:</span> Risk skoruna göre en yüksek 20 boru gösteriliyor.
              </div>
            )}
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Boru ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">İlçe</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">Risk</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">Seviye</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Neden?</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Önerilen Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((pipe, index) => {
                  const action = getRecommendedAction(pipe);
                  return (
                  <tr 
                    key={pipe.pipe_id}
                    onClick={() => setSelectedPipe(pipe)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-800">{pipe.pipe_id}</div>
                      <div className="text-xs text-slate-400">{pipe.dma_id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{pipe.district}</td>
                    <td className="px-4 py-3 text-center">
                      <span 
                        className="text-base font-semibold"
                        style={{ color: getRiskColor(pipe.risk_band) }}
                      >
                        {(pipe.risk_score * 100).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span 
                        className="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                        style={{ 
                          backgroundColor: getRiskColor(pipe.risk_band) + '20',
                          color: getRiskColor(pipe.risk_band)
                        }}
                      >
                        {getRiskBandLabel(pipe.risk_band)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 max-w-xs">
                      {getWhySummary(pipe)}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${
                        action.urgency === 'kritik' ? 'text-red-400' : 
                        action.urgency === 'yakın' ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {action.action}
                      </div>
                      <div className="text-xs text-slate-500">{action.days} gün içinde</div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredData.length === 0 && (
              <div className="flex items-center justify-center h-64 text-slate-500">
                Filtrelere uygun boru bulunamadı.
              </div>
            )}
          </div>
        ) : (
          /* Harita Görünümü */
          <div className="h-full relative">
            <MapContainer
              center={center}
              zoom={9}
              minZoom={8}
              maxZoom={16}
              maxBounds={bursaBounds}
              maxBoundsViscosity={1.0}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <MapBoundsEnforcer />
              <ZoomControl position="bottomright" />
              <TileLayer
                attribution='&copy; CARTO'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              
              {filteredData.map((pipe) => (
                <React.Fragment key={pipe.pipe_id}>
                  {/* Görünmez geniş tıklama alanı */}
                  <Polyline
                    positions={[pipe.geom_start, pipe.geom_end]}
                    pathOptions={{
                      color: 'transparent',
                      weight: 25,
                      opacity: 0
                    }}
                    eventHandlers={{
                      click: () => setSelectedPipe(pipe)
                    }}
                  />
                  {/* Görünen boru */}
                  <Polyline
                    positions={[pipe.geom_start, pipe.geom_end]}
                    pathOptions={{
                      color: getRiskColor(pipe.risk_band),
                      weight: pipe.risk_band === 'high' ? 8 : 5,
                      opacity: 0.9
                    }}
                    eventHandlers={{
                      click: () => setSelectedPipe(pipe)
                    }}
                  >
                  <Popup>
                    <div className="text-sm">
                      <strong>{pipe.pipe_id}</strong><br/>
                      {pipe.district} • {pipe.material}<br/>
                      <span style={{ color: getRiskColor(pipe.risk_band) }}>
                        Risk: {(pipe.risk_score * 100).toFixed(0)}
                      </span>
                    </div>
                  </Popup>
                </Polyline>
                </React.Fragment>
              ))}
            </MapContainer>
            
            {/* Lejant */}
            <div className="absolute top-4 left-4 bg-slate-800 rounded-lg p-3 z-[1000] text-sm">
              <div className="font-semibold mb-2">Risk Seviyeleri</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1 bg-red-500 rounded"></span>
                  <span className="text-slate-300">Yüksek ({stats.high})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1 bg-amber-500 rounded"></span>
                  <span className="text-slate-300">Orta ({stats.medium})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1 bg-emerald-500 rounded"></span>
                  <span className="text-slate-300">Düşük ({stats.low})</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Pipe Detail Card */}
      {selectedPipe && (
        <PipeCard pipe={selectedPipe} onClose={() => setSelectedPipe(null)} />
      )}
      
      {/* Footer */}
      <footer className="bg-slate-800 border-t border-slate-700 px-6 py-2 text-xs text-slate-500 flex justify-between">
        <span>Tahminler karar destek amaçlıdır; hukuken bağlayıcı taahhüt değildir.</span>
        <span>Son güncelleme: {new Date().toLocaleString('tr-TR')}</span>
      </footer>
    </div>
  );
};

export default RiskListView;
