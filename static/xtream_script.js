/* =================================================
   🌍 GLOBAL STATE
================================================== */
let DATA = [];
let GROUP = {};
let FILTER = "all";
let HOSTONLY = false;
let COUNTRY_FILTER = "all";
let OPEN_HOSTS = [];
let scanStartTime = null;


/* =================================================
   📊 STATS MOTORU — TEMİZ & MODERN
================================================== */
function renderStats() {
    fetch("/sysinfo")
        .then(r => r.json())
        .then(s => {
            const stats = document.getElementById("stats");
            if (!stats) return;

            // 🛡️ DATA ve GROUP kontrolü (Hata vermemesi için)
            const activeLines = (typeof DATA !== "undefined") ? DATA.filter(r => r.active || r.days > 0).length : 0;
            const hostCount = (typeof GROUP !== "undefined") ? Object.keys(GROUP).length : 0;
            const totalLines = (typeof DATA !== "undefined") ? DATA.length : 0;

            stats.innerHTML = `
                <div class="stat-item stat-blue">
                    <span class="stat-value">${hostCount}</span>
                    <small>Host</small>
                </div>

                <div class="stat-item stat-green">
                    <span class="stat-value">${activeLines}</span>
                    <small>Aktif Line</small>
                </div>

                <div class="stat-item stat-purple">
                    <span class="stat-value">${totalLines}</span>
                    <small>Toplam</small>
                </div>

                <div class="stat-item stat-pink">
                    <span class="stat-value">${s.ram_used || 0} / ${s.ram_total || 0} GB</span>
                    <small>RAM</small>
                </div>

                <div class="stat-item stat-red">
                    <span class="stat-value">%${s.cpu_percent || 0}</span>
                    <small>CPU</small>
                </div>
            `;
        }).catch(e => console.log("Stats hatası: ", e));
}


window.OPEN_HOSTS = window.OPEN_HOSTS || [];

function toggleHost(host) {
    const index = window.OPEN_HOSTS.indexOf(host);
    if (index > -1) {
        window.OPEN_HOSTS.splice(index, 1); // Açıksa kapat
    } else {
        window.OPEN_HOSTS.push(host); // Kapalıysa aç
    }
    render(); // 🚀 Sayfayı yenile ki liste gelsin!
}





