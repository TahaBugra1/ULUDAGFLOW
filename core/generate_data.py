"""
Sentetik Veri Üretici - Boru Patlak Risk Modeli MVP

Gerçekçi BUSKİ verisi simülasyonu:
- 500 boru segmenti
- 1 yıllık sensör okumaları
- Arıza logları
- Şikayet verileri
"""

import csv
import random
import os
from datetime import datetime, timedelta
from typing import List, Dict

# Bursa ilçeleri ve DMA sayıları
DISTRICTS = {
    'Osmangazi': 8,
    'Nilüfer': 7,
    'Yıldırım': 6,
    'Gemlik': 3,
    'Mudanya': 2,
    'İnegöl': 4,
    'Kestel': 2,
    'Gürsu': 2,
    'Orhangazi': 2,
    'Karacabey': 2,
}

# Boru malzemeleri ve risk faktörleri
MATERIALS = {
    'PVC': {'risk_factor': 0.2, 'typical_age': 15},
    'HDPE': {'risk_factor': 0.15, 'typical_age': 10},
    'FONT': {'risk_factor': 0.6, 'typical_age': 45},
    'ÇELİK': {'risk_factor': 0.4, 'typical_age': 35},
    'AC': {'risk_factor': 0.8, 'typical_age': 50},  # Asbest-çimento, en riskli
}

# Bursa koordinat sınırları
BURSA_BOUNDS = {
    'lat_min': 40.05,
    'lat_max': 40.30,
    'lng_min': 28.85,
    'lng_max': 29.25
}


def generate_pipes(count: int = 500) -> List[Dict]:
    """Boru envanteri üret"""
    pipes = []
    pipe_id = 1
    
    for district, dma_count in DISTRICTS.items():
        # Her ilçeye orantılı boru sayısı
        district_pipe_count = int(count * (dma_count / sum(DISTRICTS.values())))
        
        for _ in range(district_pipe_count):
            material = random.choice(list(MATERIALS.keys()))
            mat_info = MATERIALS[material]
            
            # Yaş: malzemeye göre gerçekçi dağılım
            base_age = mat_info['typical_age']
            age = max(1, int(random.gauss(base_age * 0.7, base_age * 0.3)))
            install_year = 2024 - age
            
            # Koordinatlar
            lat_start = random.uniform(BURSA_BOUNDS['lat_min'], BURSA_BOUNDS['lat_max'])
            lng_start = random.uniform(BURSA_BOUNDS['lng_min'], BURSA_BOUNDS['lng_max'])
            
            # Boru uzunluğu ve yönü
            length = random.uniform(50, 500)
            angle = random.uniform(0, 360)
            lat_offset = (length / 111000) * random.uniform(-1, 1) * 0.5
            lng_offset = (length / 85000) * random.uniform(-1, 1) * 0.5
            
            pipes.append({
                'pipe_id': f'P-{district[:3].upper()}-{pipe_id:04d}',
                'dma_id': f'DMA-{district[:3].upper()}-{random.randint(1, dma_count):02d}',
                'district': district,
                'material': material,
                'diameter_mm': random.choice([100, 150, 200, 250, 300, 400, 500]),
                'length_m': round(length, 1),
                'install_year': install_year,
                'depth_m': round(random.uniform(0.8, 2.0), 2),
                'lat_start': round(lat_start, 6),
                'lng_start': round(lng_start, 6),
                'lat_end': round(lat_start + lat_offset, 6),
                'lng_end': round(lng_start + lng_offset, 6),
            })
            pipe_id += 1
    
    return pipes


def generate_sensor_readings(pipes: List[Dict], days: int = 365) -> List[Dict]:
    """1 yıllık sensör okumaları üret"""
    readings = []
    start_date = datetime(2024, 1, 1)
    
    # Her 10 boruya 1 sensör (gerçekçi kapsam)
    sensor_pipes = random.sample(pipes, min(50, len(pipes)))
    
    for day in range(days):
        current_date = start_date + timedelta(days=day)
        
        for idx, pipe in enumerate(sensor_pipes):
            sensor_id = f'S-{idx+1:03d}'
            
            # Günde 24 okuma (saatlik) - sadece kritik saatler
            for hour in [2, 3, 4, 8, 12, 18, 22]:  # Gece + gündüz örnekleri
                timestamp = current_date.replace(hour=hour)
                is_night = 2 <= hour <= 4
                
                # Basınç: 2-5 bar arası, gece daha stabil
                base_pressure = 3.5
                if is_night:
                    pressure = base_pressure + random.gauss(0, 0.1)
                else:
                    pressure = base_pressure + random.gauss(-0.3, 0.3)
                
                # Yaşlı/riskli borularda anomali olasılığı daha yüksek
                pipe_age = 2024 - pipe['install_year']
                if pipe_age > 30 and random.random() < 0.05:
                    pressure -= random.uniform(0.5, 1.5)  # Ani basınç düşüşü
                
                # Debi
                if is_night:
                    # MNF (Minimum Night Flow) - kaçak göstergesi
                    base_flow = 5 + (MATERIALS[pipe['material']]['risk_factor'] * 10)
                    flow = base_flow + random.gauss(0, 2)
                else:
                    flow = random.uniform(20, 80)
                
                readings.append({
                    'timestamp': timestamp.isoformat(),
                    'sensor_id': sensor_id,
                    'pipe_id': pipe['pipe_id'],
                    'pressure_bar': round(max(0.5, pressure), 3),
                    'flow_lps': round(max(0, flow), 2),
                    'is_night': is_night
                })
    
    return readings


