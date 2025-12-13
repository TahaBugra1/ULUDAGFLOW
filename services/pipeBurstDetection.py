"""
Pipe Burst & Pressure Anomaly Detection Service
Boru arızası ve basınç anomalileri tespit etme servisi

Bu servis:
1. Vatandaş şikayetlerini analiz eder
2. Benzer şikayetleri kümelendirir (muhtemel arıza yerleri)
3. Basınç anomalilerini tahmin eder
4. GATRes ile gelecek basınç senaryolarını simüle eder
"""

import json
from typing import List, Dict, Tuple
import math
from datetime import datetime
import statistics

# ============================================================================
# PIPE BURST DETECTION MODELS
# ============================================================================

class BurstDetectionAnalyzer:
    """Boru patlaması tespiti için ML modeli"""
    
    def __init__(self):
        # Boru arızası için önemli sinyaller
        self.burst_keywords = [
            "patlak", "kırık", "kırılmış", "sızıntı", "çatlamış",
            "su kaçması", "su akması", "boru kırılması", "fışkırma"
        ]
        
        self.pressure_keywords = [
            "basınç düşük", "zayıf akış", "akış yok", "su çıkmaz",
            "su gelmez", "su gelmiyor", "basınç yok"
        ]
    
    def analyze_complaint(self, text: str) -> Dict:
        """Şikayeti analiz ederek boru arızası riski hesapla"""
        text_lower = text.lower()
        
        burst_score = 0
        pressure_score = 0
        
        # Boru arızası anahtar kelimelerini bul
        for keyword in self.burst_keywords:
            if keyword in text_lower:
                burst_score += 1
        
        # Basınç problemleri anahtar kelimelerini bul
        for keyword in self.pressure_keywords:
            if keyword in text_lower:
                pressure_score += 1
        
        # Normalleştir (0-100)
        burst_risk = min(100, (burst_score / len(self.burst_keywords)) * 100)
        pressure_risk = min(100, (pressure_score / len(self.pressure_keywords)) * 100)
        
        return {
            "burst_risk": burst_risk,
            "pressure_risk": pressure_risk,
            "is_likely_burst": burst_score > 0,
            "is_pressure_issue": pressure_score > 0
        }
    
    def cluster_complaints(self, complaints: List[Dict]) -> List[Dict]:
        """
        Benzer şikayetleri kümelendir
        Aynı bölge/mahallede benzer sorunlar = muhtemel arıza
        """
        clusters = {}
        
        for complaint in complaints:
            district = complaint.get("district")
            neighborhood = complaint.get("neighborhood", "")
            key = f"{district}_{neighborhood}"
            
            if key not in clusters:
                clusters[key] = {
                    "location": key,
                    "district": district,
                    "neighborhood": neighborhood,
                    "complaints": [],
                    "burst_risk": 0,
                    "pressure_risk": 0
                }
            
            clusters[key]["complaints"].append(complaint)
        
        # Her cluster için risk hesapla
        for key, cluster in clusters.items():
            burst_scores = [self.analyze_complaint(c.get("text", ""))["burst_risk"] 
                          for c in cluster["complaints"]]
            pressure_scores = [self.analyze_complaint(c.get("text", ""))["pressure_risk"] 
                             for c in cluster["complaints"]]
            
            cluster["burst_risk"] = statistics.mean(burst_scores) if burst_scores else 0
            cluster["pressure_risk"] = statistics.mean(pressure_scores) if pressure_scores else 0
            cluster["complaint_count"] = len(cluster["complaints"])
        
        # Risk seviyesine göre sırala
        return sorted(clusters.values(), 
                     key=lambda x: x["burst_risk"] + x["pressure_risk"], 
                     reverse=True)


# ============================================================================
# PRESSURE ESTIMATION (GATRes Integration)
# ============================================================================

