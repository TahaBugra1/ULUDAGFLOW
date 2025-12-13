/**
 * Bursa Su Dağıtım Ağı - Node Koordinatları ve Basınç Sensörleri
 * Bursa ili 17 ilçesinin su dağıtım node'ları
 */

export interface BursaNode {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  node_type: 'PUMP' | 'RESERVOIR' | 'JUNCTION' | 'TANK';
  elevation: number; // meters
  base_demand: number; // L/s
}

export interface PressureReading {
  node_id: string;
  timestamp: string;
  pressure: number; // bar
  flow: number; // L/s
  volume: number; // m3
  leak_detected: boolean;
}

/**
 * Bursa'nın 17 ilçesinin merkez node'ları
 * Koordinatlar: (Latitude, Longitude) - WGS84
 */
export const BURSA_NETWORK_NODES: BursaNode[] = [
  // Nilüfer (Bursa'nın en büyük ilçesi)
  {
    id: 'BURS-NIL-01',
    name: 'Nilüfer Ana Dağıtım Merkezi',
    district: 'Nilüfer',
    latitude: 40.1719,
    longitude: 29.1681,
    node_type: 'PUMP',
    elevation: 85,
    base_demand: 450.5
  },
  {
    id: 'BURS-NIL-02',
    name: 'Nilüfer Mahalle İstasyonu',
    district: 'Nilüfer',
    latitude: 40.2001,
    longitude: 29.1234,
    node_type: 'JUNCTION',
    elevation: 92,
    base_demand: 320.2
  },

  // Osmangazi (İç Bursa)
  {
    id: 'BURS-OSM-01',
    name: 'Osmangazi Merkez İstasyonu',
    district: 'Osmangazi',
    latitude: 40.1865,
    longitude: 29.1867,
    node_type: 'JUNCTION',
    elevation: 95,
    base_demand: 380.8
  },
  {
    id: 'BURS-OSM-02',
    name: 'Cumhuriyet Mahallesi Tank',
    district: 'Osmangazi',
    latitude: 40.1945,
    longitude: 29.2001,
    node_type: 'TANK',
    elevation: 110,
    base_demand: 210.5
  },

  // Yıldırım
  {
    id: 'BURS-YIL-01',
    name: 'Yıldırım Dağıtım Merkezi',
    district: 'Yıldırım',
    latitude: 40.1234,
    longitude: 29.2456,
    node_type: 'PUMP',
    elevation: 75,
    base_demand: 340.3
  },
  {
    id: 'BURS-YIL-02',
    name: 'Yıldırım Doğu İstasyonu',
    district: 'Yıldırım',
    latitude: 40.1456,
    longitude: 29.2789,
    node_type: 'JUNCTION',
    elevation: 82,
    base_demand: 215.7
  },

  // Gemlik
  {
    id: 'BURS-GEM-01',
    name: 'Gemlik Liman İstasyonu',
    district: 'Gemlik',
    latitude: 40.4156,
    longitude: 29.0534,
    node_type: 'PUMP',
    elevation: 5,
    base_demand: 280.2
  },

  // İnegöl
  {
    id: 'BURS-INE-01',
    name: 'İnegöl Merkez İstasyonu',
    district: 'İnegöl',
    latitude: 40.6445,
    longitude: 29.5012,
    node_type: 'PUMP',
    elevation: 410,
    base_demand: 195.4
  },

  // Karacabey
  {
    id: 'BURS-KAR-01',
    name: 'Karacabey Merkez İstasyonu',
    district: 'Karacabey',
    latitude: 40.2156,
    longitude: 28.7234,
    node_type: 'JUNCTION',
    elevation: 42,
    base_demand: 125.3
  },

  // Kestel
  {
    id: 'BURS-KES-01',
    name: 'Kestel Merkez İstasyonu',
    district: 'Kestel',
    latitude: 40.3234,
    longitude: 29.4567,
    node_type: 'JUNCTION',
    elevation: 280,
    base_demand: 148.5
  },

  // Mudanya
  {
    id: 'BURS-MUD-01',
    name: 'Mudanya Liman İstasyonu',
    district: 'Mudanya',
    latitude: 40.3645,
    longitude: 29.1234,
    node_type: 'PUMP',
    elevation: 0,
    base_demand: 165.2
  },

  // Mustafakemalpaşa
  {
    id: 'BURS-MUS-01',
    name: 'Mustafakemalpaşa Merkez',
    district: 'Mustafakemalpaşa',
    latitude: 40.0234,
    longitude: 28.9876,
    node_type: 'JUNCTION',
    elevation: 65,
    base_demand: 98.7
  },

  // Orhangazi
  {
    id: 'BURS-ORH-01',
    name: 'Orhangazi Merkez İstasyonu',
    district: 'Orhangazi',
    latitude: 40.4123,
    longitude: 29.3456,
    node_type: 'JUNCTION',
    elevation: 245,
    base_demand: 112.4
  },

  // Orhaneli
  {
    id: 'BURS-ORL-01',
    name: 'Orhaneli Merkez İstasyonu',
    district: 'Orhaneli',
    latitude: 39.8945,
    longitude: 29.1234,
    node_type: 'JUNCTION',
    elevation: 520,
    base_demand: 87.3
  },

  // Osmangazi (Şehreküstü) - Ek node
  {
    id: 'BURS-OSM-03',
    name: 'Şehreküstü Yüksek Tank',
    district: 'Osmangazi',
    latitude: 40.2134,
    longitude: 29.1567,
    node_type: 'TANK',
    elevation: 180,
    base_demand: 156.8
  },

  // Nilüfer (Ek node)
  {
    id: 'BURS-NIL-03',
    name: 'Nilüfer Batı İstasyonu',
    district: 'Nilüfer',
    latitude: 40.1456,
    longitude: 29.0978,
    node_type: 'JUNCTION',
    elevation: 78,
    base_demand: 189.2
  },

  // İnegöl (Ek node)
  {
    id: 'BURS-INE-02',
    name: 'İnegöl Doğu İstasyonu',
    district: 'İnegöl',
    latitude: 40.6234,
    longitude: 29.6123,
    node_type: 'JUNCTION',
    elevation: 425,
    base_demand: 135.6
  },

  // Yıldırım (Ek node)
  {
    id: 'BURS-YIL-03',
    name: 'Yıldırım Güney Tank',
    district: 'Yıldırım',
    latitude: 40.0945,
    longitude: 29.2123,
    node_type: 'TANK',
    elevation: 95,
    base_demand: 167.4
  }
];

