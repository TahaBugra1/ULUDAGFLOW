import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Droplets, Activity, MapPin } from 'lucide-react';
import { Complaint } from '../types';
import { BURSA_NETWORK_NODES, PressureReading, calculateDistrictAveragePressure, PRESSURE_BASELINE, detectLeaks } from '../services/bursaNetworkData';
import { RealTimeMonitor } from '../services/realtimeMonitor';

interface BursaMapProps {
  complaints: Complaint[];
  mapType: 'PRESSURE' | 'OUTAGE';
}

export default function BursaMap({ complaints, mapType }: BursaMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [monitor] = React.useState(() => new RealTimeMonitor());
  const markerGroup = useRef<L.FeatureGroup>(new L.FeatureGroup());

  // Basınç verisi simülasyonu
  const pressureData = useMemo(() => {
    return BURSA_NETWORK_NODES.map(node => {
      const baseline = PRESSURE_BASELINE[node.district] || 2.8;
      // Şikayet sayısı basınçı düşürüyor
      const districtComplaints = complaints.filter(c => c.district === node.district).length;
      const pressureDrop = (districtComplaints / Math.max(1, complaints.length)) * 0.5;
      
      return {
        node_id: node.id,
        district: node.district,
        latitude: node.latitude,
        longitude: node.longitude,
        current_pressure: Math.max(0.5, baseline * (1 - pressureDrop)),
        baseline_pressure: baseline,
        complaint_count: districtComplaints,
        node_type: node.node_type
      };
    });
  }, [complaints]);

  // Harita başlatma
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Bursa merkezi: 40.1826° N, 29.1864° E
    map.current = L.map(mapContainer.current).setView([40.1826, 29.1864], 10);

    // OpenStreetMap Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    markerGroup.current.addTo(map.current);
  }, []);

  // Harita marker'larını güncelle
  useEffect(() => {
    if (!map.current || !markerGroup.current) return;

    markerGroup.current.clearLayers();

    if (mapType === 'PRESSURE') {
      pressureData.forEach(node => {
        const baseline = node.baseline_pressure;
        const current = node.current_pressure;
        const percentage = (current / baseline) * 100;

        // Renk belirleme
        let color = '#276749'; // Mat yeşil (Normal)
        let intensity = '○';

        if (current < baseline * 0.7) {
          color = '#c53030'; // Mat kırmızı (Kritik)
          intensity = '●';
        } else if (current < baseline * 0.85) {
          color = '#c27803'; // Mat amber (Uyarı)
          intensity = '◐';
        }

        // Custom Icon
        const icon = L.divIcon({
          html: `
            <div style="
              background: ${color};
              width: 40px;
              height: 40px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              border: 3px solid white;
              box-shadow: 0 0 8px rgba(0,0,0,0.3);
              font-size: 16px;
            ">
              ◎
            </div>
          `,
          className: 'pressure-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([node.latitude, node.longitude], { icon }).addTo(markerGroup.current);

        // Popup içeriği
        marker.bindPopup(`
          <div style="font-family: sans-serif; width: 220px;">
            <strong style="font-size: 14px;">${node.district}</strong>
            <div style="margin-top: 8px; border-top: 1px solid #ddd; padding-top: 8px;">
              <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                <span>Basınç:</span>
                <strong>${current.toFixed(2)} bar</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                <span>Baseline:</span>
                <span>${baseline.toFixed(2)} bar</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                <span>Yüzde:</span>
                <span style="color: ${percentage < 70 ? '#dc2626' : percentage < 85 ? '#ea580c' : '#22c55e'};">
                  ${percentage.toFixed(0)}%
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 4px 0; color: #666;">
                <span>Şikayet:</span>
                <span>${node.complaint_count}</span>
              </div>
            </div>
          </div>
        `);
      });
    } else if (mapType === 'OUTAGE') {
      // Kesinti tespiti
      const outageData = monitor.getAllOutageData();
      
      BURSA_NETWORK_NODES.forEach(node => {
        const outage = outageData.find(o => o.district === node.district);
        const affected = outage?.affected_percentage || 0;

        let color = '#276749'; // Mat yeşil
        if (affected > 50) {
          color = '#c53030'; // Mat kırmızı (Aktif)
        } else if (affected > 20) {
          color = '#c27803'; // Mat amber (Planlı)
        }

        const icon = L.divIcon({
          html: `
            <div style="
              background: ${color};
              width: 40px;
              height: 40px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              border: 3px solid white;
              box-shadow: 0 0 8px rgba(0,0,0,0.3);
              font-size: 16px;
            ">
              ⦿
            </div>
          `,
          className: 'outage-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([node.latitude, node.longitude], { icon }).addTo(markerGroup.current);

        marker.bindPopup(`
          <div style="font-family: sans-serif; width: 220px;">
            <strong style="font-size: 14px;">${node.district}</strong>
            <div style="margin-top: 8px; border-top: 1px solid #ddd; padding-top: 8px;">
              <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                <span>Kesinti:</span>
                <strong>${affected.toFixed(0)}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                <span>Durum:</span>
                <span style="color: ${affected > 50 ? '#dc2626' : affected > 20 ? '#ea580c' : '#22c55e'};">
                  ${affected > 50 ? 'AKTIF' : affected > 20 ? 'PLANLANAN' : 'NORMAL'}
                </span>
              </div>
              ${outage?.affected_neighborhoods.length ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                  <small style="color: #666;">Etkilenen Mahalleler:</small>
                  <div style="font-size: 12px; color: #333; margin-top: 4px;">
                    ${outage.affected_neighborhoods.slice(0, 3).join(', ')}
                    ${outage.affected_neighborhoods.length > 3 ? '...' : ''}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `);
      });
    }
  }, [pressureData, mapType, complaints, monitor]);

  return (
    <div className="space-y-4">
      {/* Harita Container */}
      <div
        ref={mapContainer}
        className="w-full h-96 rounded-lg border-2 border-gray-300 shadow-lg"
        style={{ minHeight: '400px', background: '#f0f0f0' }}
      />

      {/* Açıklama */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="text-2xl text-green-700">○</div>
          <p className="text-xs font-semibold text-green-800 mt-1">
            {mapType === 'PRESSURE' ? 'Normal Basınç' : 'Normal'}
          </p>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="text-2xl text-amber-700">◐</div>
          <p className="text-xs font-semibold text-orange-800 mt-1">
            {mapType === 'PRESSURE' ? 'Düşük Basınç' : 'Planlı'}
          </p>
        </div>
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="text-2xl text-red-700">●</div>
          <p className="text-xs font-semibold text-red-800 mt-1">
            {mapType === 'PRESSURE' ? 'Kritik Basınç' : 'Aktif Kesinti'}
          </p>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-3">Node İstatistikleri</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="text-2xl font-bold text-blue-600">{BURSA_NETWORK_NODES.length}</p>
            <p className="text-xs text-gray-600">Toplam Node</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {pressureData.filter(p => p.current_pressure < p.baseline_pressure * 0.7).length}
            </p>
            <p className="text-xs text-gray-600">Kritik</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">
              {pressureData.filter(p => 
                p.current_pressure < p.baseline_pressure * 0.85 && 
                p.current_pressure >= p.baseline_pressure * 0.7
              ).length}
            </p>
            <p className="text-xs text-gray-600">Uyarı</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {pressureData.filter(p => p.current_pressure >= p.baseline_pressure * 0.85).length}
            </p>
            <p className="text-xs text-gray-600">Normal</p>
          </div>
        </div>
      </div>

      {/* Node Listesi */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Bölge Detayları</h4>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {pressureData.map(node => {
            const percentage = (node.current_pressure / node.baseline_pressure) * 100;
            let statusColor = 'bg-green-100 text-green-800';
            let statusText = 'Normal';

            if (percentage < 70) {
              statusColor = 'bg-red-100 text-red-800';
              statusText = 'KRİTİK';
            } else if (percentage < 85) {
              statusColor = 'bg-orange-100 text-orange-800';
              statusText = 'UYARI';
            }

            return (
              <div key={node.node_id} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">{node.district}</p>
                  <p className="text-xs text-gray-500">{node.current_pressure.toFixed(2)} / {node.baseline_pressure.toFixed(2)} bar</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                  {statusText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
