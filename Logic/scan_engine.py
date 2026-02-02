# ============================================================
#  TARAMA MOTORU — scan_engine.py
#  Bekir Panel için tek merkezli tarama sistemi
#
#  Bu dosya:
#    - SCAN_STATUS (global sayaç)
#    - Xtream kontrolü (check_xtream)
#    - Ülke çözümü (resolve_country)
#    - Tüm taramayı yöneten run_scan()
#    - Tarama ilerlemesini dönen get_progress()
#    - Log sistemi
#
#  NOT:
#  Bu dosya TEK BAŞINA çalışır.
#  BakimYonetimi.py artık sadece run_scan() ve get_progress() çağıracak.
# ============================================================

import asyncio
import random
import socket
import time
from urllib.parse import urlparse

import httpx

# ============================================================
#  GLOBAL SCAN STATUS
# ============================================================

SCAN_STATUS = {
    "current": 0,      # Şu ana kadar taranan satır
    "total": 0,        # Toplam taranacak satır
    "running": False,  # Tarama devam ediyor mu
    "scan_id": None    # Her taramaya özel ID
}

# ============================================================
#  LOG SİSTEMİ
# ============================================================

LOG_FILE = "static/scan.log"

def log(msg: str):
    """
    Tarama motoru için log kaydı.
    Hem terminale hem scan.log dosyasına yazar.
    """
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except:
        pass


# ============================================================
#  🚀 UÇAK MODU — GÜNCELLENMİŞ TARAMA MOTORU
# ============================================================


async def check_xtream(row: dict, client: httpx.AsyncClient) -> dict:
    """
    Bekir Abi: Bu fonksiyon artık sadece hesabı değil, 
    IP üzerinden ÜLKEYİ de tarama anında buluyor!
    """
    h = row.get("host", "").strip().rstrip("/")
    u = row.get("user", "").strip()
    p = row.get("pass", "").strip()

    row["active"] = False
    row["status"] = "offline"
    row["country"] = "xx" # 🏁 Varsayılan ülke kodu

    try:
        # 🌍 BEKİR ABİ: İŞTE O KRİTİK EKLEME BURASI!
        # Hesap aktif olsun olmasın, IP'den ülkeyi tarama anında çözüyoruz.
        row["country"] = await resolve_country(h, client)

        url = f"{h}/player_api.php"
        res = await client.get(url, params={"username": u, "password": p}, timeout=10)

        if res.status_code == 200:
            content = res.text
            if '"auth":1' in content or 'exp_date' in content:
                row["active"] = True
                row["status"] = "online"

                try:
                    data = res.json()
                    info = data.get("user_info", {})
                    row["max"] = int(info.get("max_connections") or 1)

                    exp = info.get("exp_date")
                    if exp and str(exp).isdigit():
                        ts = int(exp)
                        if ts > 9999999999:
                            ts //= 1000
                        row["days"] = max(0, (ts - int(time.time())) // 86400)
                    else:
                        row["days"] = 999
                except:
                    row["max"], row["days"] = 1, 365
        else:
            row["status"] = f"off_{res.status_code}"

    except Exception as e:
       row["status"] = "timeout"
       log(f"⚠️ check_xtream hata: {h} → {e}")

    return row
# ============================================================
#  ÜLKE ÇÖZÜCÜ
# ============================================================

DNS_CACHE = {}
IP_COUNTRY_CACHE = {}
COUNTRY_FIX = {"uk": "gb", "uae": "ae", "ger": "de", "tur": "tr"}

async def resolve_country(host: str, client: httpx.AsyncClient) -> str:
    """
    Bekir Abi: Bu fonksiyon artık 3 farklı yere sorar, 
    IP'den ülkeyi bulmadan pes etmez!
    """
    try:
        parsed = urlparse(host if "://" in host else f"http://{host}")
        domain = parsed.hostname
        if not domain: return "xx"

        # 1. DNS & CACHE KONTROLÜ
        if domain in DNS_CACHE:
            ip = DNS_CACHE[domain]
        else:
            ip = socket.gethostbyname(domain)
            DNS_CACHE[domain] = ip

        if ip in IP_COUNTRY_CACHE:
            return IP_COUNTRY_CACHE[ip]

        # 🕵️‍♂️ 2. DENEME: Country.is (Senin eski servis)
        try:
            r = await client.get(f"https://api.country.is/{ip}", timeout=3)
            if r.status_code == 200:
                code = r.json().get("country", "").lower()
                if code and code != "xx":
                    code = COUNTRY_FIX.get(code, code)
                    IP_COUNTRY_CACHE[ip] = code
                    return code
        except: pass

        # 🕵️‍♂️ 3. DENEME: IP-API (Çok daha güçlü ve garantidir)
        try:
            r2 = await client.get(f"http://ip-api.com/json/{ip}?fields=countryCode", timeout=3)
            if r2.status_code == 200:
                code = r2.json().get("countryCode", "").lower()
                if code:
                    code = COUNTRY_FIX.get(code, code)
                    IP_COUNTRY_CACHE[ip] = code
                    return code
        except: pass

    except Exception as e:
        log(f"⚠️ resolve_country kritik hata: {e}")

    return "xx"
# ============================================================
#  ANA TARAMA MOTORU
# ============================================================

async def run_scan(rows: list, save_callback):
    """
    Tüm taramayı başlatır.
    - Aynı anda ikinci taramayı engeller
    - Sayaçları sıfırlar
    - Her satırı paralel tarar
    - Sonuçları save_callback ile kaydeder
    """

    if SCAN_STATUS["running"]:
        return False, "Zaten bir tarama devam ediyor Bekir abi."

    SCAN_STATUS.update({
        "current": 0,
        "total": len(rows),
        "running": True,
        "scan_id": time.time()
    })

    log(f"🚀 Tarama başladı. Toplam {len(rows)} satır.")



    async with httpx.AsyncClient(verify=False) as client:
        sem = asyncio.Semaphore(25)
        host_country_map = {}

        async def worker(row):
            async with sem:
                try:
                    r = await check_xtream(row, client)

                    host = r.get("host", "")
                    if host:
                        if host in host_country_map:
                            r["country"] = host_country_map[host]
                        else:
                            c = await resolve_country(host, client)
                            r["country"] = c
                            host_country_map[host] = c

                except Exception as e:
                    log(f"⚠️ worker hata: {e}")

                finally:
                    SCAN_STATUS["current"] += 1

                return r

        results = await asyncio.gather(*(worker(r) for r in rows))

    SCAN_STATUS["running"] = False
    log("✅ Tarama tamamlandı, sonuçlar kaydediliyor...")

    save_callback(results)

    log("💾 Sonuçlar kaydedildi.")
    return True, "Tarama tamamlandı Bekir abi."

# ============================================================
#  PROGRESS GETTER
# ============================================================

def get_progress():
    """
    Frontend'in progress bar için kullandığı sayaç.
    """
    return SCAN_STATUS