function render() {
    const list = document.getElementById("list");
    if (!list) return;

    // 🔄 Üst istatistik panelini arka planda yenile
    setTimeout(renderStats, 0);

    const q = (document.getElementById("search")?.value || "").toLowerCase();
    const currentFavs = JSON.parse(localStorage.getItem("bekir_favs") || "[]");

    if (typeof GROUP === "undefined") return;
    let hosts = Object.keys(GROUP);

    /* =================================================
       ⭐ FAVORİ HOSTLARI EN ÜSTE AL
    ================================================== */
    hosts.sort((a, b) => {
        const aFav = GROUP[a].some(r => currentFavs.some(f => f.host === r.host && f.user === r.user));
        const bFav = GROUP[b].some(r => currentFavs.some(f => f.host === r.host && f.user === r.user));
        return bFav - aFav;
    });

    let htmlRows = "";

    /* =================================================
       🔁 TÜM HOSTLARI DÖN
    ================================================== */
    hosts.forEach((host) => {
        let tempRows = "";

        // Host içindeki satırları favorilere göre sırala
        let sortedRows = [...GROUP[host]].sort((a, b) => {
            const aFav = currentFavs.some(f => f.host === a.host && f.user === a.user);
            const bFav = currentFavs.some(f => f.host === b.host && f.user === b.user);
            return bFav - aFav;
        });

        /* =================================================
                   🔍 SATIR FİLTRELERİ (IP VE BAYRAK DESTEKLİ)
                ================================================== */
        sortedRows.forEach((r) => {
            // ✅ IP KODUNA GÖRE ÜLKEYİ BELİRLE (country yoksa country_code bak)
            const c = (r.country || r.country_code || "un").toLowerCase();

            // 1. Arama Filtresi
            if (q && !(r.host + r.user + r.pass).toLowerCase().includes(q)) return;

            // 2. 🚩 Bayrak Filtresi (Seçili ülkede kalması için)
            if (typeof COUNTRY_FILTER !== "undefined" && COUNTRY_FILTER !== "all") {
                if (c !== COUNTRY_FILTER.toLowerCase()) return;
            }

            // 3. Max Filtresi
            if (typeof FILTER !== "undefined") {
                if (FILTER === "max1" && parseInt(r.max) !== 1) return;
                if (FILTER === "max2" && parseInt(r.max) < 2) return;
            }

            const daysNum = parseInt(r.days) || 0;
            const cls = daysNum >= 30 ? "row-green" : daysNum >= 7 ? "row-yellow" : "row-red";

            const hEsc = r.host.replace(/'/g, "\\'");
            const uEsc = r.user.replace(/'/g, "\\'");
            const pEsc = r.pass.replace(/'/g, "\\'");

            const isFav = currentFavs.some(f => f.host === r.host && f.user === r.user);
            const favClass = isFav ? "fav-row" : "";

            // ✅ BEKİR ABİ: BAYRAĞI EKRANA ÇAKAN KOD
            /* =================================================
   🖼️ BEKİR ABİ: BAYRAKLARI 24PX'TEN 35PX'E ÇIKARDIK!
================================================== */
            const flagHTML = `<img src="https://flagcdn.com/w80/${c}.png" 
                       style="width:40px; border-radius:4px; box-shadow: 0 0 6px rgba(0,0,0,0.9); border: 1px solid #334155;" 
                       onerror="this.src='https://flagcdn.com/w80/un.png'" 
                       loading="lazy">`;
            

/* =============================================================================
   🚥 BEKİR ABİ: 1-KIRMIZI, 2-SARI, 3+ YEŞİL MOTORU (NET VERSİYON)
============================================================================= */

// 🚀 1. MAX SAYISI İÇİN RENK AYARI
const maxNum = parseInt(r.max) || 0;
const maxColor = maxNum === 1 ? "#ef4444" : (maxNum === 2 ? "#facc15" : "#4ade80");

// 🚀 2. GÜN SAYISI İÇİN RENK AYARI
const dayColor = daysNum === 1 ? "#ef4444" : (daysNum === 2 ? "#facc15" : "#4ade80");

tempRows += `
    <tr class="data-row ${cls} ${favClass}" style="background: #0f172a; border-bottom: 1px solid #1e293b;">
        
        <td class="td-copy" style="font-size: 18px; font-weight: bold; color: #94a3b8; padding: 15px 12px;" onclick="copy('${hEsc}')">
            ${r.host.substring(0, 40)}...
        </td>
        
        <td class="td-copy" style="font-size: 20px; font-weight: 900; color: #ffffff; padding: 15px 12px;" onclick="openClient('${hEsc}','${uEsc}','${pEsc}')">
            <span style="color: #4ade80; margin-right: 8px;">▶️</span>${r.user}
        </td>

        <td class="td-copy" style="font-size: 18px; font-weight: bold; color: #64748b; padding: 15px 12px;" onclick="copy('${pEsc}')">
            ${r.pass}
        </td>

        <td style="text-align:center; padding: 15px 12px;">${flagHTML}</td>

        <td style="text-align:center; font-weight:900; color: ${maxColor}; font-size: 35px; padding: 15px 12px; text-shadow: none;">
            ${r.max}
        </td>

        <td style="text-align:center; font-weight:900; color: ${dayColor}; font-size: 35px; padding: 15px 12px; text-shadow: none;">
            ${daysNum}
        </td>

        <td style="padding: 15px 12px;">
            <div class="row-actions" style="display:flex; gap:8px; justify-content:center; align-items:center;">
                <button class="btn-mini" style="font-size: 13px; padding: 8px 12px; display:flex; align-items:center; gap:5px;" onclick="copy('${hEsc}|${uEsc}|${pEsc}')">
                    <span>📄</span> KOPYALA
                </button>
                <button class="btn-mini btn-mini-m3u" style="font-size: 13px; padding: 8px 12px; display:flex; align-items:center; gap:5px;" onclick="openClient('${hEsc}','${uEsc}','${pEsc}')">
                    <span>🎬</span> M3U
                </button>
                <button class="btn-mini btn-mini-del" style="font-size: 13px; padding: 8px 12px; display:flex; align-items:center; gap:5px; background:#be123c !important;" onclick="event.stopPropagation(); deleteOne('${hEsc}','${uEsc}','${pEsc}')">
                    <span>🗑️</span> SİL
                </button>
                <button class="btn-mini btn-fav ${isFav ? "btn-fav-active" : ""}" style="font-size: 22px; background:none; border:none; padding:0 5px;" onclick="favoriEkle('${hEsc}', '${uEsc}', '${pEsc}')">
                    ${isFav ? '🌟' : '⭐'}
                </button>
            </div>
        </td>
    </tr>`;
        });


/* =================================================
   🚩 BEKİR ABİ: HOST BAŞLIĞI — BAYRAKLI, YILDIZLI VE KÜÇÜK HARFLİ
================================================== */
/* =============================================================================
   🚩 BEKİR ABİ: SARI BAŞLIĞI VE BAYRAĞI DARALTAN HATASIZ TAM MOTOR
============================================================================= */
if (tempRows.length > 0 || HOSTONLY) {
    // 🌍 1. BAYRAK VE ÜLKE KONTROLÜ
    const firstRow = GROUP[host] ? GROUP[host][0] : null;
    const c = (firstRow && (firstRow.country || firstRow.country_code)) ? (firstRow.country || firstRow.country_code).toLowerCase() : "";

    let fullName = "BİLİNMİYOR";
    try {
        if (c && c.length === 2) {
            const regionNames = new Intl.DisplayNames(['tr'], { type: 'region' });
            fullName = regionNames.of(c.toUpperCase()).toUpperCase();
        }
    } catch (e) {
        fullName = c ? c.toUpperCase() : "HEPSİ";
    }

    // 🚩 2. BAYRAK VE ALTINDAKİ YAZIYI DARALTTIK (75PX SABİT)
    const hostFlag = c.length === 2
        ? `<div style="display: flex; flex-direction: column; align-items: center; margin-right: 12px; width: 75px; flex-shrink: 0;">
            <img src="https://flagcdn.com/w80/${c}.png" 
                 style="width: 45px; height: auto; border-radius: 4px; border: 2px solid #facc15; box-shadow: 0 0 8px rgba(0,0,0,0.8);">
            <span style="font-size: 10px; font-weight: 900; color: #facc15; margin-top: 4px; text-align:center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${fullName}
            </span>
           </div>`
        : `<div style="display: flex; flex-direction: column; align-items: center; margin-right: 12px; width: 75px; flex-shrink: 0;">
            <span style="font-size: 30px;">🌍</span>
            <span style="font-size: 10px; font-weight: 900; color: #facc15; margin-top: 2px;">TÜMÜ</span>
           </div>`;

    // ⭐ 3. YILDIZ VE FAVORİ KONTROLÜ
    const hasFav = GROUP[host].some(r => currentFavs.some(f => f.host === r.host && f.user === r.user));
    const isOpened = window.OPEN_HOSTS && window.OPEN_HOSTS.includes(host);
    const cleanHost = host.replace("http://", "").replace("https://", "").toLowerCase();

    const hostStyle = hasFav
        ? "border-left: 10px solid #facc15; background: rgba(250, 204, 21, 0.2);"
        : "border-left: 6px solid #facc15; background: #1e293b; border-bottom: 1px solid #334155;";

    const safeHost = host.replace(/'/g, "\\'");

    // 🏗️ 4. SARI SATIRI OLUŞTURMA (BURADA HOST İSMİNE SINIR KOYDUK)
    htmlRows += `
        <tr class="tr-host" style="cursor:pointer; ${hostStyle}" onclick="toggleHost('${safeHost}')">
            <td colspan="7" style="padding:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px;">
                    
                    <div style="display:flex; align-items:center; overflow: hidden;">
                        <input type="checkbox" class="host-checkbox" 
                            style="width:20px; height:20px; cursor:pointer; margin-right:12px; accent-color: #facc15; flex-shrink: 0;" 
                            onclick="event.stopPropagation(); toggleSelectHost('${safeHost}')">
                        
                        <div style="display:flex; align-items:center; overflow: hidden;">
                            ${hostFlag} 
                            
                            <span style="font-size:20px; font-weight:900; color: #facc15; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; display: inline-block;">
                                ${cleanHost}
                            </span>

                            ${hasFav ? '<span style="color:#fbbf24; margin-left:8px; flex-shrink: 0;">⭐</span>' : ''}
                            
                            <small style="font-size:14px; color:#38bdf8; margin-left:15px; font-weight:bold; flex-shrink: 0;">
                                [ ${GROUP[host].length} HAT ]
                            </small>
                        </div>
                    </div>

                    <button class="btn-groupdel" style="background:linear-gradient(135deg, #be123c, #9f1239) !important; color:white; padding:8px 14px; border-radius:8px; font-weight:bold; border:none; cursor:pointer; flex-shrink: 0;"
                        onclick="event.stopPropagation(); deleteGroup('${safeHost}')">🧨 GRUP SİL</button>
                </div>
            </td>
        </tr>`;

    if (q || isOpened || !HOSTONLY) {
        htmlRows += tempRows;
    }
}
    }); // Ana döngü sonu

    list.innerHTML = htmlRows || `<tr><td colspan="7" style="text-align:center; padding:30px; color:#9ca3af; font-weight:bold;">Sonuç bulunamadı Bekir Abi...</td></tr>`;
} // Render Kapanışı



/* =================================================
   🚩 ÜLKE BAYRAKLARINI LİSTELEYEN EFSANE FONKSİYON
================================================== */
function renderCountryFlags() {
    const box = document.getElementById("countryFlags");
    if (!box) return;

    const used = new Set();

    // 🕵️‍♂️ BEKİR ABİ: DATA içindeki ülkeleri topla (Boş veya 'xx' olanları alma)
    DATA.forEach(r => {
        if (r.country && r.country !== "" && r.country !== "xx") {
            used.add(r.country.toLowerCase());
        }
    });

    // 🌍 HEPSİ BUTONU (Sıfırlama)
    let html = `
        <div class="flag-wrapper">
            <span class="flag-all" title="Hepsini Göster" onclick="setCountryFilter('all')">🌍</span>
        </div>
    `;

    // 🏁 BAYRAKLARI SIRALA VE EKLE
    [...used].sort().forEach(c => {
        // Seçili bayrağı belirgin yap
        const activeClass = (window.COUNTRY_FILTER === c) ? 'active-flag' : '';

        html += `
            <div class="flag-wrapper">
                <img src="https://flagcdn.com/w80/${c}.png" 
                     class="flag-select ${activeClass}"
                     onclick="setCountryFilter('${c}')"
                     title="${c.toUpperCase()}">
            </div>
        `;
    });

    box.innerHTML = html;
}
function setCountryFilter(c) {
    // Global değişkeni güncelle
    COUNTRY_FILTER = c;

    // Bayrakların görünümünü anında tazele (Parlatma efekti için)
    renderCountryFlags();

    // Tabloyu mermi gibi süz
    render();
}


/* =================================================
   📦 DATA LOAD & CACHE MOTORU — YENİLENMİŞ
================================================== */

// 1. Hostları grupla (Hızlı ve Temiz)
function buildGroup() {
    GROUP = {};
    if (!DATA || !Array.isArray(DATA)) return; // Boş veri koruması

    DATA.forEach((r) => {
        if (!r.host) return; // Host yoksa geç
        if (!GROUP[r.host]) GROUP[r.host] = [];
        GROUP[r.host].push(r);
    });
}

// 2. İlk veri yükleme (Hafıza ve Sunucu Dengesi)
async function loadInitialData() {
    const cachedData = localStorage.getItem("iptv_cache");

    // A) Cache varsa hızlıca ekrana bas (Sayfa boş kalmasın)
    if (cachedData) {
        try {
            const d = JSON.parse(cachedData);
            DATA = d.rows || [];
            buildGroup();

            // Temayı bozmadan sadece veriyi basıyoruz
            render();
            if (typeof renderCountryFlags === "function") renderCountryFlags();
            if (typeof renderStats === "function") renderStats();
        } catch (e) {
            console.error("Cache okuma hatası:", e);
        }
    }

    // B) Sunucudan güncel veriyi çek (Arka planda sessizce yap)
    try {
        const resp = await fetch("/data?t=" + Date.now()); // t parametresi cache'i baypas eder
        if (!resp.ok) throw new Error("Sunucu hatası!");

        const d = await resp.json();
        localStorage.setItem("iptv_cache", JSON.stringify(d));

        DATA = d.rows || [];
        buildGroup();

        // Güncel veriyi ekrana yansıt
        render();
        if (typeof renderCountryFlags === "function") renderCountryFlags();
        if (typeof renderStats === "function") renderStats();

    } catch (err) {
        console.error("Güncel veri çekilemedi:", err);
    }
}

// 3. 🎯 MOTORU ÇALIŞTIR
// Not: Bu fonksiyon en altta kalsın, diğer her şey yüklendikten sonra çalışsın.
loadInitialData();



/* =================================================
   🔍 TARAYICI (SCAN) MOTORU — TAM TEMİZLİK
================================================== */

function startScan() {
    // Python tarafında taramayı başlat
    fetch("/rescan", { method: "POST" })
        .then(r => r.json())
        .then(res => {
            if (res.ok) toast("🚀 Tarama Başlatıldı!");
        });

    // Görsel sıfırlama
    const scanText = document.getElementById("scanText");
    const scanPercent = document.getElementById("scanPercent");
    const scanBar = document.getElementById("scanBar");
    const scanBox = document.getElementById("scanBox");

    if (scanText) scanText.innerText = "Hazırlanıyor...";
    if (scanPercent) scanPercent.innerText = "%0";
    if (scanBar) scanBar.style.width = "0%";
    if (scanBox) scanBox.style.display = "block";

    scanStartTime = Date.now();

    // Her saniye tarama durumunu sor
    const scanTimer = setInterval(() => {
        fetch("/progress?t=" + Date.now())
            .then(r => r.json())
            .then(p => {
                const total = p.total || 0;
                const current = p.current || 0;
                const running = p.running;

                // Zaman hesaplama
                const elapsedSec = Math.floor((Date.now() - scanStartTime) / 1000);
                document.getElementById("elapsedTime").innerText = formatSec(elapsedSec);

                if (current > 5 && total > 0) {
                    const remainingSec = Math.floor(((total - current) * elapsedSec) / current);
                    document.getElementById("remainingTime").innerText = formatSec(remainingSec);
                }

                // Görsel güncelleme
                const percent = total > 0 ? Math.floor((current / total) * 100) : 0;
                if (scanBar) scanBar.style.width = percent + "%";
                if (scanPercent) scanPercent.innerText = "%" + percent;
                if (scanText) scanText.innerText = `Taranıyor: ${current} / ${total}`;

                // Tarama bitti mi?
                if (!running && current >= total && total > 0) {
                    clearInterval(scanTimer);
                    toast("✅ Tarama Tamamlandı!");

                    if (scanText) scanText.innerText = "Tarama Bitti!";

                    setTimeout(() => {
                        if (scanBox) scanBox.style.display = "none";
                        reloadData();
                    }, 4000);
                }
            })
            .catch(err => console.error("Tarama takibi hatası:", err));
    }, 1000);
}


/* =================================================
   ⏱ ZAMAN FORMATLAYICI
================================================== */

function formatSec(s) {
    if (s < 0 || isNaN(s)) return "00:00";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return String(m).padStart(2, '0') + ":" + String(sec).padStart(2, '0');
}


/* =================================================
   🔄 TARAMA SONRASI VERİ YENİLEME
================================================== */

function reloadData() {
    fetch("/data")
        .then(r => r.json())
        .then(d => {
            DATA = d.rows || [];
            buildGroup();
            render();
            renderStats();
        });
}

/* =================================================
   📋 FİLTRE MOTORU (MAX1 / MAX2 / HOSTONLY)
================================================== */

function setFilter(f) {
    FILTER = f;
    render();
}

function setHostOnly() {
    HOSTONLY = !HOSTONLY;
    render();
}

function setAll() {
    FILTER = "all";
    HOSTONLY = false;
    COUNTRY_FILTER = "all";
    render();
}


/* =================================================
   📎 KOPYALAMA MOTORU
================================================== */

function copy(text) {
    navigator.clipboard.writeText(text);
    toast("📋 Kopyalandı");
}


/* =================================================
   📢 TOAST BİLDİRİM MOTORU
================================================== */

function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;

    t.innerText = msg;
    t.style.display = "block";
    t.style.opacity = "1";

    setTimeout(() => {
        t.style.display = "none";
    }, 2000);
}



/* -----------------------------
   1) TÜM LİSTEYİ TXT OLARAK İNDİR
------------------------------ */
function exportTXT() {
    if (DATA.length === 0) {
        toast("❌ Liste boş!");
        return;
    }

    let txt = "";
    DATA.forEach(r => {
        txt += `${r.host}|${r.user}|${r.pass}\n`;
    });

    download(txt, "iptv_listesi.txt");
    toast("📄 TXT indirildi");
}


/* -----------------------------
   2) TÜM LİSTEYİ M3U OLARAK İNDİR
------------------------------ */
function exportM3U() {
    if (DATA.length === 0) {
        toast("❌ Liste boş!");
        return;
    }

    let m3u = "#EXTM3U\n";
    DATA.forEach(r => {
        m3u += `${r.host}/get.php?username=${r.user}&password=${r.pass}&type=m3u_plus&output=ts\n`;
    });

    download(m3u, "iptv_listesi.m3u");
    toast("📺 M3U indirildi");
}


/* -----------------------------
   3) FAVORİLERİ M3U + TXT OLARAK İNDİR
------------------------------ */
async function m3uKopyala() {
    try {
        const res = await fetch('/api/export-favorites?v=' + Math.random());
        const text = await res.text();

        if (!text || !text.includes("#EXTM3U")) {
            toast("⚠️ Favori listesi boş!");
            return;
        }

        // M3U indir
        download(text, "Bekir_Favoriler.m3u");

        // TXT indir
        const txtContent = text
            .replace(/#EXTM3U\n/g, "")
            .replace(/#EXTINF:-1,.*\n/g, "");

        setTimeout(() => {
            download(txtContent, "Bekir_Favoriler.txt");
        }, 300);

        // Panoya kopyala
        navigator.clipboard.writeText(text);

        toast("🚀 Favoriler: M3U + TXT indirildi, pano kopyalandı!");
    } catch (err) {
        console.error(err);
        toast("❌ Hata oluştu!");
    }
}


/* -----------------------------
   4) İNDİRME MOTORU (GENEL)
------------------------------ */
function download(data, name) {
    const blob = new Blob([data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();

    URL.revokeObjectURL(url);
}
/* =================================================
   🗑️ DELETE MOTORU — TEK TEK, GRUP, BULK, UNDO
================================================== */


/* =================================================
   1) TEK SATIR SİLME
================================================== */
async function deleteOne(host, user, pass) {
    if (!confirm(`${host} | ${user} silinsin mi?`)) return;

    try {
        await fetch("/block", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: host + "|" + user })
        });

        toast("🗑️ Silindi");
        reloadData();
    } catch (err) {
        alert("❌ Sunucu hatası!");
    }
}


/* =================================================
   2) GRUP SİLME (HOST ALTINDAKİ TÜM SATIRLAR)
================================================== */
async function deleteGroup(host) {
    if (!confirm(`${host} grubundaki TÜM satırlar silinsin mi?`)) return;

    const rows = DATA.filter(r => r.host === host);

    for (const r of rows) {
        await fetch("/block", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: r.host + "|" + r.user })
        });
    }

    toast("🧨 Grup silindi");
    reloadData();
}


/* =================================================
   3) UNDO (GERİ ALMA)
================================================== */
async function undo() {
    if (!confirm("Son silme işlemini geri alayım mı?")) return;

    try {
        const res = await fetch("/undo", { method: "POST" });
        const data = await res.json();

        if (data.ok) {
            toast("🔄 Geri alındı!");
            setTimeout(() => location.reload(), 800);
        } else {
            alert("⚠️ Geri alınacak bir işlem bulunamadı.");
        }
    } catch (err) {
        alert("❌ Sunucuya bağlanılamadı!");
    }
}


/* =================================================
   4) BULK DELETE — MAX 1
================================================== */
async function deleteMax1() {
    if (!confirm("Tüm MAX 1 hesaplar silinsin mi?")) return;

    const res = await fetch("/delete_max1", { method: "POST" });

    if (res.ok) {
        toast("🧹 MAX 1 hesaplar temizlendi!");
        setTimeout(() => location.reload(), 800);
    }
}


/* =================================================
   5) BULK DELETE — 20 GÜN ALTI
================================================== */
async function deleteDays20() {
    if (!confirm("20 gün altı tüm hesaplar silinsin mi?")) return;

    const res = await fetch("/delete_days20", { method: "POST" });

    if (res.ok) {
        toast("⏳ 20 gün altı temizlendi!");
        setTimeout(() => location.reload(), 800);
    }
}


/* =================================================
   6) BULK DELETE — OFFLINE (GÜN 0)
================================================== */
async function deleteAllOffline() {
    if (!confirm("Günü bitmiş (OFFLINE) tüm hesaplar silinsin mi?")) return;

    const res = await fetch("/delete_offline", { method: "POST" });

    if (res.ok) {
        toast("🚫 OFFLINE hesaplar silindi!");
        setTimeout(() => location.reload(), 800);
    }
}


/* =================================================
   7) BULK DELETE — ÜLKEYE GÖRE
================================================== */
async function deleteByCountry() {
    if (COUNTRY_FILTER === "all") {
        toast("⚠️ Önce bir ülke seç!");
        return;
    }

    if (!confirm(`${COUNTRY_FILTER.toUpperCase()} ülkesi komple silinsin mi?`)) return;

    const res = await fetch("/delete_country", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: COUNTRY_FILTER })
    });

    if (res.ok) {
        toast("🌍 Ülke temizlendi!");
        setTimeout(() => location.reload(), 800);
    }
}

