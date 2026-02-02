# ============================================================
#  BAKIM YÖNETİMİ MODÜLÜ
#  - Undo (geri alma)
#  - Silme / filtreleme işlemleri
#  - Tarama (scan) tetikleme ve progress takibi
# ============================================================

import os
import shutil

from fastapi import APIRouter, Request

# Depo yönetimi araçları
from Logic.DepoYonetimi import CACHE_FILE, UNDO_FILE, load_cache, parse_mix, save_cache

# Yeni tarama motoru (TEK MERKEZ)
from Logic.scan_engine import get_progress, run_scan

router = APIRouter()

C_FILE = CACHE_FILE
U_FILE = UNDO_FILE

# ============================================================
#  BÖLÜM 1 — UNDO (GERİ ALMA)
# ============================================================

@router.post("/undo")
async def undo():
    if os.path.exists(U_FILE):
        if os.path.exists(C_FILE):
            os.remove(C_FILE)
        shutil.copy2(U_FILE, C_FILE)
        print("✅ GERİ ALMA BAŞARILI")
        return {"ok": True}
    return {"ok": False, "msg": "Yedek yok"}

def backup_undo():
    try:
        if os.path.exists(C_FILE):
            shutil.copy2(C_FILE, U_FILE)
            print(f"🔄 YEDEK ALINDI: {U_FILE}")
    except Exception as e:
        print(f"❌ BACKUP HATASI: {e}")

# ============================================================
#  BÖLÜM 2 — SİLME / FİLTRELEME
# ============================================================

@router.post("/block")
async def block(req: Request):
    backup_undo()
    data = await req.json()
    key = data.get("key")
    rows = load_cache()
    save_cache([r for r in rows if f"{r['host']}|{r['user']}" != key])
    return {"ok": True}

# --- MAX 1 SİLME KAPISI ---
@router.post("/delete_max1")
def delete_max1():
    backup_undo() # Silmeden önce yedek al
    save_cache([r for r in load_cache() if int(r.get("max", 0)) != 1])
    return {"ok": True}

# --- 20 GÜN ALTI SİLME KAPISI ---
@router.post("/delete_days20")
def delete_days20():
    backup_undo()
    save_cache([r for r in load_cache() if int(r.get("days", 0)) >= 20])
    return {"ok": True}

# --- OFFLINE (GÜN 0) SİLME KAPISI ---
@router.post("/delete_offline")
def delete_offline():
    backup_undo()
    save_cache([r for r in load_cache() if int(r.get("days", 0)) > 0])
    return {"ok": True}

# --- ÜLKE KOMPLE SİLME KAPISI ---
@router.post("/delete_country")
async def delete_country(req: Request):
    data = await req.json()
    country = data.get("country")
    if not country: return {"ok": False}
    backup_undo()
    save_cache([r for r in load_cache() if r.get("country") != country])
    return {"ok": True}


# ============================================================
#  BÖLÜM 3 — TARAMA (SCAN)
# ============================================================

@router.post("/rescan")
async def rescan():
    rows = parse_mix()
    ok, msg = await run_scan(rows, save_cache)
    return {"ok": ok, "msg": msg}

@router.get("/progress")
async def progress():
    return get_progress()
