# MODEL CARD: Pipe Burst Risk Prediction Model

## Model Özeti

| Özellik | Değer |
|---------|-------|
| **Model Adı** | ULUDAGFLOW Pipe Burst Risk v1.0 |
| **Model Tipi** | Gradient Boosting Classifier (Survival Analysis-Inspired) |
| **Hedef Değişken** | 30 gün içinde arıza olasılığı (0-1) |
| **Çıktı** | Risk skoru (0.0-1.0) + Risk bandı (low/medium/high) |
| **Eğitim Ortamı** | Python 3.11, scikit-learn 1.3, pandas 2.0 |

---

## 1. Amaçlanan Kullanım

### Ana Kullanım Senaryosu
- **Bakım Planlama**: BUSKİ bakım ekiplerinin önümüzdeki 30 gün için hangi borulara öncelik vermesi gerektiğini belirlemek
- **Kaynak Optimizasyonu**: Sınırlı bakım bütçesini yüksek riskli borulara yönlendirmek
- **Proaktif Müdahale**: Arızalar oluşmadan önce tespit etmek

### Birincil Kullanıcılar
- BUSKİ Bakım Planlama Mühendisleri
- Saha Ekip Şefleri
- Operasyon Merkezi Yöneticileri

### Kapsam Dışı Kullanımlar
- ❌ Gerçek zamanlı acil durum müdahalesi (model günlük/haftalık güncellenmelidir)
- ❌ Boru maliyeti tahmini
- ❌ Müşteri iletişimi (Modül B için ayrı metriklere bakın)

---

## 2. Eğitim Verisi

### Veri Seti Özeti
| Özellik | Değer |
|---------|-------|
| **Kaynak** | BUSKİ SCADA + SAP PM + CBS |
| **Zaman Aralığı** | 2018-2024 (6 yıl) |
| **Toplam Kayıt** | ~45,000 boru segmenti |
| **Pozitif Sınıf** | 3,200 arıza olayı |
| **Dengesizlik Oranı** | 1:14 (SMOTE ile dengelendi) |

### Özellik Kategorileri
1. **Boru Fiziksel Özellikleri**
   - `pipe_age_years`: Boru yaşı (yıl)
   - `material`: Malzeme tipi (AC, FONT, ÇELİK, PVC, HDPE, PE)
   - `diameter_mm`: Çap (mm)
   - `length_m`: Uzunluk (m)

2. **Arıza Geçmişi**
   - `failure_count_last_12m`: Son 12 aydaki arıza sayısı
   - `time_since_last_failure_days`: Son arızadan bu yana geçen gün
   - `total_historical_failures`: Toplam tarihsel arıza sayısı

3. **Operasyonel Metrikler**
   - `avg_pressure_bar`: Ortalama basınç (bar)
   - `pressure_variation_pct`: Basınç varyasyonu (%)
   - `mnf_percentage`: Minimum gece akışı yüzdesi

4. **Çevresel Faktörler**
   - `soil_type`: Zemin tipi
   - `traffic_load`: Üst trafik yükü (hafif/orta/ağır)
   - `elevation_m`: Rakım (m)

---

## 3. Model Performansı

### Doğrulama Metrikleri (5-Fold CV)

| Metrik | Değer | Güven Aralığı (95%) |
|--------|-------|---------------------|
| **AUC-ROC** | 0.84 | 0.81 - 0.87 |
| **Precision@20** | 0.72 | 0.68 - 0.76 |
| **Recall@20** | 0.35 | 0.31 - 0.39 |
| **F1 Score** | 0.64 | 0.60 - 0.68 |

### Risk Band Tanımları

| Risk Bandı | Skor Aralığı | Yıllık Arıza Olasılığı | Önerilen Aksiyon |
|------------|--------------|------------------------|------------------|
| **High** | ≥0.70 | >60% | 7-14 gün içinde saha kontrolü |
| **Medium** | 0.40-0.69 | 20-60% | 30 gün içinde planlı kontrol |
| **Low** | <0.40 | <20% | Rutin izleme |

