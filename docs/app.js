// X-GROWTH 作战指挥中心 · v2 · 渲染逻辑

const REPO_EDIT_URL = "https://github.com/chiang126126/x-growth/edit/main/docs/data.json";
const FOLLOWER_TARGET = 8000;

const PILLAR_LABEL = { WTF: "🤪 WTF", LIST: "📋 LIST", HOOK: "💔 HOOK" };
const PILLAR_COLOR = { WTF: "#f59e0b", LIST: "#6366f1", HOOK: "#f43f5e" };

document.getElementById("edit-link").href = REPO_EDIT_URL;

// Chart.js 暗色主题
Chart.defaults.color = "#94a3b8";
Chart.defaults.borderColor = "#232a3d";
Chart.defaults.font.family = "Inter, sans-serif";

fetch("data.json?t=" + Date.now())
  .then(r => r.json())
  .then(render)
  .catch(err => {
    document.getElementById("updated-at").textContent = "读取失败: " + err.message;
  });

function render(data) {
  data.posts = data.posts || [];
  data.daily = (data.daily || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  data.pipeline = data.pipeline || [];

  const last = data.daily[data.daily.length - 1] || {};
  const totalFollowers = (last.x_followers || 0) + (last.xhs_followers || 0);
  const today = new Date().toISOString().slice(0, 10);
  const startDate = data.daily[0]?.date || today;
  const dayN = Math.max(1, Math.floor((new Date(today) - new Date(startDate)) / 86400000) + 1);

  document.getElementById("updated-at").textContent = data.meta?.updated_at || "--";
  document.getElementById("day-current").textContent = String(dayN).padStart(2, "0");

  // ── TIER 1 ──────────────────────────────────────
  document.getElementById("ns-followers").textContent = fmt(totalFollowers);
  const pct = (totalFollowers / FOLLOWER_TARGET) * 100;
  document.getElementById("ns-progress").style.width = Math.min(pct, 100) + "%";
  document.getElementById("ns-pct").textContent = pct.toFixed(2) + "%";
  document.getElementById("ns-remaining").textContent = fmt(Math.max(0, FOLLOWER_TARGET - totalFollowers));

  renderMission(data, today);
  renderTempo(data, today);

  // ── TIER 2 ──────────────────────────────────────
  renderKPIs(data);

  // ── TIER 3 ──────────────────────────────────────
  renderTimeline(data, today);

  // ── TIER 4 ──────────────────────────────────────
  renderCharts(data);

  // ── TIER 5 ──────────────────────────────────────
  renderTopFlop(data);
  renderPostsTable(data);
}

// ── TIER 1 · Mission ──────────────────────────────────────
function renderMission(data, today) {
  const el = document.getElementById("today-mission");
  const items = [];

  const todayPlan = data.pipeline.filter(p => (p.plan_date || "").startsWith(today));
  const todayPosted = data.posts.filter(p => (p.published_at || "").startsWith(today));
  const todaySnap = data.daily.find(d => d.date === today);
  const needData = data.posts.filter(p => {
    const h = (Date.now() - new Date(p.published_at).getTime()) / 3600000;
    return h >= 24 && h <= 96 && !p.metrics?.imp_24h;
  });

  if (todayPlan.length) {
    items.push(missionItem("📤", `待发 <strong>${todayPlan.length}</strong> 条 · ${todayPlan[0].plan_date.slice(11, 16)}`));
  }
  if (todayPosted.length) {
    items.push(missionItem("✅", `已发 <strong>${todayPosted.length}</strong> 条 — 等待数据回流`));
  }
  if (needData.length) {
    items.push(missionItem("⏰", `<strong>${needData.length}</strong> 条已过 24h，去填 imp_24h`));
  }
  if (!todaySnap) {
    items.push(missionItem("📊", `22:00 加 daily 快照（粉丝/曝光）`));
  } else {
    items.push(missionItem("📈", `已填快照 — X +${last7Delta(data.daily, "x_followers")} 粉 / 7日`));
  }
  if (!todayPlan.length && !todayPosted.length) {
    items.push(missionItem("⚠️", `今日空档 — 去 pipeline 加排期`));
  }

  el.innerHTML = items.join("");
}

function missionItem(icon, text) {
  return `<div class="mission-item"><span class="mission-icon">${icon}</span><div class="mission-text">${text}</div></div>`;
}

function last7Delta(daily, key) {
  if (daily.length < 2) return 0;
  const last = daily[daily.length - 1]?.[key] || 0;
  const prev = daily[Math.max(0, daily.length - 8)]?.[key] || 0;
  return last - prev;
}

// ── TIER 1 · Tempo ──────────────────────────────────────
function renderTempo(data, today) {
  const wkStart = new Date();
  const dow = wkStart.getDay() || 7;
  wkStart.setDate(wkStart.getDate() - (dow - 1));

  const labels = ["一", "二", "三", "四", "五", "六", "日"];
  let weekPostCount = 0;
  const html = labels.map((lbl, i) => {
    const d = new Date(wkStart);
    d.setDate(wkStart.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const posted = data.posts.some(p => (p.published_at || "").startsWith(ds));
    const planned = data.pipeline.some(p => (p.plan_date || "").startsWith(ds));
    const isToday = ds === today;
    if (posted) weekPostCount++;
    let cls = "tempo-day";
    if (posted) cls += " posted";
    else if (planned) cls += " planned";
    if (isToday) cls += " today";
    return `<div class="${cls}" title="${ds}">${lbl}</div>`;
  }).join("");
  document.getElementById("tempo-week").innerHTML = html;
  document.getElementById("week-posts").textContent = weekPostCount;

  // streak: 从今天往前数连续发布的天数
  let streak = 0;
  const sortedDates = data.daily.slice().sort((a, b) => b.date.localeCompare(a.date));
  for (const d of sortedDates) {
    const posted = data.posts.some(p => (p.published_at || "").startsWith(d.date));
    if (posted) streak++;
    else break;
  }
  document.getElementById("streak").textContent = streak;
}

// ── TIER 2 · KPI ──────────────────────────────────────
function renderKPIs(data) {
  const last = data.daily[data.daily.length - 1] || {};
  const prev = data.daily[data.daily.length - 8] || {};
  const last14X = data.daily.slice(-14).map(d => d.x_followers || 0);
  const last14XHS = data.daily.slice(-14).map(d => d.xhs_followers || 0);
  const last14Imp = data.daily.slice(-14).map(d => (d.x_impressions || 0) + (d.xhs_impressions || 0));

  setKPI("kpi-x", "X FOLLOWERS", last.x_followers, deltaStr(last.x_followers, prev.x_followers), last14X, "#ffffff");
  setKPI("kpi-xhs", "XHS FOLLOWERS", last.xhs_followers, deltaStr(last.xhs_followers, prev.xhs_followers), last14XHS, "#FE2C55");

  const recent = data.posts.filter(p => p.metrics?.imp_24h > 0).slice(-10);
  const avgEng = recent.length ? recent.reduce((s, p) => s + engagement(p), 0) / recent.length : 0;
  const engCls = avgEng >= 5 ? "up" : avgEng >= 3 ? "flat" : avgEng > 0 ? "down" : "flat";
  const engNote = avgEng >= 5 ? "↑ 优秀 ≥5%" : avgEng >= 3 ? "· 良好 ≥3%" : avgEng > 0 ? "↓ 待提升" : "无数据";
  setKPIRaw("kpi-eng", "ENGAGEMENT RATE", avgEng ? avgEng.toFixed(2) + "%" : "—", engNote, engCls);

  const totalImp = last14Imp.reduce((s, n) => s + n, 0) * (30 / Math.max(1, last14Imp.length));
  setKPI("kpi-imp", "30D IMPRESSIONS", fmt(totalImp), "30日预估", last14Imp, "#6366f1", "flat");
}

function setKPI(id, label, value, delta, sparkData, color, forceCls) {
  const cls = forceCls || (typeof delta === "string" && delta.includes("↑") ? "up" : delta && delta.includes("↓") ? "down" : "flat");
  document.getElementById(id).innerHTML = `
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value ?? "—"}</div>
    <div class="kpi-delta ${cls}">${delta || "—"}</div>
    <canvas class="kpi-spark" id="${id}-spark"></canvas>`;
  if (sparkData && sparkData.length > 1) {
    setTimeout(() => drawSpark(`${id}-spark`, sparkData, color), 0);
  }
}

function setKPIRaw(id, label, value, delta, cls) {
  document.getElementById(id).innerHTML = `
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-delta ${cls}">${delta}</div>`;
}

function drawSpark(cid, data, color) {
  const el = document.getElementById(cid);
  if (!el) return;
  new Chart(el, {
    type: "line",
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data, borderColor: color, backgroundColor: color + "20",
        borderWidth: 2, pointRadius: 0, tension: 0.35, fill: true,
      }],
    },
    options: {
      responsive: false, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false, beginAtZero: false } },
    },
  });
}

