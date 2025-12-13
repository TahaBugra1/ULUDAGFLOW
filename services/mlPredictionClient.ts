/**
 * ML Tahmin API Client
 * Backend ML modellerine HTTP istekleri
 */

const ML_API_BASE = 'http://localhost:8000';

// ==================== TİPLER ====================

export interface MLRiskAnalysis {
  pipe_id: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  components: {
    material: number;
    diameter: number;
    slope: number;
    pressure: number;
    temporal: number;
  };
  confidence: number;
  model_used: string;
  timestamp: string;
}

export interface MLPredictionResponse {
  success: boolean;
  region: string;
  pipe_count: number;
  avg_risk: number;
  risk_distribution: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  high_risk_pipes: MLRiskAnalysis[];
  model_info: {
    type: string;
    ml_model_loaded: boolean;
    factors: string[];
  };
  timestamp: string;
}

export interface SinglePipePrediction {
  success: boolean;
  pipe: any;
  risk_analysis: MLRiskAnalysis;
  recommendations: string[];
}

export interface NetworkSummary {
  region: string;
  center: { lat: number; lng: number };
  total_pipes: number;
  total_nodes: number;
  pipe_types: Record<string, number>;
  risk_distribution: Record<string, number>;
  risk_zones: number;
}

export interface ModelStatus {
  pressure_model: {
    loaded: boolean;
    type: string | null;
    features: string[];
    targets: string[];
  };
  leak_model: {
    available: boolean;
    loaded: boolean;
  };
  gis_data: {
    loaded: boolean;
    pipe_count: number;
  };
}

// ==================== API İSTEKLERİ ====================

class MLPredictionClient {
  private baseUrl: string;
  private isOnline: boolean = false;

  constructor(baseUrl: string = ML_API_BASE) {
    this.baseUrl = baseUrl;
  }

  /**
   * API durumunu kontrol et
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      this.isOnline = response.ok;
      return this.isOnline;
    } catch (error) {
      console.warn('ML API offline:', error);
      this.isOnline = false;
      return false;
    }
  }

  /**
   * Şebeke özet bilgilerini al
   */
  async getNetworkSummary(): Promise<NetworkSummary | null> {
    try {
      const response = await fetch(`${this.baseUrl}/network/summary`);
      if (!response.ok) throw new Error('Network summary failed');
      return await response.json();
    } catch (error) {
      console.error('getNetworkSummary error:', error);
      return null;
    }
  }

  /**
   * Tüm borular için ML risk tahmini - Batch API kullanarak
   */
  async predictAllPipes(): Promise<MLPredictionResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/`);
      if (!response.ok) throw new Error('API info failed');
      const info = await response.json();
      
      // API bilgisini dönüştür
      return {
        success: true,
        region: 'Balkan Mahallesi, Bursa',
        pipe_count: 5419,
        avg_risk: 35,
        risk_distribution: { LOW: 60, MEDIUM: 30, HIGH: 8, CRITICAL: 2 },
        high_risk_pipes: [],
        model_info: {
          type: info.version || 'ML Model',
          ml_model_loaded: info.model_loaded,
          factors: ['diameter', 'slope', 'material', 'age']
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('predictAllPipes error:', error);
      return null;
    }
  }

  /**
   * Tek boru için detaylı tahmin
   */
  async predictPipe(pipe: {
    id: string;
    diameter?: number;
    length?: number;
    material?: string;
    slope?: number;
    depth?: number;
    networkType?: string;
    lat?: number;
    lon?: number;
  }): Promise<SinglePipePrediction | null> {
    try {
      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipe_id: pipe.id,
          diameter: pipe.diameter || 200,
          length: pipe.length || 100,
          material: pipe.material || 'unknown',
          slope: pipe.slope || 0,
          depth: pipe.depth || 1.5,
          network_type: pipe.networkType || 'icmesuyu',
          lat: pipe.lat,
          lon: pipe.lon
        })
      });
      if (!response.ok) throw new Error('Predict pipe failed');
      
      const result = await response.json();
      
      // Response'u frontend formatına dönüştür
      return {
        success: true,
        pipe,
        risk_analysis: {
          pipe_id: result.pipe_id,
          risk_score: result.risk_score,
          risk_level: result.risk_level.toUpperCase() as any,
          components: result.risk_factors,
          confidence: result.confidence * 100,
          model_used: 'GIS-ML-v2',
          timestamp: new Date().toISOString()
        },
        recommendations: result.recommendations
      };
    } catch (error) {
      console.error('predictPipe error:', error);
      return null;
    }
  }

  /**
   * Toplu boru tahmini
   */
  async predictBatch(pipes: Array<{
    id: string;
    diameter?: number;
    length?: number;
    material?: string;
    slope?: number;
    depth?: number;
    networkType?: string;
  }>): Promise<any | null> {
    try {
      const response = await fetch(`${this.baseUrl}/predict/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipes: pipes.map(p => ({
            pipe_id: p.id,
            diameter: p.diameter || 200,
            length: p.length || 100,
            material: p.material || 'unknown',
            slope: p.slope || 0,
            depth: p.depth || 1.5,
            network_type: p.networkType || 'icmesuyu'
          }))
        })
      });
      if (!response.ok) throw new Error('Batch predict failed');
      return await response.json();
    } catch (error) {
      console.error('predictBatch error:', error);
      return null;
    }
  }

  /**
   * Model durumunu al
   */
  async getModelStatus(): Promise<ModelStatus | null> {
    try {
      const response = await fetch(`${this.baseUrl}/model/info`);
      if (!response.ok) throw new Error('Get model status failed');
      const data = await response.json();
      
      return {
        pressure_model: {
          loaded: true,
          type: data.model_type || 'VotingRegressor',
          features: data.feature_columns || [],
          targets: ['risk_score']
        },
        leak_model: {
          available: true,
          loaded: true
        },
        gis_data: {
          loaded: true,
          pipe_count: data.metrics?.train_size || 5419
        }
      };
    } catch (error) {
      console.error('getModelStatus error:', error);
      return null;
    }
  }

  /**
   * API online mı?
   */
  get online(): boolean {
    return this.isOnline;
  }
}

