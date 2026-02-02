# ============================================================
#  DepoYonetimi.py — VERİ YÖNETİMİ MERKEZİ
#
#  Bu dosya:
#    - Cache okuma / yazma
#    - Undo (yedek) dosyası
#    - M3U kaynak yönetimi
#    - M3U parser
#    - Mix parser (TARANACAKLINKLER.txt → host/user/pass)
#    - Ülke cache yönetimi
#    - JSON kayıt işlemleri
#
#  NOT:
#  Bu dosya artık TARAMA (SCAN) ile ilgili hiçbir fonksiyon içermez.
#  Scan motoru Logic/scan_engine.py içindedir.
# ============================================================
import asyncio
import hashlib
import json
import os
import re
import shutil
import socket
import threading
from urllib.parse import parse_qs, urlparse

import requests
from fastapi import APIRouter

router = APIRouter()

# ============================================================
#  BÖLÜM 1 — DOSYA YOLLARI
# ============================================================

CACHE_FILE = "static/cache.txt"
UNDO_FILE = "static/cache.undo"
MIX_FILE = "static/TARANACAKLINKLER.txt"
COUNTRY_DISK_FILE = "static/countries.json"
M3U_SOURCE_FILE = "static/m3u_sources.json"
M3U_CACHE_FILE = "static/m3u_cache.json"
DATA_FILE = "static/data_scan.json"

# ============================================================
#  BÖLÜM 2 — KİLİTLER VE ÖNBELLEKLER
# ============================================================

FILE_LOCK = threading.Lock()
M3U_SOURCE_LOCK = threading.Lock()

COUNTRY_DISK_CACHE = {}
M3U_CACHE = {"sources": {}}

# ============================================================
#  BÖLÜM 3 — YARDIMCI FONKSİYONLAR
# ============================================================

def _hash(text: str) -> str:
    """Metni SHA1 hash'e çevirir (10 karakter)."""
    return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()[:10]


def detect_type(group: str, name: str) -> str:
    """
    M3U içeriğindeki kanalın türünü belirler.
    LIVE / VOD / DIZI / ADULT / KIDS / 4K
    """
    g = (group or "").lower()
    n = (name or "").lower()
    text = (f"{g} {n}").upper()

    if any(x in text for x in ["ADULT", "+18", "XXX", "PINK", "YETIŞKIN"]):
        return "ADULT"
    if any(x in text for x in ["KIDS", "CHILD", "CARTOON", "ÇOCUK", "BEBEK"]):
        return "KIDS"
    if any(x in text for x in ["SERIES", "DİZİ", "DIZI", "SEASON"]) or re.search(r"s\d{1,2}e\d{1,2}|\d+x\d+", n):
        return "DIZI"
    if any(x in text for x in ["VOD", "MOVIE", "FILM", "SINEMA"]) or re.search(r"\b(19|20)\d{2}\b", n):
        return "VOD"
    if any(x in text for x in ["4K", "UHD"]):
        return "4K"

    return "LIVE"

# ============================================================
#  BÖLÜM 4 — M3U KAYNAK YÖNETİMİ
# ============================================================

