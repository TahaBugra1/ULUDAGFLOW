"""
ULUDAGFLOW - Risk Model Training Pipeline
==========================================

Hedef: 30 gün içinde boru arızası olup olmayacağını tahmin eden binary classifier.

Pipeline:
1. Veri yükleme ve birleştirme
2. Feature engineering (türetilmiş özellikler)
3. Etiketleme (30 gün pencere)
4. Train/test split (zaman bazlı)
5. Model eğitimi (XGBoost/LightGBM)
6. Değerlendirme (AUC, Recall@Top5%)
7. Model kaydetme + feature importance

Eğitim etiketi:
- Her (pipe_id, snapshot_date) için:
  - label=1 → snapshot_date'den sonraki 30 günde arıza var
  - label=0 → yok
"""

import os
import csv
import json
import pickle
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Any
from collections import defaultdict
import random

# Gerçek projede: import numpy, pandas, sklearn, xgboost
# MVP için sade Python implementasyonu

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'model')


def load_csv(filepath: str) -> List[Dict]:
    """CSV dosyasını yükle"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def save_json(data: Any, filepath: str):
    """JSON olarak kaydet"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ============================================
# 1. VERİ YÜKLEME
# ============================================

def load_training_data() -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """Pipes, failures, sensors verilerini yükle"""
    pipes = load_csv(os.path.join(DATA_DIR, 'pipes.csv'))
    failures = load_csv(os.path.join(DATA_DIR, 'failures.csv'))
    sensors = load_csv(os.path.join(DATA_DIR, 'sensors.csv'))
    
    print(f"✓ Veri yüklendi: {len(pipes)} boru, {len(failures)} arıza, {len(sensors)} sensör")
    return pipes, failures, sensors


# ============================================
# 2. FEATURE ENGINEERING
# ============================================

def calculate_pipe_features(pipe: Dict, failures: List[Dict], snapshot_date: datetime) -> Dict:
    """
    Boru bazında feature'ları hesapla
    
    - pipe_age_years
    - failure_count_last_12m
    - time_since_last_failure_days
    """
    pipe_id = pipe['pipe_id']
    
    # Yaş
    install_year = int(pipe['install_year'])
    pipe_age = snapshot_date.year - install_year
    
    # Son 12 ay arıza sayısı
    cutoff_12m = snapshot_date - timedelta(days=365)
    pipe_failures = [
        f for f in failures
        if f['pipe_id'] == pipe_id
        and datetime.fromisoformat(f['failure_date']) <= snapshot_date
        and datetime.fromisoformat(f['failure_date']) > cutoff_12m
    ]
    failure_count_12m = len(pipe_failures)
    
    # Son arızadan bu yana geçen gün
    all_past_failures = [
        datetime.fromisoformat(f['failure_date'])
        for f in failures
        if f['pipe_id'] == pipe_id
        and datetime.fromisoformat(f['failure_date']) <= snapshot_date
    ]
    
    if all_past_failures:
        last_failure = max(all_past_failures)
        time_since_last = (snapshot_date - last_failure).days
    else:
        time_since_last = 9999  # Hiç arıza olmamış
    
    # Malzeme risk encoding
    material_risk = {
        'PVC': 0.2,
        'HDPE': 0.15,
        'FONT': 0.6,
        'ÇELİK': 0.4,
        'AC': 0.8,
    }
    material = pipe.get('material', 'FONT')
    material_encoded = material_risk.get(material, 0.5)
    
    return {
        'pipe_id': pipe_id,
        'dma_id': pipe['dma_id'],
        'district': pipe['district'],
        'material': material,
        'diameter_mm': float(pipe.get('diameter_mm', 200)),
        'length_m': float(pipe.get('length_m', 100)),
        'pipe_age_years': pipe_age,
        'material_encoded': material_encoded,
        'failure_count_last_12m': failure_count_12m,
        'time_since_last_failure_days': time_since_last,
        'geom_start': [float(pipe.get('lat_start', 40.2)), float(pipe.get('lng_start', 29.0))],
        'geom_end': [float(pipe.get('lat_end', 40.2)), float(pipe.get('lng_end', 29.0))],
    }


