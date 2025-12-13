/**
 * Gerçek Su Şebekesi Veri Servisi
 * Balkan Mahallesi - İçmesuyu, Atıksu, Yağmursuyu GIS Verileri
 * ML API üzerinden çalışır
 */

import realNetworkData from './realNetworkData.json';

// ==================== TİP TANIMLARI ====================

export interface Pipe {
  id: string;
  type: 'icmesuyu' | 'atiksu' | 'yagmursuyu';
  subtype: string;
  material: string;
  diameter: number;
  length: number;
  status?: string;
  slope?: string;
  risk_score: number;
  coordinates: [number, number][]; // [lat, lng]
}

export interface NetworkNode {
  id: string;
  type: string;
  lat: number;
  lng: number;
  depth?: number;
  status?: string;
  risk_score?: number;
}

export interface RiskZone {
  id: string;
  pipe_id: string;
  type: string;
  risk_score: number;
  lat: number;
  lng: number;
  reason: string;
}

export interface NetworkSummary {
  icmesuyu: { hat_sayisi: number; nokta_sayisi: number };
  atiksu: { hat_sayisi: number; nokta_sayisi: number };
  yagmursuyu: { hat_sayisi: number; nokta_sayisi: number };
}

export interface RealNetworkData {
  generated_at: string;
  region: string;
  center: { lat: number; lng: number };
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  summary: NetworkSummary;
  pipes: Pipe[];
  nodes: NetworkNode[];
  risk_zones: RiskZone[];
}

// ==================== VERİ ERİŞİM SERVİSİ ====================

class RealNetworkService {
  private data: RealNetworkData;

  constructor() {
    this.data = realNetworkData as RealNetworkData;
  }

  // Genel istatistikler
  getSummary(): NetworkSummary {
    return this.data.summary;
  }

  getRegion(): string {
    return this.data.region;
  }

  getCenter(): { lat: number; lng: number } {
    return this.data.center;
  }

  getBounds() {
    return this.data.bounds;
  }

  // ==================== BORU VERİLERİ ====================

  getAllPipes(): Pipe[] {
    return this.data.pipes;
  }

  getPipesByType(type: 'icmesuyu' | 'atiksu' | 'yagmursuyu'): Pipe[] {
    return this.data.pipes.filter(p => p.type === type);
  }

  getPipeById(id: string): Pipe | undefined {
    return this.data.pipes.find(p => p.id === id);
  }

  getHighRiskPipes(threshold: number = 40): Pipe[] {
    return this.data.pipes.filter(p => p.risk_score >= threshold);
  }

  getPipesByMaterial(material: string): Pipe[] {
    return this.data.pipes.filter(p => 
      p.material.toLowerCase().includes(material.toLowerCase())
    );
  }

  // ==================== NOKTA VERİLERİ ====================

  getAllNodes(): NetworkNode[] {
    return this.data.nodes;
  }

  getNodesByType(type: string): NetworkNode[] {
    return this.data.nodes.filter(n => n.type === type);
  }

  getNodeById(id: string): NetworkNode | undefined {
    return this.data.nodes.find(n => n.id === id);
  }

  // ==================== RİSK ANALİZİ ====================

  getRiskZones(): RiskZone[] {
    return this.data.risk_zones;
  }

  getRiskStatistics() {
    const pipes = this.data.pipes;
    
    const lowRisk = pipes.filter(p => p.risk_score < 30).length;
    const mediumRisk = pipes.filter(p => p.risk_score >= 30 && p.risk_score < 60).length;
    const highRisk = pipes.filter(p => p.risk_score >= 60).length;
    
    const avgRisk = pipes.reduce((sum, p) => sum + p.risk_score, 0) / pipes.length;
    
    return {
      total: pipes.length,
      lowRisk,
      mediumRisk,
      highRisk,
      averageRisk: Math.round(avgRisk * 10) / 10,
      distribution: {
        low: Math.round((lowRisk / pipes.length) * 100),
        medium: Math.round((mediumRisk / pipes.length) * 100),
        high: Math.round((highRisk / pipes.length) * 100)
      }
    };
  }

  // ==================== MALZEME ANALİZİ ====================

  getMaterialDistribution() {
    const materials: Record<string, number> = {};
    
    this.data.pipes.forEach(pipe => {
      const mat = pipe.material || 'Bilinmiyor';
      materials[mat] = (materials[mat] || 0) + 1;
    });
    
    return Object.entries(materials)
      .map(([material, count]) => ({ material, count }))
      .sort((a, b) => b.count - a.count);
  }

  getDiameterDistribution() {
    const diameters: Record<number, number> = {};
    
    this.data.pipes.forEach(pipe => {
      if (pipe.diameter > 0) {
        diameters[pipe.diameter] = (diameters[pipe.diameter] || 0) + 1;
      }
    });
    
    return Object.entries(diameters)
      .map(([diameter, count]) => ({ diameter: Number(diameter), count }))
      .sort((a, b) => a.diameter - b.diameter);
  }

  // ==================== UZUNLUK İSTATİSTİKLERİ ====================

