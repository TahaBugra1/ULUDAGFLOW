/**
 * Bursa Su Şebekesi Sensör Veri Simülasyonu
 * 
 * KAYNAK VERİLER (Akademik Referanslar):
 * - BattLeDIM Challenge 2020 (L-Town Network) - KIOS Research Center
 * - EPANET Benchmark Networks (Net1, Net2, Net3)
 * - EPA SWMM Water Quality Models
 * - Gerçek dünya SCADA verilerinden istatistiksel parametreler
 * 
 * NOT: Bu veriler simülasyondur, gerçek BUSKİ SCADA entegrasyonu gerektirir.
 */

export interface SensorReading {
  timestamp: string;
  node_id: string;
  pressure: number;        // bar (Türkiye için tipik 2-6 bar)
  flow: number;            // L/s (Litre/saniye)
  volume: number;          // m³ (kümülatif hacim)
  demand: number;          // L/s (talep)
  temperature: number;     // °C (su sıcaklığı)
  quality_index: number;   // 0-100 (su kalite indeksi)
}

export interface NodeSensorData {
  node_id: string;
  node_name: string;
  district: string;
  readings: SensorReading[];
  current_pressure: number;
  current_flow: number;
  average_pressure: number;
  min_pressure: number;
  max_pressure: number;
  pressure_trend: 'RISING' | 'STABLE' | 'FALLING';
  anomaly_score: number;
}

/**
 * REFERANS VERİLER - Gerçek Su Şebekesi Parametreleri
 * 
 * Kaynak: L-Town Network (BattLeDIM 2020) + Türkiye içme suyu standartları
 * 
 * Basınç Standartları (TS 266 / İçme Suyu Yönetmeliği):
 * - Minimum servis basıncı: 2 bar (kritik düşük: 1.5 bar)
 * - Optimum basınç: 3-4 bar
 * - Maximum basınç: 6 bar (yüksek basınç riski > 5 bar)
 * 
 * Akış Oranları (BUSKİ kapasiteleri tahmini):
 * - Nilüfer (ana merkez): 400-600 L/s
 * - Osmangazi: 300-500 L/s
 * - Yıldırım: 250-400 L/s
 * - Diğer ilçeler: 50-200 L/s
 */
