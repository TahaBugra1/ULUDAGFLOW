# Bursa Su Ağı API Katmanı

Bu dizin, React arayüzünün gerçek zamanlı verilerle konuşabilmesi için tasarlanan FastAPI tabanlı hizmetin kaynak kodunu içerir. Mock servis hâlâ desteklenir; ancak `VITE_API_BASE_URL` değeri tanımlandığında istemci otomatik olarak bu API'yi kullanır.

## Kurulum

```powershell
cd "c:\Users\MONSTER\3D Objects\yazprojeler\bursa\api"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Ortam değişkenleri

| Değişken | Açıklama | Varsayılan |
| --- | --- | --- |
| `BURSA_API_SECRET` | JWT üretiminde kullanılan gizli anahtar | `change-me` |
| `BURSA_API_ACCESS_TOKEN_MINUTES` | Token geçerlilik süresi (dakika) | `120` |
| `BURSA_API_ALLOWED_ORIGINS` | CORS için izin verilen origin listesi (virgülle ayrılmış) | `*` |

## Çalıştırma

```powershell
uvicorn api.main:app --reload --port 8000
```

Frontend tarafında `.env` dosyasına aşağıdaki satırı ekleyin:

```
VITE_API_BASE_URL=http://localhost:8000
```

Bu ayar sayesinde `services/mockBackend.ts` dosyası gerçek API üzerinden oturum açma isteğini yönlendirir.

## Sunulan Uç Noktalar

- `POST /auth/login` – Yönetici oturum açma (JWT döner)
- `GET /admins/me` – Giriş yapan yöneticinin bilgisi
- `GET /complaints` – Şikayet listesi (isteğe bağlı `district` parametresi)
- `GET /complaints/{id}` – Şikayet detayı
- `GET /complaints/summary` – Kategori ve durum bazlı istatistik

## Sonraki Adımlar

- JWT yenileme token'ı eklemek
- Şifre doğrulama için bcrypt/argon2 kullanmak
- Şikayet oluşturma/güncelleme uçları ve sensör tahminleri için ek API'ler
