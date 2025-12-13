import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, ZoomControl, CircleMarker } from 'react-leaflet';
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

// Şikayet kategorileri ve renkleri
const COMPLAINT_COLORS: Record<string, string> = {
  'PATLAK': '#ef4444',
  'BASINC_DUSUK': '#f97316',
  'KALITE': '#8b5cf6',
  'KESINTI': '#3b82f6',
  'SIZINTI': '#06b6d4',
  'DIGER': '#6b7280'
};

const COMPLAINT_LABELS: Record<string, string> = {
  'PATLAK': 'Patlak',
  'BASINC_DUSUK': 'Basınç Düşük',
  'KALITE': 'Su Kalitesi',
  'KESINTI': 'Kesinti',
  'SIZINTI': 'Sızıntı',
  'DIGER': 'Diğer'
};

// Borulara yakın şikayetler oluştur
function generateComplaints() {
  const complaints: Array<{
    id: string;
    lat: number;
    lng: number;
    category: string;
    priority: string;
    text: string;
    district: string;
    citizenName: string;
    createdAt: string;
    pipeId: string;
  }> = [];
  
  const categories = [
    { cat: 'PATLAK', priority: 'ACIL', texts: [
      'Beyler sokağın ortasında boru patlamış, her yer su içinde kaldı!',
      'Acil yardım lazım, ana boru patladı su fışkırıyor resmen',
      'Yolun ortasında havuz oluştu, arabalar geçemiyor artık',
      'Boru patlamış galiba, bodrum katı su bastı bizim',
      'Komşular toplanmış bakıyoruz su çıkıyor yerden, ne yapacağız?',
      'Sabahtan beri su akıyor sokağa, israf resmen ya',
      'Kapının önü göl oldu, çocukları okula nasıl göndereceğim?'
    ]},
    { cat: 'BASINC_DUSUK', priority: 'YUKSEK', texts: [
      'Su damla damla geliyor, duş alamıyoruz artık',
      'Üst kata su çıkmıyor, kombi de çalışmıyor bu basınçla',
      '3. katta oturuyorum, musluktan hava geliyor su değil',
      'Çamaşır makinesi dolmuyor, basınç yok hiç',
      'Mutfakta bulaşık yıkayamıyorum, su gelmiyor düzgün',
      'Sabah 6da kalkıp duş almaya çalışıyorum, o saatte bile basınç yok',
      'Tüm mahalle aynı durumda, kimsenin evine su gitmiyor düzgün'
    ]},
    { cat: 'KALITE', priority: 'NORMAL', texts: [
      'Su sarı sarı geliyor, içilecek gibi değil vallahi',
      'Musluktan çamurlu su akıyor, çocuklara içiremiyorum',
      'Suda garip bir koku var, banyo bile yapamıyoruz',
      'Beyaz çamaşırlar sarardı bu sudan, ne yapacağız?',
      'Su bulanık geliyor, dinlendiriyoruz sonra kullanıyoruz mecbur',
      'Paslı su geliyor, boru mu eskidi acaba?',
      'Tortu bırakıyor su, elektrikli süpürge gibi temizliyorum musluğu'
    ]},
    { cat: 'KESINTI', priority: 'YUKSEK', texts: [
      '2 gündür su yok, ne zaman gelecek acaba?',
      'Planlı kesinti dediler 4 saat, 12 saat oldu hala yok',
      'Mahallemizde sabahtan beri su kesildi, haber de yok',
      'İşe geç kaldım duş alamadım, su kesikti yine',
      'Yaşlı annem evde tek, su yok ilaçlarını içemiyor',
      'Bebek var evde, mama yapamıyoruz su olmayınca',
      'Her hafta kesinti var, artık bıktık gerçekten'
    ]},
    { cat: 'SIZINTI', priority: 'NORMAL', texts: [
      'Kaldırımın altından su sızıyor, görmüyor musunuz?',
      'Vana kapağından su akıyor haftalardır, kimse bakmıyor',
      'Bahçe duvarının dibinde ıslaklık var sürekli',
      'Yol kenarında su birikintisi oluşuyor, kışın buz tutacak tehlikeli',
      'Alt komşu şikayet ediyor, bizim borudan sızıntı varmış',
      'Park yerinde su sızıntısı var, arabalar pas tutuyor',
      'Apartman girişinde su birikti, kim ilgilenecek bununla?'
    ]},
  ];
  
  const names = ['Ahmet Yılmaz', 'Fatma Demir', 'Mehmet Kaya', 'Ayşe Çelik', 'Ali Öztürk', 'Zeynep Arslan', 'Mustafa Şahin', 'Elif Yıldız', 'Hasan Koç', 'Hatice Aydın', 'İbrahim Aksoy', 'Emine Özkan'];
  
  // Yüksek riskli borulara daha fazla şikayet
  MOCK_PRIORITY_DATA.forEach((pipe, idx) => {
    // Risk skoru yüksekse daha fazla şikayet
    const complaintCount = pipe.risk_score >= 80 ? 4 : pipe.risk_score >= 60 ? 3 : pipe.risk_score >= 40 ? 2 : 1;
    
    for (let i = 0; i < complaintCount; i++) {
      // Borunun ortasına yakın rastgele konum
      const midLat = (pipe.lat_start + pipe.lat_end) / 2 + (Math.random() - 0.5) * 0.004;
      const midLng = (pipe.lng_start + pipe.lng_end) / 2 + (Math.random() - 0.5) * 0.004;
      
      // Yüksek riskli borularda ciddi kategoriler
      let catInfo;
      if (pipe.risk_score >= 80) {
        catInfo = categories[Math.floor(Math.random() * 2)]; // PATLAK veya BASINC
      } else if (pipe.risk_score >= 60) {
        catInfo = categories[Math.floor(Math.random() * 3)];
      } else {
        catInfo = categories[Math.floor(Math.random() * categories.length)];
      }
      
      complaints.push({
        id: `C-${pipe.pipe_id}-${i}`,
        lat: midLat,
        lng: midLng,
        category: catInfo.cat,
        priority: catInfo.priority,
        text: catInfo.texts[Math.floor(Math.random() * catInfo.texts.length)],
        district: pipe.district,
        citizenName: names[Math.floor(Math.random() * names.length)],
        createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
        pipeId: pipe.pipe_id
      });
    }
  });
  
  // Daha fazla rastgele konum (merkez etrafında)
  for (let i = 0; i < 25; i++) {
    const catInfo = categories[Math.floor(Math.random() * categories.length)];
    complaints.push({
      id: `C-RANDOM-${i}`,
      lat: 40.1885 + (Math.random() - 0.5) * 0.2,
      lng: 29.0610 + (Math.random() - 0.5) * 0.4,
      category: catInfo.cat,
      priority: catInfo.priority,
      text: catInfo.texts[Math.floor(Math.random() * catInfo.texts.length)],
      district: ['Nilüfer', 'Osmangazi', 'Yıldırım', 'Gemlik', 'İnegöl', 'Mudanya'][Math.floor(Math.random() * 6)],
      citizenName: names[Math.floor(Math.random() * names.length)],
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      pipeId: ''
    });
  }
  
  return complaints;
}

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
  const [showComplaints, setShowComplaints] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<ReturnType<typeof generateComplaints>[0] | null>(null);
  
  // Şikayetleri oluştur (memoized)
  const complaints = useMemo(() => generateComplaints(), []);

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
            30 günlük patlak riski tahmin modülü • {complaints.length} Şikayet
          </p>
        </div>
        
        {/* Metrikler */}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ 
            textAlign: 'center', 
            padding: '8px 16px', 
            backgroundColor: 'rgba(59, 130, 246, 0.15)', 
            borderRadius: '8px',
            border: '1px solid rgba(59, 130, 246, 0.4)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6', textShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}>{METRICS.avg_mnf_lps}</div>
            <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 500 }}>MNF (L/s)</div>
          </div>
          <div style={{ 
            textAlign: 'center', 
            padding: '8px 16px', 
            backgroundColor: 'rgba(245, 158, 11, 0.15)', 
            borderRadius: '8px',
            border: '1px solid rgba(245, 158, 11, 0.4)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#fbbf24', textShadow: '0 0 10px rgba(251, 191, 36, 0.5)' }}>{METRICS.estimated_ili}</div>
            <div style={{ fontSize: '11px', color: '#fcd34d', fontWeight: 500 }}>ILI</div>
          </div>
          <div style={{ 
            textAlign: 'center', 
            padding: '8px 16px', 
            backgroundColor: 'rgba(239, 68, 68, 0.15)', 
            borderRadius: '8px',
            border: '1px solid rgba(239, 68, 68, 0.4)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#f87171', textShadow: '0 0 10px rgba(248, 113, 113, 0.5)' }}>{METRICS.monthly_failures}</div>
            <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 500 }}>Arıza/Ay</div>
          </div>
          <div style={{ 
            textAlign: 'center', 
            padding: '8px 16px', 
            backgroundColor: 'rgba(251, 146, 60, 0.15)', 
            borderRadius: '8px',
            border: '1px solid rgba(251, 146, 60, 0.4)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#fb923c', textShadow: '0 0 10px rgba(251, 146, 60, 0.5)' }}>{complaints.length}</div>
            <div style={{ fontSize: '11px', color: '#fdba74', fontWeight: 500 }}>Şikayet</div>
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
            {/* Harita Kontrolleri - Sağ Üst */}
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 1000,
              display: 'flex',
              gap: '8px'
            }}>
              <button
                onClick={() => setShowComplaints(!showComplaints)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: showComplaints ? '#f97316' : 'rgba(26, 35, 50, 0.95)',
                  border: showComplaints ? '2px solid #fb923c' : '2px solid rgba(251, 146, 60, 0.5)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: showComplaints ? '0 0 15px rgba(249, 115, 22, 0.5)' : '0 2px 8px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📍 Şikayetler ({complaints.length})
              </button>
            </div>
            <MapContainer
              center={center}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <ZoomControl position="bottomright" />
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
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

              {/* Şikayet Noktaları */}
              {showComplaints && complaints.map((complaint) => (
                <CircleMarker
                  key={complaint.id}
                  center={[complaint.lat, complaint.lng]}
                  radius={complaint.priority === 'ACIL' ? 10 : 7}
                  pathOptions={{
                    color: COMPLAINT_COLORS[complaint.category] || '#6b7280',
                    fillColor: COMPLAINT_COLORS[complaint.category] || '#6b7280',
                    fillOpacity: 0.8,
                    weight: 2
                  }}
                  eventHandlers={{
                    click: () => setSelectedComplaint(complaint)
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: '13px', minWidth: '180px' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        marginBottom: '8px'
                      }}>
                        <span style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          backgroundColor: COMPLAINT_COLORS[complaint.category] 
                        }}></span>
                        <strong>{COMPLAINT_LABELS[complaint.category]}</strong>
                        {complaint.priority === 'ACIL' && (
                          <span style={{ 
                            backgroundColor: '#dc2626', 
                            color: 'white', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            fontSize: '10px'
                          }}>ACİL</span>
                        )}
                      </div>
                      <div style={{ color: '#374151', marginBottom: '6px' }}>{complaint.text}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        📍 {complaint.district}<br/>
                        👤 {complaint.citizenName}<br/>
                        📅 {new Date(complaint.createdAt).toLocaleDateString('tr-TR')}
                        {complaint.pipeId && <><br/>🔗 {complaint.pipeId}</>}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>

            {/* Harita Lejant */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '12px',
              borderRadius: '6px',
              zIndex: 1000,
              fontSize: '12px',
              color: '#1a202c',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '8px', color: '#1a202c' }}>Risk Seviyeleri</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '20px', height: '4px', backgroundColor: '#c53030', borderRadius: '2px' }}></span>
                  <span style={{ color: '#374151' }}>Kritik (80+)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '20px', height: '4px', backgroundColor: '#c27803', borderRadius: '2px' }}></span>
                  <span style={{ color: '#374151' }}>Yüksek (60-79)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '20px', height: '4px', backgroundColor: '#b7791f', borderRadius: '2px' }}></span>
                  <span style={{ color: '#374151' }}>Orta (40-59)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '20px', height: '4px', backgroundColor: '#276749', borderRadius: '2px' }}></span>
                  <span style={{ color: '#374151' }}>Düşük (&lt;40)</span>
                </div>
              </div>

              {/* Şikayet Lejandı */}
              {showComplaints && (
                <>
                  <div style={{ fontWeight: 600, marginTop: '12px', marginBottom: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', color: '#1a202c' }}>
                    Şikayet Türleri
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '50%' }}></span>
                      <span style={{ color: '#374151' }}>Patlak</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: '#f97316', borderRadius: '50%' }}></span>
                      <span style={{ color: '#374151' }}>Basınç Düşük</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: '#8b5cf6', borderRadius: '50%' }}></span>
                      <span style={{ color: '#374151' }}>Su Kalitesi</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: '#3b82f6', borderRadius: '50%' }}></span>
                      <span style={{ color: '#374151' }}>Kesinti</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: '#06b6d4', borderRadius: '50%' }}></span>
                      <span style={{ color: '#374151' }}>Sızıntı</span>
                    </div>
                  </div>
                </>
              )}
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