function deltaStr(curr, prev) {
  if (curr == null || prev == null) return "无对比";
  const diff = curr - prev;
  if (diff === 0) return "· 持平 / 7日";
  return `${diff > 0 ? "↑ +" : "↓ "}${Math.abs(diff)} · 7日`;
}

// ── TIER 3 · Timeline ──────────────────────────────────────
function renderTimeline(data, today) {
  const el = document.getElementById("timeline");
  const rows = [];

  // 今日待发
  const todayPlan = data.pipeline.filter(p => (p.plan_date || "").startsWith(today))
    .sort((a, b) => a.plan_date.localeCompare(b.plan_date));
  todayPlan.forEach(p => rows.push(timelineRow("NOW", "tag-now", `T+0 · ${p.plan_date.slice(11, 16)}`, p)));

  // 未来 5 条
  const future = data.pipeline.filter(p => (p.plan_date || "").slice(0, 10) > today)
    .sort((a, b) => a.plan_date.localeCompare(b.plan_date)).slice(0, 5);
  future.forEach(p => {
    const days = Math.round((new Date(p.plan_date.slice(0, 10)) - new Date(today)) / 86400000);
    rows.push(timelineRow("NEXT", "tag-next", `T+${days}d · ${p.plan_date.slice(11, 16)}`, p));
  });

  // 最近 2 条已发
  const recent = data.posts.slice().sort((a, b) => (b.published_at || "").localeCompare(a.published_at || "")).slice(0, 2);
  recent.forEach(p => {
    const h = Math.round((Date.now() - new Date(p.published_at).getTime()) / 3600000);
    const right = !p.metrics?.imp_24h ? "等待数据" : `${fmt(p.metrics.imp_24h)} imp`;
    rows.push(timelineRow("PAST", "tag-past", `T−${h}h`, p, right));
  });

  if (!rows.length) {
    rows.push(`<div class="timeline-row"><div class="timeline-stamp">--</div><div><div class="timeline-title">时间线为空</div><div class="timeline-meta">去 pipeline 加排期</div></div><div></div></div>`);
  }
  el.innerHTML = rows.join("");
}

