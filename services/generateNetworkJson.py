"""
GIS verilerinden frontend için JSON oluştur
Düzgün formatlanmış, parse edilebilir JSON
"""

import geopandas as gpd
import json
from pathlib import Path
from pyproj import Transformer
import warnings
warnings.filterwarnings('ignore')

# Paths
ICMESUYU_PATH = r"C:\Users\MONSTER\Downloads\icmesuyu"
ATIKSU_PATH = r"C:\Users\MONSTER\3D Objects\yazprojeler\bursa\atiksu"
YAGMURSUYU_PATH = r"C:\Users\MONSTER\Downloads\yagmursuyu"
OUTPUT_PATH = r"C:\Users\MONSTER\3D Objects\yazprojeler\bursa\services\realNetworkData.json"

# Coordinate transformer (UTM -> WGS84)
transformer = Transformer.from_crs("EPSG:32635", "EPSG:4326", always_xy=True)

def safe_float(val, default=0.0):
    """Güvenli float dönüşümü"""
    try:
        if val is None:
            return default
        return float(val)
    except:
        return default

def safe_str(val, default=""):
    """Güvenli string dönüşümü"""
    if val is None:
        return default
    return str(val).strip()

def get_coords_from_geometry(geom):
    """Geometry'den koordinat listesi çıkar"""
    coords = []
    try:
        if geom is None:
            return coords
        
        if geom.geom_type == 'LineString':
            for x, y in geom.coords:
                lat, lng = transformer.transform(x, y)
                coords.append([round(lng, 6), round(lat, 6)])
        elif geom.geom_type == 'MultiLineString':
            for line in geom.geoms:
                for x, y in line.coords:
                    lat, lng = transformer.transform(x, y)
                    coords.append([round(lng, 6), round(lat, 6)])
        elif geom.geom_type == 'Point':
            x, y = geom.x, geom.y
            lat, lng = transformer.transform(x, y)
            coords.append([round(lng, 6), round(lat, 6)])
    except Exception as e:
        pass
    return coords

def calculate_risk_score(row, network_type):
    """Basit risk skoru hesapla"""
    risk = 30  # Base risk
    
    # Malzeme riski
    material = safe_str(row.get('MALZEME', row.get('CINSI', ''))).lower()
    if 'beton' in material:
        risk += 15
    elif 'asbest' in material:
        risk += 25
    elif 'pvc' in material or 'pe' in material:
        risk -= 10
    
    # Çap riski
    cap = safe_float(row.get('CAP', 200))
    if cap < 100:
        risk += 15
    elif cap < 150:
        risk += 10
    elif cap > 400:
        risk -= 5
    
    # Eğim riski (atıksu ve yağmursuyu için)
    if network_type in ['atiksu', 'yagmursuyu']:
        egim = safe_float(row.get('EGIM', 1))
        if egim == 0:
            risk += 20  # Sıfır eğim = tıkanma riski
        elif egim < 0.5:
            risk += 10
    
    # Durum riski
    durum = safe_str(row.get('HATTIN_DUR', row.get('VAZIYET', ''))).lower()
    if 'calismayan' in durum or 'arızalı' in durum:
        risk += 30
    
    return max(0, min(100, risk))

def process_lines(shp_path, network_type, subtype):
    """Hat shapefile'ını işle"""
    pipes = []
    try:
        gdf = gpd.read_file(shp_path)
        print(f"  {Path(shp_path).name}: {len(gdf)} kayıt")
        
        for idx, row in gdf.iterrows():
            coords = get_coords_from_geometry(row.geometry)
            if not coords:
                continue
            
            pipe = {
                "id": f"{network_type}_{subtype}_{idx}",
                "type": network_type,
                "subtype": subtype,
                "material": safe_str(row.get('MALZEME', row.get('CINSI', 'Bilinmiyor'))),
                "diameter": safe_float(row.get('CAP', 200)),
                "length": safe_float(row.get('UZUNLUK', row.geometry.length if row.geometry else 0)),
                "status": safe_str(row.get('HATTIN_DUR', row.get('VAZIYET', 'Aktif'))),
                "slope": safe_str(row.get('EGIM', '')),
                "risk_score": calculate_risk_score(row, network_type),
                "coordinates": coords
            }
            pipes.append(pipe)
    except Exception as e:
        print(f"  Hata: {e}")
    return pipes

def process_points(shp_path, node_type):
    """Nokta shapefile'ını işle"""
    nodes = []
    try:
        gdf = gpd.read_file(shp_path)
        print(f"  {Path(shp_path).name}: {len(gdf)} kayıt")
        
        for idx, row in gdf.iterrows():
            coords = get_coords_from_geometry(row.geometry)
            if not coords:
                continue
            
            node = {
                "id": f"node_{node_type}_{idx}",
                "type": node_type,
                "lat": coords[0][1],
                "lng": coords[0][0],
                "depth": safe_float(row.get('DERINLIK', row.get('KOT', 0))),
                "status": safe_str(row.get('VAZIYET', 'Aktif'))
            }
            nodes.append(node)
    except Exception as e:
        print(f"  Hata: {e}")
    return nodes