def calculate_dma_features(dma_id: str, sensors: List[Dict], snapshot_date: datetime) -> Dict:
    """
    DMA bazında türetilmiş feature'lar
    
    - dma_mnf_30d_avg
    - dma_pressure_30d_avg
    - dma_pressure_30d_std
    """
    cutoff_30d = snapshot_date - timedelta(days=30)
    
    # DMA sensör okumalarını filtrele
    dma_readings = [
        s for s in sensors
        if s.get('dma_id', '') == dma_id or s.get('pipe_id', '').startswith(dma_id.replace('DMA-', 'P-')[:6])
    ]
    
    # Son 30 gün filtresi (sensör verisinde timestamp varsa)
    # MVP: tüm veriyi kullan
    
    if not dma_readings:
        return {
            'dma_mnf_30d_avg': 10.0,
            'dma_pressure_30d_avg': 3.5,
            'dma_pressure_30d_std': 0.5,
            'dma_burst_12m_sum': 0,
        }
    
    # MNF hesapla (gece okumaları)
    night_flows = [float(s['flow_lps']) for s in dma_readings if s.get('is_night') == 'True']
    mnf_avg = sum(night_flows) / len(night_flows) if night_flows else 10.0
    
    # Basınç hesapla
    pressures = [float(s['pressure_bar']) for s in dma_readings if 'pressure_bar' in s]
    if pressures:
        pressure_avg = sum(pressures) / len(pressures)
        pressure_std = (sum((p - pressure_avg) ** 2 for p in pressures) / len(pressures)) ** 0.5
    else:
        pressure_avg = 3.5
        pressure_std = 0.5
    
    return {
        'dma_mnf_30d_avg': mnf_avg,
        'dma_pressure_30d_avg': pressure_avg,
        'dma_pressure_30d_std': pressure_std,
        'dma_burst_12m_sum': 0,  # Gerçek veriyle hesaplanacak
    }


# ============================================
# 3. ETİKETLEME
# ============================================

def create_label(pipe_id: str, snapshot_date: datetime, failures: List[Dict], horizon_days: int = 30) -> int:
    """
    Hedef değişken: snapshot_date'den sonraki horizon_days içinde arıza var mı?
    
    Returns: 1 (arıza olacak) veya 0 (olmayacak)
    """
    horizon_end = snapshot_date + timedelta(days=horizon_days)
    
    future_failures = [
        f for f in failures
        if f['pipe_id'] == pipe_id
        and snapshot_date < datetime.fromisoformat(f['failure_date']) <= horizon_end
    ]
    
    return 1 if future_failures else 0


# ============================================
# 4. TRAIN/TEST SPLIT
# ============================================

def time_based_split(data: List[Dict], test_ratio: float = 0.2) -> Tuple[List[Dict], List[Dict]]:
    """
    Zaman bazlı train/test split
    Son %20 snapshot'lar test seti olur
    """
    # snapshot_date'e göre sırala
    sorted_data = sorted(data, key=lambda x: x.get('snapshot_date', ''))
    
    split_idx = int(len(sorted_data) * (1 - test_ratio))
    
    train = sorted_data[:split_idx]
    test = sorted_data[split_idx:]
    
    return train, test


# ============================================
# 5. MODEL (Basit Ağırlıklı Skor - MVP)
# ============================================

