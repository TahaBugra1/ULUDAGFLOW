"""
Risk Skoru Hesaplama Modülü - MVP v1

Klasik su kayıp metrikleri + basit ağırlıklı risk skoru.
"Deep AI mucizesi" değil, literatürde kullanılan yöntemlerin sade uygulaması.
"""

import csv
import os
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from collections import defaultdict

# Ağırlıklar (literatür bazlı varsayılanlar)
WEIGHTS = {
    'age': 0.25,           # Boru yaşı
    'material': 0.20,      # Malzeme riski
    'failure_history': 0.25,  # Geçmiş arızalar
    'pressure_anomaly': 0.15,  # Basınç anomalisi
    'mnf_deviation': 0.15,  # MNF sapması
}

# Malzeme risk faktörleri
MATERIAL_RISK = {
    'PVC': 0.2,
    'HDPE': 0.15,
    'FONT': 0.6,
    'ÇELİK': 0.4,
    'AC': 0.8,
}


def load_csv(filepath: str) -> List[Dict]:
    """CSV dosyasını yükle"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def calculate_age_score(install_year: int, current_year: int = 2024) -> float:
    """
    Yaş skoru: 0-100 arası
    30+ yıl = 100, 0 yıl = 0
    """
    age = current_year - install_year
    return min(100, (age / 30) * 100)


def calculate_material_score(material: str) -> float:
    """Malzeme riski: 0-100 arası"""
    risk = MATERIAL_RISK.get(material, 0.5)
    return risk * 100


def calculate_failure_score(pipe_id: str, failures: List[Dict], years: int = 2) -> Tuple[float, int]:
    """
    Arıza geçmişi skoru
    Son 2 yılda arıza sayısına göre
    """
    cutoff = datetime.now() - timedelta(days=365 * years)
    
    recent_failures = [
        f for f in failures 
        if f['pipe_id'] == pipe_id 
        and datetime.fromisoformat(f['failure_date']) > cutoff
    ]
    
    count = len(recent_failures)
    # 0 arıza = 0, 3+ arıza = 100
    score = min(100, (count / 3) * 100)
    
    return score, count


def calculate_pressure_anomaly_score(pipe_id: str, sensors: List[Dict]) -> float:
    """
    Basınç anomali skoru
    Normal: 2.5-4.5 bar, dışındaki okumalar anomali
    """
    pipe_readings = [s for s in sensors if s['pipe_id'] == pipe_id]
    
    if not pipe_readings:
        return 50  # Sensör yok, orta risk varsay
    
    anomaly_count = 0
    for reading in pipe_readings:
        pressure = float(reading['pressure_bar'])
        if pressure < 2.0 or pressure > 5.0:
            anomaly_count += 1
    
    anomaly_ratio = anomaly_count / len(pipe_readings)
    return min(100, anomaly_ratio * 200)  # %50 anomali = 100 skor


def calculate_mnf_score(pipe_id: str, sensors: List[Dict]) -> float:
    """
    MNF (Minimum Night Flow) sapma skoru
    Gece debisi yüksekse = olası kaçak
    """
    night_readings = [
        float(s['flow_lps']) 
        for s in sensors 
        if s['pipe_id'] == pipe_id and s['is_night'] == 'True'
    ]
    
    if not night_readings:
        return 50  # Veri yok, orta risk
    
    avg_mnf = sum(night_readings) / len(night_readings)
    
    # MNF > 15 L/s yüksek risk
    return min(100, (avg_mnf / 15) * 100)


def calculate_complaint_multiplier(pipe_id: str, dma_id: str, complaints: List[Dict], days: int = 30) -> float:
    """
    Şikayet çarpanı: 1.0 - 1.5 arası
    Son 30 günde DMA'daki şikayet sayısına göre
    """
    cutoff = datetime.now() - timedelta(days=days)
    
    recent_complaints = [
        c for c in complaints
        if c['dma_id'] == dma_id
        and datetime.fromisoformat(c['complaint_date']) > cutoff
    ]
    
    count = len(recent_complaints)
    # Her 10 şikayet için +0.1, max 1.5
    multiplier = 1.0 + min(0.5, count * 0.01)
    
    return multiplier


def calculate_risk_score(pipe: Dict, failures: List[Dict], sensors: List[Dict], complaints: List[Dict]) -> Dict:
    """
    Ana risk skoru hesaplama
    
    Risk = (w1×Yaş + w2×Malzeme + w3×Arıza + w4×Basınç + w5×MNF) × Şikayet_Çarpanı
    """
    pipe_id = pipe['pipe_id']
    dma_id = pipe['dma_id']
    
    # Alt skorlar
    age_score = calculate_age_score(int(pipe['install_year']))
    material_score = calculate_material_score(pipe['material'])
    failure_score, failure_count = calculate_failure_score(pipe_id, failures)
    pressure_score = calculate_pressure_anomaly_score(pipe_id, sensors)
    mnf_score = calculate_mnf_score(pipe_id, sensors)
    
    # Ağırlıklı toplam
    base_score = (
        WEIGHTS['age'] * age_score +
        WEIGHTS['material'] * material_score +
        WEIGHTS['failure_history'] * failure_score +
        WEIGHTS['pressure_anomaly'] * pressure_score +
        WEIGHTS['mnf_deviation'] * mnf_score
    )
    
    # Şikayet çarpanı
    complaint_mult = calculate_complaint_multiplier(pipe_id, dma_id, complaints)
    
    final_score = min(100, base_score * complaint_mult)
    
    return {
        'pipe_id': pipe_id,
        'dma_id': dma_id,
        'district': pipe['district'],
        'material': pipe['material'],
        'install_year': pipe['install_year'],
        'age': 2024 - int(pipe['install_year']),
        'diameter_mm': pipe['diameter_mm'],
        'length_m': pipe['length_m'],
        'lat_start': pipe['lat_start'],
        'lng_start': pipe['lng_start'],
        'lat_end': pipe['lat_end'],
        'lng_end': pipe['lng_end'],
        # Skorlar
        'age_score': round(age_score, 1),
        'material_score': round(material_score, 1),
        'failure_score': round(failure_score, 1),
        'failure_count': failure_count,
        'pressure_score': round(pressure_score, 1),
        'mnf_score': round(mnf_score, 1),
        'complaint_multiplier': round(complaint_mult, 2),
        'risk_score': round(final_score, 1),
    }


def generate_priority_list(data_dir: str, top_n: int = 20) -> List[Dict]:
    """
    Öncelik listesi oluştur
    
    Returns: En yüksek riskli top_n boru
    """
    print("📂 Veri yükleniyor...")
    
    pipes = load_csv(os.path.join(data_dir, 'pipes.csv'))
    sensors = load_csv(os.path.join(data_dir, 'sensors.csv'))
    failures = load_csv(os.path.join(data_dir, 'failures.csv'))
    complaints = load_csv(os.path.join(data_dir, 'complaints.csv'))
    
    print(f"   Boru: {len(pipes)}, Sensör: {len(sensors)}, Arıza: {len(failures)}, Şikayet: {len(complaints)}")
    
    print("\n🔢 Risk skorları hesaplanıyor...")
    
    risk_results = []
    for i, pipe in enumerate(pipes):
        result = calculate_risk_score(pipe, failures, sensors, complaints)
        risk_results.append(result)
        
        if (i + 1) % 100 == 0:
            print(f"   {i + 1}/{len(pipes)} boru işlendi")
    
    # Skora göre sırala
    risk_results.sort(key=lambda x: x['risk_score'], reverse=True)
    
    # Öncelik numarası ekle
    for i, result in enumerate(risk_results):
        result['priority'] = i + 1
    
    print(f"\n✅ {len(risk_results)} boru analiz edildi.")
    
    return risk_results[:top_n]


def calculate_metrics(data_dir: str) -> Dict:
    """
    Temel KPI'ları hesapla
    - Ortalama MNF
    - Tahmini ILI
    - Aylık arıza sayısı
    """
    sensors = load_csv(os.path.join(data_dir, 'sensors.csv'))
    failures = load_csv(os.path.join(data_dir, 'failures.csv'))
    
    # MNF hesapla
    night_flows = [float(s['flow_lps']) for s in sensors if s['is_night'] == 'True']
    avg_mnf = sum(night_flows) / len(night_flows) if night_flows else 0
    
    # Aylık arıza (son 12 ay ortalaması)
    cutoff = datetime.now() - timedelta(days=365)
    recent_failures = [
        f for f in failures 
        if datetime.fromisoformat(f['failure_date']) > cutoff
    ]
    monthly_failures = len(recent_failures) / 12
    
    # Basit ILI tahmini (gerçekte daha karmaşık hesaplama gerekir)
    # ILI = Gerçek Kayıp / Kaçınılmaz Kayıp
    # Varsayılan: MNF'nin %60'ı gerçek kayıp
    estimated_ili = (avg_mnf * 0.6) / (avg_mnf * 0.15 + 1)  # Basitleştirilmiş
    
    return {
        'avg_mnf_lps': round(avg_mnf, 2),
        'estimated_ili': round(estimated_ili, 2),
        'monthly_failures': round(monthly_failures, 1),
        'total_failures_year': len(recent_failures),
    }


def save_results(results: List[Dict], filepath: str):
    """Sonuçları CSV'ye kaydet"""
    if not results:
        return
    
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)
    
    print(f"✓ Sonuçlar kaydedildi: {filepath}")


