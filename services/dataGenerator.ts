/**
 * Bursa Bölgeleri ve Mahalleleri Veri Tabanı
 * Gerçekçi test verileri ile harita dağılımı
 */

export const BURSA_NEIGHBORHOODS: Record<string, string[]> = {
  'Nilüfer': ['Görükle', 'Yıldırım Hamamı', 'Çıkmaz', 'Orhan Gazi', 'Yalova Caddesi', 'Ahmet Yesevi', 'Değirmendaresi', 'Kirazlı'],
  'Osmangazi': ['Çekirge', 'Tophane', 'Muratiye', 'Fevzipaşa', 'Namık Kemal', 'Odunluk', 'Konak', 'Balat'],
  'Yıldırım': ['Millet', 'Emek', 'Altıparmak', 'Barbaros', 'Barış', 'Çavuş', 'Selimiye', 'Karanfil'],
  'Mudanya': ['Merkez', 'Kumyalı', 'Nusratiye', 'Orhangazi', 'Dönertepe', 'Pelitli', 'Aydınlı'],
  'Gemlik': ['Merkez', 'Sarıali', 'Tekke', 'Hacı Halit', 'Kayapınar', 'Altıbey', 'Mahalle'],
  'Gürsu': ['Merkez', 'Harmancık', 'Tepeören', 'Koru', 'Yenice'],
  'Kestel': ['Merkez', 'Ağaçlı', 'Çobanlar', 'Altay', 'Kıransalar'],
  'İnegöl': ['Merkez', 'Çiftçiler', 'Karacakaya', 'Çaltılı', 'Harmancık'],
  'Keles': ['Merkez', 'Konuralp', 'Uluabat', 'Akşiyan'],
  'Orhaneli': ['Merkez', 'Çatalçayır', 'Koyunbaba'],
  'İznik': ['Merkez', 'Değirmendere', 'Nikomidia', 'Yakaköy'],
  'Karacabey': ['Merkez', 'Karaçal', 'Maden', 'Akçapınar'],
  'Mustafakemalpaşa': ['Merkez', 'Yeniye', 'Safranbolu'],
  'Yenişehir': ['Merkez', 'Çaylıoğlu', 'Elmalı'],
  'Orhangazi': ['Merkez', 'Çiğili', 'Kayapa'],
  'Harmancık': ['Merkez', 'Çatalçayır', 'Kurşunlu'],
  'Büyükorhan': ['Merkez', 'Çevreköy']
};

/**
 * Rastgele Türkçe şikayet şablonları
 */
const COMPLAINT_TEMPLATES = [
  'Su basıncı çok düşük, {neighbourhood}de suyun akması durmuş',
  'Boru patlak {neighbourhood} caddesinde, su kaçıyor her taraftan',
  'Su kesintisi {neighbourhood}de 3 saattir devam ediyor',
  'Su kalitesi kötü, renk anormal, bulanık geliyor {neighbourhood}',
  'Fışkırma var {neighbourhood}de, su sıçrıyor sokakta',
  'Su kokuyor, garip kokusu var {neighbourhood}',
  '{neighbourhood}de kesinti var, hiç su gelmiyor',
  'Basınç çok düşük {neighbourhood}, su çıkmıyor',
  'Kırılmış boru {neighbourhood} caddesinde, acil bakım gerekli',
  'Su sızıntısı var {neighbourhood}, yolda su birikti',
  'Sızıntı nedeniyle sokak su bastı {neighbourhood}',
  'Bölgede su kesintisi {neighbourhood}, patlak boru var',
  'Patlak boru nedeniyle basınç düştü {neighbourhood}',
  'Müteahhit çalışması nedeniyle {neighbourhood} hattı kesildi',
  '{neighbourhood}de su kesiyor, gündüzleri problem yaşıyoruz',
];

const COMPLAINT_CATEGORIES = ['BASINC', 'KALITE', 'KESINTI', 'DIGER'];

/**
 * Rastgele şikayet oluştur
 */