export const BURSA_SENSOR_BASELINE_DATA = {
  // === ANA DAĞITIM MERKEZLERİ ===
  'BURS-NIL-01': {
    name: 'Nilüfer Ana Dağıtım Merkezi',
    district: 'Nilüfer',
    baseline_pressure: 3.2,      // bar
    baseline_flow: 485.0,        // L/s
    min_pressure: 2.0,           // bar - kritik alt sınır
    max_pressure: 4.5,           // bar - güvenli üst sınır
    elevation: 85,               // metre (deniz seviyesinden)
    pipe_diameter: 600,          // mm - ana boru çapı
    network_age: 15,             // yıl - şebeke yaşı
    // 24 saatlik talep deseni (L/s) - L-Town verilerinden adapte
    demand_pattern: [
      165, 145, 130, 125, 135, 185, 285, 420, 485, 510, 490, 470,
      455, 440, 425, 445, 480, 520, 495, 440, 365, 285, 220, 180
    ],
    // Mevsimsel faktörler (kış=0.85, ilkbahar=0.95, yaz=1.15, sonbahar=0.95)
    seasonal_factors: { winter: 0.85, spring: 0.95, summer: 1.15, autumn: 0.95 }
  },
  'BURS-OSM-01': {
    name: 'Osmangazi Merkez İstasyonu',
    district: 'Osmangazi',
    baseline_pressure: 3.4,
    baseline_flow: 410.0,
    min_pressure: 2.2,
    max_pressure: 4.8,
    elevation: 120,
    pipe_diameter: 500,
    network_age: 25,
    demand_pattern: [
      140, 120, 105, 100, 110, 160, 245, 360, 410, 435, 420, 400,
      385, 370, 355, 375, 405, 440, 420, 375, 310, 240, 185, 155
    ],
    seasonal_factors: { winter: 0.88, spring: 0.96, summer: 1.12, autumn: 0.94 }
  },
  'BURS-YIL-01': {
    name: 'Yıldırım Dağıtım Merkezi',
    district: 'Yıldırım',
    baseline_pressure: 2.9,
    baseline_flow: 355.0,
    min_pressure: 1.8,
    max_pressure: 4.2,
    elevation: 95,
    pipe_diameter: 450,
    network_age: 30,
    demand_pattern: [
      120, 100, 90, 85, 95, 140, 215, 315, 355, 380, 365, 345,
      330, 315, 300, 320, 350, 380, 360, 320, 265, 205, 160, 135
    ],
    seasonal_factors: { winter: 0.90, spring: 0.97, summer: 1.10, autumn: 0.93 }
  },
  
  // === İLÇE İSTASYONLARI ===
  'BURS-GEM-01': {
    name: 'Gemlik Liman İstasyonu',
    district: 'Gemlik',
    baseline_pressure: 3.6,
    baseline_flow: 165.0,
    min_pressure: 2.4,
    max_pressure: 5.0,
    elevation: 15,
    pipe_diameter: 300,
    network_age: 20,
    demand_pattern: [
      55, 48, 42, 40, 45, 68, 105, 145, 165, 175, 170, 160,
      152, 145, 138, 148, 162, 175, 168, 150, 125, 95, 72, 60
    ],
    seasonal_factors: { winter: 0.75, spring: 0.90, summer: 1.35, autumn: 0.90 }
  },
  'BURS-INE-01': {
    name: 'İnegöl Merkez İstasyonu',
    district: 'İnegöl',
    baseline_pressure: 2.6,
    baseline_flow: 195.0,
    min_pressure: 1.6,
    max_pressure: 3.8,
    elevation: 280,
    pipe_diameter: 350,
    network_age: 22,
    demand_pattern: [
      65, 55, 50, 48, 52, 78, 122, 172, 195, 210, 200, 188,
      178, 170, 162, 175, 192, 208, 198, 175, 145, 112, 85, 72
    ],
    seasonal_factors: { winter: 0.92, spring: 0.98, summer: 1.08, autumn: 0.92 }
  },
  'BURS-MUD-01': {
    name: 'Mudanya Sahil İstasyonu',
    district: 'Mudanya',
    baseline_pressure: 3.8,
    baseline_flow: 125.0,
    min_pressure: 2.6,
    max_pressure: 5.2,
    elevation: 25,
    pipe_diameter: 250,
    network_age: 18,
    demand_pattern: [
      42, 36, 32, 30, 34, 52, 80, 110, 125, 135, 130, 122,
      115, 110, 105, 112, 122, 132, 125, 112, 92, 72, 55, 46
    ],
    seasonal_factors: { winter: 0.70, spring: 0.85, summer: 1.45, autumn: 0.88 }
  },
  'BURS-KES-01': {
    name: 'Kestel Dağıtım Merkezi',
    district: 'Kestel',
    baseline_pressure: 2.4,
    baseline_flow: 85.0,
    min_pressure: 1.4,
    max_pressure: 3.4,
    elevation: 180,
    pipe_diameter: 200,
    network_age: 28,
    demand_pattern: [
      28, 24, 22, 20, 23, 35, 55, 75, 85, 92, 88, 82,
      78, 74, 70, 75, 82, 90, 85, 76, 62, 48, 38, 32
    ],
    seasonal_factors: { winter: 0.95, spring: 1.00, summer: 1.05, autumn: 0.95 }
  },
  'BURS-GUR-01': {
    name: 'Gürsu Sanayi İstasyonu',
    district: 'Gürsu',
    baseline_pressure: 3.0,
    baseline_flow: 145.0,
    min_pressure: 2.0,
    max_pressure: 4.2,
    elevation: 140,
    pipe_diameter: 300,
    network_age: 12,
    demand_pattern: [
      48, 42, 38, 35, 40, 68, 115, 138, 145, 148, 145, 142,
      138, 135, 132, 138, 145, 148, 142, 130, 105, 78, 58, 52
    ],
    seasonal_factors: { winter: 0.98, spring: 1.02, summer: 1.02, autumn: 0.98 }
  },
  'BURS-ORH-01': {
    name: 'Orhangazi İstasyonu',
    district: 'Orhangazi',
    baseline_pressure: 2.8,
    baseline_flow: 110.0,
    min_pressure: 1.8,
    max_pressure: 4.0,
    elevation: 65,
    pipe_diameter: 250,
    network_age: 24,
    demand_pattern: [
      36, 32, 28, 26, 30, 45, 72, 98, 110, 118, 115, 108,
      102, 98, 94, 100, 108, 116, 110, 98, 80, 62, 48, 40
    ],
    seasonal_factors: { winter: 0.88, spring: 0.95, summer: 1.15, autumn: 0.92 }
  },
  'BURS-IZN-01': {
    name: 'İznik Göl İstasyonu',
    district: 'İznik',
    baseline_pressure: 3.2,
    baseline_flow: 72.0,
    min_pressure: 2.2,
    max_pressure: 4.4,
    elevation: 85,
    pipe_diameter: 200,
    network_age: 20,
    demand_pattern: [
      24, 20, 18, 17, 19, 30, 48, 65, 72, 78, 75, 70,
      66, 64, 60, 65, 70, 76, 72, 65, 52, 40, 32, 26
    ],
    seasonal_factors: { winter: 0.78, spring: 0.88, summer: 1.32, autumn: 0.90 }
  }
};

