# ============================================================
#  SystemCore.py — Sistem Durumu + Arayüz + Yardımcı Motor
#
#  Bu dosya:
#    - Sunucu sistem bilgilerini döner (RAM, CPU, Disk, Uptime)
#    - Restart sinyali sağlar
#    - M3U yönetim sayfasını yükler
#    - Panel arayüz sayfalarını döner
#    - Cache verisini frontend'e iletir
#    - Taranacak linkleri okur (get_fresh_lines)
#
#  NOT:
#  Bu dosya tarama (scan) içermez.
#  Scan motoru Logic/scan_engine.py içindedir.
# ============================================================

import os
import shutil
import time

import psutil
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

# ------------------------------------------------------------
#  ROUTER & TEMPLATE ENGINE
# ------------------------------------------------------------
router = APIRouter()
templates = Jinja2Templates(directory="templates")

# Disk kullanımını ölçmek için kök dizin
BASE = "/"


# ============================================================
#  BÖLÜM 1 — SİSTEM DURUMU (RAM, CPU, DISK, UPTIME)
# ============================================================

@router.get("/sysinfo")
def sysinfo():
    """
    Sunucunun RAM, Disk ve CPU kullanım bilgilerini döner.
    Frontend bu veriyi sistem panelinde gösterir.
    """
    m = psutil.virtual_memory()
    d = shutil.disk_usage(BASE)

    return {
        "ram_used": round(m.used / 1024**3, 1),
        "ram_total": round(m.total / 1024**3, 1),
        "ram_percent": m.percent,

        "disk_used": round(d.used / 1024**3, 1),
        "disk_total": round(d.total / 1024**3, 1),
        "disk_percent": round(d.used / d.total * 100, 1),

        "cpu_percent": psutil.cpu_percent(0.3),
        "uptime": int(time.time() - psutil.boot_time()),
    }


# ============================================================
#  BÖLÜM 2 — YENİDEN BAŞLATMA SİNYALİ
# ============================================================

@router.post("/restart")
def restart():
    """
    Frontend'in 'Yeniden Başlat' butonu için sinyal döner.
    Gerçek restart işlemi burada yapılmaz.
    """
    return {"ok": True}


# ============================================================
#  BÖLÜM 3 — M3U YÖNETİM SAYFASI
# ============================================================

@router.get("/m3u", response_class=HTMLResponse)
async def m3u_page(request: Request):
    """
    M3U Yönetim sayfasını yükler.
    """
    if not os.path.exists("templates/m3u.html"):
        return HTMLResponse("<h1>m3u.html bulunamadı</h1>", status_code=404)

    return templates.TemplateResponse("m3u.html", {"request": request})


# ============================================================
#  BÖLÜM 4 — PANEL ARAYÜZ SAYFALARI
# ============================================================

# Cache yükleme fonksiyonu
try:
    from Logic.DepoYonetimi import load_cache
except ImportError:
    def load_cache():
        return []

@router.get("/", response_class=HTMLResponse)
async def xtreambekir_page(request: Request):
    """Ana panel sayfası."""
    return templates.TemplateResponse("xtreambekir.html", {"request": request})

@router.get("/client", response_class=HTMLResponse)
async def client_page(request: Request):
    """Client panel sayfası."""
    return templates.TemplateResponse("client.html", {"request": request})


# ============================================================
#  BÖLÜM 5 — CACHE VERİSİ (Frontend tablo için)
# ============================================================

@router.get("/data")
def get_data():
    """
    Cache dosyasındaki tüm satırları JSON olarak döner.
    Frontend tabloyu buradan besler.
    """
    return {"rows": load_cache()}