def main():
    print("=" * 60)
    print("🔴 BORU PATLAK RİSK ÖNCELİKLENDİRME MODÜLÜ")
    print("=" * 60)
    
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    
    # Öncelik listesi oluştur
    priority_list = generate_priority_list(data_dir, top_n=20)
    
    # Sonuçları kaydet
    output_path = os.path.join(data_dir, 'priority_list.csv')
    save_results(priority_list, output_path)
    
    # Metrikleri hesapla
    metrics = calculate_metrics(data_dir)
    
    # Özet yazdır
    print("\n" + "=" * 60)
    print("📊 SONUÇLAR")
    print("=" * 60)
    
    print("\n🎯 EN YÜKSEK RİSKLİ 20 BORU:")
    print("-" * 60)
    print(f"{'#':<3} {'Boru ID':<15} {'DMA':<18} {'İlçe':<12} {'Risk':<6}")
    print("-" * 60)
    
    for item in priority_list:
        print(f"{item['priority']:<3} {item['pipe_id']:<15} {item['dma_id']:<18} {item['district']:<12} {item['risk_score']:<6}")
    
    print("\n📈 METRİKLER:")
    print(f"   MNF (Gece Min. Debi): {metrics['avg_mnf_lps']} L/s")
    print(f"   Tahmini ILI: {metrics['estimated_ili']}")
    print(f"   Son 12 ay arıza: {metrics['total_failures_year']} ({metrics['monthly_failures']}/ay)")
    
    print("\n⚠️  NOT: Bu bir karar destek aracıdır, bağlayıcı taahhüt değildir.")
    print("=" * 60)


if __name__ == '__main__':
    main()