function timelineRow(tag, tagCls, stamp, item, right = "") {
  return `
    <div class="timeline-row">
      <div class="timeline-stamp"><span class="tag ${tagCls}">${tag}</span>${stamp}</div>
      <div>
        <div class="timeline-title">${item.title}</div>
        <div class="timeline-meta">${pillTag(item.platform)} ${pillarTag(item.pillar)}</div>
      </div>
      <div class="timeline-right">${right}</div>
    </div>`;
}

// ── TIER 4 · Charts ──────────────────────────────────────
function renderCharts(data) {
  const last30 = data.daily.slice(-30);
  new Chart(document.getElementById("chart-followers"), {
    type: "line",
    data: {
      labels: last30.map(d => d.date.slice(5)),
      datasets: [
        lineDataset("X", last30.map(d => d.x_followers), "#ffffff"),
        lineDataset("小红书", last30.map(d => d.xhs_followers), "#FE2C55"),
      ],
    },
    options: chartOpts(),
  });

  const counts = { WTF: 0, LIST: 0, HOOK: 0 };
  data.posts.forEach(p => { if (p.pillar in counts) counts[p.pillar]++; });
  new Chart(document.getElementById("chart-pillar"), {
    type: "doughnut",
    data: {
      labels: Object.keys(counts).map(k => `${PILLAR_LABEL[k]} (${counts[k]})`),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: Object.keys(counts).map(k => PILLAR_COLOR[k]),
        borderColor: "#131826", borderWidth: 3,
      }],
    },
    options: { ...chartOpts(), cutout: "62%", plugins: { ...chartOpts().plugins, legend: { position: "bottom", labels: { boxWidth: 10, padding: 10, font: { size: 11 } } } }, scales: {} },
  });

  const last14 = data.daily.slice(-14);
  new Chart(document.getElementById("chart-impressions"), {
    type: "bar",
    data: {
      labels: last14.map(d => d.date.slice(5)),
      datasets: [
        { label: "X", data: last14.map(d => d.x_impressions || 0), backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 3 },
        { label: "小红书", data: last14.map(d => d.xhs_impressions || 0), backgroundColor: "#FE2C55", borderRadius: 3 },
      ],
    },
    options: { ...chartOpts(), scales: { x: { stacked: true, ticks: { color: "#94a3b8" }, grid: { display: false } }, y: { stacked: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(35,42,61,0.5)" } } } },
  });

  const recent = data.posts.filter(p => p.metrics?.imp_24h > 0).slice(-15);
  new Chart(document.getElementById("chart-engagement"), {
    type: "line",
    data: {
      labels: recent.map(p => p.published_at.slice(5, 10)),
      datasets: [lineDataset("互动率%", recent.map(p => +engagement(p).toFixed(2)), "#6366f1")],
    },
    options: chartOpts(),
  });
}

function lineDataset(label, data, color) {
  return {
    label, data,
    borderColor: color,
    backgroundColor: color + "20",
    tension: 0.35, fill: true, borderWidth: 2.5,
    pointRadius: 3, pointHoverRadius: 5,
    pointBackgroundColor: color, pointBorderColor: "#131826", pointBorderWidth: 1.5,
  };
}

function chartOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: { labels: { color: "#94a3b8", boxWidth: 10, font: { size: 11 } } },
      tooltip: {
        backgroundColor: "#1a2030", borderColor: "#6366f1", borderWidth: 1,
        padding: 10, titleColor: "#e2e8f0", bodyColor: "#94a3b8",
        cornerRadius: 6, displayColors: true, boxPadding: 4,
      },
    },
    scales: {
      x: { ticks: { color: "#94a3b8", font: { size: 11 } }, grid: { color: "rgba(35,42,61,0.5)", drawBorder: false } },
      y: { ticks: { color: "#94a3b8", font: { size: 11 } }, grid: { color: "rgba(35,42,61,0.5)", drawBorder: false } },
    },
  };
}