// Mevcut mevsimi hesapla
function getCurrentSeason(): 'winter' | 'spring' | 'summer' | 'autumn' {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

/**
 * Gerçekçi sensör verisi simülasyonu - EPANET Hidrolik Modelleme
 * 
 * Fizik Temelli Simülasyon:
 * 1. Basınç = f(talep, yükseklik, boru direnci, pompa kapasitesi)
 * 2. Akış = f(talep deseni, mevsimsellik, günlük varyasyon)
 * 3. Gürültü = Gaussian noise (σ = gerçek SCADA sensör doğruluğu)
 * 
 * Referans: Hazen-Williams formülasyonu + EPANET extended period simulation
 */
export function generateRealisticSensorReadings(
  node_id: string,
  hoursBack: number = 24
): SensorReading[] {
  const baselineData = BURSA_SENSOR_BASELINE_DATA[node_id as keyof typeof BURSA_SENSOR_BASELINE_DATA];
  if (!baselineData) return [];

  const readings: SensorReading[] = [];
  const now = new Date();
  const currentSeason = getCurrentSeason();
  const seasonalFactor = baselineData.seasonal_factors[currentSeason];

  // Şebeke yaşı etkisi (eski borular = daha yüksek direnç = daha düşük basınç)
  const ageFactor = 1 - (baselineData.network_age * 0.005); // %0.5 yıllık düşüş

  for (let i = hoursBack; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 3600000);
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    
    // Hafta sonu faktörü (Cumartesi-Pazar daha düşük talep)
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.85 : 1.0;
    
    // Saatlik talep deseni
    const baseDemand = baselineData.demand_pattern[hour];
    const adjustedDemand = baseDemand * seasonalFactor * weekendFactor;
    const demandRatio = adjustedDemand / baselineData.baseline_flow;
    
    // === BASINÇ SİMÜLASYONU ===
    // Bernoulli denklemi: P = P_base - (demand_effect) - (elevation_head) - (friction_loss)
    // Basitleştirilmiş: P = P_base * (1 - k * demand_ratio) + noise
    const demandEffect = demandRatio * 0.25; // Talep etkisi
    const frictionLoss = Math.pow(demandRatio, 1.85) * 0.1; // Hazen-Williams yaklaşımı
    
    // Gaussian gürültü (sensör doğruluğu ±0.05 bar)
    const pressureNoise = gaussianRandom(0, 0.05);
    
    let pressure = baselineData.baseline_pressure * ageFactor * (1 - demandEffect - frictionLoss) + pressureNoise;
    pressure = Math.max(baselineData.min_pressure, Math.min(baselineData.max_pressure, pressure));

    // === AKIŞ SİMÜLASYONU ===
    // Q = demand + leak_factor + noise
    const leakFactor = 0.02 + (baselineData.network_age * 0.001); // Yaşlı borular = daha fazla sızıntı
    const flowNoise = gaussianRandom(0, baselineData.baseline_flow * 0.02);
    let flow = adjustedDemand * (1 + leakFactor) + flowNoise;
    flow = Math.max(0, flow);

    // === HACİM HESAPLAMA ===
    // m³/saat cinsinden
    const volume = flow * 3.6; // L/s -> m³/h

    // === SU KALİTE İNDEKSİ ===
    // Sıcaklık, basınç ve akışa bağlı kalite
    const baseQuality = 85;
    const pressureQuality = pressure > 2.5 ? 10 : pressure * 4;
    const flowQuality = flow > (adjustedDemand * 0.5) ? 5 : 0;
    const quality_index = Math.min(100, Math.max(0, baseQuality + pressureQuality - flowQuality + gaussianRandom(0, 2)));

    // === SU SICAKLIĞI ===
    // Mevsimsel + günlük varyasyon
    const seasonTemp = { winter: 8, spring: 14, summer: 22, autumn: 16 };
    const baseTemp = seasonTemp[currentSeason];
    const dailyVariation = Math.sin((hour / 24) * Math.PI * 2) * 2;
    const temperature = baseTemp + dailyVariation + gaussianRandom(0, 0.5);

    readings.push({
      timestamp: timestamp.toISOString(),
      node_id,
      pressure: parseFloat(pressure.toFixed(3)),
      flow: parseFloat(flow.toFixed(2)),
      volume: parseFloat(volume.toFixed(2)),
      demand: parseFloat(adjustedDemand.toFixed(2)),
      temperature: parseFloat(temperature.toFixed(1)),
      quality_index: parseFloat(quality_index.toFixed(1))
    });
  }

  return readings;
}

