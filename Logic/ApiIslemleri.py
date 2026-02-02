# ============================================================
#  ApiIslemleri.py — IPTV Client, Series Info, Favoriler
#
#  Bu dosya:
#    - IPTV oynatma (mpv ile)
#    - Xtream API üzerinden client-info
#    - Dizi detayları (series-info)
#    - Favori ekleme / silme
#    - Favorileri M3U olarak dışa aktarma
#
#  NOT:
#  Bu dosya tarama (scan) ile ilgili hiçbir işlem içermez.
# ============================================================


import asyncio
import json
import os
import random
import socket
import subprocess
import time
from urllib.parse import (
    quote,
    unquote,
    urlparse,
)

import httpx
import requests
from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from Logic.DepoYonetimi import M3U_CACHE, load_m3u_sources

# ------------------------------------------------------------
#  FASTAPI ROUTER & TEMPLATE ENGINE
# ------------------------------------------------------------
router = APIRouter()
templates = Jinja2Templates(directory="templates")

# ------------------------------------------------------------
#  DOSYA YOLLARI
# ------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAV_PATH = os.path.join(BASE_DIR, "static", "favoriler.json")


# 📂 ÜLKE KAYIT DOSYASI
COUNTRY_DISK_FILE = "static/countries.json"
COUNTRY_DISK_CACHE = {}


def get_and_save_country(host_url):
    global COUNTRY_DISK_CACHE
    try:
        # URL'den temiz host alalım
        clean_host = (
            host_url.replace("http://", "")
            .replace("https://", "")
            .split(":")[0]
            .split("/")[0]
        )

        # Eğer hafızada varsa uğraşma
        if clean_host in COUNTRY_DISK_CACHE:
            return COUNTRY_DISK_CACHE[clean_host]

        print(f"🌍 Dünya üzerinde iz sürülüyor: {clean_host}")

        # Gerçek IP bulalım
        real_ip = socket.gethostbyname(clean_host)

        # Lokasyon sorgusu
        res = requests.get(f"http://ip-api.com/json/{real_ip}", timeout=3).json()

        if res.get("status") == "success":
            country = res.get("country", "Dünya")
            # Türkçe düzeltmeler
            translations = {
                "Belgium": "Belçika 🇧🇪",
                "Turkey": "Türkiye 🇹🇷",
                "Germany": "Almanya 🇩🇪",
                "France": "Fransa 🇫🇷",
            }
            country = translations.get(country, country)

            # Kaydet
            COUNTRY_DISK_CACHE[clean_host] = country
            with open(COUNTRY_DISK_FILE, "w", encoding="utf-8") as f:
                json.dump(COUNTRY_DISK_CACHE, f, ensure_ascii=False, indent=4)
            print(f"✅ ÜLKE KAYDEDİLDİ: {country}")
            return country
    except:
        pass
    return "Dünya"


# ============================================================
#  BÖLÜM 1 — IPTV PLAYER (mpv ile oynatma)
# ============================================================



