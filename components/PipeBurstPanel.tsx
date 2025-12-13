import React, { useState, useEffect } from 'react';
import { pipeBurstAPI } from '../services/mockBackend';
import { BurstAnalysisResult, BurstPrediction, PressureEstimate } from '../types';
import { AlertTriangle, Droplet, TrendingDown, MapPin, RefreshCw } from 'lucide-react';

interface PipeBurstPanelProps {
  onAnomaliesDetected?: (bursts: BurstPrediction[]) => void;
}

export const PipeBurstPanel: React.FC<PipeBurstPanelProps> = ({ onAnomaliesDetected }) => {
  const [analysis, setAnalysis] = useState<BurstAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [forecast, setForecast] = useState<PressureEstimate[] | null>(null);

  const refreshAnalysis = async () => {
    setLoading(true);
    try {
      const result = pipeBurstAPI.analyzeBursts();
      setAnalysis(result);

      // Bildirimleri gönder
      if (result.burst_predictions.length > 0) {
        onAnomaliesDetected?.(result.burst_predictions);
      }
    } catch (error) {
      console.error('Analiz hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAnalysis();
    const interval = setInterval(refreshAnalysis, 10 * 60 * 1000); // Her 10 dakikada bir
    return () => clearInterval(interval);
  }, []);

  const handleDistrictSelect = (district: string) => {
    setSelectedDistrict(district);
    const pressure_forecast = pipeBurstAPI.getDailyPressureForecast(district);
    setForecast(pressure_forecast);
  };

  if (!analysis) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-red-100 p-3 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Boru Arızası Tespiti</h3>
            <p className="text-sm text-gray-500">AI tabanlı basınç anomali analizi</p>
          </div>
        </div>
        <button
          onClick={refreshAnalysis}
          disabled={loading}
          className="p-2 bg-red-100 rounded-lg text-red-600 hover:bg-red-200 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <p className="text-sm font-semibold text-orange-700">ARIZA RİSKİ</p>
          <p className="text-2xl font-bold text-orange-900">
            {analysis.summary.high_risk_locations}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm font-semibold text-blue-700">BASSINÇ SORUNU</p>
          <p className="text-2xl font-bold text-blue-900">
            {analysis.summary.critical_pressure_zones}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-sm font-semibold text-purple-700">ŞİKAYET</p>
          <p className="text-2xl font-bold text-purple-900">
            {analysis.summary.total_complaints}
          </p>
        </div>
      </div>

      {/* High Risk Locations */}
      {analysis.burst_predictions.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Yüksek Risk Bölgeleri
          </h4>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {analysis.burst_predictions.map((pred: BurstPrediction) => (
              <div
                key={pred.location}
                onClick={() => handleDistrictSelect(pred.district)}
                className={`border-l-4 rounded-lg p-4 cursor-pointer transition-all ${
                  pred.burst_probability > 60
                    ? 'border-red-500 bg-red-50 hover:bg-red-100'
                    : 'border-orange-500 bg-orange-50 hover:bg-orange-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {pred.district} - {pred.neighborhood}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{pred.recommended_action}</p>
                    <div className="flex gap-3 mt-2 text-xs font-semibold">
                      <span className="text-red-700">
                        Arıza Riski: {Math.round(pred.burst_probability)}%
                      </span>
                      {pred.pressure_drop_detected && (
                        <span className="text-blue-700">
                          Basınç Düşüşü Algılandı
                        </span>
                      )}
                      <span className="text-gray-700">
                        {pred.complaint_concentration} şikayet
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pressure Forecast */}
      {selectedDistrict && forecast && (
        <div className="border-t pt-6">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Droplet className="w-4 h-4 text-blue-600" />
            {selectedDistrict} - 24 Saatlik Basınç Tahmini
          </h4>
          <div className="grid grid-cols-12 gap-1 text-xs">
            {forecast.map((est: any, idx: number) => {
              const hour = idx;
              const color =
                est.severity === 'CRITICAL'
                  ? 'bg-red-500'
                  : est.severity === 'WARNING'
                  ? 'bg-orange-500'
                  : 'bg-green-500';

              return (
                <div
                  key={idx}
                  className={`${color} text-white rounded p-1 text-center font-semibold relative group`}
                  title={`${hour}:00 - ${est.estimated_pressure} bar`}
                >
                  {hour}h
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap mb-1 opacity-0 group-hover:opacity-100 z-10">
                    {est.estimated_pressure} bar
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Districts Pressure Overview */}
      <div>
        <h4 className="font-semibold text-gray-800 mb-3">Tüm Bölgelerin Basınç Durumu</h4>
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {Object.entries(analysis.pressure_estimates).map(([district, est]: [string, any]) => {
            const color =
              est.severity === 'CRITICAL'
                ? 'bg-red-100 border-red-300 text-red-800'
                : est.severity === 'WARNING'
                ? 'bg-orange-100 border-orange-300 text-orange-800'
                : 'bg-green-100 border-green-300 text-green-800';

            return (
              <button
                key={district}
                onClick={() => handleDistrictSelect(district)}
                className={`p-3 rounded-lg border text-center hover:shadow-md transition-shadow ${color}`}
              >
                <p className="text-sm font-medium truncate">{district}</p>
                <p className="text-lg font-bold">{est.estimated_pressure} bar</p>
                <p className="text-xs opacity-75">{est.severity}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-700">
          <strong>Bilgi:</strong> Sistem vatandaş şikayetlerini analiz ederek
          "basınç düşüklüğü", "sızıntı", "patlak boru" gibi anahtar kelimeler arar.
          Benzer şikayetleri kümeleyerek boru arızası olabilecek konumları tahmin eder
          ve saatlik basınç değişimlerini gösterir.
        </p>
      </div>
    </div>
  );
};

export default PipeBurstPanel;
