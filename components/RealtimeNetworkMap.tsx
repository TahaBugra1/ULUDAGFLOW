import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Droplets, TrendingDown, MapPin, Clock } from 'lucide-react';
import { Complaint } from '../types';
import { RealTimeMonitor } from '../services/realtimeMonitor';

interface RealtimeNetworkMapProps {
  complaints: Complaint[];
  mapType: 'PRESSURE' | 'OUTAGE';
}

export default function RealtimeNetworkMap({ complaints, mapType }: RealtimeNetworkMapProps) {
  const [monitor] = useState(() => new RealTimeMonitor());
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Her 10 saniyede bir otomatik güncelle
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshing(true);
      
      // Veri güncelle
      if (mapType === 'PRESSURE') {
        monitor.analyzePressure(complaints);
      } else {
        monitor.analyzeOutages(complaints);
      }
      
      setLastUpdate(new Date());
      setRefreshing(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [complaints, mapType, monitor]);

  // İlk load
  useEffect(() => {
    if (mapType === 'PRESSURE') {
      monitor.analyzePressure(complaints);
    } else {
      monitor.analyzeOutages(complaints);
    }
    setLastUpdate(new Date());
  }, [complaints, mapType, monitor]);

  const pressureData = useMemo(() => monitor.getAllPressureData(), [monitor]);
  const outageData = useMemo(() => monitor.getAllOutageData(), [monitor]);
  const criticalPressures = useMemo(() => monitor.getCriticalPressureZones(), [monitor]);
  const activeOutages = useMemo(() => monitor.getActiveOutages(), [monitor]);

  const getTimeSince = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Şimdi';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} dk önce`;
    return `${Math.floor(seconds / 3600)} saat önce`;
  };

  const getPressureColor = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return 'from-red-600 to-red-700';
      case 'LOW':
        return 'from-orange-500 to-orange-600';
      default:
        return 'from-green-500 to-green-600';
    }
  };

  const getPressureIcon = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return '●';
      case 'LOW':
        return '◐';
      default:
        return '○';
    }
  };

  const getOutageSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'from-red-600 to-red-700';
      case 'MEDIUM':
        return 'from-orange-500 to-orange-600';
      default:
        return 'from-yellow-500 to-yellow-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Canlı Durum Göstergesi */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${refreshing ? 'animate-pulse' : 'animate-bounce'} bg-green-500`}></div>
            <span className="text-sm font-semibold text-gray-700">
              {refreshing ? 'Veriler güncelleniyor...' : 'Canlı Sistem'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Clock className="w-4 h-4" />
          {getTimeSince(lastUpdate)}
        </div>
      </div>

      {/* BASINÇ HAHAritası */}
      {mapType === 'PRESSURE' && (
        <>
          {/* Kritik Basınç Uyarı */}
          {criticalPressures.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-800">Kritik Basınç Bölgeleri</p>
                  <p className="text-sm text-red-700">{criticalPressures.length} bölgede acil müdahale gerekli</p>
                </div>
              </div>
              <div className="space-y-2">
                {criticalPressures.slice(0, 3).map(p => (
                  <div key={p.district} className="text-sm text-red-700 bg-white p-2 rounded border border-red-100">
                    <strong>{p.district}:</strong> {p.current_pressure.toFixed(2)} bar
                    ({((p.current_pressure / p.baseline_pressure) * 100).toFixed(0)}% baseline)
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Basınç Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pressureData.map(pressure => (
              <div
                key={pressure.district}
                className={`p-4 rounded-lg border-2 bg-gradient-to-br ${getPressureColor(pressure.status)} text-white relative overflow-hidden`}
              >
                {/* Arka fon efekti */}
                <div className="absolute inset-0 opacity-10 bg-noise pointer-events-none"></div>

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-lg">{pressure.district}</p>
                      <p className="text-sm opacity-90">{getPressureIcon(pressure.status)} {pressure.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{pressure.current_pressure.toFixed(2)}</p>
                      <p className="text-xs opacity-75">bar</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div>
                      <p className="text-xs opacity-75 mb-1">Baseline: {pressure.baseline_pressure.toFixed(2)} bar</p>
                      <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white"
                          style={{
                            width: `${(pressure.current_pressure / pressure.baseline_pressure) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 opacity-90">
                    <p>{pressure.affected_neighborhoods.length} Mahalle Etkilenmiş</p>
                    <p>{pressure.complaint_count} Bildirim</p>
                  </div>

                  {pressure.affected_neighborhoods.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/20">
                      <p className="text-xs opacity-75 mb-2">Etkilenen:</p>
                      <div className="flex flex-wrap gap-1">
                        {pressure.affected_neighborhoods.slice(0, 2).map(n => (
                          <span key={n} className="text-xs bg-white/20 px-2 py-1 rounded">
                            {n}
                          </span>
                        ))}
                        {pressure.affected_neighborhoods.length > 2 && (
                          <span className="text-xs bg-white/20 px-2 py-1 rounded">
                            +{pressure.affected_neighborhoods.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* KESİNTİ HAHAritası */}
      {mapType === 'OUTAGE' && (
        <>
          {/* Aktif Kesinti Uyarı */}
          {activeOutages.length > 0 && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-orange-800">Aktif Kesintiler</p>
                  <p className="text-sm text-orange-700">{activeOutages.length} bölgede su kesintisi</p>
                </div>
              </div>
              <div className="space-y-2">
                {activeOutages.slice(0, 3).map(o => (
                  <div key={o.district} className="text-sm text-orange-700 bg-white p-2 rounded border border-orange-100">
                    <strong>{o.district}:</strong> {o.affected_percentage.toFixed(0)}% etkilenmiş
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kesinti Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {outageData.map(outage => (
              <div
                key={outage.district}
                className={`p-4 rounded-lg border-2 bg-gradient-to-br ${getOutageSeverityColor(outage.severity)} text-white relative overflow-hidden`}
              >
                {/* Arka fon efekti */}
                <div className="absolute inset-0 opacity-10 bg-noise pointer-events-none"></div>

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-lg">{outage.district}</p>
                      <p className="text-sm opacity-90">
                        {outage.status === 'ACTIVE' ? '● Aktif' : outage.status === 'PLANNED' ? '○ Planlı' : '◉ Çözüldü'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{outage.affected_percentage.toFixed(0)}</p>
                      <p className="text-xs opacity-75">% Kesinti</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div>
                      <p className="text-xs opacity-75 mb-1">Etkilenme Oranı</p>
                      <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white"
                          style={{ width: `${outage.affected_percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 opacity-90">
                    <p>{outage.affected_neighborhoods.length} Mahalle</p>
                    <p>{outage.complaint_count} Bildirim</p>
                    <p>Tahmini Bitiş: {new Date(outage.estimated_end).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</p>
                  </div>

                  {outage.affected_neighborhoods.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/20">
                      <p className="text-xs opacity-75 mb-2">Etkilenen Mahalles:</p>
                      <div className="flex flex-wrap gap-1">
                        {outage.affected_neighborhoods.slice(0, 2).map(n => (
                          <span key={n} className="text-xs bg-white/20 px-2 py-1 rounded">
                            {n}
                          </span>
                        ))}
                        {outage.affected_neighborhoods.length > 2 && (
                          <span className="text-xs bg-white/20 px-2 py-1 rounded">
                            +{outage.affected_neighborhoods.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {outageData.length === 0 && (
            <div className="text-center py-12 bg-green-50 rounded-lg border-2 border-green-200">
              <p className="text-2xl mb-2">◉</p>
              <p className="font-semibold text-green-800">Tüm Kesintiler Çözüldü</p>
              <p className="text-sm text-green-700">Bursa'da aktif kesinti yok</p>
            </div>
          )}
        </>
      )}

      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-2xl font-bold text-blue-600">{pressureData.length}</p>
          <p className="text-xs text-blue-700 mt-1">Toplam Bölge</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-2xl font-bold text-red-600">{criticalPressures.length}</p>
          <p className="text-xs text-red-700 mt-1">Kritik Basınç</p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
          <p className="text-2xl font-bold text-orange-600">{activeOutages.length}</p>
          <p className="text-xs text-orange-700 mt-1">Aktif Kesinti</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-2xl font-bold text-gray-600">{complaints.length}</p>
          <p className="text-xs text-gray-700 mt-1">Toplam Bildirim</p>
        </div>
      </div>
    </div>
  );
}