@router.get("/api/play")
def play_video(url: str):
    """Bekir Abi, 'cmd' hatası giderildi, Android maskesi takıldı!"""
    
    # 🥊 1. TEMİZLİK: Eskileri mermi gibi süpür
    try:
        subprocess.run(["pkill", "-9", "mpv"], check=False)
    except:
        pass

    try:
        if not url: 
            return {"ok": False}

        # 🛠️ 2. URL ANALİZ VE TEMİZLİK
        decoded_url = unquote(url).strip()
        final_url = decoded_url.replace(".undefined", "").split("|")[0]
        
        is_vod = "/movie/" in final_url.lower() or "/series/" in final_url.lower()
        
        # 🎯 UZANTI AYIKLAMA
        existing_ext = ""
        base_url = final_url
        for tag in [".ts", ".m3u8", ".mp4", ".mkv"]:
            if final_url.lower().endswith(tag):
                existing_ext = tag
                base_url = final_url[:final_url.lower().rfind(tag)]
                break

        # 🚀 3. DENEME SIRALAMASI
        exts = ["", ".ts", ".m3u8"] if not is_vod else ["", ".mp4", ".mkv"]

        # 🎯 KİRİŞ: try_play fonksiyonu artık cmd'yi doğru tanıyor
        def try_play(target_url):
            target_url = target_url.replace("..", ".")
            print(f"🥊 AGRESİF ATEŞLEME: {target_url}")
            
            # 🔥 PANELİ KANDIRAN ANDROID + VLC MASKE KOMUTU
            current_cmd = [
                "mpv", target_url,
                "--no-ytdl",
                "--force-window=yes",
                "--ontop",
                "--cache=yes",
                "--demuxer-max-bytes=180M",
                # 🎭 ANDROID TV MASKESİ (403 ENGELİNİ GEÇER)
                "--user-agent=Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36",
                f"--http-header-fields=Referer: {target_url.split('/live/')[0]}/,Origin: {target_url.split('/live/')[0]}"
            ]
            
            env = os.environ.copy()
            env["DISPLAY"] = ":0"
            return subprocess.Popen(current_cmd, env=env, start_new_session=True)

        for ext in exts:
            current_url = f"{base_url}{ext}" if ext != "" else final_url
            
            # 🚀 ATEŞLE!
            proc = try_play(current_url)
            
            # ⏱️ Panelin kapıyı açması için 5 saniye bekle
            time.sleep(5)
            
            if proc.poll() is None:
                print(f"✅ KAPI KIRILDI! {current_url}")
                return {"ok": True}
            else:
                ret = proc.returncode
                if ret is not None and ret <= 0:
                    print("🛑 Bekir Abi kapattı.")
                    return {"ok": False}
                print(f"❌ {ext or 'Orijinal'} denemesi başarısız...")

        return {"ok": False}

    except Exception as e:
        print(f"❌ Genel Hata: {e}")
        return {"ok": False}



# ============================================================
#  🚀 BEKİR ABİ — IPTV CLIENT INFO (CLOUDFLARE BYPASS)
# ============================================================

@router.get("/api/client-info")
async def client_info(host: str, user: str, passw: str):
    """
    Bekir Abi: Terminaldeki VLC imzasını buraya çaktık, 
    Cloudflare engelini yerle bir ediyoruz!
    """
    base = host.rstrip("/")
    limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)
    
    # 🔥 BEKİR ABİ: SERVER'I KANDIRAN KRİTİK BAŞLIKLAR
    headers = {
        "User-Agent": "VLC/3.0.11 LibVLC/3.0.11",
        "Accept": "*/*",
        "Connection": "keep-alive"
    }

    # Timeout'u 15 saniye yaptık ki Cloudflare yavaşlatırsa takılmayalım abi!
    async with httpx.AsyncClient(timeout=15.0, verify=False, limits=limits, headers=headers) as client:

        tasks = [
            client.get(f"{base}/player_api.php?username={user}&password={passw}&action=get_live_streams"),
            client.get(f"{base}/player_api.php?username={user}&password={passw}&action=get_vod_streams"),
            client.get(f"{base}/player_api.php?username={user}&password={passw}&action=get_series"),
            client.get(f"{base}/player_api.php?username={user}&password={passw}&action=get_live_categories"),
            client.get(f"{base}/player_api.php?username={user}&password={passw}&action=get_vod_categories"),
            client.get(f"{base}/player_api.php?username={user}&password={passw}&action=get_series_categories"),
        ]

        try:
            responses = await asyncio.gather(*tasks, return_exceptions=True)

            results = [
                (
                    r.json()
                    if isinstance(r, httpx.Response) and r.status_code == 200
                    else []
                )
                for r in responses
            ]

            live_list, vod_list, series_list, l_cat, v_cat, s_cat = results

            # Kategorileri mühürleyelim abi
            cat_map = {
                str(c["category_id"]): c["category_name"]
                for c in (l_cat + v_cat + s_cat)
                if isinstance(c, dict) and "category_id" in c
            }

            groups = {"live": {}, "vod": {}, "series": {}}

            def process_fast(items, key):
                if not isinstance(items, list): return []
                for it in items:
                    cid = str(it.get("category_id", ""))
                    g_name = cat_map.get(cid, "Genel")
                    it["_group"] = g_name
                    groups[key][g_name] = groups[key].get(g_name, 0) + 1
                return items

            # 🍺 BEKİR ABİ: VERİYİ PANELİN ANLAYACAĞI DİLDEN GÖNDERİYORUZ
            return {
                "ok": True,
                "counts": {
                    "live": len(live_list),
                    "vod": len(vod_list),
                    "series": len(series_list),
                },
                "groups": groups,
                "lists": {
                    "live": process_fast(live_list, "live"),
                    "vod": process_fast(vod_list, "vod"),
                    "series": process_fast(series_list, "series"),
                },
            }

        except Exception as e:
            print(f"⚠️ Bekir Abi Arıza Var: {str(e)}")
            return {"ok": False, "error": str(e)}