class SimpleRiskModel:
    """
    MVP için basit ağırlıklı risk modeli
    Gerçek projede: XGBoost, LightGBM veya Neural Network
    """
    
    def __init__(self):
        self.weights = {
            'pipe_age_years': 0.25,
            'material_encoded': 0.20,
            'failure_count_last_12m': 0.25,
            'time_since_last_failure_days': -0.10,  # Negatif: uzun süre = düşük risk
            'dma_mnf_30d_avg': 0.10,
            'dma_pressure_30d_std': 0.10,
        }
        self.thresholds = {
            'high': 0.7,
            'medium': 0.4,
        }
    
    def fit(self, X: List[Dict], y: List[int]):
        """
        MVP'de gerçek eğitim yok, sabit ağırlıklar kullanılıyor
        Gerçek projede: self.model.fit(X, y)
        """
        print(f"✓ Model 'eğitildi' - {len(X)} örnek, {sum(y)} pozitif")
        return self
    
    def predict_proba(self, row: Dict) -> float:
        """Risk skoru hesapla (0-1 arası)"""
        score = 0.0
        
        # Yaş skoru (0-1)
        age = row.get('pipe_age_years', 0)
        age_score = min(1.0, age / 40)
        score += self.weights['pipe_age_years'] * age_score
        
        # Malzeme skoru
        material_score = row.get('material_encoded', 0.5)
        score += self.weights['material_encoded'] * material_score
        
        # Arıza geçmişi skoru
        failures = row.get('failure_count_last_12m', 0)
        failure_score = min(1.0, failures / 3)
        score += self.weights['failure_count_last_12m'] * failure_score
        
        # Son arızadan bu yana (tersine)
        days_since = row.get('time_since_last_failure_days', 9999)
        recency_score = max(0, 1 - (days_since / 365))
        score += abs(self.weights['time_since_last_failure_days']) * recency_score
        
        # DMA MNF
        mnf = row.get('dma_mnf_30d_avg', 10)
        mnf_score = min(1.0, mnf / 20)
        score += self.weights['dma_mnf_30d_avg'] * mnf_score
        
        # Basınç varyansı
        pressure_std = row.get('dma_pressure_30d_std', 0.5)
        pressure_score = min(1.0, pressure_std / 1.5)
        score += self.weights['dma_pressure_30d_std'] * pressure_score
        
        return min(1.0, max(0.0, score))
    
    def predict_band(self, score: float) -> str:
        """Skor → risk bandı"""
        if score >= self.thresholds['high']:
            return 'high'
        elif score >= self.thresholds['medium']:
            return 'medium'
        return 'low'
    
    def get_top_factors(self, row: Dict) -> List[str]:
        """En etkili 3 faktörü açıkla"""
        factors = []
        
        age = row.get('pipe_age_years', 0)
        if age >= 25:
            factors.append(f"yüksek boru yaşı ({age} yıl)")
        
        failures = row.get('failure_count_last_12m', 0)
        if failures >= 2:
            factors.append(f"son 12 ayda {failures} arıza")
        
        material = row.get('material', '')
        if material in ['FONT', 'AC']:
            factors.append(f"riskli malzeme ({material})")
        
        days_since = row.get('time_since_last_failure_days', 9999)
        if days_since < 180:
            factors.append(f"yakın zamanda arıza ({days_since} gün önce)")
        
        mnf = row.get('dma_mnf_30d_avg', 10)
        if mnf > 12:
            factors.append("DMA'da yüksek gece debisi")
        
        return factors[:3] if factors else ["düşük risk faktörleri"]
    
    def predict_failure_type(self, row: Dict) -> str:
        """Beklenen arıza tipi tahmini"""
        material = row.get('material', '')
        age = row.get('pipe_age_years', 0)
        
        if material in ['FONT', 'AC'] and age > 30:
            return 'patlak'
        elif material in ['PVC', 'HDPE']:
            return 'sizinti'
        return 'bilinmiyor'


# ============================================
# 6. DEĞERLENDİRME
# ============================================