/**
 * Basınç Baseline Değerleri - Bölge ve Yükseklik Bazında
 * Formül: P = P0 - (ρ * g * h) / 100000
 * P0 = 3.5 bar (sistem başlangıç basıncı)
 * ρ = 1000 kg/m³, g = 9.81 m/s²
 */
export const PRESSURE_BASELINE: Record<string, number> = {
  'Nilüfer': 2.8,        // Düşük yükseklik, iyi basınç
  'Osmangazi': 2.9,      // Merkez, orta basınç
  'Yıldırım': 2.7,       // Merkez, düşük basınç
  'Gemlik': 3.2,         // Deniz seviyesi, yüksek basınç
  'İnegöl': 1.9,         // Yüksek rakım, düşük basınç
  'Karacabey': 3.0,      // Düşük rakım
  'Kestel': 2.3,         // Yüksek rakım
  'Mudanya': 3.3,        // Deniz seviyesi
  'Mustafakemalpaşa': 2.95, // Düşük rakım
  'Orhangazi': 2.4,      // Yüksek rakım
  'Orhaneli': 1.8,       // Çok yüksek rakım
};

/**
 * GitHub CSV Verilerini Bursa Node'larıyla Eşleştir
 */
export function mapGitHubDataToBursaNodes(githubPressureData: any[]): PressureReading[] {
  return githubPressureData.map((reading, idx) => {
    const nodeIndex = idx % BURSA_NETWORK_NODES.length;
    const node = BURSA_NETWORK_NODES[nodeIndex];
    
    return {
      node_id: node.id,
      timestamp: reading.timestamp || new Date().toISOString(),
      pressure: reading.pressure || PRESSURE_BASELINE[node.district] || 2.8,
      flow: reading.flow || node.base_demand,
      volume: reading.volume || 0,
      leak_detected: (reading.pressure || 2.8) < (PRESSURE_BASELINE[node.district] || 2.8) * 0.8
    };
  });
}

/**
 * Bölgeye Göre Ortalama Basınç Hesapla
 */
export function calculateDistrictAveragePressure(
  pressureReadings: PressureReading[],
  district: string
): number {
  const districtNodes = BURSA_NETWORK_NODES.filter(n => n.district === district).map(n => n.id);
  const districtReadings = pressureReadings.filter(r => districtNodes.includes(r.node_id));
  
  if (districtReadings.length === 0) return PRESSURE_BASELINE[district] || 2.8;
  
  const sum = districtReadings.reduce((acc, r) => acc + r.pressure, 0);
  return sum / districtReadings.length;
}

/**
 * Sızıntı Tespiti - Basınç Düşüşüne Dayalı
 */
export function detectLeaks(pressureReadings: PressureReading[]): PressureReading[] {
  return pressureReadings.filter(r => {
    const baseline = PRESSURE_BASELINE[
      BURSA_NETWORK_NODES.find(n => n.id === r.node_id)?.district || 'Nilüfer'
    ] || 2.8;
    
    // Kritik: Baseline'ın %20'sinden fazla düşüş
    return r.pressure < baseline * 0.8;
  });
}