def main():
    print("=" * 60)
    print("GIS -> JSON Dönüştürücü")
    print("=" * 60)
    
    all_pipes = []
    all_nodes = []
    
    # İçmesuyu
    print("\n📍 İçmesuyu işleniyor...")
    icme_hat = Path(ICMESUYU_PATH) / "balkan_icmesuyu_hat.shp"
    icme_nokta = Path(ICMESUYU_PATH) / "balkan_icmesuyu_nokta.shp"
    
    if icme_hat.exists():
        all_pipes.extend(process_lines(str(icme_hat), "icmesuyu", "ana_hat"))
    if icme_nokta.exists():
        all_nodes.extend(process_points(str(icme_nokta), "icmesuyu_nokta"))
    
    # Atıksu
    print("\n🚿 Atıksu işleniyor...")
    atik_boru = Path(ATIKSU_PATH) / "balkan_atiksu_boru.shp"
    atik_rogar = Path(ATIKSU_PATH) / "balkan_atiksu_rogar.shp"
    
    if atik_boru.exists():
        all_pipes.extend(process_lines(str(atik_boru), "atiksu", "boru"))
    if atik_rogar.exists():
        all_nodes.extend(process_points(str(atik_rogar), "atiksu_rogar"))
    
    # Yağmursuyu
    print("\n🌧️ Yağmursuyu işleniyor...")
    yagmur_hat = Path(YAGMURSUYU_PATH) / "balkan_yagmursuyu_ana_hat.shp"
    yagmur_rogar = Path(YAGMURSUYU_PATH) / "balkan_yagmursuyu_rogar.shp"
    
    if yagmur_hat.exists():
        all_pipes.extend(process_lines(str(yagmur_hat), "yagmursuyu", "ana_hat"))
    if yagmur_rogar.exists():
        all_nodes.extend(process_points(str(yagmur_rogar), "yagmursuyu_rogar"))
    
    # Risk bölgelerini hesapla
    risk_zones = []
    for pipe in all_pipes:
        if pipe['risk_score'] >= 50:
            if pipe['coordinates']:
                mid_idx = len(pipe['coordinates']) // 2
                coord = pipe['coordinates'][mid_idx]
                risk_zones.append({
                    "id": f"risk_{pipe['id']}",
                    "pipe_id": pipe['id'],
                    "type": pipe['type'],
                    "risk_score": pipe['risk_score'],
                    "lat": coord[1],
                    "lng": coord[0],
                    "reason": f"Yüksek risk: {pipe['material']}, Çap: {pipe['diameter']}mm"
                })
    
    # Merkez ve sınırları hesapla
    all_lats = []
    all_lngs = []
    for pipe in all_pipes:
        for coord in pipe['coordinates']:
            all_lngs.append(coord[0])
            all_lats.append(coord[1])
    
    center_lat = sum(all_lats) / len(all_lats) if all_lats else 40.21
    center_lng = sum(all_lngs) / len(all_lngs) if all_lngs else 28.81
    
    # JSON yapısı
    network_data = {
        "generated_at": "2025-12-13T11:20:00",
        "region": "Balkan Mahallesi, Bursa",
        "center": {
            "lat": round(center_lat, 6),
            "lng": round(center_lng, 6)
        },
        "bounds": {
            "minLat": round(min(all_lats), 6) if all_lats else 40.20,
            "maxLat": round(max(all_lats), 6) if all_lats else 40.22,
            "minLng": round(min(all_lngs), 6) if all_lngs else 28.80,
            "maxLng": round(max(all_lngs), 6) if all_lngs else 28.82
        },
        "summary": {
            "icmesuyu": {
                "hat_sayisi": len([p for p in all_pipes if p['type'] == 'icmesuyu']),
                "nokta_sayisi": len([n for n in all_nodes if 'icmesuyu' in n['type']])
            },
            "atiksu": {
                "hat_sayisi": len([p for p in all_pipes if p['type'] == 'atiksu']),
                "nokta_sayisi": len([n for n in all_nodes if 'atiksu' in n['type']])
            },
            "yagmursuyu": {
                "hat_sayisi": len([p for p in all_pipes if p['type'] == 'yagmursuyu']),
                "nokta_sayisi": len([n for n in all_nodes if 'yagmursuyu' in n['type']])
            }
        },
        "pipes": all_pipes,
        "nodes": all_nodes,
        "risk_zones": risk_zones
    }
    
    # JSON kaydet
    print(f"\n💾 JSON kaydediliyor: {OUTPUT_PATH}")
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(network_data, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ TAMAMLANDI!")
    print("=" * 60)
    print(f"Toplam Boru: {len(all_pipes)}")
    print(f"Toplam Nokta: {len(all_nodes)}")
    print(f"Risk Bölgesi: {len(risk_zones)}")
    print(f"Dosya: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
