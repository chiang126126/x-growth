// X-Growth 运营看板 · 渲染逻辑
// 数据源: data.json（单一文件，你每天编它）

const REPO_EDIT_URL = "https://github.com/chiang126126/x-growth/edit/main/docs/data.json";

const PILLAR_LABEL = { WTF: "🤪 WTF猎奇", LIST: "📋 LIST清单", HOOK: "💔 HOOK情绪" };
const PILLAR_COLOR = { WTF: "#f59e0b", LIST: "#3b82f6", HOOK: "#f43f5e" };

document.getElementById("edit-link").href = REPO_EDIT_URL;

fetch("data.json?t=" + Date.now())
  .then(r => r.json())
  .then(render)
  .catch(err => {
    document.getElementById("updated-at").textContent = "⚠️ 读取 data.json 失败：" + err.message;
  });

function render(data) {
  data.posts = data.posts || [];
  data.daily = (data.daily || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  data.pipeline = data.pipeline || [];

  document.getElementById("updated-at").textContent =
    `更新于 ${data.meta?.updated_at || "—"} · 已发 ${data.posts.length} 条 · 待发 ${data.pipeline.filter(p=>p.status==="待发").length} 条`;

  renderKPIs(data);
  renderToday(data);
  renderUpcoming(data);
  renderChartFollowers(data);
  renderChartPillar(data);
  renderChartImpressions(data);
  renderChartEngagement(data);
  renderTopFlop(data);
  renderPostsTable(data);
}

// ── KPI 卡片 ───────────────────────────────────────────────────────────────
function renderKPIs({ daily, posts }) {
  const last = daily[daily.length - 1] || {};
  const prev7 = daily[daily.length - 8] || {};

  // X 粉丝
  setKPI("kpi-x", "X 粉丝", last.x_followers, delta(last.x_followers, prev7.x_followers), "📱");
  // 小红书粉丝
  setKPI("kpi-xhs", "小红书粉丝", last.xhs_followers, delta(last.xhs_followers, prev7.xhs_followers), "📕");

  // 30 天总曝光
  const last30 = daily.slice(-30);
  const totalImp = last30.reduce((s, d) => s + (d.x_impressions || 0) + (d.xhs_impressions || 0), 0);
  setKPI("kpi-imp", "30天总曝光", fmt(totalImp), `${last30.length} 天数据`, "📊", "flat");

  // 7 天平均互动率
  const recent = posts.filter(p => p.metrics?.imp_24h > 0).slice(-10);
  const avgEng = recent.length
    ? recent.reduce((s, p) => s + engagement(p), 0) / recent.length
    : 0;
  setKPI("kpi-eng", "近10条平均互动率", avgEng.toFixed(2) + "%", "≥3% 良好 / ≥5% 优秀", "⚡",
    avgEng >= 5 ? "up" : avgEng >= 3 ? "flat" : "down");
}

function setKPI(id, label, value, delta, emoji, deltaCls) {
  const el = document.getElementById(id);
  el.innerHTML = `
    <div class="kpi-label">${emoji} ${label}</div>
    <div class="kpi-value">${value ?? "—"}</div>
    <div class="kpi-delta ${deltaCls || (typeof delta === "string" && delta.includes("+") ? "up" : delta && delta.includes("-") ? "down" : "flat")}">
      ${delta || "—"}
    </div>`;
}

function delta(curr, prev) {
  if (curr == null || prev == null) return "无对比";
  const diff = curr - prev;
  const pct = prev ? ((diff / prev) * 100).toFixed(1) : "—";
  return `${diff >= 0 ? "↑ +" : "↓ "}${Math.abs(diff)} (${pct}%) · 7日`;
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
  return String(n);
}

// ── 今日 + 未来 ─────────────────────────────────────────────────────────────
function renderToday({ pipeline, posts, daily }) {
  const today = new Date().toISOString().slice(0, 10);
  const el = document.getElementById("today-actions");

  const todayPlan = pipeline.filter(p => (p.plan_date || "").startsWith(today));
  const todayPosted = posts.filter(p => (p.published_at || "").startsWith(today));
  const todaySnap = daily.find(d => d.date === today);

  const items = [];

  if (todayPlan.length) {
    items.push(`<div class="alert alert-info">📤 今天计划发 ${todayPlan.length} 条：<br>${todayPlan.map(p => `· <b>${p.title}</b> @ ${p.plan_date.slice(11,16) || "—"} ${pillTag(p.platform)}`).join("<br>")}</div>`);
  } else {
    items.push(`<div class="alert alert-warn">⚠️ 今天 pipeline 里没有排期 — 去 data.json 加 1 条</div>`);
  }

  if (todayPosted.length) {
    items.push(`<div class="alert alert-ok">✅ 今天已发 ${todayPosted.length} 条 — ${todayPosted.map(p => p.title).join(" · ")}</div>`);
  }

  if (!todaySnap) {
    items.push(`<div class="alert alert-warn">📝 今天还没填日快照 — 22:00 记得加 daily[] 一行</div>`);
  } else {
    items.push(`<div class="alert alert-ok">📊 日快照已填：X ${todaySnap.x_followers} 粉 / 小红书 ${todaySnap.xhs_followers} 粉</div>`);
  }

  // 缺数据提醒：24h+ 已发但没有 imp_24h
  const need = posts.filter(p => {
    const hours = (Date.now() - new Date(p.published_at).getTime()) / 3600000;
    return hours >= 24 && hours <= 72 && !p.metrics?.imp_24h;
  });
  if (need.length) {
    items.push(`<div class="alert alert-warn">⏰ ${need.length} 条已过 24h 但没填数据：${need.map(p => p.title).join(" · ")}</div>`);
  }

  el.innerHTML = items.join("");
}

function renderUpcoming({ pipeline }) {
  const today = new Date().toISOString().slice(0, 10);
  const wk = new Date(); wk.setDate(wk.getDate() + 7);
  const wkStr = wk.toISOString().slice(0, 10);

  const upcoming = pipeline
    .filter(p => p.plan_date && p.plan_date.slice(0, 10) >= today && p.plan_date.slice(0, 10) <= wkStr)
    .sort((a, b) => a.plan_date.localeCompare(b.plan_date));

  const el = document.getElementById("upcoming");
  if (!upcoming.length) {
    el.innerHTML = `<div class="text-sm text-slate-500">未来 7 天没有排期。<br>👉 去 <a href="${REPO_EDIT_URL}" target="_blank" class="text-indigo-600">data.json</a> 添加。</div>`;
    return;
  }
  el.innerHTML = upcoming.map(p => `
    <div class="post-row">
      <div class="post-title">${p.title}</div>
      <div class="post-stat">${p.plan_date.slice(5, 16)} ${pillTag(p.platform)} ${pillarTag(p.pillar)}</div>
    </div>
  `).join("");
}

// ── 图表 ──────────────────────────────────────────────────────────────────
function renderChartFollowers({ daily }) {
  const last = daily.slice(-30);
  new Chart(document.getElementById("chart-followers"), {
    type: "line",
    data: {
      labels: last.map(d => d.date.slice(5)),
      datasets: [
        { label: "X", data: last.map(d => d.x_followers), borderColor: "#0f172a", backgroundColor: "rgba(15,23,42,0.1)", tension: 0.3, fill: true },
        { label: "小红书", data: last.map(d => d.xhs_followers), borderColor: "#f43f5e", backgroundColor: "rgba(244,63,94,0.1)", tension: 0.3, fill: true },
      ],
    },
    options: chartOpts(),
  });
}

function renderChartPillar({ posts }) {
  const counts = { WTF: 0, LIST: 0, HOOK: 0 };
  posts.forEach(p => { if (p.pillar in counts) counts[p.pillar]++; });
  new Chart(document.getElementById("chart-pillar"), {
    type: "doughnut",
    data: {
      labels: Object.keys(counts).map(k => `${PILLAR_LABEL[k]} (${counts[k]})`),
      datasets: [{ data: Object.values(counts), backgroundColor: Object.keys(counts).map(k => PILLAR_COLOR[k]) }],
    },
    options: { ...chartOpts(), plugins: { legend: { position: "bottom" } } },
  });
}

function renderChartImpressions({ daily }) {
  const last = daily.slice(-14);
  new Chart(document.getElementById("chart-impressions"), {
    type: "bar",
    data: {
      labels: last.map(d => d.date.slice(5)),
      datasets: [
        { label: "X", data: last.map(d => d.x_impressions), backgroundColor: "#0f172a" },
        { label: "小红书", data: last.map(d => d.xhs_impressions), backgroundColor: "#f43f5e" },
      ],
    },
    options: { ...chartOpts(), scales: { x: { stacked: true }, y: { stacked: true } } },
  });
}

function renderChartEngagement({ posts }) {
  const recent = posts.filter(p => p.metrics?.imp_24h > 0).slice(-15);
  new Chart(document.getElementById("chart-engagement"), {
    type: "line",
    data: {
      labels: recent.map(p => p.published_at.slice(5, 10)),
      datasets: [{
        label: "互动率%",
        data: recent.map(p => engagement(p).toFixed(2)),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.1)",
        tension: 0.3, fill: true,
      }],
    },
    options: chartOpts(),
  });
}

