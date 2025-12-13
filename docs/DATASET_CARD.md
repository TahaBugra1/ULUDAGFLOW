# DATASET CARD: BUSKİ Pipe Network Dataset

## Veri Seti Özeti

| Özellik | Değer |
|---------|-------|
| **Veri Seti Adı** | BUSKI-PIPE-NETWORK-v1 |
| **Veri Tipi** | Yapısal (Tabular) + Geometrik (GeoJSON) |
| **Toplam Kayıt** | ~45,000 boru segmenti |
| **Zaman Aralığı** | 2018-01-01 — 2024-12-31 |
| **Güncelleme Sıklığı** | Günlük (SCADA), Haftalık (Arıza), Aylık (Envanter) |

---

## 1. Veri Kaynakları

### Birincil Kaynaklar

| Kaynak | Sistem | Veri Tipi | Güncelleme |
|--------|--------|-----------|------------|
| **SCADA** | Wonderware | Basınç, Debi | Gerçek zamanlı |
| **SAP PM** | SAP S/4HANA | Arıza kayıtları | İş emri kapatıldığında |
| **CBS** | ArcGIS Enterprise | Boru geometrisi | Proje tamamlandığında |
| **Şikayet Sistemi** | BUSKI Portal | Vatandaş bildirimleri | Anlık |

### Veri Akış Diyagramı

```
SCADA ──────┐
            │
SAP PM ─────┼───▶ ETL ───▶ Data Warehouse ───▶ ML Pipeline
            │                     │
CBS ────────┘                     ▼
                            Feature Store
```

---

## 2. Veri Alanları (Fields)

### Boru Temel Bilgileri

| Alan | Tip | Açıklama | Örnek |
|------|-----|----------|-------|
| `pipe_id` | string | Benzersiz boru tanımlayıcı | P-OSM-0317 |
| `dma_id` | string | DMA tanımlayıcı | DMA-OSM-02 |
| `district` | string | İlçe adı | Osmangazi |
| `material` | string | Malzeme tipi | FONT, AC, ÇELİK, PVC, HDPE, PE |
| `diameter_mm` | int | Boru çapı (mm) | 100, 150, 200, 300 |
| `length_m` | float | Boru uzunluğu (m) | 125.5 |
| `install_year` | int | Tesis yılı | 1985 |
| `pipe_age_years` | int | Hesaplanan yaş | 39 |

### Arıza Verileri

| Alan | Tip | Açıklama | Örnek |
|------|-----|----------|-------|
| `failure_id` | string | Arıza tanımlayıcı | F-2024-001234 |
| `failure_date` | datetime | Arıza tarihi | 2024-01-15T08:30:00 |
| `failure_type` | string | Arıza tipi | patlak, sizinti, çökme |
| `repair_duration_hours` | float | Onarım süresi | 4.5 |
| `affected_customers` | int | Etkilenen abone sayısı | 250 |
| `water_loss_m3` | float | Su kaybı (m³) | 150.0 |

### Operasyonel Metrikler

| Alan | Tip | Açıklama | Örnek |
|------|-----|----------|-------|
| `avg_pressure_bar` | float | Ortalama basınç | 4.2 |
| `min_pressure_bar` | float | Minimum basınç | 2.1 |
| `max_pressure_bar` | float | Maksimum basınç | 6.5 |
| `pressure_variation_pct` | float | Basınç varyasyonu % | 15.3 |
| `mnf_percentage` | float | Minimum gece akışı % | 23.5 |
| `ili` | float | Altyapı Kaçak İndeksi | 3.8 |

### Geometrik Veriler

| Alan | Tip | Açıklama | Örnek |
|------|-----|----------|-------|
| `geom_start` | [lat, lon] | Başlangıç koordinatı | [40.1920, 29.0300] |
| `geom_end` | [lat, lon] | Bitiş koordinatı | [40.1945, 29.0330] |
| `geometry` | GeoJSON | Tam geometri | LineString(...) |

---

## 3. Veri Kalitesi

### Tamamlılık

