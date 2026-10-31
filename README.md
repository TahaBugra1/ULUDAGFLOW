# ULUDAGFLOW

**Bursa için su altyapısı bildirim, izleme ve risk analizi prototipi.**

ULUDAGFLOW; vatandaşların suyla ilgili sorunları bildirebildiği, mevcut bildirim ve uyarıları inceleyebildiği ve yöneticilerin şikâyet yoğunluğu ile su şebekesi risklerini görüntüleyebildiği web tabanlı bir uygulamadır. Projede boru bazlı risk önceliklendirmesi, harita görünümleri, bildirim/talep ekranları ve isteğe bağlı yapay zekâ destekli metin işleme ile teknik raporlama işlevleri bulunur.

> **Proje durumu:** Bu depo prototip ve demonstrasyon bileşenleri içerir. Bazı ekranlar sentetik/örnek verilerle çalışır; uygulamanın tüm modüllerinin gerçek zamanlı belediye altyapı verisine bağlı olduğu veya saha kullanımına hazır olduğu varsayılmamalıdır.

## Özellikler

### Vatandaş arayüzü

- Telefon numarası ve doğrulama kodu akışıyla vatandaş giriş/kayıt ekranları.
- İlçe ve mahalle seçimiyle su kesintisi, düşük basınç, sızıntı, patlak, su kalitesi ve diğer sorunlara ilişkin bildirimler.
- Duyuruları ve bölgesel bildirimleri görüntüleme.
- Şikâyet yoğunluğunun ilçelere göre sunulduğu görselleştirme.
- Profil bilgilerini ve kullanıcının bildirimlerini yönetme.

### Yönetim ve risk izleme

- Bildirim/uyarı inceleme ve yönetim arayüzü.
- İlçe bazlı şikâyet yoğunluğu ve risk görünümleri.
- Boru segmentleri için risk skoru, öncelik sırası, malzeme ve geçmiş arıza gibi alanları gösteren liste ve harita ekranları.
- Boru bazlı teknik rapor üretme arayüzü.
- Şebeke verileri üzerinde tür, risk, malzeme ve çap odaklı görünümler.
- Talep (ticket) ve mahalle düzeyinde durum/özet bilgileri gösteren ekranlar.

### Analiz ve yapay zekâ bileşenleri

- Şikâyet metinlerini kategorilere ayırma ve içerik işleme için Gemini entegrasyonu; anahtar bulunmadığında yerel alternatif mantık.
- Şikâyetler ve simüle edilmiş sensör girdileri üzerinden şebeke durum/risk çıkarımı yapan TypeScript servisleri.
- Boru kırılması/sızıntısı gibi olaylar için anahtar kelimelere ve bildirim kümelerine dayanan analiz.
- Teknik boru raporları için OpenAI API entegrasyonu; API kullanılamadığında şablon tabanlı rapor üretimi.

**Önemli:** Risk puanlarının ve tahminlerin varlığı, modelin gerçek saha verisi üzerinde doğrulandığı anlamına gelmez. Örnek verilerden üretilen skorlar operasyonel karar için tek başına kullanılmamalıdır.

## Kullanılan teknolojiler

| Katman | Teknolojiler |
| --- | --- |
| Web uygulaması | React 19, TypeScript, Vite 6 |
| Harita ve görselleştirme | Leaflet, React Leaflet, Recharts |
| Arayüz | Tailwind CSS (mevcut `index.html` dosyasında CDN üzerinden), Lucide React |
| Yapay zekâ servisleri | Google GenAI SDK; OpenAI Chat Completions HTTP çağrıları |
| Opsiyonel API | Python, FastAPI, Uvicorn, python-jose |
| Prototip veri saklama | Tarayıcı `localStorage` ve depodaki JSON veri dosyaları |

## Proje yapısı

```text
ULUDAGFLOW/
├── api/                 # FastAPI uygulaması, kimlik doğrulama ve yönlendirmeler
├── components/          # Harita ve arayüz bileşenleri
├── core/                # Boru risk listesi, risk paneli ve talep sayfası
├── data/                # Uygulama veri kaynakları
├── DB/                  # JSON tabanlı veri dosyaları
├── docs/                # Ek dokümantasyon içeriği
├── ml/                  # Makine öğrenmesiyle ilgili çalışma dosyaları
├── services/            # Veri, simülasyon, tahmin ve yapay zekâ servisleri
├── App.tsx              # Ana uygulama ve kullanıcı akışları
├── types.ts             # Ortak TypeScript tipleri
├── index.tsx            # React giriş noktası
├── index.html           # HTML giriş belgesi
├── vite.config.ts       # Vite yapılandırması
└── package.json         # JavaScript bağımlılıkları ve komutlar
```

Bu şema üst düzey dizinleri gösterir; `api/`, `docs/` ve `ml/` klasörlerinin tüm alt dosyalarını listelemez.

## Yerel kurulum — web uygulaması

**Gereksinimler:** Node.js ve npm. Node.js sürümü için deponun kökünde bir `engines` kısıtı tanımlanmadığından belirli bir minimum sürüm iddia edilmemektedir; Vite 6 ile uyumlu güncel bir Node.js sürümü kullanılmalıdır.

```bash
git clone https://github.com/TahaBugra1/ULUDAGFLOW.git
cd ULUDAGFLOW
npm ci
npm run dev
```

Vite yapılandırmasında geliştirme portu **3000** olarak tanımlıdır. Uygulamayı genellikle `http://localhost:3000` adresinden açabilirsiniz. Port doluysa Vite farklı bir port seçebilir.

Diğer mevcut npm komutları:

```bash
npm run build       # Üretim derlemesi
npm run preview     # Derleme önizlemesi
npm run docs:open   # docs klasörünü live-server aracılığıyla sunar
```

