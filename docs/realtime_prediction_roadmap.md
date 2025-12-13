# Gerçek Zamanlı Tahmin ve Raporlama Yol Haritası

Bu doküman, Bursa su şebekesi arayüzünde gerçek zamanlı tahminleri haritaya yansıtmak, OpenAI API çıktılarıyla raporları zenginleştirmek ve PDF formatında indirilebilir raporlar üretmek için izlenecek adımları özetler.

## 1. Veri Altyapısı ve Gerçek Zamanlı Tahmin

- **Sensör ve Senaryo Verisi Birleştirme**  
  - `ml/leak_modeling` altında oluşturulan özellik mühendisliği pipeline'ını (engineer_features) gerçek zamanlı akışa uyarlayın.  
  - Şu anda kullanılan şikayet tabanlı `RealTimeMonitor` sınıfına ek olarak, senaryo modellerinden (sızıntı tespiti, lokasyon ve koordinat regresyonu) gelen tahminleri besleyen yeni bir `RealtimeInferenceEngine` oluşturun.

- **Model Sunumu**  
  - Eğitim sonrası modelleri `ml/artifacts` altına kaydedin (ör. `joblib.dump`).  
  - Basit bir FastAPI servisi içinde `/predict/leak`, `/predict/coordinates` gibi uç noktalar sağlayın; giriş olarak sensör/node ölçümleri veya şikayetlerden türetilmiş özellikleri kabul etsin.  
  - Yanıt şeması harita bileşenlerinin kolay okuyacağı biçimde olsun (`district`, `node_id`, `confidence`, `predicted_leak`, `coordinates`).

- **Anlık Veri Akışı**  
  - Frontend tarafında, `services/realtimeMonitor.ts` dosyasına WebSocket veya Server-Sent Events üzerinden gelen tahmin akışını işleyen ek bir `subscribeToPredictions()` fonksiyonu ekleyin.  
  - Tahminler geldiğinde mevcut `pressureCache` ve `outageCache` yapılarını yeni risk skorlarıyla güncelleyin.

## 2. Harita Entegrasyonu

- **UnifiedBursaMap Bileşeni**  
  - `components/UnifiedBursaMap.tsx` içinde harita overlay'lerini güçlendirmek için `predictionLayers` adlı yeni bir prop tanımlayın. Bu prop; tahmin türünü (`leakRisk`, `pressureForecast`) ve görsel özelliklerini (`color`, `intensity`) içersin.  
  - Risk seviyesine göre renk paleti, mevcut tasarım renkleriyle uyumlu olmalı: **kritik** için `var(--danger)`, **düşük risk** için `var(--secondary-400)` tonları.

- **Animasyon ve Bildirimler**  
  - Kritik bölgelerde yumuşak puls animasyonu (var olan `animate-pulse`) ve minimal ikonlar kullanın.  
  - Cliché neon/laser temalardan kaçın; Inter font ailesini kullanmaya devam edin.

## 3. OpenAI API ile Analitik Özetler

- **Servis Katmanı**  
  - `services` klasörüne `openaiReportService.ts` ekleyin.  
  - Bu servis, tahmin çıktıları + şikayet özetlerini birleştirip OpenAI Chat Completions API'ye göndererek Türkçe risk özetleri, aksiyon önerileri ve kullanıcıya yönelik kısa bilgilendirme oluşturur.  
  - Prompt'ta kuruluşun dili, ton rehberi (sade, somut) ve font tercihleri belirtilsin.

- **Önyüz Entegrasyonu**  
  - `components/NetworkPredictionPanel.tsx` içinde "Yapay Zeka Analizi" sekmesi ekleyin.  
  - API sonucunu kart içinde gösterin; kart başlık ve içerik `Inter`, alt bilgi `Inter Medium` ile yazılsın.

## 4. PDF Raporlama ve İndirilebilir Doküman

- **Rapor Şablonu**  
  - `reports` adında yeni bir klasör oluşturup `pdfTemplates` altına React PDF (`@react-pdf/renderer`) tabanlı komponent ekleyin.  
  - Başlık fontu: "Inter SemiBold" (400-600 arası kalınlık).  
  - Bölüm ayraçları için Bursa renk paletine sadık kalın (`--primary-600` ve `--secondary-700`).

- **Rapor İçeriği**  
  - Bölüm 1: Güncel durum özeti (şebeke basıncı, aktif kesintiler).  
  - Bölüm 2: Model tahminleri (tablo + kısa yorum).  
  - Bölüm 3: OpenAI destekli öneriler (bullet list, gereksiz süslemelerden kaçın).  
  - Bölüm 4: Eylem planı (hangi ekip ne yapmalı, tahmini süre).  
  - Alt bilgi: Tarih, veri kaynağı (WDN1 + canlı şikayetler) ve iletişim bilgisi.

- **İndirme Akışı**  
  - Frontend'de "PDF indir" butonu ekleyin; buton tıklandığında rapor servisini çağırıp PDF blob'u indirilebilir hale getirin.  
  - Buton stili `btn` yardımcı sınıflarıyla uyumlu olsun; gradient veya parlak neon kullanmayın.

## 5. Tasarım ve Deneyim Notları

- Font: `Inter` ailesi, gerektiğinde `Inter Medium` ve `Inter SemiBold`.  
- Arka plan efektleri `index.css`'teki mevcut desenlerle tutarlı kalsın; yeni bileşenlerde minimal çizgiler, yumuşak köşeler.  
- İkon/maskot gibi klişe yapay zeka görsellerinden kaçının; bunun yerine sade su damlası veya hat minimalizmi tercih edin.

## 6. Test ve Doğrulama

- **Unit Test**: Model servis uç noktalarını ve PDF üretim fonksiyonlarını kapsayın.  
- **Scenario Test**: Gerçek zamanlı akış simülasyonu ve OpenAI cevapsız kaldığında fallback metinleri doğrulayın.  
- **Kullanıcı Testi**: Harita overlay'lerinin okunabilirliği ve PDF raporunun okunaklılığı üzerine kısa pilot geri bildirim toplayın.

---

Bu yol haritası tamamlandığında, kullanıcılar şebekenin anlık risk durumunu haritada görebilecek, yapay zekâ tarafından hazırlanmış özetleri inceleyebilecek ve raporları PDF olarak indirebilecekler.
