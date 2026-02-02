import os
from contextlib import asynccontextmanager

import psutil  # Bu yoksa bilgiler yalan olur abi
import uvicorn
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# =========================================================
# 1. MODÜLLER
# =========================================================
from Logic import ApiIslemleri, BakimYonetimi, DepoYonetimi, SystemCore
from Logic.scan_engine import get_progress as scan_progress


# =========================================================
# 2. YAŞAM DÖNGÜSÜ
# =========================================================
@asynccontextmanager
async def app_lifespan(app: FastAPI):
    print("🚀 Bekir Panel 2026 Ateşlendi!")
    try:
        DepoYonetimi.read_data()
    except Exception as e:
        print(f"⚠️ Veri yükleme uyarısı: {e}")
    yield
    print("🛑 Bekir Panel Durduruldu.")

# =========================================================
# 3. FASTAPI AYARLARI
# =========================================================
XTREAMBEKIR = FastAPI(lifespan=app_lifespan, title="Bekir Panel 2026")

if os.path.exists("static"):
    XTREAMBEKIR.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

# =========================================================
# 4. ROUTER KAYITLARI
# =========================================================
XTREAMBEKIR.include_router(DepoYonetimi.router)
XTREAMBEKIR.include_router(SystemCore.router)
XTREAMBEKIR.include_router(BakimYonetimi.router)
XTREAMBEKIR.include_router(ApiIslemleri.router)

# =========================================================
# 5. SAYFALAR
# =========================================================
@XTREAMBEKIR.get("/")
async def ana_sayfa(request: Request):
    return templates.TemplateResponse("xtreambekir.html", {"request": request})

@XTREAMBEKIR.get("/client")
async def client_sayfasi(request: Request):
    return templates.TemplateResponse("client.html", {"request": request})

# =========================================================
# 5.5 TARAMA PROGRESS (YENİ MOTOR)
# =========================================================
@XTREAMBEKIR.get("/progress")
async def get_progress():
    return scan_progress()


# --- Sistem Bilgilerini Çeken Kapı ---
@XTREAMBEKIR.get("/sysinfo")
def get_sysinfo():
    
    vm = psutil.virtual_memory()
    # 🎯 İSİMLERE DİKKAT: ram_used, ram_total, cpu_percent, cpu_count
    return {
        "ram_used": round(vm.used / (1024**3), 1),
        "ram_total": round(vm.total / (1024**3), 1),
        "ram_percent": vm.percent,
        "cpu_percent": psutil.cpu_percent(interval=None),
        "cpu_count": psutil.cpu_count(), # <-- Bu satır çekirdek sayısını gönderir
        "os": os.name
    }
# =========================================================
# 6. ÇALIŞTIRICI
# =========================================================
if __name__ == "__main__":
    uvicorn.run("Main:XTREAMBEKIR", host="0.0.0.0", port=8000, reload=True)