// ── TIER 5 · Details ──────────────────────────────────────
function renderTopFlop({ posts }) {
  const scored = posts.filter(p => p.metrics?.imp_24h > 0).map(p => ({ ...p, eng: engagement(p) }));
  const top = [...scored].sort((a, b) => b.eng - a.eng).slice(0, 5);
  const flop = [...scored].sort((a, b) => a.eng - b.eng).slice(0, 5);
  document.getElementById("top-posts").innerHTML = top.length ? top.map(postRow).join("")
    : `<div class="empty">发了几条 + 填了 imp_24h 后会出现</div>`;
  document.getElementById("flop-posts").innerHTML = flop.length ? flop.map(postRow).join("")
    : `<div class="empty">数据不足</div>`;
}

function postRow(p) {
  return `
    <div class="post-row">
      <div class="post-title-cell"><a href="${p.url || "#"}" target="_blank">${p.title}</a></div>
      <div class="post-meta">${fmt(p.metrics.imp_24h)} imp · <b>${p.eng.toFixed(1)}%</b></div>
    </div>`;
}

function renderPostsTable({ posts }) {
  const t = document.getElementById("posts-table");
  const sorted = posts.slice().sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  t.innerHTML = `
    <thead><tr>
      <th>DATE</th><th>TITLE</th><th>PLAT</th><th>PILLAR</th>
      <th class="num">IMP</th><th class="num">ENG</th><th class="num">+F</th><th>RATE</th>
    </tr></thead>
    <tbody>${sorted.map(p => `
      <tr>
        <td class="dim">${(p.published_at || "—").slice(0, 10)}</td>
        <td><a href="${p.url || "#"}" target="_blank">${p.title}</a></td>
        <td>${pillTag(p.platform)}</td>
        <td>${pillarTag(p.pillar)}</td>
        <td class="num">${fmt(p.metrics?.imp_24h)}</td>
        <td class="num">${p.metrics?.imp_24h ? engagement(p).toFixed(1) + "%" : "—"}</td>
        <td class="num">${p.metrics?.follower_gain ?? "—"}</td>
        <td>${ratingTag(p.rating)}</td>
      </tr>`).join("")}</tbody>`;
}

// ── 工具 ──────────────────────────────────────
function pillTag(p) {
  if (p === "X") return `<span class="pill pill-x">X</span>`;
  if (p === "小红书") return `<span class="pill pill-xhs">XHS</span>`;
  return "";
}
function pillarTag(p) {
  if (!p) return "";
  return `<span class="pill pill-${p.toLowerCase()}">${PILLAR_LABEL[p] || p}</span>`;
}
function ratingTag(r) {
  if (r === "爆款") return `<span class="pill pill-bao">⭐ HIT</span>`;
  if (r === "哑火") return `<span class="pill pill-flop">💩 FLOP</span>`;
  if (r === "中规中矩") return `<span class="pill pill-mid">MID</span>`;
  return `<span class="pill pill-mid">—</span>`;
}
function engagement(p) {
  const m = p.metrics || {};
  const imp = m.imp_24h || 0;
  if (!imp) return 0;
  return ((m.likes || 0) + (m.reposts || 0) + (m.replies || 0)) / imp * 100;
}
function fmt(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(Math.round(n));
}