/* =================================================
   ⭐ FAVORİ MOTORU — YILDIZLAMA + SENKRON + LOCALSTORAGE
================================================== */

/*
    Favori sistemi 3 aşamada çalışır:
 
    1) Sunucuya favori isteği gönderilir (/api/favorite)
    2) Sunucu "eklendi" veya "çıkarıldı" bilgisini döner
    3) LocalStorage güncellenir → render() çağrılır → UI anında yenilenir
*/

async function favoriEkle(host, user, pass) {
    try {
        const res = await fetch('/api/favorite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, user, pass })
        });

        const data = await res.json();
        if (!data.ok) {
            toast("❌ Favori işlemi başarısız!");
            return;
        }

        // Mevcut favorileri al
        let favs = JSON.parse(localStorage.getItem("bekir_favs") || "[]");

        if (data.is_fav) {
            // Yeni favori eklendi
            favs.push({ host, user, pass });
            toast("⭐ Favorilere eklendi");
        } else {
            // Favoriden çıkarıldı
            favs = favs.filter(f => !(f.host === host && f.user === user));
            toast("❌ Favoriden çıkarıldı");
        }

        // LocalStorage güncelle
        localStorage.setItem("bekir_favs", JSON.stringify(favs));

        // UI anında güncellensin
        render();

    } catch (err) {
        console.error(err);
        alert("❌ Sunucu hatası!");
    }
}