class PressureSimulator:
    """
    Basınç simülatörü - GATRes model çıkışlarını simüle eder
    Gerçek GATRes entegrasyonu için bu modeli değiştirebilirsiniz
    """
    
    def __init__(self):
        # Bursa bölgeleri için tahmini baseline basınç değerleri (bar)
        self.baseline_pressure = {
            'Nilüfer': 3.5,
            'Osmangazi': 3.2,
            'Yıldırım': 3.1,
            'Mudanya': 3.0,
            'Gemlik': 2.8,
            'İnegöl': 2.7,
            'Kestel': 3.3,
            'Gürsu': 3.4,
            'Harmancık': 2.6,
            'Karacabey': 2.5,
            'Keles': 2.4,
            'İznik': 2.3,
            'Orhaneli': 2.2,
            'Orhangazi': 3.1,
            'Yenişehir': 2.8,
            'Büyükorhan': 2.5,
            'Mustafakemalpaşa': 2.6
        }
    
    def estimate_pressure(self, 
                         district: str, 
                         hour: int = None,
                         burst_risk: float = 0) -> Dict:
        """
        Basınç tahmini yap
        
        Args:
            district: Bölge adı
            hour: Saat (pik/off-peak hesaplaması için)
            burst_risk: Boru arızası riski (0-100)
        
        Returns:
            Basınç tahmini ve anomali tespiti
        """
        if hour is None:
            hour = datetime.now().hour
        
        base = self.baseline_pressure.get(district, 3.0)
        
        # Saatlik kullanım deseni (pik saatlerde düşer)
        hourly_factor = self._get_hourly_factor(hour)
        
        # Boru arızası riski basınçı düşürür
        burst_factor = 1 - (burst_risk / 100) * 0.4
        
        # Tahmini basınç
        estimated_pressure = base * hourly_factor * burst_factor
        estimated_pressure = max(0.5, estimated_pressure)  # Minimum 0.5 bar
        
        # Normal aralık: 2.0 - 4.0 bar
        is_anomaly = estimated_pressure < 2.0 or estimated_pressure > 5.0
        
        severity = "NORMAL"
        if estimated_pressure < 1.5:
            severity = "CRITICAL"  # Kritik düşük basınç
        elif estimated_pressure < 2.0:
            severity = "WARNING"
        elif estimated_pressure > 4.5:
            severity = "CRITICAL"  # Kritik yüksek basınç
        
        return {
            "district": district,
            "estimated_pressure": round(estimated_pressure, 2),
            "baseline_pressure": base,
            "hourly_factor": round(hourly_factor, 2),
            "burst_factor": round(burst_factor, 2),
            "burst_risk": burst_risk,
            "is_anomaly": is_anomaly,
            "severity": severity,
            "timestamp": datetime.now().isoformat()
        }
    
    def _get_hourly_factor(self, hour: int) -> float:
        """Saatine göre talep faktörü"""
        # Pik saatler: 7-10, 12-14, 18-22
        peak_hours = [7, 8, 9, 12, 13, 19, 20, 21]
        off_peak = [3, 4, 5]
        
        if hour in peak_hours:
            return 0.75  # Pik saatlerde %25 daha az basınç
        elif hour in off_peak:
            return 1.2  # Gece saatlerinde %20 daha fazla basınç
        else:
            return 1.0
    
    def predict_daily_pressure(self, 
                              district: str,
                              burst_risk: float = 0) -> List[Dict]:
        """Günlük basınç tahmini (saatlik)"""
        predictions = []
        for hour in range(24):
            pred = self.estimate_pressure(district, hour, burst_risk)
            predictions.append(pred)
        return predictions


# ============================================================================
# BURST LOCATION PREDICTION (Spatial Analysis)
# ============================================================================

class BurstLocationPredictor:
    """Arıza konumunu tahmin et - şikayetlerin spatial dağılımını analiz eder"""
    
    def __init__(self):
        # Bursa bölgeleri için grid koordinatları (simplified)
        self.district_grid = {
            'Nilüfer': (40.19, 29.07),
            'Osmangazi': (40.19, 29.01),
            'Yıldırım': (40.22, 29.13),
            'Mudanya': (40.36, 28.67),
        }
    
    def predict_burst_location(self, 
                              clustered_complaints: List[Dict]) -> List[Dict]:
        """
        Arıza olabilir yerleri tahmin et
        Complaint yoğunluğu + pressure drop = arıza ihtimali
        """
        burst_predictions = []
        
        for cluster in clustered_complaints:
            if cluster["burst_risk"] < 20:
                continue  # Düşük risk - atla
            
            prediction = {
                "location": cluster["location"],
                "district": cluster["district"],
                "neighborhood": cluster["neighborhood"],
                "burst_probability": min(100, cluster["burst_risk"] * 1.2),
                "pressure_drop_detected": cluster["pressure_risk"] > 30,
                "complaint_concentration": cluster["complaint_count"],
                "recommended_action": self._get_recommendation(
                    cluster["burst_risk"],
                    cluster["pressure_risk"]
                )
            }
            burst_predictions.append(prediction)
        
        return sorted(burst_predictions, 
                     key=lambda x: x["burst_probability"],
                     reverse=True)
    
    def _get_recommendation(self, burst_risk: float, pressure_risk: float) -> str:
        """Tavsiye edin"""
        if burst_risk > 60 and pressure_risk > 60:
            return "ACIL: Teknik ekip gönder. Boru patlaması olasılığı yüksek."
        elif burst_risk > 40:
            return "UYARI: Bölgeyi yakından izle. İnşaat ve tamir hazırla."
        elif pressure_risk > 50:
            return "BİLDİRİ: Basınç anormallikleri tespit. Kaçak kontrolü yap."
        else:
            return "NORMAL: Düzenli izleme devam et."


# ============================================================================
# GATRES INTEGRATION (Future)
# ============================================================================