function chartOpts() {
  return { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: "index" } };
}

// ── Top / Flop ─────────────────────────────────────────────────────────────
function renderTopFlop({ posts }) {
  const scored = posts.filter(p => p.metrics?.imp_24h > 0)
    .map(p => ({ ...p, eng: engagement(p) }));

  const top = [...scored].sort((a, b) => b.eng - a.eng).slice(0, 5);
  const flop = [...scored].sort((a, b) => a.eng - b.eng).slice(0, 5);

  document.getElementById("top-posts").innerHTML = top.length
    ? top.map(rowFor).join("")
    : `<div class="text-slate-500">还没数据。发了几条 + 填了 imp_24h 后会出现。</div>`;

  document.getElementById("flop-posts").innerHTML = flop.length
    ? flop.map(rowFor).join("")
    : `<div class="text-slate-500">数据不足</div>`;
}

function rowFor(p) {
  return `
    <div class="post-row">
      <div class="post-title">
        <a href="${p.url || "#"}" target="_blank" class="hover:underline">${p.title}</a>
      </div>
      <div class="post-stat">
        ${pillTag(p.platform)} ${pillarTag(p.pillar)}
        · ${fmt(p.metrics.imp_24h)} imp
        · <b>${p.eng.toFixed(1)}%</b> 互动
      </div>
    </div>`;
}

