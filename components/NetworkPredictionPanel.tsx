import React, { useState, useEffect } from 'react';
import { networkPredictionAPI } from '../services/mockBackend';
import { AlertTriangle, TrendingUp, Clock, Activity, RefreshCw } from 'lucide-react';

interface NetworkPredictionPanelProps {
  onNotificationsGenerated?: (messages: string[]) => void;
}

export const NetworkPredictionPanel: React.FC<NetworkPredictionPanelProps> = ({ onNotificationsGenerated }) => {
  const [predictions, setPredictions] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timer | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshPredictions = async () => {
    setLoading(true);
    try {
      const result = networkPredictionAPI.predictAllDistricts();
      setPredictions(result);
      setLastUpdated(new Date());

      // Auto-generate notifications if needed
      if (result.alertingDistricts.length > 0) {
        const messages = networkPredictionAPI.generateNotifications();
        onNotificationsGenerated?.(messages);
      }
    } catch (error) {
      console.error('Tahmin hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    refreshPredictions();

    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      refreshPredictions();
    }, 5 * 60 * 1000);

    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const getRiskIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return '○';
      case 'WARNING':
        return '◐';
      case 'CRITICAL':
        return '●';
      default:
        return '?';
    }
  };

  const getRiskColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'WARNING':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'CRITICAL':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  if (!predictions) {
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
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-3 rounded-lg">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Şebeke Durum Tahmini (AI)</h3>
            <p className="text-sm text-gray-500">NLP tabanlı otomatik tahmin sistemi</p>
          </div>
        </div>
        <button
          onClick={refreshPredictions}
          disabled={loading}
          className="p-2 bg-blue-100 rounded-lg text-blue-600 hover:bg-blue-200 disabled:opacity-50 transition-colors"
          title="Tahmini güncelle"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700">KRİTİK</p>
              <p className="text-2xl font-bold text-red-900">{predictions.criticalCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600 opacity-50" />
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-700">UYARI</p>
              <p className="text-2xl font-bold text-yellow-900">{predictions.warningCount}</p>
            </div>
            <Activity className="w-8 h-8 text-yellow-600 opacity-50" />
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700">SAĞLAM</p>
              <p className="text-2xl font-bold text-blue-900">
                {predictions.allPredictions.length - predictions.criticalCount - predictions.warningCount}
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </div>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-xs text-gray-500 mb-4 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Son güncelleme: {lastUpdated.toLocaleTimeString('tr-TR')}
        </div>
      )}

      {/* Alert Districts */}
      {predictions.alertingDistricts.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Uyarılı Bölgeler
          </h4>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {predictions.alertingDistricts.map((pred: any) => (
              <div
                key={pred.districtName}
                className={`border-l-4 rounded-lg p-4 ${getRiskColor(pred.predictedStatus)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-bold">
                      {getRiskIcon(pred.predictedStatus)} {pred.districtName}
                    </p>
                    <p className="text-xs opacity-75 mt-1">{pred.recommendedAction}</p>
                    <div className="flex gap-4 mt-2 text-xs font-semibold">
                      <span>Risk: {Math.round(pred.riskScore)}/100</span>
                      <span>Güven: %{Math.round(pred.confidenceLevel)}</span>
                      {pred.estimatedResolutionTime && (
                        <span>Tahmini: {pred.estimatedResolutionTime} dk</span>
                      )}
                    </div>

                    {/* Contributing Factors */}
                    {pred.factors.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                        <p className="text-xs font-semibold opacity-75 mb-1">Faktörler:</p>
                        <ul className="text-xs space-y-0.5 opacity-75">
                          {pred.factors.map((factor: any, idx: number) => (
                            <li key={idx}>
                              • {factor.name}: {factor.impact > 0 ? '+' : ''}{factor.impact} pt
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Districts Summary */}
      <div>
        <h4 className="font-semibold text-gray-800 mb-3">Tüm Bölgeler</h4>
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {predictions.allPredictions.map((pred: any) => (
            <div
              key={pred.districtName}
              className={`p-3 rounded-lg border ${getRiskColor(pred.predictedStatus)} text-center`}
            >
              <p className="font-semibold">{getRiskIcon(pred.predictedStatus)}</p>
              <p className="text-sm font-medium truncate">{pred.districtName}</p>
              <p className="text-xs opacity-75">{Math.round(pred.riskScore)}/100</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-700">
          <strong>Bilgi:</strong> Tahmin modeli, vatandaş şikayetlerini NLP ile analiz ederek su şebeke durumunu tahmin eder.
          Kritik tahminler otomatik olarak uyarı oluşturur.
        </p>
      </div>
    </div>
  );
};

export default NetworkPredictionPanel;
