import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Sentetik data - MVP için statik
// Gerçek uygulamada API'den çekilecek
const MOCK_PRIORITY_DATA = [
  { priority: 1, pipe_id: 'P-NIL-001', dma_id: 'DMA-Nilüfer', district: 'Nilüfer', material: 'FONT', age: 35, risk_score: 92.4, lat_start: 40.2120, lng_start: 28.9500, lat_end: 40.2140, lng_end: 28.9520 },
  { priority: 2, pipe_id: 'P-OSM-012', dma_id: 'DMA-Osmangazi', district: 'Osmangazi', material: 'AC', age: 42, risk_score: 89.1, lat_start: 40.1920, lng_start: 29.0300, lat_end: 40.1945, lng_end: 29.0330 },
  { priority: 3, pipe_id: 'P-YIL-008', dma_id: 'DMA-Yıldırım', district: 'Yıldırım', material: 'FONT', age: 38, risk_score: 85.7, lat_start: 40.2050, lng_start: 29.0800, lat_end: 40.2070, lng_end: 29.0825 },
  { priority: 4, pipe_id: 'P-NIL-045', dma_id: 'DMA-Nilüfer', district: 'Nilüfer', material: 'ÇELİK', age: 28, risk_score: 82.3, lat_start: 40.2180, lng_start: 28.9400, lat_end: 40.2200, lng_end: 28.9430 },
  { priority: 5, pipe_id: 'P-GEM-003', dma_id: 'DMA-Gemlik', district: 'Gemlik', material: 'AC', age: 45, risk_score: 79.8, lat_start: 40.4320, lng_start: 29.1550, lat_end: 40.4340, lng_end: 29.1580 },
  { priority: 6, pipe_id: 'P-OSM-089', dma_id: 'DMA-Osmangazi', district: 'Osmangazi', material: 'FONT', age: 31, risk_score: 77.2, lat_start: 40.1880, lng_start: 29.0250, lat_end: 40.1900, lng_end: 29.0280 },
  { priority: 7, pipe_id: 'P-INE-022', dma_id: 'DMA-İnegöl', district: 'İnegöl', material: 'FONT', age: 33, risk_score: 74.6, lat_start: 40.0820, lng_start: 29.5120, lat_end: 40.0845, lng_end: 29.5150 },
  { priority: 8, pipe_id: 'P-YIL-056', dma_id: 'DMA-Yıldırım', district: 'Yıldırım', material: 'ÇELİK', age: 25, risk_score: 72.1, lat_start: 40.2010, lng_start: 29.0750, lat_end: 40.2030, lng_end: 29.0775 },
  { priority: 9, pipe_id: 'P-MUD-011', dma_id: 'DMA-Mudanya', district: 'Mudanya', material: 'AC', age: 40, risk_score: 69.5, lat_start: 40.3760, lng_start: 28.8830, lat_end: 40.3780, lng_end: 28.8860 },
  { priority: 10, pipe_id: 'P-KES-007', dma_id: 'DMA-Kestel', district: 'Kestel', material: 'FONT', age: 29, risk_score: 67.3, lat_start: 40.2020, lng_start: 29.2120, lat_end: 40.2040, lng_end: 29.2150 },
  { priority: 11, pipe_id: 'P-NIL-123', dma_id: 'DMA-Nilüfer', district: 'Nilüfer', material: 'FONT', age: 26, risk_score: 64.8, lat_start: 40.2200, lng_start: 28.9350, lat_end: 40.2220, lng_end: 28.9380 },
  { priority: 12, pipe_id: 'P-OSM-156', dma_id: 'DMA-Osmangazi', district: 'Osmangazi', material: 'ÇELİK', age: 22, risk_score: 62.4, lat_start: 40.1950, lng_start: 29.0400, lat_end: 40.1970, lng_end: 29.0430 },
  { priority: 13, pipe_id: 'P-KAR-004', dma_id: 'DMA-Karacabey', district: 'Karacabey', material: 'AC', age: 38, risk_score: 59.9, lat_start: 40.2180, lng_start: 28.3620, lat_end: 40.2200, lng_end: 28.3650 },
  { priority: 14, pipe_id: 'P-YIL-098', dma_id: 'DMA-Yıldırım', district: 'Yıldırım', material: 'FONT', age: 24, risk_score: 57.5, lat_start: 40.2080, lng_start: 29.0850, lat_end: 40.2100, lng_end: 29.0880 },
  { priority: 15, pipe_id: 'P-GEM-019', dma_id: 'DMA-Gemlik', district: 'Gemlik', material: 'ÇELİK', age: 20, risk_score: 55.1, lat_start: 40.4350, lng_start: 29.1600, lat_end: 40.4370, lng_end: 29.1630 },
  { priority: 16, pipe_id: 'P-INE-067', dma_id: 'DMA-İnegöl', district: 'İnegöl', material: 'FONT', age: 27, risk_score: 52.8, lat_start: 40.0860, lng_start: 29.5080, lat_end: 40.0880, lng_end: 29.5110 },
  { priority: 17, pipe_id: 'P-MUD-034', dma_id: 'DMA-Mudanya', district: 'Mudanya', material: 'FONT', age: 23, risk_score: 50.4, lat_start: 40.3790, lng_start: 28.8780, lat_end: 40.3810, lng_end: 28.8810 },
  { priority: 18, pipe_id: 'P-NIL-201', dma_id: 'DMA-Nilüfer', district: 'Nilüfer', material: 'PVC', age: 18, risk_score: 48.1, lat_start: 40.2240, lng_start: 28.9450, lat_end: 40.2260, lng_end: 28.9480 },
  { priority: 19, pipe_id: 'P-OSM-234', dma_id: 'DMA-Osmangazi', district: 'Osmangazi', material: 'HDPE', age: 12, risk_score: 45.7, lat_start: 40.2000, lng_start: 29.0350, lat_end: 40.2020, lng_end: 29.0380 },
  { priority: 20, pipe_id: 'P-KES-041', dma_id: 'DMA-Kestel', district: 'Kestel', material: 'PVC', age: 15, risk_score: 43.3, lat_start: 40.2050, lng_start: 29.2080, lat_end: 40.2070, lng_end: 29.2110 },
];