// ── 全表 ───────────────────────────────────────────────────────────────────
function renderPostsTable({ posts }) {
  const t = document.getElementById("posts-table");
  const sorted = posts.slice().sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  t.innerHTML = `
    <thead><tr>
      <th>日期</th><th>标题</th><th>平台</th><th>柱</th>
      <th class="text-right">曝光</th><th class="text-right">互动率</th><th class="text-right">涨粉</th><th>评分</th>
    </tr></thead>
    <tbody>
      ${sorted.map(p => `
        <tr>
          <td class="whitespace-nowrap">${(p.published_at || "—").slice(0, 10)}</td>
          <td><a href="${p.url || "#"}" target="_blank" class="text-indigo-600 hover:underline">${p.title}</a></td>
          <td>${pillTag(p.platform)}</td>
          <td>${pillarTag(p.pillar)}</td>
          <td class="text-right">${fmt(p.metrics?.imp_24h)}</td>
          <td class="text-right">${p.metrics?.imp_24h ? engagement(p).toFixed(1) + "%" : "—"}</td>
          <td class="text-right">${p.metrics?.follower_gain ?? "—"}</td>
          <td>${ratingTag(p.rating)}</td>
        </tr>`).join("")}
    </tbody>`;
}

function pillTag(p) {
  return p === "X" ? `<span class="pill pill-x">X</span>` :
         p === "小红书" ? `<span class="pill pill-xhs">小红书</span>` : "";
}

function pillarTag(p) {
  if (!p) return "";
  return `<span class="pill pill-${p.toLowerCase()}">${PILLAR_LABEL[p] || p}</span>`;
}

function ratingTag(r) {
  if (r === "爆款") return `<span class="pill pill-list">⭐ 爆款</span>`;
  if (r === "哑火") return `<span class="pill pill-hook">💩 哑火</span>`;
  if (r === "中规中矩") return `<span class="pill bg-slate-100 text-slate-600">中规中矩</span>`;
  return "—";
}
