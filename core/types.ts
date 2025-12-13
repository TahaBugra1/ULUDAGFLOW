/**
 * ULUDAGFLOW - Veri Şeması ve Tipler
 * 
 * İki modül:
 * - Modül A: Pipe Risk Motoru (BUSKİ iç kullanım)
 * - Modül B: Mahalle Su Gerçekliği (vatandaş erişimi)
 */

// ============================================
// TEMEL TABLOLAR
// ============================================

/** Boru kayıt tablosu */
export interface Pipe {
  pipe_id: string;
  dma_id: string;
  district: string;
  material: 'dokme_demir' | 'celik' | 'PVC' | 'PE' | 'diger';
  diameter_mm: number;
  length_m: number;
  install_year: number;
  // Geometri (harita için)
  geom_start: [number, number]; // [lat, lng]
  geom_end: [number, number];
}

/** Türetilmiş boru özellikleri */
export interface PipeFeatures extends Pipe {
  pipe_age_years: number;
  failure_count_last_12m: number;
  time_since_last_failure_days: number | null;
}

/** Arıza kaydı tablosu */
export interface PipeFailure {
  failure_id: string;
  pipe_id: string;
  failure_date: string; // ISO date
  failure_type: 'patlak' | 'sizinti' | 'baglanti' | 'vana_arizasi' | 'diger';
  repair_duration_hours: number;
}

/** DMA günlük istatistik tablosu */
export interface DMAStatsDaily {
  date: string; // ISO date
  dma_id: string;
  min_night_flow_lps: number;
  avg_pressure_m: number;
  pressure_std: number;
  burst_count: number;
}

/** Türetilmiş DMA özellikleri (30 gün pencere) */
export interface DMAFeatures {
  dma_id: string;
  dma_mnf_30d_avg: number;
  dma_pressure_30d_avg: number;
  dma_pressure_30d_std: number;
  dma_burst_12m_sum: number;
}

// ============================================
// MODÜL A: PİPE RİSK MOTORU ÇIKTISI
// ============================================

export type RiskBand = 'low' | 'medium' | 'high';
export type ExpectedFailureType = 'patlak' | 'sizinti' | 'bilinmiyor';

/** Model çıktısı: boru bazında risk skoru */
export interface PipeRiskScore {
  pipe_id: string;
  dma_id: string;
  district: string;
  
  // Risk metrikleri
  risk_score: number; // 0-1 arası
  risk_band: RiskBand;
  expected_failure_type: ExpectedFailureType;
  
  // Açıklanabilirlik
  top_factors: string[]; // max 3 faktör
  
  // Bağlam bilgileri
  pipe_age_years: number;
  material: string;
  failure_count_last_12m: number;
  time_since_last_failure_days: number | null;
  
  // Geometri
  geom_start: [number, number];
  geom_end: [number, number];
}

/** RiskListView için filtre seçenekleri */
export interface RiskListFilters {
  district?: string;
  dma_id?: string;
  material?: string;
  risk_band?: RiskBand;
}

// ============================================
// MODÜL B: MAHALLE SU GERÇEKLİĞİ
// ============================================

export type TicketStatus = 'alindi' | 'atanmis' | 'sahada' | 'cozuluyor' | 'kapandi';
export type IssueType = 'su_kesintisi' | 'dusuk_basinc' | 'su_kalitesi' | 'diger';
export type PerformanceVsCity = 'daha_iyi' | 'benzer' | 'daha_kotu';

/** WhatsApp bot'tan gelen şikayet bileti */
export interface Ticket {
  ticket_id: string;
  created_at: string; // ISO datetime
  
  // Kullanıcı girdisi
  issue_type: IssueType;
  description: string;
  location: {
    lat: number;
    lng: number;
    neighborhood: string;
    district: string;
    dma_id: string;
  };
  media_urls?: string[];
  
  // Durum takibi
  status: TicketStatus;
  assigned_unit?: string;
  eta_hours?: number;
  actual_duration_hours?: number;
  resolved_at?: string;
}

export type TrendDirection = 'improving' | 'stable' | 'worsening';

/** Mahalle gerçeklik kartı metrikleri */
export interface NeighborhoodMetrics {
  neighborhood: string;
  district: string;
  dma_id: string;
  
  // Son 30 gün metrikleri
  outage_count_30d: number;
  avg_outage_duration_30d_hours: number;
  bursts_30d: number;
  
  // Son 12 ay metrikleri
  bursts_12m: number;
  failure_count_12m: number;
  
  // Risk durumu (Modül A'dan)
  risk_band_current: RiskBand;
  risk_summary: string;      // "Bu DMA'da son 12 ayda 9 patlak oldu. MNF halen yüksek."
  risk_action: string;       // "30 gün içinde saha kontrolü önerilir."
  risk_factors: string[];    // ["9 patlak/12 ay", "MNF %18", "2 FONT boru (35+ yaş)"]
  risk_trend: TrendDirection; // Risk eğilimi
  
  // Şehir karşılaştırması
  performance_vs_city: PerformanceVsCity;
  city_avg_outage_count_30d: number;
  city_avg_outage_duration_30d_hours: number;
  city_avg_bursts_12m: number;
  
  // Trend bilgileri
  trend_vs_last_month: TrendDirection;
  mnf_current: number;
  mnf_city_avg: number;
  
  // Backward compatibility
  risk_explanation?: string;
}

/** Ticket sayfası için birleşik veri */
export interface TicketPageData {
  ticket: Ticket;
  neighborhood: NeighborhoodMetrics;
}

// ============================================
// API RESPONSE TİPLERİ
// ============================================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/** Risk listesi sayfalama */
export interface PaginatedRiskList {
  items: PipeRiskScore[];
  total: number;
  page: number;
  page_size: number;
  filters_applied: RiskListFilters;
}

// ============================================
// MODEL EĞİTİM TİPLERİ
// ============================================

/** Eğitim verisi satırı */
export interface TrainingRow {
  pipe_id: string;
  snapshot_date: string;
  
  // Boru özellikleri
  pipe_age_years: number;
  material_encoded: number; // one-hot veya label encoded
  diameter_mm: number;
  length_m: number;
  failure_count_last_12m: number;
  time_since_last_failure_days: number;
  
  // DMA özellikleri
  dma_mnf_30d_avg: number;
  dma_pressure_30d_avg: number;
  dma_pressure_30d_std: number;
  dma_burst_12m_sum: number;
  
  // Hedef değişken
  label: 0 | 1; // 30 gün içinde arıza var/yok
}

/** Model değerlendirme metrikleri */
export interface ModelMetrics {
  auc_roc: number;
  recall_at_5pct: number; // Top 5% boruda gerçek patlak yüzdesi
  precision_at_5pct: number;
  f1_score: number;
  
  // Confusion matrix
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
}