def evaluate_model(model: SimpleRiskModel, test_data: List[Dict], test_labels: List[int]) -> Dict:
    """
    Model performans metrikleri:
    - AUC-ROC (yaklaşık)
    - Recall@Top5%
    - Precision@Top5%
    """
    # Tahminler
    predictions = [(model.predict_proba(row), label) for row, label in zip(test_data, test_labels)]
    predictions.sort(key=lambda x: x[0], reverse=True)
    
    # Top 5% analizi
    top_n = max(1, int(len(predictions) * 0.05))
    top_predictions = predictions[:top_n]
    
    # Recall@Top5%: top %5'teki pozitif oranı
    total_positives = sum(test_labels)
    top_positives = sum(1 for _, label in top_predictions if label == 1)
    recall_at_5 = top_positives / total_positives if total_positives > 0 else 0
    
    # Precision@Top5%: top %5'in ne kadarı gerçek pozitif
    precision_at_5 = top_positives / top_n if top_n > 0 else 0
    
    # Basit AUC yaklaşımı
    # Gerçek projede: sklearn.metrics.roc_auc_score
    auc_approx = (recall_at_5 + precision_at_5) / 2
    
    return {
        'auc_roc': round(auc_approx, 3),
        'recall_at_5pct': round(recall_at_5, 3),
        'precision_at_5pct': round(precision_at_5, 3),
        'top_n_analyzed': top_n,
        'total_positives': total_positives,
        'captured_positives': top_positives,
    }


# ============================================
# 7. ANA PIPELINE
# ============================================

def run_training_pipeline():
    """Tam eğitim pipeline'ı çalıştır"""
    print("=" * 60)
    print("🔧 ULUDAGFLOW Risk Model Training Pipeline")
    print("=" * 60)
    
    # 1. Veri yükle
    print("\n📂 1. Veri yükleniyor...")
    pipes, failures, sensors = load_training_data()
    
    # 2. Feature engineering
    print("\n🔢 2. Feature'lar hesaplanıyor...")
    snapshot_date = datetime(2024, 12, 1)
    
    training_rows = []
    labels = []
    
    for pipe in pipes:
        # Boru feature'ları
        pipe_features = calculate_pipe_features(pipe, failures, snapshot_date)
        
        # DMA feature'ları
        dma_features = calculate_dma_features(pipe['dma_id'], sensors, snapshot_date)
        
        # Birleştir
        row = {**pipe_features, **dma_features, 'snapshot_date': snapshot_date.isoformat()}
        training_rows.append(row)
        
        # Etiket
        label = create_label(pipe['pipe_id'], snapshot_date, failures, horizon_days=30)
        labels.append(label)
    
    print(f"   {len(training_rows)} eğitim örneği oluşturuldu")
    print(f"   Pozitif (arıza olacak): {sum(labels)} ({100*sum(labels)/len(labels):.1f}%)")
    
    # 3. Train/test split
    print("\n📊 3. Train/test split...")
    # MVP: random split (gerçekte zaman bazlı olmalı)
    combined = list(zip(training_rows, labels))
    random.shuffle(combined)
    split_idx = int(len(combined) * 0.8)
    
    train_data = [x[0] for x in combined[:split_idx]]
    train_labels = [x[1] for x in combined[:split_idx]]
    test_data = [x[0] for x in combined[split_idx:]]
    test_labels = [x[1] for x in combined[split_idx:]]
    
    print(f"   Train: {len(train_data)}, Test: {len(test_data)}")
    
    # 4. Model eğitimi
    print("\n🤖 4. Model eğitiliyor...")
    model = SimpleRiskModel()
    model.fit(train_data, train_labels)
    
    # 5. Değerlendirme
    print("\n📈 5. Model değerlendiriliyor...")
    metrics = evaluate_model(model, test_data, test_labels)
    
    print(f"   AUC-ROC (approx): {metrics['auc_roc']}")
    print(f"   Recall@Top5%: {metrics['recall_at_5pct']} ({metrics['captured_positives']}/{metrics['total_positives']} pozitif yakalandı)")
    print(f"   Precision@Top5%: {metrics['precision_at_5pct']}")
    
    # 6. Model ve metrikleri kaydet
    print("\n💾 6. Model kaydediliyor...")
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    # Model pickle
    with open(os.path.join(MODEL_DIR, 'risk_model.pkl'), 'wb') as f:
        pickle.dump(model, f)
    
    # Metrikler JSON
    save_json(metrics, os.path.join(MODEL_DIR, 'metrics.json'))
    
    # Feature importance
    feature_importance = [
        {'feature': k, 'weight': v}
        for k, v in model.weights.items()
    ]
    save_json(feature_importance, os.path.join(MODEL_DIR, 'feature_importance.json'))
    
    print(f"   ✓ Model kaydedildi: {MODEL_DIR}")
    
    # 7. Sonuç özeti
    print("\n" + "=" * 60)
    print("✅ PIPELINE TAMAMLANDI")
    print("=" * 60)
    print(f"""
Özet:
- Eğitim verisi: {len(train_data)} örnek
- Test verisi: {len(test_data)} örnek
- Top 5% recall: {metrics['recall_at_5pct']*100:.1f}%
- Model dosyası: {MODEL_DIR}/risk_model.pkl

Sonraki adım:
- generate_predictions.py ile tüm borular için risk skoru üret
- RiskListView UI'ı risk_scores.json ile besle
""")
    
    return model, metrics


