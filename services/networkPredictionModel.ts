import { Complaint } from '../types';
import { 
  generateAllNodeSensorData, 
  detectSensorAnomalies, 
  predictBurstRisk,
  NodeSensorData 
} from './sensorDataService';

export interface NetworkPrediction {
  districtName: string;
  riskScore: number; // 0-100
  predictedStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  confidenceLevel: number; // 0-100
  factors: PredictionFactor[];
  recommendedAction: string;
  estimatedResolutionTime?: number; // minutes
}

export interface PredictionFactor {
  name: string;
  impact: number; // -50 to +50
  description: string;
}

export interface NetworkMetrics {
  complaintCount: number;
  averagePressure: number; // 0-10 scale
  complaintDensity: number;
  recentIncidents: number;
  weatherFactor: number; // -10 to +10
  temporalFactor: number; // based on hour
}

// NLP Keywords for network issue detection
const NETWORK_ISSUE_KEYWORDS = {
  PRESSURE_LOW: ['basınç düşük', 'su gelmez', 'zayıf akış', 'akış yok', 'su çıkmaz', 'su gelmiyor'],
  WATER_QUALITY: ['renk', 'koku', 'bulanık', 'paslanmış', 'kirli', 'sağlığa zararlı', 'anormal renk'],
  BURST: ['patlak', 'kırılmış', 'çatlamış', 'kırık boru', 'boru patladı', 'sızıntı var'],
  CUTOFF: ['kesinti', 'kesik', 'kapatıldı', 'kapandı', 'kesildi', 'duruş'],
  DISCOLORATION: ['sarı su', 'kırmızı su', 'kahverengi su', 'çamurlu', 'renkli su'],
  CONTAMINATION: ['kontaminasyon', 'microbial', 'bakteri', 'virüs', 'parazit']
};

// Temporal patterns (risk increases certain hours)
const TEMPORAL_RISK_PATTERNS: Record<number, number> = {
  6: -5,  // early morning (lower risk)
  7: 0,   // normal
  12: 10, // lunch (higher usage)
  18: 20, // evening peak (highest risk)
  22: 5,  // night
  3: -10  // deep night (lowest risk)
};

/**
 * NLP-based complaint analysis to extract network health signals
 */
export function analyzeComplaintForNetworkSignals(complaint: Complaint): {
  issueType: keyof typeof NETWORK_ISSUE_KEYWORDS | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
} {
  const text = complaint.text.toLowerCase();
  let detectedType: keyof typeof NETWORK_ISSUE_KEYWORDS | null = null;
  let maxMatches = 0;

  for (const [type, keywords] of Object.entries(NETWORK_ISSUE_KEYWORDS)) {
    const matches = keywords.filter(k => text.includes(k)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedType = type as keyof typeof NETWORK_ISSUE_KEYWORDS;
    }
  }

  // Severity based on keywords and likes (community agreement)
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (complaint.likes > 5 && detectedType) severity = 'HIGH';
  else if (complaint.likes > 2 || (detectedType && maxMatches > 1)) severity = 'MEDIUM';

  const confidence = Math.min(100, (maxMatches / 3) * 100);

  return { issueType: detectedType, severity, confidence };
}

/**
 * Calculate network metrics for a district based on complaints
 */
export function calculateNetworkMetrics(
  complaints: Complaint[],
  district: string,
  currentHour: number = new Date().getHours()
): NetworkMetrics {
  const districtComplaints = complaints.filter(c => c.district === district);

  // Count different types of issues
  const issueTypes = districtComplaints.map(c => analyzeComplaintForNetworkSignals(c));
  const criticalIssues = issueTypes.filter(i => i.severity === 'HIGH').length;
  const mediumIssues = issueTypes.filter(i => i.severity === 'MEDIUM').length;

  // Calculate pressure based on complaint ratio (inverse relationship)
  const complaintDensity = districtComplaints.length / 100; // normalized
  const averagePressure = Math.max(0, 10 - complaintDensity * 5); // Lower with more complaints

  // Temporal factor (peak hours = higher risk)
  const temporalFactor = TEMPORAL_RISK_PATTERNS[currentHour] || 0;

  // Weather assumption (dry weather = higher demand = lower pressure)
  const weatherFactor = -3; // Could integrate real weather API

  const recentIncidents = criticalIssues + mediumIssues * 0.5;

  return {
    complaintCount: districtComplaints.length,
    averagePressure,
    complaintDensity,
    recentIncidents,
    weatherFactor,
    temporalFactor
  };
}

/**
 * Predict network status - GEREKÇİ SENSÖR VERİSİ İLE
 * Şikayet + Sensör verileri birleştirilerek tahmin yapılır
 */
