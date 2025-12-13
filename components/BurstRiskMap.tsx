import React, { useState, useEffect, useRef, useMemo } from 'react';
import { pipeBurstAPI } from '../services/mockBackend';
import { BurstPrediction, BurstAnalysisResult } from '../types';
import { MapPin, AlertTriangle, TrendingUp, Eye, EyeOff } from 'lucide-react';

interface BurstRiskMapProps {
  onBurstSelected?: (burst: BurstPrediction) => void;
}

export const BurstRiskMap: React.FC<BurstRiskMapProps> = ({ onBurstSelected }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [analysis, setAnalysis] = useState<BurstAnalysisResult | null>(null);
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [showLabels, setShowLabels] = useState(true);

  // Bursa bölgeleri koordinatları
  const districtCoordinates: Record<string, [number, number]> = {
    'Nilüfer': [40.19, 29.07],
    'Osmangazi': [40.19, 29.01],
    'Yıldırım': [40.22, 29.13],
    'Mudanya': [40.36, 28.67],
    'Gemlik': [40.43, 29.34],
    'Gürsu': [40.15, 29.43],
    'Harmancık': [40.35, 29.17],
    'İnegöl': [40.06, 29.40],
    'İznik': [40.42, 29.73],
    'Karacabey': [40.25, 28.33],
    'Keles': [40.02, 29.72],
    'Kestel': [40.08, 29.14],
    'Mustafakemalpaşa': [40.17, 28.50],
    'Orhaneli': [40.25, 29.90],
    'Orhangazi': [40.28, 29.17],
    'Yenişehir': [40.11, 29.91],
    'Büyükorhan': [40.33, 28.97]
  };

  // Arıza riskine göre renk belirleme
  const getRiskColor = (probability: number): string => {
    if (probability >= 70) return '#DC2626'; // Kırmızı - KRİTİK
    if (probability >= 50) return '#EA580C'; // Turuncu - YÜKSEK
    if (probability >= 30) return '#FBBF24'; // Sarı - ORTA
    return '#10B981'; // Yeşil - DÜŞÜK
  };

  const getRiskLevel = (probability: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' => {
    if (probability >= 70) return 'CRITICAL';
    if (probability >= 50) return 'HIGH';
    if (probability >= 30) return 'MEDIUM';
    return 'LOW';
  };

  const getRiskLabel = (level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): string => {
    switch (level) {
      case 'CRITICAL':
        return 'KRİTİK';
      case 'HIGH':
        return 'YÜKSEK';
      case 'MEDIUM':
        return 'ORTA';
      case 'LOW':
        return 'DÜŞÜK';
    }
  };

  // Analizi yükle
  useEffect(() => {
    const result = pipeBurstAPI.analyzeBursts();
    setAnalysis(result);
  }, []);

  // Haritayı başlat ve arıza noktalarını göster
  useEffect(() => {
    if (!mapRef.current || !analysis) return;

    // Harita başlatılmadıysa başlat
    if (!mapInstance.current) {
      const L = (window as any).L;

      mapInstance.current = L.map(mapRef.current).setView([40.19, 29.07], 10);
      mapInstance.current.setMaxBounds([
        [39.5, 28.0],
        [40.8, 30.5]
      ]);

      // Tile layer ekle
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 14,
        minZoom: 9
      }).addTo(mapInstance.current);
    }

    // Mevcut işaretçileri kaldır
    markersRef.current.forEach(m => mapInstance.current.removeLayer(m));
    markersRef.current = [];

    // Arıza noktalarını haritaya ekle
    const L = (window as any).L;
    const bursts = analysis.burst_predictions.filter(b => {
      if (riskFilter === 'ALL') return true;
      const level = getRiskLevel(b.burst_probability);
      return level === riskFilter;
    });

    for (const burst of bursts) {
      const district = burst.district;
      const coords = districtCoordinates[district];
      if (!coords) continue;

      const color = getRiskColor(burst.burst_probability);
      const riskLevel = getRiskLevel(burst.burst_probability);
      const size = 20 + (burst.burst_probability / 100) * 15;

      // Arıza noktası işaretçisi
      const marker = L.circleMarker(coords, {
        radius: size,
        fillColor: color,
        color: 'white',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8,
      });

      // Popup içeriği
      const popupContent = `
        <div style="width: 280px; font-family: Arial, sans-serif;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #1f2937;">
            ${burst.district} - ${burst.neighborhood}
          </div>
          <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="margin-bottom: 6px;">
              <span style="font-weight: 600; color: #374151;">Arıza Riski:</span>
              <span style="color: ${color}; font-weight: bold; margin-left: 4px;">${Math.round(burst.burst_probability)}%</span>
            </div>
            <div style="margin-bottom: 6px;">
              <span style="font-weight: 600; color: #374151;">Önem:</span>
              <span style="color: ${color}; font-weight: bold; margin-left: 4px;">${getRiskLabel(riskLevel)}</span>
            </div>
            <div style="margin-bottom: 6px;">
              <span style="font-weight: 600; color: #374151;">Şikayetler:</span>
              <span style="margin-left: 4px;">${burst.complaint_concentration}</span>
            </div>
            ${burst.pressure_drop_detected ? '<div style="color: #c53030; font-weight: 600; margin-top: 6px;">Basınç Düşüşü Algılandı</div>' : ''}
          </div>
          <div style="background: ${color}20; padding: 8px; border-left: 3px solid ${color}; border-radius: 4px; color: #1f2937; font-size: 12px;">
            <strong>Tavsiye:</strong> ${burst.recommended_action}
          </div>
        </div>
      `;

      marker
        .bindPopup(popupContent, { maxWidth: 300 })
        .on('click', () => {
          onBurstSelected?.(burst);
        })
        .addTo(mapInstance.current);

      // Etiket ekle (isteğe bağlı)
      if (showLabels) {
        const label = L.marker(coords, {
          icon: L.divIcon({
            html: `
              <div style="
                font-weight: bold;
                color: white;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                font-size: 12px;
                text-align: center;
                cursor: pointer;
                line-height: 1.2;
                background: ${color};
                padding: 4px 8px;
                border-radius: 4px;
              ">
                ${burst.district}<br/>
                <span style="font-size: 10px;">${Math.round(burst.burst_probability)}%</span>
              </div>
            `,
            className: 'burst-label',
            iconSize: [70, 45]
          })
        })
        .addTo(mapInstance.current);

        markersRef.current.push(label);
      }

      markersRef.current.push(marker);
    }
  }, [analysis, riskFilter, showLabels, onBurstSelected]);

  if (!analysis || analysis.burst_predictions.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 text-center">
        <p className="text-gray-500">Şu anda risk altında bölge yok</p>
      </div>
    );
  }

  const riskStats = {
    CRITICAL: analysis.burst_predictions.filter(
      b => getRiskLevel(b.burst_probability) === 'CRITICAL'
    ).length,
    HIGH: analysis.burst_predictions.filter(
      b => getRiskLevel(b.burst_probability) === 'HIGH'
    ).length,
    MEDIUM: analysis.burst_predictions.filter(
      b => getRiskLevel(b.burst_probability) === 'MEDIUM'
    ).length,
    LOW: analysis.burst_predictions.filter(
      b => getRiskLevel(b.burst_probability) === 'LOW'
    ).length
  };

  return (
    <div className="space-y-4">
      {/* Kontroller */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Risk Filtreleri */}
        <div className="flex gap-2">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(level => {
            const colors = {
              ALL: 'bg-gray-500',
              CRITICAL: 'bg-red-600',
              HIGH: 'bg-orange-600',
              MEDIUM: 'bg-yellow-500'
            };

            const labels = {
              ALL: 'Tümü',
              CRITICAL: 'Kritik',
              HIGH: 'Yüksek',
              MEDIUM: 'Orta'
            };

            return (
              <button
                key={level}
                onClick={() => setRiskFilter(level)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all text-white ${
                  riskFilter === level
                    ? 'ring-2 ring-offset-2 scale-105 shadow-lg'
                    : 'opacity-70 hover:opacity-100'
                } ${colors[level]}`}
              >
                {labels[level]} ({level === 'ALL'
                  ? analysis.burst_predictions.length
                  : riskStats[level]})
              </button>
            );
          })}
        </div>

        {/* Etiketler Toggle */}
        <button
          onClick={() => setShowLabels(!showLabels)}
          className="ml-auto bg-white border border-gray-300 p-2 rounded-lg hover:bg-gray-50 shadow-sm flex items-center gap-1 text-xs font-medium text-gray-700"
        >
          {showLabels ? (
            <>
              <Eye className="w-4 h-4" /> Etiketler Gizle
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4" /> Etiketleri Göster
            </>
          )}
        </button>
      </div>

      {/* Harita */}
      <div
        ref={mapRef}
        className="w-full h-[500px] rounded-xl border border-slate-200 shadow-inner overflow-hidden bg-gray-100"
      />

      {/* Legend */}
      <div className="bg-white/95 p-4 rounded-lg backdrop-blur-sm shadow-lg border border-gray-200">
        <p className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Arıza Risk Seviyeleri
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded-full shadow-md"></div>
            <span className="text-sm font-medium">Kritik (70%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-600 rounded-full shadow-md"></div>
            <span className="text-sm font-medium">Yüksek (50-69%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full shadow-md"></div>
            <span className="text-sm font-medium">Orta (30-49%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded-full shadow-md"></div>
            <span className="text-sm font-medium">Düşük (&lt;30%)</span>
          </div>
        </div>
      </div>

      {/* Risk Özeti */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 mb-1">● KRİTİK</p>
          <p className="text-2xl font-bold text-red-900">{riskStats.CRITICAL}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-orange-700 mb-1">◐ YÜKSEK</p>
          <p className="text-2xl font-bold text-orange-900">{riskStats.HIGH}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-yellow-700 mb-1">○ ORTA</p>
          <p className="text-2xl font-bold text-yellow-900">{riskStats.MEDIUM}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-green-700 mb-1">◉ DÜŞÜK</p>
          <p className="text-2xl font-bold text-green-900">{riskStats.LOW}</p>
        </div>
      </div>

      {/* Detay Tablosu */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Bölge</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Arıza Riski</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Şikayet</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Basınç</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Tavsiye</th>
            </tr>
          </thead>
          <tbody>
            {analysis.burst_predictions
              .sort((a, b) => b.burst_probability - a.burst_probability)
              .slice(0, 10)
              .map((burst, idx) => {
                const level = getRiskLevel(burst.burst_probability);
                const color = getRiskColor(burst.burst_probability);
                const bgColor = level === 'CRITICAL' ? 'bg-red-50' : level === 'HIGH' ? 'bg-orange-50' : level === 'MEDIUM' ? 'bg-yellow-50' : 'bg-green-50';

                return (
                  <tr key={idx} className={`border-b border-gray-200 hover:${bgColor} cursor-pointer`}>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {burst.district} - {burst.neighborhood}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        style={{ color, fontWeight: 'bold' }}
                      >
                        {Math.round(burst.burst_probability)}% ({getRiskLabel(level)})
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{burst.complaint_concentration}</td>
                    <td className="px-4 py-2">
                      {burst.pressure_drop_detected ? (
                        <span className="text-red-600 font-semibold">▼ Düşüş</span>
                      ) : (
                        <span className="text-green-600">Normal</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 max-w-xs truncate">
                      {burst.recommended_action}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BurstRiskMap;