def load_m3u_sources():
    """M3U kaynak listesini JSON dosyasından okur."""
    if not os.path.exists(M3U_SOURCE_FILE):
        return []
    try:
        with open(M3U_SOURCE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []


def save_m3u_sources(rows):
    """M3U kaynak listesini JSON olarak kaydeder."""
    with M3U_SOURCE_LOCK:
        try:
            with open(M3U_SOURCE_FILE, "w", encoding="utf-8") as f:
                json.dump(rows, f, ensure_ascii=False, indent=2)
        except:
            pass


# 📂 1. DEĞİŞKENLERİ TANIMLAYALIM
COUNTRY_DISK_FILE = "country_cache.json"
COUNTRY_DISK_CACHE = {}


# ============================================================
#  BÖLÜM 5 — M3U PARSER
# ============================================================

EXTINF_RE = re.compile(
    r'#EXTINF:.*?(?:group-title="(?P<group>.*?)")?.*?,(?P<name>.*)',
    re.IGNORECASE
)

def parse_m3u(content: str, source_name: str):
    """M3U içeriğini parçalar ve kanal listesi döner."""
    items = []
    last_extinf = None
    url_counter = {}

    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#EXTM3U"):
            continue

        if line.startswith("#EXTINF"):
            m = EXTINF_RE.search(line)
            last_extinf = {
                "group": (m.group("group") if m else "").strip(),
                "name": (m.group("name") if m else "").strip(),
            }
            continue

        if line.startswith("#") or not last_extinf:
            continue

        url = line
        idx = url_counter.get(url, 0) + 1
        url_counter[url] = idx

        items.append({
            "id": _hash(f"{source_name}|{url}|{idx}"),
            "name": f"{last_extinf['name']} ({idx})" if idx > 1 else last_extinf["name"],
            "group": last_extinf["group"],
            "url": url,
            "source": source_name,
            "type": detect_type(last_extinf["group"], last_extinf["name"]),
        })

        last_extinf = None

    return items


def parse_m3u_content(content: str, source_url: str):
    """M3U içeriğini kaynağa göre işler."""
    return parse_m3u(content, source_url)

# ============================================================
#  BÖLÜM 6 — ONLINE LİNK AVCISI
# ============================================================

def fetch_online_links():
    """
    İnternetten otomatik Xtream linkleri toplar.
    Sonuçları TARANACAKLINKLER.txt dosyasına ekler.
    """
    sources = [
        "https://iptv-org.github.io/iptv/index.m3u",
        "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/tr.m3u",
        "https://raw.githubusercontent.com/Free-IPTV/Countries/master/Turkey.m3u"
    ]

    target_path = MIX_FILE
    unique_links = set()

    for url in sources:
        try:
            r = requests.get(url, timeout=10, verify=False)
            if r.status_code == 200:
                found = re.findall(
                    r"(https?://[^/:\s]+(?::\d+)?)/(?:get\.php\?username=|live/|movie/|series/|player_api\.php\?username=)"
                    r"([^/&?]+)[/&?](?:password=)?([^/&?.\s]+)",
                    r.text
                )
                for item in found:
                    unique_links.add(f"{item[0]}|{item[1]}|{item[2]}")
        except:
            continue

    if not unique_links:
        return 0

    existing = set()
    if os.path.exists(target_path):
        with open(target_path, "r", encoding="utf-8") as f:
            existing = {line.strip() for line in f if line.strip()}

    new_added = 0
    with open(target_path, "a", encoding="utf-8") as f_out:
        for l in unique_links:
            if l not in existing:
                f_out.write(l + "\n")
                new_added += 1

    return new_added

# ============================================================
#  BÖLÜM 7 — CACHE / JSON KAYIT İŞLEMLERİ
# ============================================================

def save_scan_to_json(rows):
    """Tarama sonuçlarını JSON dosyasına kaydeder."""
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
        print(f"✅ Tarama sonuçları {DATA_FILE} dosyasına kaydedildi.")
    except Exception as e:
        print(f"❌ JSON kayıt hatası: {e}")


def save_cache(rows):
    """
    Cache listesini hem TXT hem JSON olarak kaydeder.
    TXT → cache.txt
    JSON → data.json (arayüz için)
    """
    with FILE_LOCK:
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                for r in rows:
                    f.write(f"{r['host']}|{r['user']}|{r['pass']}|{r['max']}|{r['days']}|{r['country']}\n")

            with open("static/data.json", "w", encoding="utf-8") as f:
                json.dump({"rows": rows}, f, ensure_ascii=False)

        except Exception as e:
            print(f"❌ Cache kayıt hatası: {e}")


def load_cache():
    """cache.txt dosyasını okuyup satırları dict listesi olarak döner."""
    rows = []
    if not os.path.exists(CACHE_FILE):
        return rows

    with FILE_LOCK:
        try:
            with open(CACHE_FILE, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    parts = line.strip().split("|")
                    if len(parts) == 6:
                        rows.append({
                            "host": parts[0],
                            "user": parts[1],
                            "pass": parts[2],
                            "max": int(parts[3]),
                            "days": int(parts[4]),
                            "country": parts[5],
                        })
        except:
            pass

    return rows

# ============================================================
#  BÖLÜM 8 — M3U / URL YARDIMCILARI
# ============================================================

def normalize_m3u_url(url: str) -> str:
    """URL içindeki boşlukları temizler."""
    return url.strip().replace(" ", "") if url else ""


def extract_url(text):
    """Metin içinden URL çeker."""
    match = re.search(r'(https?://[^\s<>"\']+)', text)
    return match.group(1) if match else None





def parse_mix():
    out = []
    seen = set()
    files = ["static/TARANACAKLINKLER.txt", "static/GUNLUK_INDIRILENLER.txt"]
    lines = []

    for f in files:
        if os.path.exists(f):
            with open(f, "r", encoding="utf-8", errors="ignore") as fp:
                lines.extend(fp.read().splitlines())

    def add(host, user, passwd, maxv=1):
        if not host or not user or not passwd:
            return
        if not host.startswith("http"):
            host = "http://" + host
        uo = urlparse(host)
        final = f"{uo.scheme}://{uo.netloc}"
        key = f"{final}|{user}|{passwd}"
        if key not in seen:
            seen.add(key)
            out.append({
                "host": final,
                "user": user,
                "pass": passwd,
                "max": int(maxv),
                "days": 0,
                "country": "xx"
            })

    i = 0
    L = len(lines)

    while i < L:
        l = lines[i].strip()

        # ---------------------------------------------------------
        # 1) GET.PHP / PLAYER_API
        # ---------------------------------------------------------
        if "get.php" in l or "player_api" in l:
            url = extract_url(l)
            if url:
                uo = urlparse(url)
                q = parse_qs(uo.query)
                u = q.get("username", [""])[0]
                p = q.get("password", [""])[0]
                if u and p:
                    add(f"{uo.scheme}://{uo.netloc}", u, p)
            i += 1
            continue

        # ---------------------------------------------------------
        # 2) Tek satır pipe formatı
        # ---------------------------------------------------------
        if "|" in l:
            parts = l.split("|")
            if len(parts) >= 3:
                add(parts[0].strip(), parts[1].strip(), parts[2].strip())
                i += 1
                continue

        # ---------------------------------------------------------
        # 3) HOST= USER= PASS= formatı
        # ---------------------------------------------------------
        if l.lower().startswith("host="):
            host = l.split("=", 1)[1].strip()
            user = ""
            passwd = ""

            if i + 1 < L and lines[i+1].lower().startswith("user"):
                user = lines[i+1].split("=", 1)[1].strip()

            if i + 2 < L and lines[i+2].lower().startswith("pass"):
                passwd = lines[i+2].split("=", 1)[1].strip()

            if host and user and passwd:
                add(host, user, passwd)
                i += 3
                continue

        # ---------------------------------------------------------
        # 4) user: test pass: 1234 tek satır formatı
        # ---------------------------------------------------------
        if "user:" in l.lower() and "pass:" in l.lower():
            host = lines[i-1].strip() if i > 0 else ""
            u = re.search(r"user:\s*([^\s]+)", l, re.I)
            p = re.search(r"pass:\s*([^\s]+)", l, re.I)
            if host and u and p:
                add(host, u.group(1), p.group(1))
                i += 1
                continue

        # ---------------------------------------------------------
        # 5) host user pass boşluklu format
        # ---------------------------------------------------------
        if " " in l and l.count(" ") == 2 and not l.startswith("#"):
            parts = l.split()
            if len(parts) == 3 and "." in parts[0]:
                add(parts[0], parts[1], parts[2])
                i += 1
                continue

        # ---------------------------------------------------------
        # 6) Panel formatı
        # ---------------------------------------------------------
        if l.lower().startswith("panel:"):
            host = l.split(":", 1)[1].strip()
            user = ""
            passwd = ""

            if i + 1 < L:
                l2 = lines[i+1].strip()
                if l2.lower().startswith("kullanıcı") or l2.lower().startswith("kullanici"):
                    user = l2.split(":", 1)[1].strip()

            if i + 2 < L:
                l3 = lines[i+2].strip()
                if l3.lower().startswith("şifre") or l3.lower().startswith("sifre"):
                    passwd = l3.split(":", 1)[1].strip()

            if host and user and passwd:
                add(host, user, passwd)
                i += 3
                continue

        # ---------------------------------------------------------
        # 7) URL PATH formatı: /live/user/pass/
        # ---------------------------------------------------------
        if "http://" in l or "https://" in l:
            url = extract_url(l)
            if url:
                m = re.search(r"/live/([^/]+)/([^/]+)/", url)
                if m:
                    add(url, m.group(1), m.group(2))
                    i += 1
                    continue

        # ---------------------------------------------------------
        # 8) HOST + N kullanıcı formatı
        # ---------------------------------------------------------
        if "http://" in l or "https://" in l:
            host = extract_url(l)
            if host:
                j = i + 1
                while j + 2 < L:
                    u = lines[j].strip()
                    p = lines[j+1].strip()
                    m = lines[j+2].strip()

                    if not u or not p:
                        break
                    try:
                        maxv = int(m)
                    except:
                        break

                    add(host, u, p, maxv)
                    j += 3

                i = j
                continue

        i += 1

    return out


# ============================================================
#  BÖLÜM 10 — MAIN.PY İÇİN VERİ YÜKLEME
# ============================================================

def read_data():
    """Main.py içindeki lifespan için ülke verisini RAM'e yükler."""
    global COUNTRY_DISK_CACHE
    if os.path.exists(COUNTRY_DISK_FILE):
        try:
            with open(COUNTRY_DISK_FILE, "r", encoding="utf-8") as f:
                COUNTRY_DISK_CACHE = json.load(f)
                print(f"✅ {len(COUNTRY_DISK_CACHE)} ülke verisi diskten yüklendi.")
        except Exception as e:
            print(f"⚠️ Ülke verisi okuma hatası: {e}")
    else:
        print("ℹ️ Ülke cache dosyası henüz oluşmamış.")
