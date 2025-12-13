# 🎯 Boru Patlak Riski Önceliklendirme Modülü

## Tek Cümlelik Ürün Tanımı

> **"Önümüzdeki 30 günde patlama riski en yüksek 20 boru kesimini tahmin eden ve bakım ekibine öncelik listesi çıkaran karar destek aracı."**

---

## ❌ Kapsam Dışı (MVP'de YOK)

- Vatandaş mobil uygulaması
- Sosyal özellikler (beğeni, yorum)
- PDF rapor oluşturma
- Animasyonlu harita katmanları
- "En akıllı şehir" vizyonu
- Gerçek zamanlı bildirim sistemi

---

## ✅ MVP Kapsamı

### Girdi
- 1 yıllık sensör verisi (basınç, debi, MNF)
- Arıza logları (geçmiş patlamalar)
- Boru envanteri (yaş, çap, malzeme, DMA)
- Şikayet yoğunluğu (opsiyonel çarpan)

### Çıktı
1. **Tablo**: Boru ID, DMA, Risk Skoru, Geçmiş Arıza Sayısı, Öncelik Sırası
2. **Harita**: İlk 20 riskli boruyu gösteren tek katman (kırmızı-turuncu-sarı)

---

## 📊 Veri Şeması

### 1. pipes.csv - Boru Envanteri
| Alan | Tip | Açıklama |
|------|-----|----------|
| pipe_id | string | Benzersiz boru kimliği |
| dma_id | string | DMA (District Metered Area) |
| district | string | İlçe adı |
| material | enum | PVC, HDPE, FONT, ÇELİK, AC |
| diameter_mm | int | Boru çapı (mm) |
| length_m | float | Boru uzunluğu (m) |
| install_year | int | Döşeme yılı |
| depth_m | float | Gömü derinliği |
| lat_start | float | Başlangıç enlemi |
| lng_start | float | Başlangıç boylamı |
| lat_end | float | Bitiş enlemi |
| lng_end | float | Bitiş boylamı |

### 2. sensor_readings.csv - Sensör Verileri
| Alan | Tip | Açıklama |
|------|-----|----------|
| timestamp | datetime | Ölçüm zamanı |
| sensor_id | string | Sensör kimliği |
| pipe_id | string | Bağlı boru |
| pressure_bar | float | Basınç (bar) |
| flow_lps | float | Debi (L/s) |
| is_night | bool | Gece ölçümü mü (02:00-04:00) |

### 3. failures.csv - Arıza Logları
| Alan | Tip | Açıklama |
|------|-----|----------|
| failure_id | string | Arıza kimliği |
| pipe_id | string | Arızalı boru |
| failure_date | date | Arıza tarihi |
| failure_type | enum | PATLAK, SIZINTI, CONTA, VANA |
| repair_hours | float | Onarım süresi (saat) |
| water_loss_m3 | float | Kayıp su (m³) |

### 4. complaints.csv - Şikayet Verileri (Opsiyonel)
| Alan | Tip | Açıklama |
|------|-----|----------|
| complaint_id | string | Şikayet kimliği |
| pipe_id | string | İlişkili boru (nullable) |
| dma_id | string | DMA |
| complaint_date | date | Şikayet tarihi |
| category | enum | BASINC, KESINTI, SIZINTI, KALITE |

---

## 🧮 Risk Skoru Hesaplama

### Formül (v1 - Basit Ağırlıklı)

```
Risk_Skoru = (
    w1 × Yaş_Faktörü +
    w2 × Malzeme_Faktörü +
    w3 × Arıza_Geçmişi +
    w4 × Basınç_Anomali +
    w5 × MNF_Sapma
) × Şikayet_Çarpanı
```

### Ağırlıklar (Varsayılan)
| Faktör | Ağırlık | Açıklama |
|--------|---------|----------|
| w1 | 0.25 | Boru yaşı (30+ yıl = yüksek risk) |
| w2 | 0.20 | Malzeme (AC, FONT = yüksek risk) |
| w3 | 0.25 | Son 2 yılda arıza sayısı |
| w4 | 0.15 | Ortalama basınçtan sapma |
| w5 | 0.15 | Gece minimum debisi anomalisi |