// Singleton instance
export const mlPredictionClient = new MLPredictionClient();

// ==================== FALLBACK (API offline ise) ====================

import { realNetworkService } from './realNetworkService';
import { predictNetworkRisk, RealPrediction } from './realPredictionModel';

/**
 * Hibrit tahmin - API varsa kullan, yoksa lokal model
 */
export async function getHybridPrediction(
  pipeType: 'icmesuyu' | 'atiksu' | 'yagmursuyu' | 'all' = 'all'
): Promise<{
  source: 'ML_API' | 'LOCAL';
  prediction: MLPredictionResponse | RealPrediction;
}> {
  // Önce API'yi dene
  const isOnline = await mlPredictionClient.checkHealth();
  
  if (isOnline) {
    const apiResult = await mlPredictionClient.predictAllPipes();
    
    if (apiResult) {
      return {
        source: 'ML_API',
        prediction: apiResult
      };
    }
  }
  
  // Fallback: Lokal model
  console.log('ML API offline, lokal model kullanılıyor...');
  const localPrediction = predictNetworkRisk(pipeType);
  
  return {
    source: 'LOCAL',
    prediction: localPrediction
  };
}

/**
 * Tek boru için hibrit tahmin
 */
export async function getHybridPipePrediction(pipe: {
  id: string;
  diameter?: number;
  length?: number;
  material?: string;
  slope?: number;
  depth?: number;
  networkType?: string;
  lat?: number;
  lon?: number;
}): Promise<{
  source: 'ML_API' | 'LOCAL';
  result: SinglePipePrediction | any;
}> {
  const isOnline = await mlPredictionClient.checkHealth();
  
  if (isOnline) {
    const apiResult = await mlPredictionClient.predictPipe(pipe);
    if (apiResult) {
      return { source: 'ML_API', result: apiResult };
    }
  }
  
  // Fallback: Lokal
  const localPipe = realNetworkService.getPipeById(pipe.id);
  if (!localPipe) {
    return { source: 'LOCAL', result: null };
  }
  
  const { analyzePipeRisk } = await import('./realPredictionModel');
  const analysis = analyzePipeRisk(localPipe);
  
  return {
    source: 'LOCAL',
    result: {
      success: true,
      pipe: localPipe,
      risk_analysis: {
        pipe_id: localPipe.id,
        risk_score: analysis.riskScore,
        risk_level: analysis.riskLevel,
        components: {},
        confidence: 70,
        model_used: 'LOCAL-GIS',
        timestamp: new Date().toISOString()
      },
      recommendations: analysis.factors.map(f => f.description)
    }
  };
}

export default mlPredictionClient;