/* =================================================
   🕒 SAAT & TARİH MOTORU — CANLI GÜNCELLEME
================================================== */

function updateClock() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");

    const clockEl = document.getElementById("liveClock");
    const dateEl = document.getElementById("liveDate");

    if (clockEl) {
        clockEl.innerText = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }

    if (dateEl) {
        dateEl.innerText = d.toLocaleDateString("tr-TR", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }
}

// Her saniye güncelle
setInterval(updateClock, 1000);
updateClock(); // İlk saniyeyi bekleme


/* =================================================
   🧠 SYSINFO MOTORU — CPU & RAM CANLI TAKİP
================================================== */

function updateSysInfo() {
    fetch('/sysinfo')
        .then(res => res.json())
        .then(data => {
            // CPU kutusu
            const cpuEl =
                document.querySelector('.card.red span') ||
                document.getElementById("cpu-usage");

            // RAM kutusu
            const ramEl =
                document.querySelector('.card.purple span') ||
                document.getElementById("ram-usage");

            if (cpuEl) cpuEl.innerHTML = `%${data.cpu}`;
            if (ramEl) ramEl.innerHTML = `${data.ram_u} GB / ${data.ram_t} GB`;
        })
        .catch(err => console.error("Sysinfo alınamadı:", err));
}

// 3 saniyede bir güncelle
setInterval(updateSysInfo, 3000);
updateSysInfo(); // İlk yükleme

