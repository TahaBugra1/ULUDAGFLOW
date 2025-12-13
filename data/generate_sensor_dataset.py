"""
UludagFlow - Gerçekçi Sensör Veri Seti Oluşturucu
GIS verilerinden WDN1 benzeri zaman serisi sensör verileri üretir

Oluşturulan veriler:
- Basınç (pressure) - her sensör noktası için
- Debi (flow) - ana hatlar için
- MNF (Minimum Night Flow) - gece debisi
- Sızıntı durumu (leak status) - binary label
"""

import numpy as np
import pandas as pd
import geopandas as gpd
from datetime import datetime, timedelta
import json
import os
from pathlib import Path

# Rastgelelik için seed
np.random.seed(42)

# Paths
ICMESUYU_PATH = r"C:\Users\MONSTER\Downloads\icmesuyu"
ATIKSU_PATH = r"C:\Users\MONSTER\3D Objects\yazprojeler\bursa\atiksu"
YAGMURSUYU_PATH = r"C:\Users\MONSTER\Downloads\yagmursuyu"
OUTPUT_DIR = r"C:\Users\MONSTER\3D Objects\yazprojeler\bursa\data\sensor_dataset"

# Simülasyon parametreleri
SIMULATION_DAYS = 30  # 30 günlük veri
SAMPLE_INTERVAL_MINUTES = 15  # 15 dakikada bir ölçüm
SENSOR_COUNT = 32  # WDN1 ile uyumlu sensör sayısı

# Bursa su şebekesi gerçekçi parametreleri
PRESSURE_BASE = 4.5  # bar (Bursa ortalama)
PRESSURE_MIN = 2.0   # bar
PRESSURE_MAX = 7.0   # bar
FLOW_BASE = 150      # L/s (ana hat)
DEMAND_MULTIPLIERS = {
    # Saatlik talep çarpanları (gerçekçi günlük profil)
    0: 0.4, 1: 0.3, 2: 0.25, 3: 0.2, 4: 0.2, 5: 0.3,
    6: 0.6, 7: 1.0, 8: 1.3, 9: 1.2, 10: 1.1, 11: 1.0,
    12: 1.1, 13: 1.0, 14: 0.9, 15: 0.9, 16: 1.0, 17: 1.2,
    18: 1.4, 19: 1.5, 20: 1.3, 21: 1.1, 22: 0.8, 23: 0.5
}


def load_gis_data():
    """GIS verilerini yükle"""
    print("GIS verileri yükleniyor...")
    
    # İçmesuyu hatları
    icme_hat = gpd.read_file(os.path.join(ICMESUYU_PATH, "balkan_icmesuyu_hat.shp"))
    icme_nokta = gpd.read_file(os.path.join(ICMESUYU_PATH, "balkan_icmesuyu_nokta.shp"))
    
    print(f"  İçmesuyu: {len(icme_hat)} hat, {len(icme_nokta)} nokta")
    
    return icme_hat, icme_nokta


def select_sensor_locations(gdf_nodes, n_sensors=SENSOR_COUNT):
    """Sensör konumlarını seç - stratejik noktalar"""
    print(f"\n{n_sensors} sensör konumu seçiliyor...")
    
    # Rastgele ama dengeli dağılım
    if len(gdf_nodes) < n_sensors:
        indices = list(range(len(gdf_nodes)))
    else:
        indices = np.random.choice(len(gdf_nodes), n_sensors, replace=False)
    
    sensors = []
    for i, idx in enumerate(indices):
        row = gdf_nodes.iloc[idx]
        geom = row.geometry
        
        sensors.append({
            'sensor_id': f'S{i+1:02d}',
            'node_id': row.get('ID', idx),
            'x': geom.x if hasattr(geom, 'x') else geom.centroid.x,
            'y': geom.y if hasattr(geom, 'y') else geom.centroid.y,
            'type': 'pressure',  # Basınç sensörü
            'zone': f'Zone_{(i % 4) + 1}'  # 4 bölgeye dağıt
        })
    
    # 8 adet debi sensörü ekle
    for i in range(8):
        sensors.append({
            'sensor_id': f'F{i+1:02d}',
            'node_id': f'flow_{i+1}',
            'x': sensors[i*4]['x'] if i*4 < len(sensors) else 0,
            'y': sensors[i*4]['y'] if i*4 < len(sensors) else 0,
            'type': 'flow',
            'zone': f'Zone_{(i % 4) + 1}'
        })
    
    return sensors