export function predictNetworkStatus(
  complaints: Complaint[],
  district: string
): NetworkPrediction {
  // Sensör verilerini çek
  const allSensorData = generateAllNodeSensorData();
  const districtSensorData = allSensorData.filter(s => s.district === district);

  // Şikayet bazlı metrikler
  const metrics = calculateNetworkMetrics(complaints, district);

  // Sensör bazlı risk skoru
  let sensorRiskScore = 0;
  const sensorAnomalies: string[] = [];

  districtSensorData.forEach(node => {
    // Anomali tespiti
    const anomaly = detectSensorAnomalies(node);
    if (anomaly.hasAnomaly) {
      sensorAnomalies.push(`${node.node_name}: ${anomaly.description}`);
      sensorRiskScore += anomaly.severity === 'HIGH' ? 30 : 15;
    }

    // Boru patlak riski
    const burstRisk = predictBurstRisk(node);
    if (burstRisk.risk_level === 'CRITICAL') {
      sensorAnomalies.push(`${node.node_name}: PATLAK RİSKİ - ${burstRisk.burst_probability}%`);
      sensorRiskScore += 40;
    } else if (burstRisk.risk_level === 'HIGH') {
      sensorRiskScore += 25;
    }

    // Basınç eğilimi
    if (node.pressure_trend === 'FALLING') {
      sensorRiskScore += 15;
    }
  });

  sensorRiskScore = Math.min(100, sensorRiskScore / Math.max(1, districtSensorData.length));

  // Risk scoring algorithm - SENSÖR + ŞİKAYET HİBRİD
  let riskScore = 0;

  // 50% sensör veri, 50% şikayet
  riskScore += sensorRiskScore * 0.5;

  // Complaint density impact (max 15 points)
  riskScore += metrics.complaintDensity * 15;

  // Pressure impact (max 15 points)
  riskScore += (10 - metrics.averagePressure) * 1.5;

  // Recent incidents impact (max 10 points)
  riskScore += metrics.recentIncidents * 2;

  // Temporal and weather factors
  riskScore += Math.max(0, metrics.temporalFactor * 0.5);
  riskScore += Math.max(0, metrics.weatherFactor * 0.5);

  riskScore = Math.min(100, Math.max(0, riskScore));

  // Determine status
  let predictedStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (riskScore >= 70) predictedStatus = 'CRITICAL';
  else if (riskScore >= 40) predictedStatus = 'WARNING';

  // Confidence based on sensor data quality
  const dataQuality = Math.min(100, (districtSensorData.length / 3) * 100);
  const complaintConfidence = Math.min(100, (metrics.complaintCount / 5) * 100);
  const confidenceLevel = (dataQuality + complaintConfidence) / 2;

  // Identify factors
  const factors: PredictionFactor[] = [];

  // Sensör bazlı faktörler
  if (sensorAnomalies.length > 0) {
    factors.push({
      name: 'Sensör anomalileri',
      impact: Math.min(35, sensorAnomalies.length * 10),
      description: sensorAnomalies.join(' | ')
    });
  }

  if (districtSensorData.some(n => n.pressure_trend === 'FALLING')) {
    factors.push({
      name: 'Düşen basınç trendi',
      impact: 20,
      description: 'Bir veya daha fazla node\'da basınç düşüyor'
    });
  }

  // Şikayet bazlı faktörler
  if (metrics.complaintDensity > 0.3) {
    factors.push({
      name: 'Yüksek şikayet oranı',
      impact: 15,
      description: 'Bölgede anormal yüksek sayıda şikayet alınmıştır'
    });
  }

  if (metrics.recentIncidents > 3) {
    factors.push({
      name: 'Son zamanlı olaylar',
      impact: 10,
      description: 'Kritik seviye şikayetler tespit edilmiştir'
    });
  }

  // Estimation for resolution
  let estimatedResolutionTime: number | undefined;
  if (predictedStatus === 'CRITICAL') {
    estimatedResolutionTime = 60 + (riskScore - 70) * 3; // 60+ dakika
  } else if (predictedStatus === 'WARNING') {
    estimatedResolutionTime = 120 + (riskScore - 40) * 2; // 120+ dakika
  }

  // Recommended action
  let recommendedAction = 'Normal izleme devam edin';
  if (predictedStatus === 'CRITICAL') {
    recommendedAction = 'ACIL: Teknik ekibi görevlendir. Vatandaşlara bildirim gönder.';
  } else if (predictedStatus === 'WARNING') {
    recommendedAction = 'Şebeke durumunu yakından izle. Olası kesintiye hazır ol.';
  }

  return {
    districtName: district,
    riskScore,
    predictedStatus,
    confidenceLevel,
    factors,
    recommendedAction,
    estimatedResolutionTime
  };
}

/**
 * Generate human-readable notification message
 */
export function generateNetworkNotificationMessage(prediction: NetworkPrediction): string {
  const emoji = {
    HEALTHY: '✅',
    WARNING: '⚠️',
    CRITICAL: '🚨'
  };

  const title = {
    HEALTHY: 'Su şebekesi normal',
    WARNING: 'Su şebeke uyarısı',
    CRITICAL: 'ACIL: Su şebeke krizidir'
  };

  const baseMessage = `${emoji[prediction.predictedStatus]} ${title[prediction.predictedStatus]}

${prediction.districtName} bölgesinde:
• Risk seviyesi: ${prediction.riskScore.toFixed(0)}/100
• Durum: ${prediction.predictedStatus === 'HEALTHY' ? 'Sorun yok ✓' : prediction.predictedStatus === 'WARNING' ? 'Olası kesinti ⚠️' : 'Acil müdahale gerekli 🚨'}
• Güven seviyesi: %${prediction.confidenceLevel.toFixed(0)}

${prediction.recommendedAction}`;

  if (prediction.estimatedResolutionTime) {
    return baseMessage + `\n\nTahmini çözüm süresi: ~${prediction.estimatedResolutionTime} dakika`;
  }

  return baseMessage;
}

/**
 * Batch predict for multiple districts
 */
export function predictAllDistricts(
  complaints: Complaint[],
  districts: string[]
): NetworkPrediction[] {
  return districts.map(district => predictNetworkStatus(complaints, district));
}
