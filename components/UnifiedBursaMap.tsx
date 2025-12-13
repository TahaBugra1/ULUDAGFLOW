import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { NetworkPrediction, predictAllDistricts } from '../services/networkPredictionModel';
import { 
  NodeSensorData, 
  predictBurstRisk,
  generateAllNodeSensorData
} from '../services/sensorDataService';
import { BURSA_NETWORK_NODES, BursaNode } from '../services/bursaNetworkData';
import { Complaint } from '../types';

// ===== MODERN SVG ICONS =====
const createModernIcon = (type: 'sensor' | 'complaint' | 'leak' | 'burst' | 'warning' | 'critical', size = 32) => {
  const icons: Record<string, string> = {
    sensor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2">
      <circle cx="12" cy="12" r="3" fill="#3B82F6"/>
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>
      <circle cx="12" cy="12" r="8" stroke-dasharray="4 2"/>
    </svg>`,
    complaint: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E0B">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>`,
    leak: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#06B6D4">
      <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z"/>
      <circle cx="12" cy="14" r="2" fill="#0891B2"/>
    </svg>`,
    burst: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#EF4444">
      <path d="M12 2L2 12l3 3 7-7 7 7 3-3L12 2z"/>
      <path d="M12 22l-5-5 2-2 3 3 3-3 2 2-5 5z"/>
      <circle cx="12" cy="12" r="4" fill="#DC2626" stroke="#FEE2E2" stroke-width="1"/>
    </svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F97316">
      <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6z"/>
      <path d="M11 10h2v4h-2zm0 6h2v2h-2z" fill="#EA580C"/>
    </svg>`,
    critical: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#DC2626">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z"/>
    </svg>`
  };
  
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">${icons[type]}</div>`,
    className: 'custom-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

// ===== MAP LAYERS ENUM =====
enum MapLayer {
  SENSORS = 'sensors',
  COMPLAINTS = 'complaints',
  LEAKS = 'leaks',
  PREDICTIONS = 'predictions'
}

// ===== SIDE PANEL TYPES =====
interface PanelData {
  type: 'sensor' | 'complaint' | 'leak' | 'prediction' | null;
  data: any;
}

// ===== CRITICAL ZONES =====
const CRITICAL_ZONES = [
  { name: 'Osmangazi Merkez', center: [40.1885, 29.0610] as [number, number], radius: 1200, baseRisk: 0.85, issue: 'Eski altyapı - 40+ yıl' },
  { name: 'Nilüfer Sanayi', center: [40.2150, 28.9800] as [number, number], radius: 800, baseRisk: 0.72, issue: 'Yüksek basınç bölgesi' },
  { name: 'Yıldırım Tarihi', center: [40.1950, 29.0900] as [number, number], radius: 600, baseRisk: 0.78, issue: 'Deprem risk bölgesi' },
  { name: 'Mudanya Sahil', center: [40.3750, 28.8800] as [number, number], radius: 500, baseRisk: 0.65, issue: 'Tuzlu su korozyonu' },
  { name: 'Gemlik Endüstri', center: [40.4300, 29.1600] as [number, number], radius: 700, baseRisk: 0.70, issue: 'Kimyasal kirlilik riski' }
];

// ===== MAIN COMPONENT =====
interface UnifiedBursaMapProps {
  complaints: Complaint[];
  onComplaintClick?: (complaint: Complaint) => void;
}

const UnifiedBursaMap: React.FC<UnifiedBursaMapProps> = ({ complaints, onComplaintClick }) => {
  // State
  const [activeLayers, setActiveLayers] = useState<Set<MapLayer>>(new Set([MapLayer.SENSORS, MapLayer.COMPLAINTS]));
  const [sensorData, setSensorData] = useState<NodeSensorData[]>([]);
  const [predictions, setPredictions] = useState<NetworkPrediction[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<PanelData>({ type: null, data: null });
  const [leakPoints, setLeakPoints] = useState<Array<{id: string, lat: number, lng: number, severity: string, detectedAt: Date}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  
  // Bursa bounds
  const bursaBounds: L.LatLngBoundsExpression = [[39.9, 28.4], [40.8, 29.8]];
  const bursaCenter: [number, number] = [40.1885, 29.0610];

  // Memoized complaint positions
  const complaintPositions = useMemo(() => {
    return complaints.map(complaint => {
      const node = BURSA_NETWORK_NODES.find(n => 
        n.district.toLowerCase() === complaint.district?.toLowerCase()
      );
      
      if (node) {
        return {
          complaint,
          position: [
            node.latitude + (Math.random() - 0.5) * 0.04,
            node.longitude + (Math.random() - 0.5) * 0.06
          ] as [number, number]
        };
      }
      
      return {
        complaint,
        position: [
          40.1885 + (Math.random() - 0.5) * 0.15,
          29.0610 + (Math.random() - 0.5) * 0.2
        ] as [number, number]
      };
    });
  }, [complaints]);

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      
      // Generate sensor data
      const sensors = generateAllNodeSensorData();
      setSensorData(sensors);
      
      // Get unique districts from nodes
      const districts = [...new Set(BURSA_NETWORK_NODES.map(n => n.district))];
      
      // Generate predictions
      const preds = predictAllDistricts(complaints, districts);
      setPredictions(preds);
      
      // Generate leak points for critical zones
      const leaks = CRITICAL_ZONES.filter(z => z.baseRisk > 0.7).map((zone, idx) => ({
        id: `leak-${idx}`,
        lat: zone.center[0] + (Math.random() - 0.5) * 0.01,
        lng: zone.center[1] + (Math.random() - 0.5) * 0.01,
        severity: zone.baseRisk > 0.8 ? 'critical' : 'high',
        detectedAt: new Date(Date.now() - Math.random() * 86400000 * 3)
      }));
      setLeakPoints(leaks);
      
      setIsLoading(false);
    };
    
    initializeData();
  }, [complaints]);

  // Toggle layer
  const toggleLayer = (layer: MapLayer) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  };

  // Handle marker click
  const handleMarkerClick = (type: PanelData['type'], data: any) => {
    setSelectedPanel({ type, data });
    setSidePanelOpen(true);
  };

  // Close side panel
  const closeSidePanel = () => {
    setSidePanelOpen(false);
    setTimeout(() => setSelectedPanel({ type: null, data: null }), 300);
  };

  // Get risk level style
  const getRiskStyle = (level: string) => {
    const normalizedLevel = level.toUpperCase();
    switch (normalizedLevel) {
      case 'CRITICAL': return { bg: 'bg-red-500/20 border-red-500/50', badge: 'bg-red-500 text-white', bar: 'bg-red-500' };
      case 'HIGH': return { bg: 'bg-orange-500/20 border-orange-500/50', badge: 'bg-orange-500 text-white', bar: 'bg-orange-500' };
      case 'MEDIUM': return { bg: 'bg-yellow-500/20 border-yellow-500/50', badge: 'bg-yellow-500 text-black', bar: 'bg-yellow-500' };
      default: return { bg: 'bg-green-500/20 border-green-500/50', badge: 'bg-green-500 text-white', bar: 'bg-green-500' };
    }
  };

  // Render side panel content
  const renderSidePanelContent = () => {
    if (!selectedPanel.type || !selectedPanel.data) return null;

    switch (selectedPanel.type) {
      case 'sensor':
        const sensor = selectedPanel.data as NodeSensorData;
        const burstRisk = predictBurstRisk(sensor);
        const riskStyle = getRiskStyle(burstRisk.risk_level);
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white">{sensor.node_name}</h3>
                <p className="text-sm text-gray-400">{sensor.district}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Basınç</p>
                <p className="text-xl font-bold text-white">{sensor.current_pressure.toFixed(2)} bar</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Debi</p>
                <p className="text-xl font-bold text-white">{sensor.current_flow.toFixed(1)} L/s</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Ortalama Basınç</p>
                <p className="text-xl font-bold text-white">{sensor.average_pressure.toFixed(2)} bar</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Trend</p>
                <p className={`text-xl font-bold ${
                  sensor.pressure_trend === 'RISING' ? 'text-green-400' :
                  sensor.pressure_trend === 'FALLING' ? 'text-red-400' : 'text-yellow-400'
                }`}>{sensor.pressure_trend}</p>
              </div>
            </div>
            
            <div className={`rounded-lg p-4 border ${riskStyle.bg}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300">Patlama Riski</span>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${riskStyle.badge}`}>
                  {burstRisk.burst_probability}%
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all ${riskStyle.bar}`}
                  style={{ width: `${burstRisk.burst_probability}%` }}
                />
              </div>
            </div>
            
            {burstRisk.indicators && burstRisk.indicators.length > 0 && (
              <div className="bg-gray-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-2">Risk Göstergeleri</p>
                <ul className="space-y-1">
                  {burstRisk.indicators.map((ind, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400"/>
                      {ind}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {burstRisk.recommended_actions && burstRisk.recommended_actions.length > 0 && (
              <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
                <p className="text-xs text-blue-400 mb-2">Önerilen Aksiyonlar</p>
                <ul className="space-y-1">
                  {burstRisk.recommended_actions.map((action, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                      <span className="text-blue-400">→</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'complaint':
        const complaint = selectedPanel.data as Complaint;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white">Şikayet #{complaint.id}</h3>
                <p className="text-sm text-gray-400">{complaint.district}, {complaint.neighborhood}</p>
              </div>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-300">{complaint.text}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Kategori</p>
                <p className="text-sm font-medium text-white">{complaint.category}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Durum</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                  complaint.status === 'RESOLVED' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {complaint.status === 'RESOLVED' ? 'Çözüldü' : 'Açık'}
                </span>
              </div>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Beğeni</p>
              <p className="text-sm text-white">Beğeni: {complaint.likes}</p>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Oluşturma Tarihi</p>
              <p className="text-sm text-white">{new Date(complaint.created_at).toLocaleString('tr-TR')}</p>
            </div>
            
            {complaint.adminReply && (
              <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
                <p className="text-xs text-blue-400 mb-2">Yetkili Yanıtı</p>
                <p className="text-sm text-gray-300">{complaint.adminReply}</p>
              </div>
            )}
          </div>
        );

      case 'leak':
        const leak = selectedPanel.data;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white">Sızıntı Tespiti</h3>
                <p className="text-sm text-gray-400">ID: {leak.id}</p>
              </div>
            </div>
            
            <div className={`rounded-lg p-4 ${
              leak.severity === 'critical' ? 'bg-red-500/20 border border-red-500/50' :
              'bg-orange-500/20 border border-orange-500/50'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Şiddet</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  leak.severity === 'critical' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                }`}>
                  {leak.severity === 'critical' ? 'KRİTİK' : 'YÜKSEK'}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Tespit Tarihi</p>
                <p className="text-sm text-white">{new Date(leak.detectedAt).toLocaleString('tr-TR')}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Konum</p>
                <p className="text-sm text-white">{leak.lat.toFixed(4)}, {leak.lng.toFixed(4)}</p>
              </div>
            </div>
            
            <button className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
              Acil Müdahale Ekibi Çağır
            </button>
          </div>
        );

      case 'prediction':
        const pred = selectedPanel.data as NetworkPrediction;
        const predRiskStyle = getRiskStyle(pred.predictedStatus);
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 12l3 3 7-7 7 7 3-3L12 2z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white">Risk Tahmini</h3>
                <p className="text-sm text-gray-400">{pred.districtName}</p>
              </div>
            </div>
            
            <div className={`rounded-lg p-4 border ${predRiskStyle.bg}`}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-300">Risk Skoru</span>
                <span className={`text-2xl font-bold ${
                  pred.predictedStatus === 'CRITICAL' ? 'text-red-400' :
                  pred.predictedStatus === 'WARNING' ? 'text-orange-400' :
                  'text-green-400'
                }`}>
                  {pred.riskScore}%
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all ${predRiskStyle.bar}`}
                  style={{ width: `${pred.riskScore}%` }}
                />
              </div>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-2">Güven Seviyesi</p>
              <p className="text-sm text-white">{pred.confidenceLevel}%</p>
            </div>
            
            {pred.factors && pred.factors.length > 0 && (
              <div className="bg-gray-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-2">Faktörler</p>
                <ul className="space-y-2">
                  {pred.factors.slice(0, 4).map((factor, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        factor.impact > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {factor.impact > 0 ? '+' : ''}{factor.impact}
                      </span>
                      <span>{factor.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
              <p className="text-xs text-blue-400 mb-2">Önerilen Aksiyon</p>
              <p className="text-sm text-gray-300">{pred.recommendedAction}</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-gray-400">Harita yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Layer Controls - Top Left */}
      <div className="absolute top-4 left-4 z-[1000] bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-xl p-3 border border-gray-700">
        <p className="text-xs text-gray-400 mb-2 font-medium">Katmanlar</p>
        <div className="space-y-1">
          {[
            { key: MapLayer.SENSORS, label: 'Sensörler', icon: '◎' },
            { key: MapLayer.COMPLAINTS, label: 'Şikayetler', icon: '●' },
            { key: MapLayer.LEAKS, label: 'Sızıntılar', icon: '○' },
            { key: MapLayer.PREDICTIONS, label: 'Tahminler', icon: '◐' }
          ].map(layer => (
            <button
              key={layer.key}
              onClick={() => toggleLayer(layer.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                activeLayers.has(layer.key)
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <span>{layer.icon}</span>
              <span>{layer.label}</span>
              <span className={`ml-auto w-2 h-2 rounded-full ${
                activeLayers.has(layer.key) ? 'bg-green-400' : 'bg-gray-500'
              }`}/>
            </button>
          ))}
        </div>
      </div>

      {/* Stats - Top Right */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        <div className="bg-gray-800/95 backdrop-blur-sm rounded-xl px-4 py-2 border border-gray-700">
          <span className="text-gray-400 text-xs">Sensör</span>
          <p className="text-white font-bold">{sensorData.length}</p>
        </div>
        <div className="bg-gray-800/95 backdrop-blur-sm rounded-xl px-4 py-2 border border-gray-700">
          <span className="text-gray-400 text-xs">Şikayet</span>
          <p className="text-white font-bold">{complaints.length}</p>
        </div>
        <div className="bg-gray-800/95 backdrop-blur-sm rounded-xl px-4 py-2 border border-gray-700">
          <span className="text-gray-400 text-xs">Sızıntı</span>
          <p className="text-red-400 font-bold">{leakPoints.length}</p>
        </div>
      </div>

      {/* Side Panel */}
      <div className={`absolute top-0 right-0 h-full w-96 bg-gray-800/98 backdrop-blur-md border-l border-gray-700 z-[1001] transform transition-transform duration-300 ease-in-out ${
        sidePanelOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Detaylar</h2>
          <button 
            onClick={closeSidePanel}
            className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto h-[calc(100%-60px)]">
          {renderSidePanelContent()}
        </div>
      </div>

      {/* Map Container */}
      <MapContainer
        center={bursaCenter}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        maxBounds={bursaBounds}
        minZoom={9}
        maxZoom={18}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Critical Zones */}
        {activeLayers.has(MapLayer.PREDICTIONS) && CRITICAL_ZONES.map((zone, idx) => (
          <Circle
            key={`zone-${idx}`}
            center={zone.center}
            radius={zone.radius}
            pathOptions={{
              color: zone.baseRisk > 0.75 ? '#EF4444' : zone.baseRisk > 0.6 ? '#F97316' : '#F59E0B',
              fillColor: zone.baseRisk > 0.75 ? '#EF4444' : zone.baseRisk > 0.6 ? '#F97316' : '#F59E0B',
              fillOpacity: 0.15,
              weight: 2
            }}
          >
            <Popup>
              <div className="text-center">
                <strong>{zone.name}</strong>
                <p className="text-sm text-gray-600">{zone.issue}</p>
                <p className="text-sm font-bold" style={{ color: zone.baseRisk > 0.75 ? '#EF4444' : '#F97316' }}>
                  Risk: {(zone.baseRisk * 100).toFixed(0)}%
                </p>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Sensor Markers */}
        {activeLayers.has(MapLayer.SENSORS) && sensorData.map(sensor => {
          const node = BURSA_NETWORK_NODES.find(n => n.id === sensor.node_id);
          if (!node) return null;
          
          return (
            <Marker
              key={sensor.node_id}
              position={[node.latitude, node.longitude]}
              icon={createModernIcon('sensor', 28)}
              eventHandlers={{
                click: () => handleMarkerClick('sensor', sensor)
              }}
            />
          );
        })}

        {/* Complaint Markers */}
        {activeLayers.has(MapLayer.COMPLAINTS) && complaintPositions.map(({ complaint, position }) => (
          <Marker
            key={complaint.id}
            position={position}
            icon={createModernIcon('complaint', 28)}
            eventHandlers={{
              click: () => {
                handleMarkerClick('complaint', complaint);
                onComplaintClick?.(complaint);
              }
            }}
          />
        ))}

        {/* Leak Markers */}
        {activeLayers.has(MapLayer.LEAKS) && leakPoints.map(leak => (
          <Marker
            key={leak.id}
            position={[leak.lat, leak.lng]}
            icon={createModernIcon(leak.severity === 'critical' ? 'critical' : 'leak', 32)}
            eventHandlers={{
              click: () => handleMarkerClick('leak', leak)
            }}
          />
        ))}

        {/* Prediction Markers */}
        {activeLayers.has(MapLayer.PREDICTIONS) && predictions.map((pred, idx) => {
          const node = BURSA_NETWORK_NODES.find(n => n.district === pred.districtName);
          if (!node) return null;
          
          return (
            <Marker
              key={`pred-${idx}`}
              position={[node.latitude, node.longitude]}
              icon={createModernIcon(
                pred.predictedStatus === 'CRITICAL' ? 'burst' : 
                pred.predictedStatus === 'WARNING' ? 'warning' : 'sensor', 
                32
              )}
              eventHandlers={{
                click: () => handleMarkerClick('prediction', pred)
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
};

export default UnifiedBursaMap;