class GATResIntegration:
    """
    GATRes modeline entegrasyon
    Şu anda simüle edilmiş, gerçek model eklenebilir
    """
    
    def __init__(self, model_path: str = None):
        """
        Args:
            model_path: Eğitilmiş GATRes model yolu
        """
        self.model_path = model_path
        self.is_available = False
        
        # Gerçek GATRes kullanmak için:
        # import torch
        # from gnn_pressure_estimation.GraphModels import GATRes
        # self.model = torch.load(model_path)
        # self.is_available = True
    
    def estimate_network_wide_pressure(self, 
                                      network_state: Dict) -> Dict:
        """
        Tüm ağ için basınç tahmini (GATRes)
        
        Giriş:
        - network_state: Bölgelerin mevcut durumu
        
        Çıkış:
        - Tüm düğümlerin tahmini basınçları
        """
        if self.is_available:
            # Gerçek GATRes çalıştır
            pass
        
        # Şu an için simüle edilen sonuçlar
        return {
            "status": "simulated",
            "note": "GATRes modeli henüz entegre edilmedi. Test aşamasında simüle veriler kullanılıyor."
        }


# ============================================================================
# MAIN SERVICE CLASS
# ============================================================================

class PipeBurstDetectionService:
    """Ana servis - tüm bileşenleri birleştirir"""
    
    def __init__(self):
        self.burst_analyzer = BurstDetectionAnalyzer()
        self.pressure_simulator = PressureSimulator()
        self.location_predictor = BurstLocationPredictor()
        self.gatres = GATResIntegration()
    
    def analyze_complaints_for_bursts(self, complaints: List[Dict]) -> Dict:
        """
        Şikayetleri analiz ederek arıza riskini hesapla
        
        Returns:
            Arıza tahmini, konum, basınç verileri
        """
        # Şikayetleri kümelendir
        clusters = self.burst_analyzer.cluster_complaints(complaints)
        
        # Arıza konumlarını tahmin et
        burst_predictions = self.location_predictor.predict_burst_location(clusters)
        
        # Her bölge için basınç tahmini yap
        pressure_estimates = {}
        for pred in burst_predictions:
            district = pred["district"]
            pressure = self.pressure_simulator.estimate_pressure(
                district,
                burst_risk=pred["burst_probability"]
            )
            pressure_estimates[district] = pressure
        
        return {
            "timestamp": datetime.now().isoformat(),
            "complaint_clusters": clusters,
            "burst_predictions": burst_predictions,
            "pressure_estimates": pressure_estimates,
            "summary": {
                "total_complaints": len(complaints),
                "high_risk_locations": len([p for p in burst_predictions 
                                           if p["burst_probability"] > 60]),
                "critical_pressure_zones": len([p for p in pressure_estimates.values() 
                                              if p["severity"] == "CRITICAL"])
            }
        }
    
    def get_daily_pressure_forecast(self, district: str, burst_risk: float = 0) -> List[Dict]:
        """Günlük basınç tahmini"""
        return self.pressure_simulator.predict_daily_pressure(district, burst_risk)


# ============================================================================
# API ENDPOINTS (Flask Integration - Optional)
# ============================================================================

# Bu fonksiyonlar Flask entegrasyonu için örnek
# Kullanmak için: from flask import request, jsonify
# Uygulamanız Flask kullanıyorsa aşağıdaki imports'u ekleyin:
# from flask import request, jsonify

"""
def create_service_endpoints(app):
    \"\"\"Flask uygulamasına API endpoints ekle\"\"\"
    from flask import request, jsonify
    
    service = PipeBurstDetectionService()
    
    @app.route('/api/analyze-bursts', methods=['POST'])
    def analyze_bursts():
        \"\"\"POST: Şikayetleri arıza analizi için işle\"\"\"
        data = request.get_json()
        complaints = data.get('complaints', [])
        
        result = service.analyze_complaints_for_bursts(complaints)
        return jsonify(result)
    
    @app.route('/api/pressure-forecast/<district>', methods=['GET'])
    def get_pressure_forecast(district):
        \"\"\"GET: Bölge için günlük basınç tahmini\"\"\"
        burst_risk = request.args.get('burst_risk', 0, type=float)
        
        forecast = service.get_daily_pressure_forecast(district, burst_risk)
        return jsonify(forecast)
    
    @app.route('/api/burst-locations', methods=['POST'])
    def get_burst_locations():
        \"\"\"POST: Potansiyel arıza konumlarını al\"\"\"
        data = request.get_json()
        complaints = data.get('complaints', [])
        
        # Analiz et
        result = service.analyze_complaints_for_bursts(complaints)
        
        return jsonify({
            "burst_locations": result["burst_predictions"],
            "critical_areas": [p for p in result["burst_predictions"] 
                             if p["burst_probability"] > 60]
        })
"""


if __name__ == "__main__":
    # Test örneği
    service = PipeBurstDetectionService()
    
    test_complaints = [
        {
            "district": "Nilüfer",
            "neighborhood": "Görükle",
            "text": "Bizim sokakta patlak boru var, su kaçıyor her taraftan"
        },
        {
            "district": "Nilüfer",
            "neighborhood": "Görükle",
            "text": "Aynı yerde basınç çok düşük, su çıkmıyor"
        },
        {
            "district": "Osmangazi",
            "neighborhood": "Çekirge",
            "text": "Boru kırılmış sanırım, akış yok"
        }
    ]
    
    result = service.analyze_complaints_for_bursts(test_complaints)
    print(json.dumps(result, indent=2, ensure_ascii=False))
