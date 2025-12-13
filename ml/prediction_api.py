"""
UludagFlow - Boru Risk Tahmin API
Gerçek GIS verileriyle eğitilmiş ML modeli servisi
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import joblib
import numpy as np
import json
import os
from datetime import datetime

# API oluştur
app = FastAPI(
    title="UludagFlow Boru Risk Tahmin API",
    description="Gerçek GIS verileriyle eğitilmiş ML tabanlı boru arıza risk tahmini",
    version="2.0.0"
)

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model yolu
MODEL_PATH = os.path.join(os.path.dirname(__file__), "artifacts", "pipe_risk_model.joblib")
METADATA_PATH = os.path.join(os.path.dirname(__file__), "artifacts", "pipe_risk_model_metadata.json")

# Global model değişkenleri
model_data = None
model_metadata = None


def load_model():
    """Modeli yükle"""
    global model_data, model_metadata
    
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model dosyası bulunamadı: {MODEL_PATH}")
    
    model_data = joblib.load(MODEL_PATH)
    
    if os.path.exists(METADATA_PATH):
        with open(METADATA_PATH, 'r', encoding='utf-8') as f:
            model_metadata = json.load(f)
    
    print(f"✓ Model yüklendi: {MODEL_PATH}")
    return True


# Request/Response modelleri
class PipeFeatures(BaseModel):
    pipe_id: str
    diameter: float = 200.0
    length: float = 100.0
    material: str = "unknown"
    slope: float = 0.0
    depth: float = 1.5
    age_years: Optional[int] = None
    network_type: str = "icmesuyu"
    lat: Optional[float] = None
    lon: Optional[float] = None


class BatchPredictRequest(BaseModel):
    pipes: List[PipeFeatures]


class RiskPrediction(BaseModel):
    pipe_id: str
    risk_score: float
    risk_level: str
    risk_factors: Dict[str, float]
    confidence: float
    recommendations: List[str]


class BatchPredictResponse(BaseModel):
    predictions: List[RiskPrediction]
    model_version: str
    timestamp: str
    total_pipes: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int


# Material risk mapping
MATERIAL_RISK = {
    'beton': 0.7,
    'betonarme': 0.6,
    'pvc': 0.3,
    'pe': 0.25,
    'hdpe': 0.2,
    'fdk': 0.35,
    'çelik': 0.5,
    'dökme demir': 0.65,
    'asbest': 0.9,
    'unknown': 0.5
}


def get_material_risk(material: str) -> float:
    """Malzeme risk skorunu hesapla"""
    material_lower = material.lower().strip()
    for key, value in MATERIAL_RISK.items():
        if key in material_lower:
            return value
    return 0.5


def calculate_risk_factors(pipe: PipeFeatures) -> Dict[str, float]:
    """Risk faktörlerini hesapla"""
    factors = {}
    
    # Çap riski (küçük çaplar daha riskli)
    if pipe.diameter < 100:
        factors['diameter_risk'] = 0.8
    elif pipe.diameter < 200:
        factors['diameter_risk'] = 0.5
    elif pipe.diameter < 400:
        factors['diameter_risk'] = 0.3
    else:
        factors['diameter_risk'] = 0.2
    
    # Eğim riski (düşük veya çok yüksek eğim riskli)
    if pipe.slope == 0:
        factors['slope_risk'] = 0.9  # Sıfır eğim = tıkanma riski
    elif pipe.slope < 0.005:
        factors['slope_risk'] = 0.7
    elif pipe.slope > 0.1:
        factors['slope_risk'] = 0.6  # Çok yüksek eğim = aşınma
    else:
        factors['slope_risk'] = 0.2
    
    # Malzeme riski
    factors['material_risk'] = get_material_risk(pipe.material)
    
    # Uzunluk riski (uzun borular daha fazla bakım gerektirir)
    if pipe.length > 200:
        factors['length_risk'] = 0.6
    elif pipe.length > 100:
        factors['length_risk'] = 0.4
    else:
        factors['length_risk'] = 0.2
    
    # Derinlik riski
    if pipe.depth > 3:
        factors['depth_risk'] = 0.7  # Derin borular erişimi zor
    elif pipe.depth < 1:
        factors['depth_risk'] = 0.6  # Sığ borular hasar riski
    else:
        factors['depth_risk'] = 0.3
    
    # Yaş riski
    if pipe.age_years:
        if pipe.age_years > 30:
            factors['age_risk'] = 0.9
        elif pipe.age_years > 20:
            factors['age_risk'] = 0.7
        elif pipe.age_years > 10:
            factors['age_risk'] = 0.5
        else:
            factors['age_risk'] = 0.2
    else:
        factors['age_risk'] = 0.5  # Bilinmeyen yaş
    
    return factors


def prepare_features(pipe: PipeFeatures) -> np.ndarray:
    """ML modeli için özellik vektörü hazırla - metadata sırasına göre"""
    
    # Material encoding
    material_lower = pipe.material.lower()
    material_encoded = hash(material_lower) % 10  # Simple encoding
    
    # Network type encoding
    type_encoded = {'icmesuyu': 0, 'atiksu': 1, 'yagmursuyu': 2}.get(pipe.network_type, 0)
    subtype_encoded = 0  # Default
    
    # Risk calculations
    material_risk = get_material_risk(pipe.material)
    
    # Diameter risk
    if pipe.diameter < 100:
        diameter_risk = 0.8
    elif pipe.diameter < 200:
        diameter_risk = 0.5
    else:
        diameter_risk = 0.2
    
    # Slope risk
    if pipe.slope == 0:
        slope_risk = 0.9
    elif pipe.slope < 0.01:
        slope_risk = 0.6
    else:
        slope_risk = 0.2
    
    # Age risk
    age_years = pipe.age_years if pipe.age_years else 15
    if age_years > 30:
        age_risk = 0.9
    elif age_years > 20:
        age_risk = 0.7
    else:
        age_risk = 0.3
    
    # Length risk
    if pipe.length > 200:
        length_risk = 0.6
    elif pipe.length > 100:
        length_risk = 0.4
    else:
        length_risk = 0.2
    
    # Status risk (default working)
    status_risk = 0.2
    
    # Type risk
    type_risk = {'icmesuyu': 0.3, 'atiksu': 0.5, 'yagmursuyu': 0.4}.get(pipe.network_type, 0.4)
    
    # Centroid coordinates (Bursa defaults)
    centroid_x = pipe.lon if pipe.lon else 28.81
    centroid_y = pipe.lat if pipe.lat else 40.21
    
    # Feature vector - metadata sırasına göre:
    # diameter, length, slope, geom_length, centroid_x, centroid_y,
    # material_risk, diameter_risk, slope_risk, age_risk, length_risk,
    # status_risk, type_risk, material_encoded, type_encoded, subtype_encoded
    features = np.array([
        pipe.diameter,
        pipe.length,
        pipe.slope,
        pipe.length,  # geom_length olarak
        centroid_x,
        centroid_y,
        material_risk,
        diameter_risk,
        slope_risk,
        age_risk,
        length_risk,
        status_risk,
        type_risk,
        material_encoded,
        type_encoded,
        subtype_encoded
    ]).reshape(1, -1)
    
    return features


def get_recommendations(risk_score: float, factors: Dict[str, float]) -> List[str]:
    """Risk bazlı öneriler oluştur"""
    recommendations = []
    
    if risk_score > 70:
        recommendations.append("🚨 Acil müdahale gerekiyor - Detaylı inceleme yapılmalı")
    
    if factors.get('slope_risk', 0) > 0.7:
        recommendations.append("📐 Eğim problemi - Tıkanma riski için düzenli temizlik")
    
    if factors.get('material_risk', 0) > 0.6:
        recommendations.append("🔧 Malzeme eskimesi - Boru yenileme planlaması önerilir")
    
    if factors.get('age_risk', 0) > 0.7:
        recommendations.append("📅 Yaşlı altyapı - Öncelikli yenileme listesine alın")
    
    if factors.get('diameter_risk', 0) > 0.6:
        recommendations.append("📏 Küçük çap - Kapasite artırımı değerlendirilmeli")
    
    if factors.get('depth_risk', 0) > 0.6:
        recommendations.append("⛏️ Erişim zorluğu - Özel ekipman planlaması gerekli")
    
    if not recommendations:
        recommendations.append("✅ Normal bakım programı yeterli")
    
    return recommendations


def predict_risk(pipe: PipeFeatures) -> RiskPrediction:
    """Tek boru için risk tahmini"""
    global model_data
    
    # Risk faktörlerini hesapla
    factors = calculate_risk_factors(pipe)
    
    # ML model tahmini
    if model_data is not None:
        try:
            features = prepare_features(pipe)
            
            # VotingRegressor veya dict yapısı
            if hasattr(model_data, 'predict'):
                # VotingRegressor modeli
                ml_risk = model_data.predict(features)[0]
            elif isinstance(model_data, dict):
                # Ayrı modeller dict olarak
                rf_pred = model_data['random_forest'].predict(features)[0]
                gb_pred = model_data['gradient_boosting'].predict(features)[0]
                ml_risk = rf_pred * 0.5 + gb_pred * 0.5
            else:
                raise ValueError("Bilinmeyen model formatı")
            
            # Clamp to 0-100
            ml_risk = max(0, min(100, ml_risk))
            
            confidence = 0.85  # Model güvenilirliği
        except Exception as e:
            print(f"ML prediction error: {e}")
            # Fallback to rule-based
            ml_risk = sum(factors.values()) / len(factors) * 100
            confidence = 0.6
    else:
        # Rule-based fallback
        ml_risk = sum(factors.values()) / len(factors) * 100
        confidence = 0.5
    
    # Risk seviyesi belirleme
    if ml_risk >= 70:
        risk_level = "high"
    elif ml_risk >= 40:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    # Öneriler
    recommendations = get_recommendations(ml_risk, factors)
    
    return RiskPrediction(
        pipe_id=pipe.pipe_id,
        risk_score=round(ml_risk, 2),
        risk_level=risk_level,
        risk_factors=factors,
        confidence=round(confidence, 2),
        recommendations=recommendations
    )


@app.on_event("startup")
async def startup_event():
    """API başlangıcında modeli yükle"""
    try:
        load_model()
        print("✓ UludagFlow Boru Risk API hazır!")
    except Exception as e:
        print(f"⚠ Model yükleme hatası: {e}")
        print("  Rule-based fallback kullanılacak")


@app.get("/")
async def root():
    """API bilgisi"""
    return {
        "name": "UludagFlow Boru Risk Tahmin API",
        "version": "2.0.0",
        "status": "active",
        "model_loaded": model_data is not None,
        "endpoints": [
            "/predict - Tek boru risk tahmini",
            "/predict/batch - Toplu risk tahmini",
            "/health - Sağlık kontrolü",
            "/model/info - Model bilgileri"
        ]
    }


@app.get("/health")
async def health_check():
    """Sağlık kontrolü"""
    return {
        "status": "healthy",
        "model_loaded": model_data is not None,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/model/info")
async def model_info():
    """Model bilgileri"""
    if model_metadata:
        return model_metadata
    return {
        "error": "Model metadata bulunamadı",
        "model_loaded": model_data is not None
    }


@app.post("/predict", response_model=RiskPrediction)
async def predict_single(pipe: PipeFeatures):
    """Tek boru için risk tahmini"""
    return predict_risk(pipe)


@app.post("/predict/batch", response_model=BatchPredictResponse)
async def predict_batch(request: BatchPredictRequest):
    """Toplu boru risk tahmini"""
    predictions = []
    high_risk = 0
    medium_risk = 0
    low_risk = 0
    
    for pipe in request.pipes:
        pred = predict_risk(pipe)
        predictions.append(pred)
        
        if pred.risk_level == "high":
            high_risk += 1
        elif pred.risk_level == "medium":
            medium_risk += 1
        else:
            low_risk += 1
    
    return BatchPredictResponse(
        predictions=predictions,
        model_version="2.0.0",
        timestamp=datetime.now().isoformat(),
        total_pipes=len(predictions),
        high_risk_count=high_risk,
        medium_risk_count=medium_risk,
        low_risk_count=low_risk
    )


@app.get("/network/summary")
async def network_summary():
    """Ağ özeti"""
    if model_metadata:
        return {
            "total_pipes_trained": model_metadata.get('total_samples', 5419),
            "networks": ["icmesuyu", "atiksu", "yagmursuyu"],
            "icmesuyu_count": 4339,
            "atiksu_count": 841,
            "yagmursuyu_count": 239,
            "model_performance": {
                "r2_score": model_metadata.get('r2_score', 0.37),
                "rmse": model_metadata.get('rmse', 5.17)
            }
        }
    return {
        "error": "Model metadata yüklenmedi"
    }


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("UludagFlow Boru Risk Tahmin API Başlatılıyor...")
    print("="*60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