| Alan | Dolu Oran | Notlar |
|------|-----------|--------|
| `pipe_id` | 100% | Zorunlu alan |
| `material` | 98.5% | 1.5% bilinmiyor olarak işaretli |
| `install_year` | 92.3% | Eski kayıtlarda eksik |
| `failure_count` | 100% | 0 dahil hesaplanmış |
| `geometry` | 99.2% | CBS entegrasyonu sonrası |

### Doğruluk Kontrolleri

| Kontrol | Yöntem | Son Sonuç |
|---------|--------|-----------|
| Koordinat geçerliliği | Bursa sınırları içinde mi? | 99.8% geçerli |
| Yaş tutarlılığı | install_year + age = current_year | 100% tutarlı |
| Arıza tarihi | pipe install_year < failure_date | 99.9% tutarlı |
| DMA uyumu | pipe location ∈ DMA boundary | 98.7% uyumlu |

### Eksik Veri Stratejisi

| Alan | Strateji | Uygulama |
|------|----------|----------|
| `install_year` | Mahalle medyanı | 1978 (merkez), 1995 (çevre) |
| `material` | "BILINMIYOR" etiketi | Modelde ayrı kategori |
| `pressure` | Son 7 gün ortalaması | NaN → interpolasyon |

---

## 4. Veri Bölümleme

### Train/Validation/Test Split

```
2018-01    2021-06    2023-01    2024-06
│─────────────│──────────│──────────│
    TRAIN         VAL       TEST
    (60%)        (20%)      (20%)
```

### Stratified Sampling
- Her ilçeden orantılı örnekleme
- Arıza/non-arıza oranı korunmuş
- Mevsimsel dağılım dengelenmiş

---

## 5. Gizlilik ve Güvenlik

### Kişisel Veri İçeriği
- ❌ Müşteri isimleri
- ❌ Adres detayları
- ❌ Telefon numaraları
- ✅ Agregat sayılar (etkilenen abone sayısı)
- ✅ Bölge bazlı istatistikler

### Erişim Kontrolleri

| Rol | Erişim Seviyesi |
|-----|-----------------|
| Data Scientist | Tam (anonimleştirilmiş) |
| Bakım Mühendisi | Bölgesel (kendi DMA'sı) |
| Yönetici | Özet istatistikler |
| Dış kullanıcı | Erişim yok |

### Veri Saklama
- **Ham veri**: 7 yıl (yasal zorunluluk)
- **İşlenmiş veri**: 3 yıl
- **Model eğitim verileri**: Süresiz (anonimleştirilmiş)

---

## 6. Lisans ve Kullanım

### Lisans
**Dahili Kullanım - Kısıtlı**

Bu veri seti yalnızca BUSKİ ve yetkili ortakları tarafından, tanımlanmış amaçlar doğrultusunda kullanılabilir.

### İzin Verilen Kullanımlar
- ✅ Arıza tahmin modeli eğitimi
- ✅ Bakım optimizasyonu
- ✅ Kaynak planlama
- ✅ İç raporlama

### Yasak Kullanımlar
- ❌ Ticari satış
- ❌ Üçüncü taraf paylaşımı
- ❌ Bireysel müşteri hedefleme
- ❌ Açık veri olarak yayınlama

---

## 7. Bakım ve İletişim

### Veri Sahipliği

| Rol | Birim | Sorumluluk |
|-----|-------|------------|
| Veri Sahibi | BUSKİ IT | Veri kalitesi, erişim yönetimi |
| Teknik Sorumlu | Dijital Altyapı | ETL, veri akışları |
| İş Sorumlusu | İşletme Müdürlüğü | Veri doğruluğu, iş kuralları |

### Bilinen Sorunlar

| Sorun | Durum | Çözüm Planı |
|-------|-------|-------------|
| 2018 öncesi arıza kayıtları eksik | Kalıcı | N/A |
| Kırsal bölge veri azlığı | Devam ediyor | IoT sensör genişlemesi |
| Eski CBS formatları | Çözüldü | 2023'te migrasyon tamamlandı |

### İletişim

**Veri Talepleri**: data-request@buski.gov.tr  
**Teknik Sorular**: ds-destek@buski.gov.tr  
**Veri Kalitesi Bildirimi**: kalite@buski.gov.tr

---

**Son Güncelleme**: 2024-01-15  
**Versiyon**: 1.0.0