/* =================================================
   🔗 CLIENT SAYFASINA GİDİŞ — TEMİZ SÜRÜM
================================================== */

function openClient(host, user, pass) {
    if (!host || !user || !pass) {
        alert("Bilgiler eksik geliyor!");
        return;
    }

    const h = encodeURIComponent(host.trim());
    const u = encodeURIComponent(user.trim());
    const p = encodeURIComponent(pass.trim());

    const url = `/client?host=${h}&user=${u}&pass=${p}`;
    window.open(url, "_blank");
}


/* =================================================
   ➕ LİNE EKLEME MOTORU — TEMİZ
================================================== */

function addLine() {
    const val = document.getElementById("newLine")?.value.trim();
    if (!val) return alert("Link boş olamaz!");

    fetch("/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line: val })
    })
        .then(r => r.json())
        .then(d => {
            if (d.ok) {
                document.getElementById("newLine").value = "";
                toast("➕ Eklendi");
                reloadData();
            }
        })
        .catch(() => alert("❌ Sunucu hatası!"));
}


/* =================================================
   🔄 PANEL YENİDEN BAŞLATMA
================================================== */

function restartPanel() {
    if (!confirm("Panel yeniden başlatılsın mı?")) return;

    fetch("/restart", { method: "POST" });

    alert("Panel yeniden başlatılıyor...");

    setTimeout(() => {
        localStorage.removeItem("iptv_cache");
        location.reload();
    }, 2500);
}