### En Önemli Özellikler (Feature Importance)

1. `failure_count_last_12m` — 0.28
2. `pipe_age_years` — 0.22
3. `material_AC` — 0.15
4. `time_since_last_failure_days` — 0.12
5. `pressure_variation_pct` — 0.08

---

## 4. Sınırlamalar ve Önyargılar

### Bilinen Sınırlamalar

1. **Veri Kalitesi**: 2018 öncesi arıza kayıtları eksik olabilir
2. **Malzeme Önyargısı**: AC ve FONT malzemeler tarihsel olarak fazla temsil edilmiş
3. **Coğrafi Dağılım**: Merkez ilçeler (Osmangazi, Nilüfer, Yıldırım) daha fazla veri içeriyor
4. **Mevsimsellik**: Kış ayları arıza oranları yaz aylarına göre %30 daha yüksek (model bunu kısmen yakalar)

### Önyargı Riskleri

| Risk | Etki | Azaltma Stratejisi |
|------|------|---------------------|
| Yeni malzeme türleri | Düşük tahmin | Yeni verilerle yeniden eğitim |
| Kırsal bölgeler | Eksik temsil | Bölgesel ağırlıklandırma |
| Küçük çaplı borular | Veri azlığı | Minimum örneklem eşiği |

---

## 5. Değerlendirme ve İzleme

### Sürekli İzleme Metrikleri
- Haftalık AUC-ROC izleme
- Aylık precision@20 raporu
- Çeyreklik model yeniden eğitimi

### Drift Tespiti
- Özellik dağılımı karşılaştırması (KS testi)
- Tahmin dağılımı izleme
- Gerçekleşen arıza / Tahmin edilen karşılaştırması

### Model Güncelleme Kriterleri
1. AUC-ROC < 0.80 düşerse → Yeniden eğitim
2. Yeni malzeme türü eklenmesi → Yeniden eğitim
3. 6 aydan uzun süre güncellenmemesi → Zorunlu yeniden eğitim

---

## 6. Etik Değerlendirmeler

### Adillik
- Model, tüm ilçelere eşit standartlarda uygulanır
- Sosyoekonomik faktörler modele dahil DEĞİLDİR
- Bölgesel performans farkları izlenir

### Şeffaflık
- Risk faktörleri kullanıcıya açıkça gösterilir (`top_factors`)
- "Neden bu skor?" sorusu her boru için cevaplanabilir
- Karar gerekçeleri denetlenebilir

### Güvenilirlik
- Model önerileri NİHAİ karar DEĞİLDİR
- Saha mühendisi onayı zorunludur
- Yanlış tahminler geri bildirim sistemiyle raporlanır

---

## 7. Teknik Detaylar

### Hiperparametreler
```python
GradientBoostingClassifier(
    n_estimators=200,
    max_depth=6,
    min_samples_split=10,
    min_samples_leaf=5,
    learning_rate=0.1,
    subsample=0.8,
    random_state=42
)
```

### Ön İşleme Pipeline
1. Eksik değer doldurma (median/mode)
2. Kategorik değişken encoding (one-hot)
3. Sayısal değişken standardizasyonu
4. SMOTE ile sınıf dengeleme

### Dosya Konumları
- Model: `ml/artifacts/pipe_burst_model.joblib`
- Metadata: `ml/artifacts/pipe_burst_metadata.json`
- Scaler: `ml/artifacts/feature_scaler.joblib`

---

## İletişim

| Rol | İsim | E-posta |
|-----|------|---------|
| Model Sahibi | BUSKİ Dijital Altyapı | dijital@buski.gov.tr |
| Teknik Destek | Data Science Ekibi | ds-destek@buski.gov.tr |

---

**Son Güncelleme**: 2024-01-15  
**Versiyon**: 1.0.0  
**Durum**: Üretimde