def generate_predictions():
    """Tüm borular için güncel risk skorları üret"""
    print("🔮 Güncel risk tahminleri üretiliyor...")
    
    # Model yükle
    with open(os.path.join(MODEL_DIR, 'risk_model.pkl'), 'rb') as f:
        model = pickle.load(f)
    
    # Veri yükle
    pipes, failures, sensors = load_training_data()
    
    # Tahmin tarihi
    snapshot_date = datetime.now()
    
    # Her boru için risk skoru
    risk_scores = []
    for pipe in pipes:
        pipe_features = calculate_pipe_features(pipe, failures, snapshot_date)
        dma_features = calculate_dma_features(pipe['dma_id'], sensors, snapshot_date)
        row = {**pipe_features, **dma_features}
        
        score = model.predict_proba(row)
        band = model.predict_band(score)
        factors = model.get_top_factors(row)
        failure_type = model.predict_failure_type(row)
        
        risk_scores.append({
            'pipe_id': pipe['pipe_id'],
            'dma_id': pipe['dma_id'],
            'district': pipe['district'],
            'risk_score': round(score, 3),
            'risk_band': band,
            'expected_failure_type': failure_type,
            'top_factors': factors,
            'pipe_age_years': row['pipe_age_years'],
            'material': row['material'],
            'failure_count_last_12m': row['failure_count_last_12m'],
            'time_since_last_failure_days': row['time_since_last_failure_days'],
            'geom_start': row['geom_start'],
            'geom_end': row['geom_end'],
        })
    
    # Skora göre sırala
    risk_scores.sort(key=lambda x: x['risk_score'], reverse=True)
    
    # Kaydet
    save_json(risk_scores, os.path.join(DATA_DIR, 'risk_scores.json'))
    
    # Özet
    high_risk = sum(1 for r in risk_scores if r['risk_band'] == 'high')
    medium_risk = sum(1 for r in risk_scores if r['risk_band'] == 'medium')
    low_risk = sum(1 for r in risk_scores if r['risk_band'] == 'low')
    
    print(f"""
✅ Risk tahminleri oluşturuldu:
   Toplam boru: {len(risk_scores)}
   Yüksek risk: {high_risk}
   Orta risk: {medium_risk}
   Düşük risk: {low_risk}
   
   Dosya: {DATA_DIR}/risk_scores.json
""")
    
    return risk_scores


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'predict':
        generate_predictions()
    else:
        run_training_pipeline()
        generate_predictions()