`docs:open` komutu `npx live-server docs` çalıştırır; araç yerelde kurulu değilse `npx` tarafından edinilmesi gerekebilir.

## Ortam değişkenleri

İsteğe bağlı olarak proje kökünde `.env.local` oluşturulabilir:

```dotenv
# İsteğe bağlı FastAPI sunucusunun temel adresi
VITE_API_BASE_URL=http://localhost:8000

# Gemini tabanlı metin işleme için
GEMINI_API_KEY=

# OpenAI destekli teknik raporlar için
VITE_OPENAI_API_KEY=
```

- `VITE_API_BASE_URL` boş bırakılırsa yönetici girişi de dahil ilgili akışlar uygulamanın yerel/simüle edilmiş servis mantığına dönebilir. Bu değişken tanımlanırsa yönetici kimlik doğrulama isteği sunucuya gönderilir.
- `GEMINI_API_KEY`, `vite.config.ts` içinde istemci tarafında kullanılacak şekilde derleme sırasında aktarılır.
- `VITE_OPENAI_API_KEY`, `services/openaiService.ts` tarafından istemci tarafında okunur.

> **Güvenlik uyarısı:** Mevcut mimaride yapay zekâ API anahtarları tarayıcıya ulaşabilir. Gerçek anahtarları herkese açık bir dağıtımda kullanmayın. Üretim ortamı için yapay zekâ çağrılarını sunucu tarafına taşıyıp kimlik bilgilerini sunucuda saklayın. `.env` ve `.env.local` dosyaları `.gitignore` kapsamındadır.

## İsteğe bağlı FastAPI servisi

Depoda `api/main.py` altında bir FastAPI uygulaması bulunur. Tanımlanan yönlendirme grupları `/auth`, `/admins` ve `/complaints`; sağlık kontrolü ise `/health` uç noktasıdır.

Proje kök dizinindeyken:

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

pip install -r api/requirements.txt
python -m uvicorn api.main:app --reload --port 8000
```

API sağlık kontrolü: `http://localhost:8000/health`.

API yapılandırmasında aşağıdaki sunucu ortam değişkenleri bulunur:

| Değişken | İşlevi |
| --- | --- |
| `BURSA_API_SECRET` | İmzalı erişim belirteçleri için gizli anahtar |
| `BURSA_API_ACCESS_TOKEN_MINUTES` | Erişim belirtecinin dakika cinsinden ömrü (varsayılan: 120) |
| `BURSA_API_ALLOWED_ORIGINS` | İzin verilen CORS origin adresleri (virgülle ayrılmış) |

> **Güvenlik:** `BURSA_API_SECRET` için kodda geliştirme amaçlı `change-me` varsayılanı vardır. Gerçek dağıtımda güçlü bir sır belirleyin ve izin verilen CORS origin'lerini açıkça sınırlayın. Bu README, tüm API uç noktalarının eksiksiz şekilde frontend'e bağlandığını iddia etmez.

## Veri kaynakları ve sınırlar

Projede birden fazla veri yolu bulunur; bunlar aynı şey değildir:

1. **Tarayıcı simülasyonu:** `services/mockBackend.ts`, vatandaş, yönetici, şikâyet ve uyarı gibi kayıtları `localStorage` üzerinde JSON biçiminde tutar. Buradaki kayıtlar gerçek bir veritabanı sunucusuna otomatik olarak yazılmaz.
2. **Depodaki JSON verileri:** Örneğin `DB/SikayetBilgileri.json` başlangıç şikâyet verisi olarak; `services/realNetworkData.json` ise şebeke haritası bileşenlerinin veri kaynağı olarak kullanılır.
3. **Sentetik risk/talep kayıtları:** `core/PipeRiskDashboard.tsx` içindeki boru önceliklendirme verileri ve `core/TicketPage.tsx` içindeki talep örnekleri kodda açıkça mock olarak işaretlenmiştir.
4. **Opsiyonel HTTP API:** FastAPI servisi ayrı çalıştırılabilir. Ön yüzün gerçek API'yi kullanması, ilgili akışın ayrıca entegre edilmesine ve doğru yapılandırılmasına bağlıdır.

Balkan Mahallesi şebeke verilerini görüntüleyen ekranlarda dosyaya gömülü hat/nokta bilgileri kullanılır; `realNetworkService.ts` bu JSON dosyasını doğrudan içe aktarır. Haritada GIS kökenli veri alanlarının bulunması, veri setinin güncelliğini veya resmî kaynakla eşleşmesini tek başına kanıtlamaz.

## Geliştirme notları

- Kimlik doğrulama, OTP ve kullanıcı verileri içeren simüle edilmiş akışlar güvenli üretim kimlik doğrulamasının yerini tutmaz. Mock doğrulama mantığını gerçek vatandaş verileriyle kullanmayın.
- Yapay zekâ servislerinde anahtar olmadan çalışabilen alternatifler vardır; bunlar model çağrısıyla aynı çıktıyı garanti etmez.
- Boru risk puanları, geçmiş arıza örnekleri ve otomatik hazırlanan raporlar için gerçek veri kaynağı, değerlendirme yöntemi ve doğrulama metrikleri ayrıca belgelenmelidir.
- Web derleme komutu depoda vardır; bu README hazırlanırken başarılı bir kurulum, derleme veya uçtan uca test sonucu doğrulanmamıştır.

## Lisans

Depo kökünde bir lisans dosyası doğrulanmadığından burada lisans türü belirtilmemiştir. Kullanım ve yeniden dağıtım koşulları netleştirilmek isteniyorsa uygun bir `LICENSE` dosyası eklenmelidir.