export function generateRandomComplaints(count: number = 200) {
  const complaints = [];
  const districtNames = Object.keys(BURSA_NEIGHBORHOODS);
  
  for (let i = 0; i < count; i++) {
    const district = districtNames[Math.floor(Math.random() * districtNames.length)];
    const neighborhoods = BURSA_NEIGHBORHOODS[district];
    const neighbourhood = neighborhoods[Math.floor(Math.random() * neighborhoods.length)];
    
    const template = COMPLAINT_TEMPLATES[Math.floor(Math.random() * COMPLAINT_TEMPLATES.length)];
    const text = template.replace('{neighbourhood}', neighbourhood);
    
    const category = COMPLAINT_CATEGORIES[Math.floor(Math.random() * COMPLAINT_CATEGORIES.length)];
    
    // Zamanları dağıt (son 7 gün içinde)
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(createdAt.getHours() - hoursAgo);
    createdAt.setMinutes(createdAt.getMinutes() - minutesAgo);
    
    // Bazı şikayetlerin çok tepki aldığını simüle et
    const likes = Math.random() > 0.7 ? Math.floor(Math.random() * 50) + 5 : Math.floor(Math.random() * 15);
    
    complaints.push({
      id: `complaint-${i + 1}`,
      user_id: `user-${Math.floor(Math.random() * 500) + 1}`,
      user_name: ['Ahmet', 'Fatma', 'Mehmet', 'Ayşe', 'Ali', 'Zeynep', 'Mustafa', 'Emine', 'Hasan', 'Leyla'][Math.floor(Math.random() * 10)] + 
                 ' ' + 
                 ['Yılmaz', 'Arslan', 'Kaya', 'Demir', 'Çınar', 'Kaplan', 'Gül', 'Topçu', 'Akman', 'Berk'][Math.floor(Math.random() * 10)],
      district,
      neighborhood: neighbourhood,
      text,
      category,
      created_at: createdAt.toISOString(),
      status: 'OPEN',
      likes,
      likedBy: Array(likes).fill(0).map((_, idx) => `user-${Math.floor(Math.random() * 500) + 1}`),
      adminReply: Math.random() > 0.8 ? 'BUSKİ yetkilileri tarafından gereken işlemler yapılmıştır.' : undefined
    });
  }
  
  return complaints;
}

/**
 * Basınç seviyeleri oluştur (bölge bazında)
 */
export function generatePressureData() {
  const districtNames = Object.keys(BURSA_NEIGHBORHOODS);
  const pressureData: Record<string, {
    current: number;
    baseline: number;
    status: 'NORMAL' | 'LOW' | 'CRITICAL';
    lastUpdate: string;
  }> = {};
  
  districtNames.forEach(district => {
    const baseline = 2.5 + Math.random() * 1; // 2.5 - 3.5 bar
    const current = baseline * (0.7 + Math.random() * 0.3); // 70-100% of baseline
    
    pressureData[district] = {
      current: parseFloat(current.toFixed(2)),
      baseline: parseFloat(baseline.toFixed(2)),
      status: current < 1.8 ? 'CRITICAL' : current < 2.2 ? 'LOW' : 'NORMAL',
      lastUpdate: new Date().toISOString()
    };
  });
  
  return pressureData;
}

/**
 * Kesinti bilgileri oluştur
 */
export function generateOutageData() {
  const districtNames = Object.keys(BURSA_NEIGHBORHOODS);
  const outageData: Record<string, {
    status: 'ACTIVE' | 'PLANNED' | 'RESOLVED';
    percentage: number;
    affectedAreas: number;
    estimatedEndTime: string;
  }> = {};
  
  districtNames.forEach(district => {
    const hasOutage = Math.random() > 0.7;
    const percentage = hasOutage ? Math.floor(Math.random() * 100) : 0;
    
    outageData[district] = {
      status: percentage === 0 ? 'RESOLVED' : Math.random() > 0.5 ? 'ACTIVE' : 'PLANNED',
      percentage,
      affectedAreas: Math.ceil((BURSA_NEIGHBORHOODS[district].length * percentage) / 100),
      estimatedEndTime: new Date(Date.now() + Math.random() * 86400000).toISOString()
    };
  });
  
  return outageData;
}