def generate_failures(pipes: List[Dict], years: int = 3) -> List[Dict]:
    """Arıza logları üret (son 3 yıl)"""
    failures = []
    failure_id = 1
    
    for pipe in pipes:
        pipe_age = 2024 - pipe['install_year']
        mat_risk = MATERIALS[pipe['material']]['risk_factor']
        
        # Arıza olasılığı: yaş ve malzemeye bağlı
        failure_prob = (pipe_age / 100) * mat_risk * 3
        expected_failures = int(failure_prob * years)
        
        for _ in range(expected_failures):
            failure_date = datetime(2022, 1, 1) + timedelta(days=random.randint(0, 365 * years))
            
            failures.append({
                'failure_id': f'F-{failure_id:05d}',
                'pipe_id': pipe['pipe_id'],
                'failure_date': failure_date.date().isoformat(),
                'failure_type': random.choices(
                    ['PATLAK', 'SIZINTI', 'CONTA', 'VANA'],
                    weights=[0.4, 0.35, 0.15, 0.1]
                )[0],
                'repair_hours': round(random.uniform(2, 24), 1),
                'water_loss_m3': round(random.uniform(10, 500), 1)
            })
            failure_id += 1
    
    return failures


def generate_complaints(pipes: List[Dict], days: int = 365) -> List[Dict]:
    """Şikayet verileri üret"""
    complaints = []
    complaint_id = 1
    
    # DMA bazında şikayet yoğunluğu (bazı bölgeler daha çok şikayet alır)
    dma_list = list(set(p['dma_id'] for p in pipes))
    dma_weights = {dma: random.uniform(0.5, 2.0) for dma in dma_list}
    
    start_date = datetime(2024, 1, 1)
    
    for day in range(days):
        current_date = start_date + timedelta(days=day)
        
        # Günde 5-20 şikayet
        daily_complaints = random.randint(5, 20)
        
        for _ in range(daily_complaints):
            dma = random.choice(dma_list)
            related_pipes = [p for p in pipes if p['dma_id'] == dma]
            
            complaints.append({
                'complaint_id': f'C-{complaint_id:06d}',
                'pipe_id': random.choice(related_pipes)['pipe_id'] if random.random() < 0.3 else '',
                'dma_id': dma,
                'complaint_date': current_date.date().isoformat(),
                'category': random.choices(
                    ['BASINC', 'KESINTI', 'SIZINTI', 'KALITE'],
                    weights=[0.35, 0.30, 0.25, 0.10]
                )[0]
            })
            complaint_id += 1
    
    return complaints


def save_csv(data: List[Dict], filename: str):
    """CSV dosyasına kaydet"""
    if not data:
        return
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
    
    print(f"✓ {filename} - {len(data)} kayıt")


def main():
    print("🔧 Sentetik veri üretiliyor...\n")
    
    # Veri üret
    pipes = generate_pipes(500)
    sensors = generate_sensor_readings(pipes, days=365)
    failures = generate_failures(pipes, years=3)
    complaints = generate_complaints(pipes, days=365)
    
    # Kaydet
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    
    save_csv(pipes, os.path.join(data_dir, 'pipes.csv'))
    save_csv(sensors, os.path.join(data_dir, 'sensors.csv'))
    save_csv(failures, os.path.join(data_dir, 'failures.csv'))
    save_csv(complaints, os.path.join(data_dir, 'complaints.csv'))
    
    print(f"\n✅ Tüm veriler {data_dir} klasörüne kaydedildi.")
    
    # Özet istatistikler
    print("\n📊 Veri Özeti:")
    print(f"   Boru sayısı: {len(pipes)}")
    print(f"   Sensör okuması: {len(sensors)}")
    print(f"   Arıza kaydı: {len(failures)}")
    print(f"   Şikayet: {len(complaints)}")
    
    # Malzeme dağılımı
    mat_counts = {}
    for p in pipes:
        mat_counts[p['material']] = mat_counts.get(p['material'], 0) + 1
    print("\n   Malzeme dağılımı:")
    for mat, count in sorted(mat_counts.items(), key=lambda x: -x[1]):
        print(f"      {mat}: {count} boru")


if __name__ == '__main__':
    main()
