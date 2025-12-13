import React, { useMemo } from 'react';
import { Droplets, Zap } from 'lucide-react';
import { Complaint } from '../types';
import UnifiedBursaMap from './UnifiedBursaMap';
import RealtimeNetworkMap from './RealtimeNetworkMap';

interface AdminMapsViewProps {
  complaints: Complaint[];
}

export default function AdminMapsView({ complaints }: AdminMapsViewProps) {
  // Kategoriye göre dağılım
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {
      'BASINC': 0,
      'KESINTI': 0,
      'KALITE': 0,
      'DIGER': 0
    };
    complaints.forEach(c => {
      if (stats[c.category] !== undefined) stats[c.category]++;
    });
    return stats;
  }, [complaints]);

  // Bölge bazında şikayet yoğunluğu
  const districtStats = useMemo(() => {
    const stats: Record<string, number> = {};
    complaints.forEach(c => {
      stats[c.district] = (stats[c.district] || 0) + 1;
    });
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [complaints]);

  // Kategori renkleri
  const categoryColors = {
    'BASINC': 'bg-blue-500',
    'KESINTI': 'bg-red-500',
    'KALITE': 'bg-purple-500',
    'DIGER': 'bg-gray-500'
  };

  const categoryLabels = {
    'BASINC': 'Basınç Problemi',
    'KESINTI': 'Kesinti',
    'KALITE': 'Kalite',
    'DIGER': 'Diğer'
  };

  return (
    <div className="space-y-8">
      {/* BİRLEŞTİRİLMİŞ BURSA HARITASI - TÜM VERİLER TEK HARITA */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-indigo-300 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          Bursa Su Altyapısı – Etkileşimli Harita
        </h2>
        <p className="text-gray-600 mb-6">
          Basınç, kesinti, şikayet dağılımı ve arızaları tek harita üzerinden takip edin. 
          Katman seçerek ve bölge filtreleyerek detaylı analiz yapın.
        </p>
        <UnifiedBursaMap complaints={complaints} />
      </div>

      {/* İstatistikler ve Özet */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200">
          <p className="text-3xl font-bold text-blue-700">{complaints.length}</p>
          <p className="text-sm text-blue-600 mt-2 font-semibold">Toplam Bildirim</p>
        </div>

        <div className="p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border-2 border-red-200">
          <p className="text-3xl font-bold text-red-700">{categoryStats['KESINTI']}</p>
          <p className="text-sm text-red-600 mt-2 font-semibold">Kesinti Bildirimi</p>
        </div>

        <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-100 rounded-lg border-2 border-cyan-200">
          <p className="text-3xl font-bold text-blue-700">{categoryStats['BASINC']}</p>
          <p className="text-sm text-blue-600 mt-2 font-semibold">Basınç Sorunu</p>
        </div>

        <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border-2 border-purple-200">
          <p className="text-3xl font-bold text-purple-700">{categoryStats['KALITE']}</p>
          <p className="text-sm text-purple-600 mt-2 font-semibold">Kalite Şikayeti</p>
        </div>
      </div>

      {/* Kategoriler Özeti */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Şikayet Kategorileri</h3>
        
        <div className="space-y-4">
          {Object.entries(categoryStats).map(([category, count]) => {
            const total = complaints.length || 0;
            const percentage = total > 0 ? ((count as number) / total) * 100 : 0;
            
            return (
              <div key={category}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {count} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      categoryColors[category as keyof typeof categoryColors]
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* En Yüksek Bildirim Alan Bölgeler */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">
          En Çok Bildirim Alan Bölgeler
        </h3>

        <div className="space-y-3">
          {districtStats.map(([district, count], idx) => (
            <div key={district} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
              <div className="flex items-center gap-4 flex-1">
                <span className="w-10 h-10 rounded-full bg-slate-600 text-white flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-semibold text-gray-900">{district}</p>
                  <p className="text-xs text-gray-500">Bölge</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-700">{count}</p>
                <p className="text-xs text-gray-500">bildirim</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sistem Durumu */}
      <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-700">
              <span className="text-2xl text-white">◉</span>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-green-900">Canlı İzleme Sistemi Aktif</h3>
            <p className="text-sm text-green-700 mt-1">
              Bursa su altyapısı gerçek zamanlı olarak izlenmektedir. Basınç ve kesinti durumları otomatik olarak güncellenmektedir.
            </p>
            <p className="text-xs text-green-600 mt-3 font-mono">
              Son Güncelleme: {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
