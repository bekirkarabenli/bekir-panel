/* =================================================
   GLOBAL STATE & INITIAL LOAD
================================================== */
let currentView = "main";
let currentType = null;
let CLIENT_DATA = null;

const params = new URLSearchParams(window.location.search);
const host = params.get("host"), user = params.get("user"), passw = params.get("pass");

if (!host || !user || !passw) {
    document.getElementById("content").innerHTML = `<div class="loading">❌ Bilgiler Eksik!</div>`;
} else {
    document.getElementById("clientInfo").innerText = `${host.replace('http://', '')} | ${user}`;
    loadClientData();
}


function loadClientData() {
    console.log("🚀 Bekir Abi: Veri çekme işlemi başladı...");

    fetch(`/api/client-info?host=${encodeURIComponent(host)}&user=${encodeURIComponent(user)}&passw=${encodeURIComponent(passw)}`)
        .then(response => {
            if (!response.ok) throw new Error(`Sunucu Hatası: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log("Veri geldi:", data);
            
            // 🔥 BEKİR ABİ: BURASI KRİTİK!
            if (data.ok && data.counts.live > 0) {
                // Eğer her şey yolundaysa normal dükkanı aç abi
                CLIENT_DATA = data;
                renderHome(); 
            } else {
                // 🛠️ EĞER KANAL 0 İSE VEYA HATA VARSA BALYOZ BUTONUNU GÖSTER!
                showBalyozButonu();
            }
        })
        .catch(err => {
            console.error("Fetch Hatası:", err);
            // Bağlantı koparsa da butonu göster ki terminalle şansımızı deneyelim
            showBalyozButonu();
        });
}


/* =================================================
   1. ANA MENÜ (TV - FİLM - DİZİ)
================================================== */
function renderHome() {
    currentView = "main";
    document.getElementById("pageTitle").innerText = "💎 BEKOMAX PREMIUM TERMINAL";
    const c = CLIENT_DATA.counts;

    // 🚀 BEKİR ABİ: Kutuları büyüttük, gölgeleri ve parlamayı ekledik!
    document.getElementById("content").innerHTML = `
    <div class="group-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; padding: 20px;">
      
      <div class="group-card live-card" onclick="openGroups('live')" style="background: linear-gradient(135deg, #1e40af, #3b82f6);">
        <div class="group-icon" style="font-size: 60px; margin-bottom: 10px;">📺</div>
        <div class="group-name" style="font-size: 28px; font-weight: 900; letter-spacing: 1px;">CANLI YAYIN</div>
        <div class="group-count" style="font-size: 18px; background: rgba(0,0,0,0.3); padding: 5px 15px; border-radius: 20px; margin-top: 10px;">
            🚀 ${c.live} KANAL
        </div>
      </div>

      <div class="group-card vod-card" onclick="openGroups('vod')" style="background: linear-gradient(135deg, #7c3aed, #a855f7);">
        <div class="group-icon" style="font-size: 60px; margin-bottom: 10px;">🎬</div>
        <div class="group-name" style="font-size: 28px; font-weight: 900; letter-spacing: 1px;">SİNEMA (VOD)</div>
        <div class="group-count" style="font-size: 18px; background: rgba(0,0,0,0.3); padding: 5px 15px; border-radius: 20px; margin-top: 10px;">
            🔥 ${c.vod} FİLM
        </div>
      </div>

      <div class="group-card series-card" onclick="openGroups('series')" style="background: linear-gradient(135deg, #db2777, #f472b6);">
        <div class="group-icon" style="font-size: 60px; margin-bottom: 10px;">📚</div>
        <div class="group-name" style="font-size: 28px; font-weight: 900; letter-spacing: 1px;">DİZİLER</div>
        <div class="group-count" style="font-size: 18px; background: rgba(0,0,0,0.3); padding: 5px 15px; border-radius: 20px; margin-top: 10px;">
            ⭐ ${c.series} DİZİ
        </div>
      </div>

    </div>

    <style>
        /* 💎 BEKİR ABİ'NİN ÖZEL KART TASARIMI */
        .group-card {
            cursor: pointer;
            padding: 40px 20px;
            border-radius: 20px;
            text-align: center;
            color: white;
            transition: all 0.3s ease;
            box-shadow: 0 10px 20px rgba(0,0,0,0.4);
            border: 2px solid rgba(255,255,255,0.1);
        }

        .group-card:hover {
            transform: translateY(-10px) scale(1.03);
            box-shadow: 0 15px 30px rgba(0,0,0,0.6);
            border: 2px solid rgba(255,255,255,0.5);
        }

        .live-card:hover { box-shadow: 0 0 30px rgba(59, 130, 246, 0.6); }
        .vod-card:hover { box-shadow: 0 0 30px rgba(168, 85, 247, 0.6); }
        .series-card:hover { box-shadow: 0 0 30px rgba(244, 114, 182, 0.6); }
    </style>
    `;
}

/* =================================================
   📂 KATEGORİ LİSTESİ — 3 SIRA LİSTE EDİTİ
================================================== */
function openGroups(type) {
    currentView = "groups";
    currentType = type;
    document.getElementById("pageTitle").innerText = `📂 ${type.toUpperCase()} KATEGORİLER`;

    const groups = CLIENT_DATA.groups[type] || {};
    const names = Object.keys(groups).sort();

    // 🚀 BEKİR ABİ: Grid yapısını 3 sütun yaptık (min 200px olacak şekilde)
    let html = `<div class="group-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; padding: 10px;">`;

    names.forEach(name => {
        const safeName = name.replace(/'/g, "\\'");

        /* =================================================
           📂 LIVE KATEGORİ — BAYRAK SAĞDA VE BÜYÜK EDİTİ
        ================================================== */
        if (type === 'live') {
            const flagMatch = name.match(/([A-Z]{2})/);
            const countryCode = flagMatch ? flagMatch[1].toLowerCase() : null;
            const cleanName = name.replace(/[[|].*?[\]|]/g, "").trim();

            // 🚩 BAYRAĞI BİRAZ BÜYÜTTÜK VE SAĞA AYARLADIK
            const flagHTML = countryCode
                ? `<img src="https://flagcdn.com/w40/${countryCode}.png" style="width:30px; border-radius:3px; box-shadow: 0 0 5px rgba(0,0,0,0.5);">`
                : `<span style="font-size:20px;">📺</span>`;

            html += `
    <div class="group-card" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; border-left: 5px solid #ef4444; background: rgba(255, 255, 255, 0.07); border-radius: 8px; height: 60px; overflow: hidden; transition: 0.2s;" onclick="openChannels('${type}', '${safeName}')">
      
      <div class="group-name" style="font-size: 16px; font-weight: 900; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; padding-right: 10px;">
        ${cleanName}
      </div>

      <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
        ${flagHTML}
        <div class="group-count" style="background: #ef4444; color: white; padding: 4px 10px; border-radius: 8px; font-size: 13px; font-weight: 900; min-width: 40px; text-align: center;">
            ${groups[name]}
        </div>
      </div>

    </div>`;
        }
        // 🎬 VOD VEYA 📚 DİZİ — BÜYÜK KLASÖR GÖRÜNÜMÜ
        else {
            const icon = type === 'vod' ? '📂' : '📁';
            const accentColor = type === 'vod' ? '#a855f7' : '#db2777';

            html += `
            <div class="group-card folder-card" style="padding: 25px 15px; text-align: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-bottom: 4px solid ${accentColor}; border-radius: 12px;" onclick="openChannels('${type}', '${safeName}')">
              <div class="folder-icon" style="font-size: 50px; margin-bottom: 10px;">${icon}</div>
              <div class="group-name" style="font-size: 20px; font-weight: 800; color: #f3f4f6; margin-bottom: 8px;">${name}</div>
              <div class="group-count" style="color: ${accentColor}; font-weight: bold; font-size: 14px;">🚀 ${groups[name]} İÇERİK</div>
            </div>`;
        }
    });

    document.getElementById("content").innerHTML = html + `</div>`;
    window.scrollTo(0, 0);
}




function openChannels(type, groupName) {
    currentView = "channels";
    currentType = type;
    document.getElementById("pageTitle").innerText = groupName;

    const items = CLIENT_DATA.lists[type].filter(it => String(it._group) === String(groupName));
    const isPoster = (type === "vod" || type === "series");

    let headerHtml = `<input id="searchBox" placeholder="🔍 Ara..." oninput="filterList()">`;
    headerHtml += `<div id="listContainer" class="${isPoster ? 'vod-grid' : 'list-container'}"></div>`;
    document.getElementById("content").innerHTML = headerHtml;

    const listContainer = document.getElementById("listContainer");

    let index = 0;
    const chunkSize = 100;

    function renderNextBatch() {
        const batch = items.slice(index, index + chunkSize);
        let batchHtml = "";

        batch.forEach(it => {
            const rawName = it.name || it.title || "İsimsiz";
            const nameForJs = rawName.replace(/'/g, "\\'");
            const img = it.stream_icon || it.cover || "";
            const streamId = it.series_id || it.stream_id || it.movie_id;

            if (type === "series") {
                batchHtml += `
                <div class="vod-card list-ch" data-name="${rawName.toLowerCase()}" 
                     onclick="openSeriesInfo('${streamId}', '${nameForJs}', '${host}', '${user}', '${passw}')">
                    <img src="${img}" class="vod-poster" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=Afiş+Yok'">
                    <div class="vod-info">${rawName}</div>
                </div>`;
            } else {
                const ext = it.container_extension || "ts";
                const path = (type === "live") ? "live" : "movie";

                // 🔥 TAMİR EDİLEN KRİTİK BÖLGE:
                const realUrl = `${host}/${path}/${user}/${passw}/${streamId}.${ext}`;
                const playUrl = realUrl; // playUrl artık tanımlı, hata vermez.

                if (isPoster) {
                    batchHtml += `
                    <div class="vod-card list-ch" data-name="${rawName.toLowerCase()}" onclick="play('${playUrl}')">
                        <img src="${img}" class="vod-poster" loading="lazy">
                        <div class="vod-info">${rawName}</div>
                    </div>`;
                } else {
                    batchHtml += `
                    <div class="channel-row list-ch" data-name="${rawName.toLowerCase()}" onclick="play('${playUrl}')">
                        <img src="${img}" class="picon" loading="lazy" onerror="this.src='https://via.placeholder.com/50x35?text=TV'">
                        <span class="channel-name">${rawName}</span>
                    </div>`;
                }
            }
        });

        listContainer.insertAdjacentHTML('beforeend', batchHtml);
        index += chunkSize;

        if (index < items.length) {
            requestAnimationFrame(renderNextBatch);
        }
    }

    renderNextBatch();
    window.scrollTo(0, 0);
}


function openSeriesInfo(seriesId, seriesName, sHost, sUser, sPass) {
    currentView = "episodes";
    document.getElementById("pageTitle").innerText = `📂 ${seriesName}`;
    const content = document.getElementById("content");
    content.innerHTML = `<div class="loading" style="text-align:center; padding:50px; color:white;">⏳ Bölümler Hazırlanıyor...</div>`;

    // Python API'sine gönderirken sHost, sUser ve sPass'i kullanıyoruz
    const url = `/api/series-info?host=${encodeURIComponent(sHost)}&user=${encodeURIComponent(sUser)}&passw=${encodeURIComponent(sPass)}&series_id=${seriesId}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.ok && data.episodes && data.episodes.length > 0) {
                let html = `<div class="list-container" style="background:#111; padding:10px;">`;
                data.episodes.forEach(ep => {
                    html += `
                    <div class="channel-row" onclick="play('${ep.url}')" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; border-bottom:1px solid #333; padding:15px; color:white;">
                        <span><b style="color:red;">S${ep.season} E${ep.episode_num}</b> - ${ep.title}</span>
                        <button class="btn-play" style="background:red; color:white; border:none; padding:8px 15px; border-radius:5px; font-weight:bold; cursor:pointer;">▶ İZLE</button>
                    </div>`;
                });
                content.innerHTML = html + `</div>`;
                window.scrollTo(0, 0);
            } else {
                content.innerHTML = `<div class="loading" style="color:yellow; text-align:center; padding:50px;">⚠️ Bölüm listesi alınamadı! Python terminaline bak.</div>`;
            }
        })
        .catch(err => {
            content.innerHTML = `<div class="loading" style="color:red; text-align:center; padding:50px;">❌ Hata: ${err.message}</div>`;
        });
}
/* =================================================
   YARDIMCI FONKSİYONLAR (PLAY - BACK - FILTER)
================================================== */
let beko_kilit = false; // 🔒 Python'un kafası karışmasın diye kilit koyduk

