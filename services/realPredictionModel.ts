/**
 * Gerçek Veriye Dayalı Tahmin Modeli
 * GIS Şebeke Verileri + Şikayet Verileri + Sensör Verileri
 * 
 * Bu model mock data yerine gerçek Shapefile verilerini kullanır
 */

import { Complaint } from '../types';
import { realNetworkService, Pipe, NetworkNode, RiskZone } from './realNetworkService';

// ==================== TİP TANIMLARI ====================

export interface RealPrediction {
  region: string;
  pipeId?: string;
  pipeType: 'icmesuyu' | 'atiksu' | 'yagmursuyu' | 'all';
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidenceLevel: number;
  factors: RiskFactor[];
  recommendedActions: string[];
  affectedPipes: number;
  estimatedImpact: string;
}

export interface RiskFactor {
  name: string;
  weight: number; // 0-100
  contribution: number; // -50 to +50
  description: string;
  source: 'GIS' | 'COMPLAINT' | 'SENSOR' | 'TEMPORAL';
}

export interface PipeRiskAnalysis {
  pipe: Pipe;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  nearbyComplaints: number;
  lastIncident?: Date;
}

export interface AreaRiskSummary {
  center: { lat: number; lng: number };
  radius: number;
  totalPipes: number;
  avgRisk: number;
  highRiskCount: number;
  criticalCount: number;
  dominantIssue: string;
}

// ==================== RİSK AĞIRLIKLARI ====================

const RISK_WEIGHTS = {
  // Malzeme bazlı risk (yaşlanma)
  MATERIAL: {
    'BETON': 25,
    'BETONARME': 20,
    'CELIK': 30,      // Korozyon riski yüksek
    'FDK': 10,        // Düktil demir - dayanıklı
    'PE': 5,          // Polietilen - en dayanıklı
    'PVC': 8,
    'HDPE': 5,
    'DEFAULT': 15
  },
  
  // Çap bazlı risk (küçük çap = yüksek risk)
  DIAMETER: {
    VERY_SMALL: { max: 100, risk: 35 },
    SMALL: { max: 200, risk: 25 },
    MEDIUM: { max: 400, risk: 10 },
    LARGE: { max: 800, risk: 5 },
    VERY_LARGE: { max: Infinity, risk: 0 }
  },
  
  // Eğim bazlı risk (atıksu/yağmursuyu için)
  SLOPE: {
    NEGATIVE: 40,     // Ters eğim - kritik
    ZERO: 35,         // Sıfır eğim - tıkanma riski
    LOW: 20,          // Düşük eğim
    NORMAL: 0,        // Normal
    HIGH: 5           // Çok yüksek eğim - aşınma riski
  }
};

// ==================== YARDIMCI FONKSİYONLAR ====================

function getMaterialRisk(material: string): number {
  const mat = material.toUpperCase();
  for (const [key, risk] of Object.entries(RISK_WEIGHTS.MATERIAL)) {
    if (mat.includes(key)) return risk;
  }
  return RISK_WEIGHTS.MATERIAL.DEFAULT;
}

function getDiameterRisk(diameter: number): number {
  if (diameter <= 0) return 20; // Belirsiz
  
  const ranges = RISK_WEIGHTS.DIAMETER;
  if (diameter <= ranges.VERY_SMALL.max) return ranges.VERY_SMALL.risk;
  if (diameter <= ranges.SMALL.max) return ranges.SMALL.risk;
  if (diameter <= ranges.MEDIUM.max) return ranges.MEDIUM.risk;
  if (diameter <= ranges.LARGE.max) return ranges.LARGE.risk;
  return ranges.VERY_LARGE.risk;
}

function getSlopeRisk(slopeStr: string): number {
  if (!slopeStr || slopeStr === '') return 0;
  
  try {
    const slope = parseFloat(slopeStr);
    if (slope < 0) return RISK_WEIGHTS.SLOPE.NEGATIVE;
    if (slope === 0) return RISK_WEIGHTS.SLOPE.ZERO;
    if (slope < 0.01) return RISK_WEIGHTS.SLOPE.LOW;
    if (slope > 0.5) return RISK_WEIGHTS.SLOPE.HIGH;
    return RISK_WEIGHTS.SLOPE.NORMAL;
  } catch {
    return 0;
  }
}