# ============================================================
#  BÖLÜM 3 — SERIES INFO (Dizi detayları)
# ============================================================


@router.get("/api/series-info")
async def series_info_api(host: str, user: str, passw: str, series_id: str):
    """
    Xtream API → action=get_series_info
    Dizi haritasını çözer ve bölümleri listeler.
    """
    try:
        url = f"{host}/player_api.php?username={user}&password={passw}&action=get_series_info&series_id={series_id}"
        print(f"📡 Dizi haritası alınıyor: {series_id}")

        async with httpx.AsyncClient(timeout=20.0, verify=False) as client:
            r = await client.get(url)
            data = r.json()

        raw_episodes = data.get("episodes", {})
        if not raw_episodes:
            return {"ok": False, "episodes": []}

        formatted = []

        for season_num, episodes in raw_episodes.items():
            for ep in episodes:
                ep_id = ep.get("id")
                ext = ep.get("container_extension", "ts")

                formatted.append(
                    {
                        "id": ep_id,
                        "title": ep.get("title", f"Bölüm {ep.get('episode_num')}"),
                        "season": season_num,
                        "url": f"{host}/series/{user}/{passw}/{ep_id}.{ext}",
                    }
                )

        return {"ok": True, "info": data.get("info", {}), "episodes": formatted}

    except Exception as e:
        return {"ok": False, "error": str(e), "episodes": []}


# ============================================================
#  BÖLÜM 4 — FAVORİLER
# ============================================================


@router.post("/api/favorite")
async def add_to_favorites(request: Request):
    """
    Favori ekleme / silme (toggle).
    """
    try:
        row = await request.json()
        os.makedirs(os.path.dirname(FAV_PATH), exist_ok=True)

        favs = []
        if os.path.exists(FAV_PATH):
            with open(FAV_PATH, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    favs = json.loads(content)

        idx = next(
            (
                i
                for i, f in enumerate(favs)
                if f.get("host") == row.get("host") and f.get("user") == row.get("user")
            ),
            None,
        )

        if idx is not None:
            favs.pop(idx)
            is_fav = False
            msg = "Kaldırıldı"
        else:
            favs.append(row)
            is_fav = True
            msg = "Eklendi"

        with open(FAV_PATH, "w", encoding="utf-8") as f:
            json.dump(favs, f, ensure_ascii=False, indent=4)

        return {"ok": True, "msg": msg, "is_fav": is_fav}

    except Exception as e:
        return {"ok": False, "error": str(e)}


# ============================================================
#  BÖLÜM 5 — FAVORİLERİ M3U OLARAK DIŞA AKTARMA
# ============================================================


@router.get("/api/export-favorites")
async def export_favorites():
    """
    Favori Xtream hesaplarını M3U formatında dışa aktarır.
    """
    try:
        if not os.path.exists(FAV_PATH):
            return "Liste Boş", 200

        with open(FAV_PATH, "r", encoding="utf-8") as f:
            favs = json.load(f)

        if not favs:
            return "Liste Boş", 200

        lines = ["#EXTM3U"]

        for f in favs:
            h, u, p = f.get("host", ""), f.get("user", ""), f.get("pass", "")
            if h and u and p:
                name = h.split("//")[-1].split(":")[0]
                lines.append(f"#EXTINF:-1, ⭐ {name} - {u}")
                lines.append(
                    f"{h}/get.php?username={u}&password={p}&type=m3u_plus&output=ts"
                )

        return "\n".join(lines)

    except Exception as e:
        return f"Hata: {str(e)}", 500