  getTotalLength() {
    const icmesuyu = this.getPipesByType('icmesuyu')
      .reduce((sum, p) => sum + p.length, 0);
    const atiksu = this.getPipesByType('atiksu')
      .reduce((sum, p) => sum + p.length, 0);
    const yagmursuyu = this.getPipesByType('yagmursuyu')
      .reduce((sum, p) => sum + p.length, 0);
    
    return {
      icmesuyu: Math.round(icmesuyu),
      atiksu: Math.round(atiksu),
      yagmursuyu: Math.round(yagmursuyu),
      total: Math.round(icmesuyu + atiksu + yagmursuyu),
      totalKm: Math.round((icmesuyu + atiksu + yagmursuyu) / 100) / 10
    };
  }

  // ==================== KONUM BAZLI SORGULAR ====================

  getPipesInBounds(
    minLat: number, maxLat: number, 
    minLng: number, maxLng: number
  ): Pipe[] {
    return this.data.pipes.filter(pipe => {
      return pipe.coordinates.some(coord => 
        coord[0] >= minLat && coord[0] <= maxLat &&
        coord[1] >= minLng && coord[1] <= maxLng
      );
    });
  }

  getNodesInBounds(
    minLat: number, maxLat: number, 
    minLng: number, maxLng: number
  ): NetworkNode[] {
    return this.data.nodes.filter(node => 
      node.lat >= minLat && node.lat <= maxLat &&
      node.lng >= minLng && node.lng <= maxLng
    );
  }

  findNearestPipe(lat: number, lng: number): Pipe | null {
    let nearest: Pipe | null = null;
    let minDistance = Infinity;

    this.data.pipes.forEach(pipe => {
      pipe.coordinates.forEach(coord => {
        const distance = this.calculateDistance(lat, lng, coord[0], coord[1]);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = pipe;
        }
      });
    });

    return nearest;
  }

  findNearestNode(lat: number, lng: number): NetworkNode | null {
    let nearest: NetworkNode | null = null;
    let minDistance = Infinity;

    this.data.nodes.forEach(node => {
      const distance = this.calculateDistance(lat, lng, node.lat, node.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = node;
      }
    });

    return nearest;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ==================== TAHMİN MODELİ İÇİN VERİLER ====================

  /**
   * Tahmin modeli için hazır veri seti döndürür
   */
  getDataForPrediction() {
    const pipes = this.data.pipes;
    const nodes = this.data.nodes;
    
    return {
      // Genel metrikler
      totalPipes: pipes.length,
      totalNodes: nodes.length,
      avgRiskScore: pipes.reduce((sum, p) => sum + p.risk_score, 0) / pipes.length,
      
      // Tip bazlı dağılım
      pipesByType: {
        icmesuyu: this.getPipesByType('icmesuyu').length,
        atiksu: this.getPipesByType('atiksu').length,
        yagmursuyu: this.getPipesByType('yagmursuyu').length
      },
      
      // Malzeme bazlı risk
      materialRisk: this.calculateMaterialRisk(),
      
      // Risk dağılımı
      riskDistribution: this.getRiskStatistics().distribution,
      
      // Kritik noktalar
      criticalPipes: this.getHighRiskPipes(50),
      
      // Bölge bilgisi
      region: this.data.region,
      center: this.data.center
    };
  }

  private calculateMaterialRisk(): Record<string, number> {
    const materialRisks: Record<string, { total: number; count: number }> = {};
    
    this.data.pipes.forEach(pipe => {
      const mat = pipe.material || 'Bilinmiyor';
      if (!materialRisks[mat]) {
        materialRisks[mat] = { total: 0, count: 0 };
      }
      materialRisks[mat].total += pipe.risk_score;
      materialRisks[mat].count += 1;
    });
    
    const result: Record<string, number> = {};
    Object.entries(materialRisks).forEach(([mat, data]) => {
      result[mat] = Math.round((data.total / data.count) * 10) / 10;
    });
    
    return result;
  }

  // ==================== HARİTA VERİLERİ (GeoJSON) ====================

  toGeoJSON(type?: 'icmesuyu' | 'atiksu' | 'yagmursuyu') {
    const pipes = type ? this.getPipesByType(type) : this.data.pipes;
    
    return {
      type: 'FeatureCollection',
      features: pipes.map(pipe => ({
        type: 'Feature',
        properties: {
          id: pipe.id,
          pipeType: pipe.type,
          material: pipe.material,
          diameter: pipe.diameter,
          riskScore: pipe.risk_score,
          status: pipe.status
        },
        geometry: {
          type: 'LineString',
          coordinates: pipe.coordinates.map(c => [c[1], c[0]]) // [lng, lat] for GeoJSON
        }
      }))
    };
  }

  nodesToGeoJSON(type?: string) {
    const nodes = type ? this.getNodesByType(type) : this.data.nodes;
    
    return {
      type: 'FeatureCollection',
      features: nodes.map(node => ({
        type: 'Feature',
        properties: {
          id: node.id,
          nodeType: node.type,
          depth: node.depth,
          riskScore: node.risk_score
        },
        geometry: {
          type: 'Point',
          coordinates: [node.lng, node.lat]
        }
      }))
    };
  }
}

// Singleton instance
export const realNetworkService = new RealNetworkService();

// Export data types and service
export default realNetworkService;