def generate_demand_pattern(timestamps):
    """Saatlik talep paterni oluştur"""
    pattern = []
    for ts in timestamps:
        hour = ts.hour
        base = DEMAND_MULTIPLIERS[hour]
        
        # Hafta sonu düşük tüketim
        if ts.weekday() >= 5:
            base *= 0.85
        
        # Rastgele varyasyon
        noise = np.random.normal(0, 0.05)
        pattern.append(max(0.1, base + noise))
    
    return np.array(pattern)


def generate_pressure_data(sensors, timestamps, demand_pattern, leak_events):
    """Basınç verisi oluştur"""
    print("\nBasınç verileri oluşturuluyor...")
    
    pressure_data = {}
    
    for sensor in sensors:
        if sensor['type'] != 'pressure':
            continue
            
        sensor_id = sensor['sensor_id']
        zone = sensor['zone']
        
        # Baz basınç (bölgeye göre farklı)
        zone_offset = {'Zone_1': 0.5, 'Zone_2': 0.2, 'Zone_3': -0.3, 'Zone_4': -0.5}
        base_p = PRESSURE_BASE + zone_offset.get(zone, 0)
        
        pressures = []
        for i, (ts, demand) in enumerate(zip(timestamps, demand_pattern)):
            # Temel basınç (talebe ters orantılı)
            p = base_p - (demand - 1.0) * 0.8
            
            # Gece basıncı daha yüksek
            if 2 <= ts.hour <= 5:
                p += 0.5
            
            # Sızıntı etkisi
            for leak in leak_events:
                if leak['start'] <= ts <= leak['end'] and leak['zone'] == zone:
                    # Sızıntı basıncı düşürür
                    leak_effect = leak['severity'] * 0.8
                    p -= leak_effect
            
            # Sensör gürültüsü
            noise = np.random.normal(0, 0.05)
            p += noise
            
            # Limitlere sıkıştır
            p = max(PRESSURE_MIN, min(PRESSURE_MAX, p))
            pressures.append(round(p, 3))
        
        pressure_data[sensor_id] = pressures
    
    return pressure_data


def generate_flow_data(sensors, timestamps, demand_pattern, leak_events):
    """Debi verisi oluştur"""
    print("Debi verileri oluşturuluyor...")
    
    flow_data = {}
    
    for sensor in sensors:
        if sensor['type'] != 'flow':
            continue
            
        sensor_id = sensor['sensor_id']
        zone = sensor['zone']
        
        # Baz debi (bölgeye göre)
        zone_base = {'Zone_1': 180, 'Zone_2': 150, 'Zone_3': 120, 'Zone_4': 100}
        base_f = zone_base.get(zone, FLOW_BASE)
        
        flows = []
        for i, (ts, demand) in enumerate(zip(timestamps, demand_pattern)):
            # Talebe orantılı debi
            f = base_f * demand
            
            # Sızıntı etkisi (debi artar)
            for leak in leak_events:
                if leak['start'] <= ts <= leak['end'] and leak['zone'] == zone:
                    leak_flow = leak['severity'] * 20  # L/s ek akış
                    f += leak_flow
            
            # Sensör gürültüsü
            noise = np.random.normal(0, f * 0.02)
            f += noise
            
            flows.append(round(max(0, f), 2))
        
        flow_data[sensor_id] = flows
    
    return flow_data


def calculate_mnf(flow_data, timestamps):
    """Minimum Night Flow (MNF) hesapla - gece 02:00-04:00"""
    print("MNF hesaplanıyor...")
    
    mnf_data = {}
    
    # Günlük MNF hesapla
    df = pd.DataFrame({'timestamp': timestamps})
    df['date'] = df['timestamp'].dt.date
    df['hour'] = df['timestamp'].dt.hour
    
    for sensor_id, flows in flow_data.items():
        df[sensor_id] = flows
        
        # Gece saatleri (02:00-04:00)
        night_mask = (df['hour'] >= 2) & (df['hour'] <= 4)
        
        # Günlük MNF
        daily_mnf = df[night_mask].groupby('date')[sensor_id].min()
        mnf_data[sensor_id] = {
            'daily_mnf': daily_mnf.to_dict(),
            'avg_mnf': round(daily_mnf.mean(), 2),
            'max_mnf': round(daily_mnf.max(), 2),
            'min_mnf': round(daily_mnf.min(), 2)
        }
    
    return mnf_data


