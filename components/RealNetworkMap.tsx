/**
 * Gerçek GIS Verilerine Dayalı Şebeke Haritası
 * Balkan Mahallesi - İçmesuyu, Atıksu, Yağmursuyu
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, AlertTriangle, Droplets, Activity, 
  Filter, Eye, EyeOff, RefreshCw, Info,
  Layers, TrendingUp, Gauge
} from 'lucide-react';
import { realNetworkService, Pipe, NetworkNode, RiskZone } from '../services/realNetworkService';
import { 
  predictNetworkRisk, 
  getRealNetworkDashboard,
  RealPrediction 
} from '../services/realPredictionModel';
import { Complaint } from '../types';

interface RealNetworkMapProps {
  complaints?: Complaint[];
}

type NetworkType = 'all' | 'icmesuyu' | 'atiksu' | 'yagmursuyu';
type ViewMode = 'risk' | 'material' | 'diameter';

export default function RealNetworkMap({ complaints = [] }: RealNetworkMapProps) {
  const [selectedType, setSelectedType] = useState<NetworkType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('risk');
  const [showNodes, setShowNodes] = useState(true);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [selectedPipe, setSelectedPipe] = useState<Pipe | null>(null);
  const [prediction, setPrediction] = useState<RealPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Dashboard verileri
  const dashboard = useMemo(() => getRealNetworkDashboard(), []);
  
  // Filtreli borular
  const pipes = useMemo(() => {
    if (selectedType === 'all') {
      return realNetworkService.getAllPipes();
    }
    return realNetworkService.getPipesByType(selectedType);
  }, [selectedType]);

  // Risk analizi
  useEffect(() => {
    setIsLoading(true);
    const pred = predictNetworkRisk(
      selectedType === 'all' ? 'all' : selectedType, 
      complaints
    );
    setPrediction(pred);
    setIsLoading(false);
  }, [selectedType, complaints]);

  // Renk hesaplama
  const getPipeColor = (pipe: Pipe): string => {
    if (viewMode === 'risk') {
      if (pipe.risk_score >= 60) return '#ef4444'; // Kırmızı
      if (pipe.risk_score >= 40) return '#f97316'; // Turuncu
      if (pipe.risk_score >= 20) return '#eab308'; // Sarı
      return '#22c55e'; // Yeşil
    }
    
    if (viewMode === 'material') {
      const mat = pipe.material.toUpperCase();
      if (mat.includes('BETON')) return '#6b7280';
      if (mat.includes('FDK')) return '#3b82f6';
      if (mat.includes('PE') || mat.includes('HDPE')) return '#10b981';
      if (mat.includes('PVC')) return '#8b5cf6';
      if (mat.includes('CELIK')) return '#f59e0b';
      return '#9ca3af';
    }
    
    if (viewMode === 'diameter') {
      if (pipe.diameter < 100) return '#ef4444';
      if (pipe.diameter < 200) return '#f97316';
      if (pipe.diameter < 400) return '#eab308';
      if (pipe.diameter < 800) return '#22c55e';
      return '#3b82f6';
    }
    
    return '#6b7280';
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'icmesuyu': return '#3b82f6';
      case 'atiksu': return '#8b5cf6';
      case 'yagmursuyu': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'icmesuyu': return 'İçmesuyu';
      case 'atiksu': return 'Atıksu';
      case 'yagmursuyu': return 'Yağmursuyu';
      default: return type;
    }
  };

  const getRiskLevelStyle = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold">Gerçek Şebeke Haritası</h2>
              <p className="text-sm text-blue-100">{dashboard.region}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs bg-white/20 px-2 py-1 rounded">
              {pipes.length} Boru
            </span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded">
              {dashboard.summary.totalLengthKm} km
            </span>
          </div>
        </div>
      </div>

      {/* Kontroller */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-4">
          {/* Şebeke Tipi */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as NetworkType)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tüm Şebekeler</option>
              <option value="icmesuyu">İçmesuyu</option>
              <option value="atiksu">Atıksu</option>
              <option value="yagmursuyu">Yağmursuyu</option>
            </select>
          </div>

          {/* Görünüm Modu */}
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-500" />
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="risk">Risk Skoru</option>
              <option value="material">Malzeme</option>
              <option value="diameter">Çap</option>
            </select>
          </div>

          {/* Toggle'lar */}
          <button
            onClick={() => setShowNodes(!showNodes)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showNodes ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {showNodes ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Noktalar
          </button>

          <button
            onClick={() => setShowRiskZones(!showRiskZones)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showRiskZones ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Risk Bölgeleri
          </button>
        </div>
      </div>

      {/* Ana İçerik */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        
        {/* Harita Alanı (SVG) */}
        <div className="lg:col-span-2 p-4 bg-gray-100 min-h-[400px] relative">
          <svg 
            viewBox="0 0 800 600" 
            className="w-full h-full"
            style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}
          >
            {/* Grid */}
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#cbd5e1" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Borular */}
            {pipes.slice(0, 200).map((pipe, idx) => {
              if (!pipe.coordinates || pipe.coordinates.length < 2) return null;
              
              // Koordinatları SVG'ye dönüştür
              const bounds = dashboard.center;
              const scale = 20000;
              
              const points = pipe.coordinates.map(coord => {
                const x = 400 + (coord[1] - bounds.lng) * scale;
                const y = 300 - (coord[0] - bounds.lat) * scale;
                return `${x},${y}`;
              }).join(' ');
              
              return (
                <polyline
                  key={pipe.id}
                  points={points}
                  fill="none"
                  stroke={getPipeColor(pipe)}
                  strokeWidth={pipe.risk_score >= 50 ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="cursor-pointer hover:stroke-[4] transition-all"
                  onClick={() => setSelectedPipe(pipe)}
                  opacity={selectedPipe && selectedPipe.id !== pipe.id ? 0.3 : 1}
                />
              );
            })}

            {/* Noktalar */}
            {showNodes && realNetworkService.getAllNodes().slice(0, 100).map((node, idx) => {
              const bounds = dashboard.center;
              const scale = 20000;
              const x = 400 + (node.lng - bounds.lng) * scale;
              const y = 300 - (node.lat - bounds.lat) * scale;
              
              if (x < 0 || x > 800 || y < 0 || y > 600) return null;
              
              return (
                <circle
                  key={node.id}
                  cx={x}
                  cy={y}
                  r={4}
                  fill={getTypeColor(node.type.split('_')[0])}
                  stroke="white"
                  strokeWidth={1}
                  className="cursor-pointer"
                />
              );
            })}

            {/* Risk Bölgeleri */}
            {showRiskZones && realNetworkService.getRiskZones().map((zone, idx) => {
              const bounds = dashboard.center;
              const scale = 20000;
              const x = 400 + (zone.lng - bounds.lng) * scale;
              const y = 300 - (zone.lat - bounds.lat) * scale;
              
              return (
                <g key={zone.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={15}
                    fill="rgba(239, 68, 68, 0.3)"
                    stroke="#ef4444"
                    strokeWidth={2}
                  />
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#ef4444"
                    fontWeight="bold"
                  >
                    !
                  </text>
                </g>
              );
            })}

            {/* Merkez işareti */}
            <circle cx={400} cy={300} r={6} fill="#1e40af" stroke="white" strokeWidth={2} />
            <text x={400} y={320} textAnchor="middle" fontSize="10" fill="#1e40af">
              Merkez
            </text>
          </svg>

          {/* Lejand */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
            <div className="font-medium mb-2">
              {viewMode === 'risk' ? 'Risk Seviyesi' : viewMode === 'material' ? 'Malzeme' : 'Çap (mm)'}
            </div>
            {viewMode === 'risk' && (
              <div className="space-y-1">
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-green-500 rounded"></span> Düşük (0-20)</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-yellow-500 rounded"></span> Orta (20-40)</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-orange-500 rounded"></span> Yüksek (40-60)</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-red-500 rounded"></span> Kritik (60+)</div>
              </div>
            )}
            {viewMode === 'material' && (
              <div className="space-y-1">
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-gray-500 rounded"></span> Beton</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-blue-500 rounded"></span> FDK</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-green-500 rounded"></span> PE/HDPE</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-purple-500 rounded"></span> PVC</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-amber-500 rounded"></span> Çelik</div>
              </div>
            )}
            {viewMode === 'diameter' && (
              <div className="space-y-1">
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-red-500 rounded"></span> &lt;100</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-orange-500 rounded"></span> 100-200</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-yellow-500 rounded"></span> 200-400</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-green-500 rounded"></span> 400-800</div>
                <div className="flex items-center gap-2"><span className="w-4 h-1 bg-blue-500 rounded"></span> &gt;800</div>
              </div>
            )}
          </div>
        </div>

        {/* Sağ Panel */}
        <div className="border-l border-gray-200 bg-white">
          {/* Tahmin Sonucu */}
          {prediction && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Risk Analizi</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskLevelStyle(prediction.riskLevel)}`}>
                  {prediction.riskLevel}
                </span>
              </div>
              
              {/* Risk Gauge */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-500">Risk Skoru</span>
                  <span className="font-bold text-lg">{prediction.riskScore}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      prediction.riskScore >= 60 ? 'bg-red-500' :
                      prediction.riskScore >= 40 ? 'bg-orange-500' :
                      prediction.riskScore >= 20 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${prediction.riskScore}%` }}
                  />
                </div>
              </div>

              {/* Güven Seviyesi */}
              <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                <span>Güven Seviyesi</span>
                <span className="font-medium">%{prediction.confidenceLevel.toFixed(0)}</span>
              </div>

              {/* Etkilenen Borular */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Riskli Boru Sayısı</span>
                <span className="font-medium text-orange-600">{prediction.affectedPipes}</span>
              </div>
            </div>
          )}

          {/* Şebeke İstatistikleri */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900 mb-3">Şebeke Tipleri</h3>
            <div className="space-y-3">
              {Object.entries(dashboard.networkTypes).map(([type, data]: [string, any]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getTypeColor(type) }}
                    />
                    <span className="text-sm text-gray-700">{getTypeLabel(type)}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{data.pipeCount} hat</div>
                    <div className="text-xs text-gray-500">
                      Risk: <span className={
                        data.riskLevel === 'HIGH' || data.riskLevel === 'CRITICAL' ? 'text-red-600' :
                        data.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
                      }>{data.riskScore}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seçili Boru Detayı */}
          {selectedPipe && (
            <div className="p-4 border-b border-gray-200 bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Seçili Boru</h3>
                <button 
                  onClick={() => setSelectedPipe(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">ID:</span>
                  <span className="font-mono text-xs">{selectedPipe.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tip:</span>
                  <span>{getTypeLabel(selectedPipe.type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Malzeme:</span>
                  <span>{selectedPipe.material || 'Bilinmiyor'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Çap:</span>
                  <span>{selectedPipe.diameter} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Uzunluk:</span>
                  <span>{selectedPipe.length.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Risk:</span>
                  <span className={
                    selectedPipe.risk_score >= 50 ? 'text-red-600 font-bold' :
                    selectedPipe.risk_score >= 30 ? 'text-orange-600' : 'text-green-600'
                  }>{selectedPipe.risk_score}</span>
                </div>
              </div>
            </div>
          )}

          {/* Öneriler */}
          {prediction && prediction.recommendedActions.length > 0 && (
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-2">Öneriler</h3>
              <ul className="space-y-2">
                {prediction.recommendedActions.slice(0, 3).map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-blue-500 mt-0.5">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Alt Bilgi */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>Veri Kaynağı: BUSKİ GIS Shapefile</span>
          <span>Bölge: {dashboard.region}</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-green-500" />
          <span>Gerçek Zamanlı</span>
        </div>
      </div>
    </div>
  );
}