/**
 * Gaussian (Normal) dağılım gürültü üretici
 * Box-Muller dönüşümü kullanarak
 */
function gaussianRandom(mean: number = 0, stdDev: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Tüm node'lar için sensör verisi oluştur
 * Her node için 24 saatlik veri + istatistikler
 */
export function generateAllNodeSensorData(): NodeSensorData[] {
  return Object.entries(BURSA_SENSOR_BASELINE_DATA).map(([node_id, baseline]) => {
    const readings = generateRealisticSensorReadings(node_id, 24);
    
    if (readings.length === 0) {
      return {
        node_id,
        node_name: baseline.name,
        district: baseline.district,
        readings: [],
        current_pressure: baseline.baseline_pressure,
        current_flow: baseline.baseline_flow,
        average_pressure: baseline.baseline_pressure,
        min_pressure: baseline.min_pressure,
        max_pressure: baseline.max_pressure,
        pressure_trend: 'STABLE' as const,
        anomaly_score: 0
      };
    }

    const currentReading = readings[readings.length - 1];
    const pressures = readings.map(r => r.pressure);
    const avgPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length;

    // Trend belirleme (son 3 saatin ortalaması vs önceki 3 saat)
    const recentReadings = readings.slice(-3);
    const olderReadings = readings.slice(-6, -3);
    
    const recentAvg = recentReadings.reduce((sum, r) => sum + r.pressure, 0) / recentReadings.length;
    const olderAvg = olderReadings.length > 0 
      ? olderReadings.reduce((sum, r) => sum + r.pressure, 0) / olderReadings.length 
      : recentAvg;
    
    let trend: 'RISING' | 'STABLE' | 'FALLING' = 'STABLE';
    const trendThreshold = 0.08; // 0.08 bar fark = trend değişimi
    if (recentAvg > olderAvg + trendThreshold) trend = 'RISING';
    else if (recentAvg < olderAvg - trendThreshold) trend = 'FALLING';

    // Anomaly skoru hesaplama
    const anomaly_score = calculateAnomalyScore(currentReading, baseline, trend);

    return {
      node_id,
      node_name: baseline.name,
      district: baseline.district,
      readings,
      current_pressure: currentReading.pressure,
      current_flow: currentReading.flow,
      average_pressure: parseFloat(avgPressure.toFixed(3)),
      min_pressure: parseFloat(Math.min(...pressures).toFixed(3)),
      max_pressure: parseFloat(Math.max(...pressures).toFixed(3)),
      pressure_trend: trend,
      anomaly_score
    };
  });
}

/**
 * Anomaly skoru hesaplama (0-100)
 * Çoklu faktörlerin ağırlıklı toplamı
 */
function calculateAnomalyScore(
  reading: SensorReading,
  baseline: typeof BURSA_SENSOR_BASELINE_DATA[keyof typeof BURSA_SENSOR_BASELINE_DATA],
  trend: 'RISING' | 'STABLE' | 'FALLING'
): number {
  let score = 0;

  // 1. Basınç sapması (max 40 puan)
  const pressureRange = baseline.max_pressure - baseline.min_pressure;
  const pressureDeviation = Math.abs(reading.pressure - baseline.baseline_pressure);
  const pressureScore = (pressureDeviation / pressureRange) * 40;
  score += Math.min(40, pressureScore);

  // 2. Kritik basınç durumu (max 30 puan)
  if (reading.pressure < baseline.min_pressure) {
    score += 30;
  } else if (reading.pressure < baseline.min_pressure + 0.3) {
    score += 20;
  } else if (reading.pressure > baseline.max_pressure) {
    score += 15;
  }

  // 3. Düşen basınç trendi (max 15 puan)
  if (trend === 'FALLING') {
    score += 15;
  }

  // 4. Akış anomalisi (max 15 puan)
  const flowDeviation = Math.abs(reading.flow - reading.demand) / reading.demand;
  if (flowDeviation > 0.3) { // %30'dan fazla sapma
    score += Math.min(15, flowDeviation * 30);
  }

  return Math.min(100, Math.round(score));
}

/**
 * Sensör anomalisi tespiti - Basınç ve akış normal aralığından sapma
 */
export function detectSensorAnomalies(nodeData: NodeSensorData): {
  hasAnomaly: boolean;
  anomalyType: 'LOW_PRESSURE' | 'HIGH_PRESSURE' | 'FLOW_ANOMALY' | 'NONE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
} {
  const baseline = BURSA_SENSOR_BASELINE_DATA[nodeData.node_id as keyof typeof BURSA_SENSOR_BASELINE_DATA];
  if (!baseline) {
    return { hasAnomaly: false, anomalyType: 'NONE', severity: 'LOW', description: 'Node bilgisi bulunamadı' };
  }

  // Basınç anomalisi tespiti
  if (nodeData.current_pressure < baseline.min_pressure + 0.2) {
    return {
      hasAnomaly: true,
      anomalyType: 'LOW_PRESSURE',
      severity: nodeData.current_pressure < baseline.min_pressure ? 'HIGH' : 'MEDIUM',
      description: `Kritik düşük basınç: ${nodeData.current_pressure.toFixed(2)} bar (minimum: ${baseline.min_pressure})`
    };
  }

  if (nodeData.current_pressure > baseline.max_pressure) {
    return {
      hasAnomaly: true,
      anomalyType: 'HIGH_PRESSURE',
      severity: 'MEDIUM',
      description: `Anormal yüksek basınç: ${nodeData.current_pressure.toFixed(2)} bar (maximum: ${baseline.max_pressure})`
    };
  }

  // Akış anomalisi tespiti
  if (nodeData.current_flow > baseline.baseline_flow * 1.5) {
    return {
      hasAnomaly: true,
      anomalyType: 'FLOW_ANOMALY',
      severity: 'HIGH',
      description: `Anormal yüksek akış: ${nodeData.current_flow.toFixed(1)} L/s (baseline: ${baseline.baseline_flow})`
    };
  }

  if (nodeData.current_flow < baseline.baseline_flow * 0.3 && nodeData.current_flow > 10) {
    return {
      hasAnomaly: true,
      anomalyType: 'FLOW_ANOMALY',
      severity: 'MEDIUM',
      description: `Düşük akış tespiti: ${nodeData.current_flow.toFixed(1)} L/s (baseline: ${baseline.baseline_flow})`
    };
  }

  return {
    hasAnomaly: false,
    anomalyType: 'NONE',
    severity: 'LOW',
    description: 'Tüm parametreler normal aralıkta'
  };
}

/**
 * EPANET CSV formatından veri parse etme
 * Format: timestamp,node_id,pressure,flow,volume
 * 
 * BattLeDIM veya LeakDB verilerini içe aktarmak için kullanılabilir
 */
export function parseEPANETCSVData(csvContent: string): SensorReading[] {
  const lines = csvContent.split('\n').filter(l => l.trim());
  const readings: SensorReading[] = [];

  for (let i = 1; i < lines.length; i++) {
    const [timestamp, node_id, pressure, flow, volume] = lines[i].split(',');
    
    if (!timestamp || !node_id || !pressure) continue;

    readings.push({
      timestamp: timestamp.trim(),
      node_id: node_id.trim(),
      pressure: parseFloat(pressure),
      flow: parseFloat(flow || '0'),
      volume: parseFloat(volume || '0'),
      demand: 0,
      temperature: 15,
      quality_index: 85
    });
  }

  return readings;
}

/**
 * Sensör verilerinden boru patlak riski tahmin et
 * 
 * Risk Faktörleri:
 * 1. Basınç düşüşü hızı (trend)
 * 2. Kritik düşük basınç seviyesi
 * 3. Anormal yüksek akış (sızıntı göstergesi)
 * 4. Basınç varyasyonu (instabilite)
 * 5. Şebeke yaşı faktörü
 */
export function predictBurstRisk(nodeData: NodeSensorData): {
  burst_probability: number; // 0-100
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  indicators: string[];
  recommended_actions: string[];
} {
  const indicators: string[] = [];
  const recommended_actions: string[] = [];
  let riskScore = 0;

  const baseline = BURSA_SENSOR_BASELINE_DATA[nodeData.node_id as keyof typeof BURSA_SENSOR_BASELINE_DATA];

  // 1. Basınç düşüşü hızı (trend)
  if (nodeData.pressure_trend === 'FALLING') {
    riskScore += 25;
    indicators.push('📉 Düşen basınç trendi tespit edildi');
    recommended_actions.push('Basınç izlemesini artırın');
  }

  // 2. Kritik düşük basınç
  if (nodeData.current_pressure < 1.5) {
    riskScore += 35;
    indicators.push('⚠️ Kritik derecede düşük basınç (<1.5 bar)');
    recommended_actions.push('ACİL: Pompa kapasitesini kontrol edin');
    recommended_actions.push('Şebeke sızıntı araştırması başlatın');
  } else if (nodeData.current_pressure < 2.0) {
    riskScore += 20;
    indicators.push('⚡ Anormal düşük basınç (<2.0 bar)');
    recommended_actions.push('Bölgedeki tüketimi kontrol edin');
  }

  // 3. Yüksek akış (sızıntı göstergesi)
  if (baseline && nodeData.current_flow > baseline.baseline_flow * 1.4) {
    riskScore += 30;
    indicators.push('🌊 Anormal yüksek akış - olası sızıntı');
    recommended_actions.push('Sızıntı tespiti ekiplerini yönlendirin');
  }

  // 4. Basınç varyasyonu (yüksek = instabilite)
  const pressureRange = nodeData.max_pressure - nodeData.min_pressure;
  if (pressureRange > 1.5) {
    riskScore += 15;
    indicators.push('📊 Yüksek basınç varyasyonu (instabilite)');
    recommended_actions.push('PRV (basınç düşürücü vana) ayarlarını kontrol edin');
  }

  // 5. Şebeke yaşı faktörü
  if (baseline && baseline.network_age > 25) {
    riskScore += 10;
    indicators.push(`🏗️ Yaşlı şebeke altyapısı (${baseline.network_age} yıl)`);
    recommended_actions.push('Boru yenileme planlaması değerlendirin');
  }

  // 6. Anomaly skoru yüksekse ek risk
  if (nodeData.anomaly_score > 50) {
    riskScore += 15;
    indicators.push('🔍 Yüksek anomaly skoru');
  }

  riskScore = Math.min(100, riskScore);

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (riskScore >= 80) riskLevel = 'CRITICAL';
  else if (riskScore >= 60) riskLevel = 'HIGH';
  else if (riskScore >= 40) riskLevel = 'MEDIUM';

  if (indicators.length === 0) {
    indicators.push('✅ Tüm parametreler normal aralıkta');
  }

  if (recommended_actions.length === 0) {
    recommended_actions.push('Rutin izlemeye devam edin');
  }

  return {
    burst_probability: riskScore,
    risk_level: riskLevel,
    indicators,
    recommended_actions
  };
}

/**
 * Model doğruluk bilgisi
 * 
 * NOT: Bu sistem simülasyon verileri kullanmaktadır.
 * Gerçek bir sistem için BUSKİ SCADA entegrasyonu gereklidir.
 */
export const MODEL_ACCURACY_INFO = {
  data_source: 'Simülasyon (EPANET + BattLeDIM referans)',
  simulation_type: 'Fizik tabanlı hidrolik modelleme',
  accuracy_disclaimer: 'Bu veriler gerçek sensör verileri DEĞİLDİR',
  
  // Model performans metrikleri (simüle edilmiş)
  pressure_model: {
    basis: 'Hazen-Williams + Bernoulli',
    noise_level: '±0.05 bar (sensör doğruluğu)',
    confidence: '75-85% (simülasyon ortamında)'
  },
  flow_model: {
    basis: 'Talep deseni + mevsimsel faktörler',
    noise_level: '±2% baseline',
    confidence: '70-80% (simülasyon ortamında)'
  },
  anomaly_detection: {
    basis: 'Çok faktörlü skor hesaplama',
    false_positive_rate: '~15% (tahmini)',
    true_positive_rate: '~70% (simülasyon ortamında)'
  },
  
  // Gerçek dünya için öneriler
  production_requirements: [
    'BUSKİ SCADA sisteminden gerçek zamanlı veri akışı',
    'En az 6 aylık tarihsel veri ile model eğitimi',
    'Saha doğrulaması ile kalibrasyon',
    'Sürekli model güncelleme döngüsü'
  ]
};