def generate_leak_events(timestamps, n_leaks=15):
    """Sızıntı olayları oluştur"""
    print(f"\n{n_leaks} sızıntı olayı oluşturuluyor...")
    
    leak_events = []
    zones = ['Zone_1', 'Zone_2', 'Zone_3', 'Zone_4']
    
    for i in range(n_leaks):
        # Rastgele başlangıç zamanı
        start_idx = np.random.randint(0, len(timestamps) - 100)
        duration_hours = np.random.randint(2, 48)  # 2-48 saat
        
        start = timestamps[start_idx]
        end = start + timedelta(hours=duration_hours)
        
        # Şiddet (0.1 - 1.0)
        severity = np.random.uniform(0.2, 1.0)
        
        leak_events.append({
            'leak_id': f'L{i+1:03d}',
            'start': start,
            'end': min(end, timestamps[-1]),
            'zone': np.random.choice(zones),
            'severity': round(severity, 2),
            'type': np.random.choice(['pipe_burst', 'joint_leak', 'valve_leak']),
            'detected': severity > 0.5  # Büyük sızıntılar tespit edilmiş
        })
    
    return leak_events


def generate_labels(timestamps, leak_events):
    """Her zaman noktası için sızıntı etiketi"""
    labels = []
    
    for ts in timestamps:
        # Bu zaman noktasında aktif sızıntı var mı?
        is_leak = 0
        leak_severity = 0
        leak_zone = None
        
        for leak in leak_events:
            if leak['start'] <= ts <= leak['end']:
                is_leak = 1
                leak_severity = max(leak_severity, leak['severity'])
                leak_zone = leak['zone']
        
        labels.append({
            'timestamp': ts,
            'is_leak': is_leak,
            'leak_severity': leak_severity,
            'leak_zone': leak_zone
        })
    
    return labels


def create_wdn_dataset(pressure_data, flow_data, timestamps, labels):
    """WDN1 formatında veri seti oluştur"""
    print("\nWDN formatında veri seti oluşturuluyor...")
    
    # Ana DataFrame
    df = pd.DataFrame({'timestamp': timestamps})
    df['time_seconds'] = (df['timestamp'] - df['timestamp'].iloc[0]).dt.total_seconds()
    
    # Basınç sütunları (P1, P2, ...)
    for i, (sensor_id, values) in enumerate(pressure_data.items()):
        df[f'P{i+1}'] = values
    
    # Debi sütunları (F1, F2, ...)
    for i, (sensor_id, values) in enumerate(flow_data.items()):
        df[f'F{i+1}'] = values
    
    # Etiketler
    df['is_leak'] = [l['is_leak'] for l in labels]
    df['leak_severity'] = [l['leak_severity'] for l in labels]
    
    return df


def save_dataset(df, sensors, leak_events, mnf_data, output_dir):
    """Veri setini kaydet"""
    print(f"\nVeri seti kaydediliyor: {output_dir}")
    
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Ana veri seti (CSV)
    main_csv = os.path.join(output_dir, "sensor_timeseries.csv")
    df.to_csv(main_csv, index=False)
    print(f"  ✓ {main_csv}")
    
    # 2. WDN1 formatında (sadece sayısal, header yok)
    wdn_csv = os.path.join(output_dir, "wdn_format.csv")
    numeric_cols = [c for c in df.columns if c not in ['timestamp', 'leak_zone']]
    df[numeric_cols].to_csv(wdn_csv, index=False, header=False)
    print(f"  ✓ {wdn_csv}")
    
    # 3. Sensör metadata
    sensors_json = os.path.join(output_dir, "sensors.json")
    with open(sensors_json, 'w', encoding='utf-8') as f:
        json.dump(sensors, f, indent=2, ensure_ascii=False)
    print(f"  ✓ {sensors_json}")
    
    # 4. Sızıntı olayları
    leaks_json = os.path.join(output_dir, "leak_events.json")
    leak_data = []
    for leak in leak_events:
        leak_data.append({
            **leak,
            'start': leak['start'].isoformat(),
            'end': leak['end'].isoformat()
        })
    with open(leaks_json, 'w', encoding='utf-8') as f:
        json.dump(leak_data, f, indent=2, ensure_ascii=False)
    print(f"  ✓ {leaks_json}")
    
    # 5. MNF verileri
    mnf_json = os.path.join(output_dir, "mnf_analysis.json")
    mnf_serializable = {}
    for sensor_id, data in mnf_data.items():
        mnf_serializable[sensor_id] = {
            'avg_mnf': data['avg_mnf'],
            'max_mnf': data['max_mnf'],
            'min_mnf': data['min_mnf'],
            'daily_mnf': {str(k): v for k, v in data['daily_mnf'].items()}
        }
    with open(mnf_json, 'w', encoding='utf-8') as f:
        json.dump(mnf_serializable, f, indent=2, ensure_ascii=False)
    print(f"  ✓ {mnf_json}")
    
    # 6. Dataset metadata
    metadata = {
        'name': 'Bursa Balkan Mahallesi Su Şebekesi Sensör Verileri',
        'version': '1.0.0',
        'created_at': datetime.now().isoformat(),
        'source': 'Simulated from real GIS data',
        'gis_source': 'Bursa Su ve Kanalizasyon İdaresi (BUSKİ)',
        'region': 'Balkan Mahallesi, Osmangazi, Bursa',
        'simulation_period': {
            'start': df['timestamp'].iloc[0].isoformat(),
            'end': df['timestamp'].iloc[-1].isoformat(),
            'duration_days': SIMULATION_DAYS,
            'sample_interval_minutes': SAMPLE_INTERVAL_MINUTES
        },
        'statistics': {
            'total_samples': len(df),
            'pressure_sensors': len(pressure_data),
            'flow_sensors': len(flow_data),
            'leak_events': len(leak_events),
            'leak_ratio': round(df['is_leak'].mean(), 4)
        },
        'columns': {
            'time_seconds': 'Simülasyon başlangıcından itibaren saniye',
            'P1-P32': 'Basınç sensörleri (bar)',
            'F1-F8': 'Debi sensörleri (L/s)',
            'is_leak': 'Sızıntı etiketi (0/1)',
            'leak_severity': 'Sızıntı şiddeti (0-1)'
        },
        'usage': 'ML model eğitimi için kullanılabilir (sızıntı tespiti, basınç tahmini)'
    }
    
    metadata_json = os.path.join(output_dir, "dataset_metadata.json")
    with open(metadata_json, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"  ✓ {metadata_json}")
    
    return metadata