### Şikayet Çarpanı
```
1.0 + (şikayet_sayısı_son_30_gün × 0.1)
```
Maksimum: 1.5

---

## 📈 Temel Metrikler

### İzlenecek KPI'lar
| Metrik | Formül | Hedef |
|--------|--------|-------|
| MNF (Gece Min. Debi) | Ortalama 02:00-04:00 debisi | Azalma trendi |
| ILI (Altyapı Kaçak İndeksi) | Gerçek kayıp / Kaçınılmaz kayıp | < 4.0 |
| Arıza Tahmin Doğruluğu | Tahmin edilen / Gerçekleşen | > %60 |

### ⚠️ Taahhüt Sınırları
- **Bu bir karar destek aracıdır, bağlayıcı taahhüt değildir**
- Kesin kayıp azaltma oranları belirtilmez
- "Önceliklendirme doğruluğunu test ediyoruz" ifadesi kullanılır

---

## 🖥️ MVP Ekran Tasarımı

### Tek Sayfa: Risk Öncelik Listesi

```
┌─────────────────────────────────────────────────────────────────┐
│  🔴 Boru Patlak Risk Önceliklendirme                    [Tarih] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │                      │  │  # │ Boru ID  │ DMA    │ Risk  │ │
│  │      HARİTA          │  │  1 │ P-OSM-42 │ DMA-05 │ 87.3  │ │
│  │   (Leaflet - Basit)  │  │  2 │ P-NIL-18 │ DMA-12 │ 82.1  │ │
│  │                      │  │  3 │ P-YIL-33 │ DMA-08 │ 79.5  │ │
│  │   🔴 Kritik (>80)    │  │  4 │ P-GEM-07 │ DMA-15 │ 76.8  │ │
│  │   🟠 Yüksek (60-80)  │  │  5 │ P-OSM-91 │ DMA-03 │ 74.2  │ │
│  │   🟡 Orta (40-60)    │  │  │    ...    │        │       │ │
│  │                      │  │ 20 │ P-INE-55 │ DMA-21 │ 52.4  │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ MNF: 124 L/s (↓3.2%)  │  ILI: 3.8  │  Arıza/Ay: 12        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Yasal ve Güvenlik Sınırları

### KVKK Uyumu
- Vatandaş verileri anonimleştirilir
- Şikayet verileri sadece DMA bazında aggregate edilir
- Kişisel bilgi saklanmaz

### SCADA Güvenliği
- Salt okunur veri erişimi
- Kontrol komutu gönderilmez
- Offline veri işleme tercih edilir

### Sorumluluk Reddi
```
Bu araç, bakım planlama süreçlerinde karar desteği sağlamak 
amacıyla geliştirilmiştir. Nihai kararlar yetkili mühendisler 
tarafından verilmelidir. Tahminlerin doğruluğu garantilenmez.
```

---

## 📁 Dosya Yapısı (MVP)

```
core/
├── README.md           # Bu dosya
├── data/
│   ├── pipes.csv       # Boru envanteri
│   ├── sensors.csv     # Sensör okumaları
│   ├── failures.csv    # Arıza logları
│   └── complaints.csv  # Şikayet verileri
├── risk_model.py       # Risk skoru hesaplama
├── data_loader.py      # CSV okuma
└── app.py              # Minimal web arayüz (Flask/FastAPI)
```

---

## Eski vs Yeni Karşılaştırma

| Eski Yaklaşım | Yeni Çekirdek |
|---------------|---------------|
| "En akıllı su yönetim şehri" vizyonu | "20 riskli boru öncelik listesi" |
| Mobil app, sosyal beğeni, PDF, AI | Tek web ekran: tablo + harita |
| %30 kayıp, %40 maliyet vaadi | MNF/ILI değişimi test planı |
| 17 katmanlı harita | 1 katman, 3 renk |
| Gemini API bildirimleri | Yok |
| Vatandaş uygulaması | Şikayet sadece çarpan olarak |

---

## Sonraki Adım

1. `data/` klasörüne sentetik veri üret
2. `risk_model.py` ile basit skor hesapla
3. Minimal Flask app ile tablo + harita göster
4. 1 sayfalık hackathon sunumu hazırla