function play(url) {
    // Eğer kilitliyse (yani bir istek zaten yoldaysa), ikinciye izin verme
    if (beko_kilit) {
        console.log("⚠️ Sabırlı ol Bekir Abi, Python şu an kapıyı zorluyor...");
        return;
    }

    // Kilidi vuruyoruz
    beko_kilit = true;
    console.log("🎬 Oynatılıyor:", url);

    fetch(`/api/play?url=${encodeURIComponent(url)}`)
        .then(res => res.json())
        .then(data => {
            if (!data.ok) console.error("❌ Hata:", data.error);
        })
        .catch(err => console.error("❌ API Bağlantı Hatası:", err))
        .finally(() => {
            // 5 saniye sonra kilidi açıyoruz ki yeni kanal açabilesin
            setTimeout(() => {
                beko_kilit = false;
                console.log("🔓 Kilit açıldı, şimdi yeni kanal seçebilirsin.");
            }, 5000);
        });
}
function goBack() {
    if (currentView === "episodes") openGroups("series"); // Bölümlerden dizi kategorisine dön
    else if (currentView === "channels") openGroups(currentType);
    else if (currentView === "groups") renderHome();
    else window.location.href = "/";
}

function filterList() {
    const q = document.getElementById("searchBox").value.toLowerCase();
    document.querySelectorAll(".list-ch").forEach(el => {
        el.style.display = el.getAttribute("data-name").includes(q) ? "" : "none";
    });
}

function copyLink(url) {
    navigator.clipboard.writeText(url);
    alert("Kopyalandı!");
}