def main():
    print("=" * 60)
    print("ULUDAGFLOW - GERÇEK SENSÖR VERİ SETİ OLUŞTURUCU")
    print("=" * 60)
    
    # 1. GIS verilerini yükle
    icme_hat, icme_nokta = load_gis_data()
    
    # 2. Sensör konumlarını belirle
    sensors = select_sensor_locations(icme_nokta)
    print(f"  Toplam sensör: {len(sensors)}")
    
    # 3. Zaman serisi oluştur
    print(f"\n{SIMULATION_DAYS} günlük simülasyon hazırlanıyor...")
    start_date = datetime(2025, 11, 1, 0, 0)
    n_samples = SIMULATION_DAYS * 24 * 60 // SAMPLE_INTERVAL_MINUTES
    timestamps = [start_date + timedelta(minutes=i*SAMPLE_INTERVAL_MINUTES) for i in range(n_samples)]
    print(f"  Toplam örnek: {len(timestamps)}")
    
    # 4. Talep paterni
    demand_pattern = generate_demand_pattern(timestamps)
    
    # 5. Sızıntı olayları
    leak_events = generate_leak_events(timestamps)
    
    # 6. Basınç verileri
    pressure_data = generate_pressure_data(sensors, timestamps, demand_pattern, leak_events)
    
    # 7. Debi verileri
    flow_data = generate_flow_data(sensors, timestamps, demand_pattern, leak_events)
    
    # 8. MNF hesapla
    mnf_data = calculate_mnf(flow_data, timestamps)
    
    # 9. Etiketler
    labels = generate_labels(timestamps, leak_events)
    
    # 10. WDN formatında birleştir
    df = create_wdn_dataset(pressure_data, flow_data, timestamps, labels)
    
    # 11. Kaydet
    metadata = save_dataset(df, sensors, leak_events, mnf_data, OUTPUT_DIR)
    
    # Özet
    print("\n" + "=" * 60)
    print("VERİ SETİ OLUŞTURULDU!")
    print("=" * 60)
    print(f"Konum: {OUTPUT_DIR}")
    print(f"Toplam örnek: {len(df)}")
    print(f"Basınç sensörü: {len(pressure_data)}")
    print(f"Debi sensörü: {len(flow_data)}")
    print(f"Sızıntı olayı: {len(leak_events)}")
    print(f"Sızıntı oranı: {df['is_leak'].mean()*100:.1f}%")
    print("\nDosyalar:")
    print("  - sensor_timeseries.csv (ana veri)")
    print("  - wdn_format.csv (WDN1 uyumlu)")
    print("  - sensors.json (sensör konumları)")
    print("  - leak_events.json (sızıntı olayları)")
    print("  - mnf_analysis.json (MNF analizi)")
    print("  - dataset_metadata.json (veri seti bilgisi)")


if __name__ == "__main__":
    main()