function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

// ==================== ANA TAHMİN FONKSİYONLARI ====================

/**
 * Tek bir boru için detaylı risk analizi
 */
export function analyzePipeRisk(
  pipe: Pipe, 
  complaints: Complaint[] = []
): PipeRiskAnalysis {
  const factors: RiskFactor[] = [];
  let totalRisk = 0;
  
  // 1. Malzeme riski
  const materialRisk = getMaterialRisk(pipe.material);
  if (materialRisk > 0) {
    factors.push({
      name: 'Malzeme Yaşlanması',
      weight: 25,
      contribution: materialRisk,
      description: `${pipe.material} malzeme - yaşlanma/korozyon riski`,
      source: 'GIS'
    });
    totalRisk += materialRisk * 0.25;
  }
  
  // 2. Çap riski
  const diameterRisk = getDiameterRisk(pipe.diameter);
  if (diameterRisk > 0) {
    factors.push({
      name: 'Boru Çapı',
      weight: 20,
      contribution: diameterRisk,
      description: `${pipe.diameter}mm çap - ${diameterRisk > 20 ? 'kapasite yetersiz' : 'normal'}`,
      source: 'GIS'
    });
    totalRisk += diameterRisk * 0.20;
  }
  
  // 3. Eğim riski (sadece atıksu ve yağmursuyu için)
  if (pipe.type !== 'icmesuyu' && pipe.slope) {
    const slopeRisk = getSlopeRisk(pipe.slope);
    if (slopeRisk > 0) {
      factors.push({
        name: 'Eğim Problemi',
        weight: 30,
        contribution: slopeRisk,
        description: slopeRisk >= 35 ? 'Sıfır/ters eğim - tıkanma riski!' : 'Düşük eğim',
        source: 'GIS'
      });
      totalRisk += slopeRisk * 0.30;
    }
  }
  
  // 4. GIS'ten gelen mevcut risk skoru
  if (pipe.risk_score > 0) {
    factors.push({
      name: 'GIS Risk Skoru',
      weight: 15,
      contribution: pipe.risk_score * 0.5,
      description: `Shapefile\'dan hesaplanan risk: ${pipe.risk_score}`,
      source: 'GIS'
    });
    totalRisk += (pipe.risk_score * 0.5) * 0.15;
  }
  
  // 5. Yakındaki şikayetler
  const nearbyComplaints = findNearbyComplaints(pipe, complaints);
  if (nearbyComplaints > 0) {
    const complaintRisk = Math.min(40, nearbyComplaints * 10);
    factors.push({
      name: 'Yakın Şikayetler',
      weight: 10,
      contribution: complaintRisk,
      description: `${nearbyComplaints} adet şikayet bu bölgede`,
      source: 'COMPLAINT'
    });
    totalRisk += complaintRisk * 0.10;
  }
  
  // Toplam riski normalize et
  const finalRisk = Math.min(100, Math.max(0, totalRisk));
  
  return {
    pipe,
    riskScore: Math.round(finalRisk * 10) / 10,
    riskLevel: getRiskLevel(finalRisk),
    factors,
    nearbyComplaints
  };
}

/**
 * Belirli bir bölge için şikayetleri bul
 */
function findNearbyComplaints(pipe: Pipe, complaints: Complaint[]): number {
  if (!pipe.coordinates || pipe.coordinates.length === 0) return 0;
  
  const [lat, lng] = pipe.coordinates[0];
  const radius = 0.005; // ~500m
  
  return complaints.filter(c => {
    // Şikayet koordinatı varsa kullan
    const cLat = (c as any).lat || 40.21; // Default Balkan
    const cLng = (c as any).lng || 28.81;
    return Math.abs(cLat - lat) < radius && Math.abs(cLng - lng) < radius;
  }).length;
}

/**
 * Tüm şebeke için risk tahmini
 */