const METRICS = {
  avg_mnf_lps: 8.42,
  estimated_ili: 3.2,
  monthly_failures: 4.7,
  total_failures_year: 56,
};

// Risk rengini hesapla - Mat kurumsal tonlar
function getRiskColor(score: number): string {
  if (score >= 80) return '#c53030'; // Mat kırmızı - Kritik
  if (score >= 60) return '#c27803'; // Mat amber - Yüksek
  if (score >= 40) return '#b7791f'; // Mat sarı - Orta
  return '#276749'; // Mat yeşil - Düşük
}

// Risk seviyesi text
function getRiskLevel(score: number): string {
  if (score >= 80) return 'Kritik';
  if (score >= 60) return 'Yüksek';
  if (score >= 40) return 'Orta';
  return 'Düşük';
}

export const PipeRiskDashboard: React.FC = () => {
  const [selectedPipe, setSelectedPipe] = useState<typeof MOCK_PRIORITY_DATA[0] | null>(null);
  const [view, setView] = useState<'table' | 'map'>('table');

  // Bursa merkez
  const center: [number, number] = [40.1885, 29.0610];

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#1a2332',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{ 
        padding: '16px 24px',
        backgroundColor: '#1a2332',
        borderBottom: '1px solid #2d3748',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            Boru Risk Önceliklendirme
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#718096' }}>
            30 günlük patlak riski tahmin modülü
          </p>
        </div>
        
        {/* Metrikler */}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#2c5282' }}>{METRICS.avg_mnf_lps}</div>
            <div style={{ fontSize: '11px', color: '#718096' }}>MNF (L/s)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#c27803' }}>{METRICS.estimated_ili}</div>
            <div style={{ fontSize: '11px', color: '#718096' }}>ILI</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#c53030' }}>{METRICS.monthly_failures}</div>
            <div style={{ fontSize: '11px', color: '#718096' }}>Arıza/Ay</div>
          </div>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setView('table')}
            style={{
              padding: '8px 16px',
              backgroundColor: view === 'table' ? '#2c5282' : 'transparent',
              border: '1px solid #2c5282',
              borderRadius: '4px',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Tablo
          </button>
          <button
            onClick={() => setView('map')}
            style={{
              padding: '8px 16px',
              backgroundColor: view === 'map' ? '#2c5282' : 'transparent',
              border: '1px solid #2c5282',
              borderRadius: '4px',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Harita
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {view === 'table' ? (
          /* Tablo Görünümü */
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              backgroundColor: '#2d3748',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#1a2332' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Boru ID</th>
                  <th style={thStyle}>DMA</th>
                  <th style={thStyle}>İlçe</th>
                  <th style={thStyle}>Malzeme</th>
                  <th style={thStyle}>Yaş</th>
                  <th style={thStyle}>Risk Skoru</th>
                  <th style={thStyle}>Seviye</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PRIORITY_DATA.map((pipe) => (
                  <tr 
                    key={pipe.pipe_id}
                    onClick={() => setSelectedPipe(pipe)}
                    style={{ 
                      cursor: 'pointer',
                      backgroundColor: selectedPipe?.pipe_id === pipe.pipe_id ? '#3d4a5c' : 'transparent',
                      borderBottom: '1px solid #1a2332'
                    }}
                  >
                    <td style={tdStyle}>{pipe.priority}</td>
                    <td style={tdStyle}>{pipe.pipe_id}</td>
                    <td style={tdStyle}>{pipe.dma_id}</td>
                    <td style={tdStyle}>{pipe.district}</td>
                    <td style={tdStyle}>{pipe.material}</td>
                    <td style={tdStyle}>{pipe.age} yıl</td>
                    <td style={tdStyle}>
                      <span style={{ 
                        fontWeight: 600, 
                        color: getRiskColor(pipe.risk_score) 
                      }}>
                        {pipe.risk_score}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        backgroundColor: getRiskColor(pipe.risk_score) + '20',
                        color: getRiskColor(pipe.risk_score),
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        {getRiskLevel(pipe.risk_score)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Seçili Boru Detayı */}
            {selectedPipe && (
              <div style={{ 
                marginTop: '16px', 
                padding: '16px', 
                backgroundColor: '#2d3748',
                borderRadius: '6px',
                border: `2px solid ${getRiskColor(selectedPipe.risk_score)}`
              }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>
                  {selectedPipe.pipe_id} Detayları
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  <div>
                    <div style={{ color: '#718096', fontSize: '12px' }}>Konum (Başlangıç)</div>
                    <div>{selectedPipe.lat_start.toFixed(4)}, {selectedPipe.lng_start.toFixed(4)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#718096', fontSize: '12px' }}>Konum (Bitiş)</div>
                    <div>{selectedPipe.lat_end.toFixed(4)}, {selectedPipe.lng_end.toFixed(4)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#718096', fontSize: '12px' }}>Risk Skoru</div>
                    <div style={{ color: getRiskColor(selectedPipe.risk_score), fontWeight: 600 }}>
                      {selectedPipe.risk_score} / 100
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#718096', fontSize: '12px' }}>Öneri</div>
                    <div style={{ fontSize: '13px' }}>
                      {selectedPipe.risk_score >= 80 
                        ? 'Acil kontrol gerekli'
                        : selectedPipe.risk_score >= 60
                        ? '30 gün içinde kontrol'
                        : 'Rutin bakım listesine ekle'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Harita Görünümü */
          <div style={{ flex: 1, position: 'relative' }}>
            <MapContainer
              center={center}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <ZoomControl position="bottomright" />
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              
              {/* Risk borularını çiz */}
              {MOCK_PRIORITY_DATA.map((pipe) => (
                <Polyline
                  key={pipe.pipe_id}
                  positions={[
                    [pipe.lat_start, pipe.lng_start],
                    [pipe.lat_end, pipe.lng_end]
                  ]}
                  pathOptions={{
                    color: getRiskColor(pipe.risk_score),
                    weight: pipe.priority <= 5 ? 6 : 4,
                    opacity: 0.9
                  }}
                  eventHandlers={{
                    click: () => setSelectedPipe(pipe)
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: '13px' }}>
                      <strong>{pipe.pipe_id}</strong><br/>
                      DMA: {pipe.dma_id}<br/>
                      Malzeme: {pipe.material} ({pipe.age} yıl)<br/>
                      <span style={{ color: getRiskColor(pipe.risk_score), fontWeight: 600 }}>
                        Risk: {pipe.risk_score}
                      </span>
                    </div>
                  </Popup>
                </Polyline>
              ))}
            </MapContainer>

            {/* Harita Lejant */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              backgroundColor: '#2d3748',
              padding: '12px',
              borderRadius: '6px',
              zIndex: 1000,
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Risk Seviyeleri</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '20px', height: '4px', backgroundColor: '#c53030', borderRadius: '2px' }}></span>
                  Kritik (80+)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '20px', height: '4px', backgroundColor: '#c27803', borderRadius: '2px' }}></span>
                  Yüksek (60-79)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '20px', height: '4px', backgroundColor: '#b7791f', borderRadius: '2px' }}></span>
                  Orta (40-59)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '20px', height: '4px', backgroundColor: '#276749', borderRadius: '2px' }}></span>
                  Düşük (&lt;40)
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ 
        padding: '8px 24px', 
        backgroundColor: '#1a2332',
        borderTop: '1px solid #2d3748',
        fontSize: '11px',
        color: '#718096',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>Bu bir karar destek aracıdır. Garanti veya bağlayıcı taahhüt içermez.</span>
        <span>Son güncelleme: {new Date().toLocaleDateString('tr-TR')}</span>
      </footer>
    </div>
  );
};

// Stil sabitleri
const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: '#718096',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '13px',
  color: '#e2e8f0'
};

export default PipeRiskDashboard;