export function predictNetworkRisk(
  pipeType: 'icmesuyu' | 'atiksu' | 'yagmursuyu' | 'all' = 'all',
  complaints: Complaint[] = []
): RealPrediction {
  // Boruları al
  const pipes = pipeType === 'all' 
    ? realNetworkService.getAllPipes()
    : realNetworkService.getPipesByType(pipeType);
  
  if (pipes.length === 0) {
    return {
      region: realNetworkService.getRegion(),
      pipeType,
      riskScore: 0,
      riskLevel: 'LOW',
      confidenceLevel: 0,
      factors: [],
      recommendedActions: ['Veri bulunamadı'],
      affectedPipes: 0,
      estimatedImpact: 'Belirsiz'
    };
  }
  
  // Her boru için risk analizi
  const analyses = pipes.map(pipe => analyzePipeRisk(pipe, complaints));
  
  // Ortalama risk
  const avgRisk = analyses.reduce((sum, a) => sum + a.riskScore, 0) / analyses.length;
  
  // Risk dağılımı
  const criticalCount = analyses.filter(a => a.riskLevel === 'CRITICAL').length;
  const highCount = analyses.filter(a => a.riskLevel === 'HIGH').length;
  const mediumCount = analyses.filter(a => a.riskLevel === 'MEDIUM').length;
  
  // Dominant faktörler
  const allFactors: Record<string, { count: number; totalContribution: number }> = {};
  analyses.forEach(a => {
    a.factors.forEach(f => {
      if (!allFactors[f.name]) {
        allFactors[f.name] = { count: 0, totalContribution: 0 };
      }
      allFactors[f.name].count++;
      allFactors[f.name].totalContribution += f.contribution;
    });
  });
  
  const topFactors: RiskFactor[] = Object.entries(allFactors)
    .sort((a, b) => b[1].totalContribution - a[1].totalContribution)
    .slice(0, 5)
    .map(([name, data]) => ({
      name,
      weight: Math.round((data.count / analyses.length) * 100),
      contribution: Math.round(data.totalContribution / data.count),
      description: `${data.count} boruda tespit edildi`,
      source: 'GIS' as const
    }));
  
  // Öneriler
  const recommendedActions: string[] = [];
  
  if (criticalCount > 0) {
    recommendedActions.push(`ACİL: ${criticalCount} adet kritik riskli boru tespit edildi. Öncelikli bakım planı oluşturun.`);
  }
  if (highCount > 0) {
    recommendedActions.push(`UYARI: ${highCount} adet yüksek riskli boru var. Önleyici bakım programına alın.`);
  }
  if (mediumCount > pipes.length * 0.5) {
    recommendedActions.push('Genel şebeke bakım ihtiyacı tespit edildi.');
  }
  
  // Malzeme bazlı öneri
  const betonCount = pipes.filter(p => p.material.toUpperCase().includes('BETON')).length;
  if (betonCount > pipes.length * 0.3) {
    recommendedActions.push(`${betonCount} adet beton boru yaşlanma riski altında. Yenileme planı hazırlayın.`);
  }
  
  if (recommendedActions.length === 0) {
    recommendedActions.push('Şebeke normal durumda. Rutin izlemeye devam edin.');
  }
  
  // Tahmini etki
  let estimatedImpact = 'Düşük';
  if (avgRisk >= 60) estimatedImpact = 'Kritik - Acil müdahale gerekli';
  else if (avgRisk >= 40) estimatedImpact = 'Yüksek - Yakın takip gerekli';
  else if (avgRisk >= 20) estimatedImpact = 'Orta - Planlı bakım önerilir';
  
  return {
    region: realNetworkService.getRegion(),
    pipeType,
    riskScore: Math.round(avgRisk * 10) / 10,
    riskLevel: getRiskLevel(avgRisk),
    confidenceLevel: Math.min(95, 70 + (pipes.length / 100) * 25), // Veri miktarına göre güven
    factors: topFactors,
    recommendedActions,
    affectedPipes: criticalCount + highCount,
    estimatedImpact
  };
}

/**
 * Belirli koordinat için en yakın riskleri bul
 */
export function findRisksNearLocation(
  lat: number, 
  lng: number, 
  radius: number = 0.01 // ~1km
): PipeRiskAnalysis[] {
  const allPipes = realNetworkService.getAllPipes();
  
  const nearbyPipes = allPipes.filter(pipe => {
    return pipe.coordinates.some(coord => 
      Math.abs(coord[0] - lat) < radius && Math.abs(coord[1] - lng) < radius
    );
  });
  
  return nearbyPipes
    .map(pipe => analyzePipeRisk(pipe))
    .sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Şikayet bazlı risk tahmini
 */
export function predictFromComplaint(complaint: Complaint): RealPrediction {
  // Şikayet konumuna yakın boruları bul
  const lat = (complaint as any).lat || realNetworkService.getCenter().lat;
  const lng = (complaint as any).lng || realNetworkService.getCenter().lng;
  
  const nearbyRisks = findRisksNearLocation(lat, lng, 0.005);
  
  if (nearbyRisks.length === 0) {
    return predictNetworkRisk('all', [complaint]);
  }
  
  // En riskli boruyu bul
  const topRisk = nearbyRisks[0];
  
  // Şikayet tipine göre ek risk
  let complaintBonus = 0;
  const text = complaint.text.toLowerCase();
  
  if (text.includes('patlak') || text.includes('sızıntı')) {
    complaintBonus = 30;
  } else if (text.includes('kesinti') || text.includes('su yok')) {
    complaintBonus = 20;
  } else if (text.includes('basınç') || text.includes('zayıf')) {
    complaintBonus = 15;
  }
  
  const adjustedRisk = Math.min(100, topRisk.riskScore + complaintBonus);
  
  return {
    region: realNetworkService.getRegion(),
    pipeId: topRisk.pipe.id,
    pipeType: topRisk.pipe.type,
    riskScore: adjustedRisk,
    riskLevel: getRiskLevel(adjustedRisk),
    confidenceLevel: 85,
    factors: [
      ...topRisk.factors,
      {
        name: 'Vatandaş Şikayeti',
        weight: 20,
        contribution: complaintBonus,
        description: `"${complaint.text.substring(0, 50)}..."`,
        source: 'COMPLAINT'
      }
    ],
    recommendedActions: [
      `Şikayet konumu: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      `En yakın riskli boru: ${topRisk.pipe.id}`,
      `Boru tipi: ${topRisk.pipe.type}, Malzeme: ${topRisk.pipe.material}`
    ],
    affectedPipes: nearbyRisks.length,
    estimatedImpact: adjustedRisk >= 60 ? 'Acil müdahale gerekli' : 'Normal takip'
  };
}

/**
 * Dashboard için özet istatistikler
 */
export function getRealNetworkDashboard() {
  const stats = realNetworkService.getRiskStatistics();
  const lengths = realNetworkService.getTotalLength();
  const materials = realNetworkService.getMaterialDistribution();
  
  const icmePrediction = predictNetworkRisk('icmesuyu');
  const atikPrediction = predictNetworkRisk('atiksu');
  const yagmurPrediction = predictNetworkRisk('yagmursuyu');
  
  return {
    region: realNetworkService.getRegion(),
    center: realNetworkService.getCenter(),
    
    // Genel istatistikler
    summary: {
      totalPipes: stats.total,
      totalLengthKm: lengths.totalKm,
      avgRiskScore: stats.averageRisk
    },
    
    // Risk dağılımı
    riskDistribution: {
      low: stats.lowRisk,
      medium: stats.mediumRisk,
      high: stats.highRisk,
      percentages: stats.distribution
    },
    
    // Şebeke tiplerine göre
    networkTypes: {
      icmesuyu: {
        pipeCount: realNetworkService.getPipesByType('icmesuyu').length,
        lengthM: lengths.icmesuyu,
        riskScore: icmePrediction.riskScore,
        riskLevel: icmePrediction.riskLevel
      },
      atiksu: {
        pipeCount: realNetworkService.getPipesByType('atiksu').length,
        lengthM: lengths.atiksu,
        riskScore: atikPrediction.riskScore,
        riskLevel: atikPrediction.riskLevel
      },
      yagmursuyu: {
        pipeCount: realNetworkService.getPipesByType('yagmursuyu').length,
        lengthM: lengths.yagmursuyu,
        riskScore: yagmurPrediction.riskScore,
        riskLevel: yagmurPrediction.riskLevel
      }
    },
    
    // Malzeme dağılımı
    materials: materials.slice(0, 5),
    
    // Kritik noktalar
    criticalZones: realNetworkService.getRiskZones()
  };
}

// Export all functions
export default {
  analyzePipeRisk,
  predictNetworkRisk,
  findRisksNearLocation,
  predictFromComplaint,
  getRealNetworkDashboard
};
