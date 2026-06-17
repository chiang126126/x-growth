// X-GROWTH 作战指挥中心 · v4
// 新增：AI 周复盘 prompt 生成 / 复制 / 打开 Claude / Toast 提示

const REPO_EDIT_URL = "https://github.com/chiang126126/x-growth/edit/main/docs/data.json";
const FOLLOWER_TARGET = 8000;
const CLAUDE_URL = "https://claude.ai/new";

const PILLAR_LABEL = { WTF: "🤪 WTF", LIST: "📋 LIST", HOOK: "💔 HOOK" };
const PILLAR_COLOR = { WTF: "#f59e0b", LIST: "#6366f1", HOOK: "#f43f5e" };

document.getElementById("edit-link").href = REPO_EDIT_URL;
document.getElementById("ai-review-btn").addEventListener("click", openPromptModal);

Chart.defaults.color = "#94a3b8";
Chart.defaults.borderColor = "#232a3d";
Chart.defaults.font.family = "Inter, sans-serif";

let DATA = null;  // 缓存数据供 AI 复盘 button 使用

fetch("data.json?t=" + Date.now())
  .then(r => r.json())
  .then(d => { DATA = d; render(d); })
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
  animateNumber(document.getElementById("day-current"), dayN, 800, n => String(n).padStart(2, "0"));

  animateNumber(document.getElementById("ns-followers"), totalFollowers, 1800, fmt);
  const pct = (totalFollowers / FOLLOWER_TARGET) * 100;
  setTimeout(() => { document.getElementById("ns-progress").style.width = Math.min(pct, 100) + "%"; }, 200);
  animateNumber(document.getElementById("ns-pct"), pct, 1500, n => n.toFixed(2) + "%");
  animateNumber(document.getElementById("ns-remaining"), Math.max(0, FOLLOWER_TARGET - totalFollowers), 1500, fmt);

  renderMission(data, today);
  renderTempo(data, today);
  renderKPIs(data);
  renderTimeline(data, today);
  renderCharts(data);
  renderTopFlop(data);
  renderPostsTable(data);
  evaluateAllStatus(data, totalFollowers);
}

// ═══════════════════════════════════════════════════════════════
//  AI 周复盘 prompt 生成
// ═══════════════════════════════════════════════════════════════
function generateWeeklyReviewPrompt(data) {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const weekDaily = data.daily.filter(d => d.date >= weekAgoStr);
  const weekPosts = data.posts.filter(p => p.published_at >= weekAgoStr);
  const upcomingPipeline = data.pipeline.filter(p => {
    const d = (p.plan_date || "").slice(0, 10);
    return d >= todayStr && d <= nextWeekStr;
  });

  const last = data.daily[data.daily.length - 1] || {};
  const totalFollowers = (last.x_followers || 0) + (last.xhs_followers || 0);
  const startDate = data.daily[0]?.date || todayStr;
  const dayN = Math.max(1, Math.floor((today - new Date(startDate)) / 86400000) + 1);

  const dailyTable = weekDaily.length
    ? weekDaily.map(d => `| ${d.date} | ${d.x_followers ?? "-"} | ${d.xhs_followers ?? "-"} | ${d.x_impressions ?? "-"} | ${d.xhs_impressions ?? "-"} | ${d.posts_today ?? 0} | ${d.log || "-"} |`).join("\n")
    : "| (本周还没有日快照) |";

  const postsList = weekPosts.length
    ? weekPosts.map(p => {
        const m = p.metrics || {};
        const eng = m.imp_24h ? (((m.likes||0)+(m.reposts||0)+(m.replies||0))/m.imp_24h*100).toFixed(2) : "—";
        return `- **${p.title}** (${p.platform} · ${p.pillar || "—"})
  - 发布: ${p.published_at?.slice(0,16) || "—"}
  - 数据: imp_24h=${m.imp_24h ?? "未填"} · 赞=${m.likes ?? "—"} · 转=${m.reposts ?? "—"} · 评=${m.replies ?? "—"} · 收藏=${m.saves ?? "—"}
  - 互动率: ${eng}% · 涨粉: ${m.follower_gain ?? "—"} · Profile点击: ${m.profile_clicks ?? "—"}
  - 评分: ${p.rating || "—"} · 链接: ${p.url || "—"}`;
      }).join("\n\n")
    : "(本周没有已发布内容)";

  const upcomingList = upcomingPipeline.length
    ? upcomingPipeline.map(p => `- ${p.plan_date?.slice(0,16)} · ${p.title} (${p.platform} · ${p.pillar || "—"})`).join("\n")
    : "(下周没有排期)";

  return `你是 X-Growth 账号的资深运营顾问。我做的是【海外离谱搞钱案例】中文双平台（X + 小红书）账号。
账号定位：扒 Indie Hackers / Starter Story / Reddit 等海外源的真实「蠢生意 / 反常案例」，用「卧槽这也行」的猎奇感引流。
内容三柱：WTF(60%) / LIST(25%) / HOOK(15%)。北极星：90 天 8,000 粉。

下面是 ${weekAgoStr} 到 ${todayStr} 的真实数据。请基于数据生成本周复盘——要直接、有数字支撑、能立刻执行，**不要写废话**。

═══════════════════════════════════════════
## 当前态势

- Mission Day: ${dayN} / 90
- 总粉丝: ${totalFollowers} / 8,000 (${(totalFollowers/FOLLOWER_TARGET*100).toFixed(2)}%)
- 当前 X 粉: ${last.x_followers ?? "—"} · 小红书粉: ${last.xhs_followers ?? "—"}

## 本周每日快照

| 日期 | X粉丝 | XHS粉丝 | X曝光 | XHS曝光 | 发布数 | 日志 |
|---|---|---|---|---|---|---|
${dailyTable}

## 本周已发布内容（${weekPosts.length} 条）

${postsList}

## 下周已排期（${upcomingPipeline.length} 条）

${upcomingList}

═══════════════════════════════════════════
## 请按下面结构输出（中文 markdown）

### 📊 数字盘点
- 本周净涨粉：X +N / XHS +N（基于快照算）
- 平均互动率：X.X%（满分 5%+ 优秀）
- 平均曝光：X
- 内容柱实际配比 vs 目标 60/25/15 偏差多少
- 节奏：本周发了 N 条，密度评估

### 🔥 本周 TOP 3 帖 + 归因
对每条 TOP，给出：
- 数字（imp / 互动率 / 涨粉）
- **为什么爆**（基于内容柱、钩子、发布时间、话题敏感度的归因分析）
- 1 句话可复制的爆款模式

### 💩 本周哑火 / 警示帖
对每条哑火（互动率 < 1% 或 imp 异常低）：
- 数字
- **可能原因**（钩子弱？时段？话题过冷？）
- 1 句话修复建议

### 💡 3 个赢点（继续做）
具体行为，不是口号。例如「周三 21:00 发 LIST 体在本周表现最强，下周固定这个时段」

### ⚠️ 3 个坑（下周不犯）
具体到行为。例如「连续 3 条 WTF 后用户疲劳，互动率从 X% 跌到 Y%，下周必须穿插 1 条 LIST」

### 🎯 下周 3 个动作建议
有数字支撑、可立即执行。例如：
1. 必发：[具体选题方向] 在 [具体时段]，复制本周 TOP 1 的 [具体要素]
2. 必停：[具体不再做的事]
3. 必测：[1 个实验，明确的假设和成功指标]

### 📈 北极星追踪
- 当前 ${totalFollowers} / 8000 (${(totalFollowers/FOLLOWER_TARGET*100).toFixed(2)}%)
- Day ${dayN} / 90，剩 ${90 - dayN} 天
- 按本周涨粉速度，Day 90 预计能到多少？是否需要加速？怎么加速？

### 一句话本周定调
（送行用，要狠）

请直接开始输出，不要客套。`;
}

// ═══════════════════════════════════════════════════════════════
//  Modal & Clipboard
// ═══════════════════════════════════════════════════════════════
function openPromptModal() {
  if (!DATA) { showToast("数据还没加载完，稍等一下"); return; }
  const prompt = generateWeeklyReviewPrompt(DATA);
  document.getElementById("prompt-text").value = prompt;
  document.getElementById("prompt-modal").classList.add("show");
}

function closePromptModal() {
  document.getElementById("prompt-modal").classList.remove("show");
}

async function copyAndOpenClaude() {
  const text = document.getElementById("prompt-text").value;
  try {
    await navigator.clipboard.writeText(text);
    showToast("📋 已复制到剪贴板 · 正在打开 Claude…");
    setTimeout(() => { window.open(CLAUDE_URL, "_blank"); }, 600);
    setTimeout(closePromptModal, 1200);
  } catch (e) {
    // Fallback: 选中文本让用户手动复制
    const ta = document.getElementById("prompt-text");
    ta.select();
    ta.setSelectionRange(0, 999999);
    showToast("自动复制失败 · 按 ⌘C 手动复制");
  }
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// 暴露给 inline onclick
window.closePromptModal = closePromptModal;
window.copyAndOpenClaude = copyAndOpenClaude;

// 点击 modal 背景关闭
document.getElementById("prompt-modal").addEventListener("click", e => {
  if (e.target.id === "prompt-modal") closePromptModal();
});

// ═══════════════════════════════════════════════════════════════
//  以下为 v3 已有逻辑（数字滚动 / 状态灯 / 各 Tier 渲染）
// ═══════════════════════════════════════════════════════════════

function animateNumber(el, target, duration, formatter) {
  if (!el) return;
  formatter = formatter || (n => String(Math.round(n)));
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const value = start + (target - start) * eased;
    el.textContent = formatter(value);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = formatter(target);
  }
  requestAnimationFrame(tick);
}

function evaluateAllStatus(data, totalFollowers) {
  if (totalFollowers >= FOLLOWER_TARGET * 0.05) setStatus(1, "ok", "ON TRACK");
  else if (totalFollowers > 0) setStatus(1, "warn", "WARMING UP");
  else setStatus(1, "crit", "NO DATA");

  const last = data.daily[data.daily.length - 1] || {};
  const prev = data.daily[data.daily.length - 8] || {};
  const lastTotal = (last.x_followers || 0) + (last.xhs_followers || 0);
  const prevTotal = (prev.x_followers || 0) + (prev.xhs_followers || 0);
  const delta = lastTotal - prevTotal;
  if (data.daily.length < 2) setStatus(2, "warn", "NEED MORE DATA");
  else if (delta > 0) setStatus(2, "ok", `+${delta} / 7D`);
  else if (delta === 0) setStatus(2, "warn", "FLAT 7D");
  else setStatus(2, "crit", `${delta} / 7D`);

  const today = new Date().toISOString().slice(0, 10);
  const wk = new Date(); wk.setDate(wk.getDate() + 7);
  const wkStr = wk.toISOString().slice(0, 10);
  const planned = data.pipeline.filter(p => {
    const d = (p.plan_date || "").slice(0, 10);
    return d >= today && d <= wkStr;
  });
  const within48h = planned.some(p => {
    const diff = (new Date(p.plan_date) - Date.now()) / 3600000;
    return diff >= 0 && diff <= 48;
  });
  if (within48h) setStatus(3, "ok", "ON QUEUE");
  else if (planned.length > 0) setStatus(3, "warn", `${planned.length} 条 7D 内`);
  else setStatus(3, "crit", "NO QUEUE");

  const recent = data.posts.filter(p => p.metrics?.imp_24h > 0).slice(-10);
  if (!recent.length) setStatus(4, "warn", "AWAITING METRICS");
  else {
    const avgEng = recent.reduce((s, p) => s + engagement(p), 0) / recent.length;
    if (avgEng >= 3) setStatus(4, "ok", `ENG ${avgEng.toFixed(1)}%`);
    else if (avgEng >= 1) setStatus(4, "warn", `ENG ${avgEng.toFixed(1)}%`);
    else setStatus(4, "crit", `ENG ${avgEng.toFixed(1)}%`);
  }

  const n = data.posts.length;
  if (n >= 10) setStatus(5, "ok", `${n} POSTS`);
  else if (n >= 1) setStatus(5, "warn", `${n} POSTS`);
  else setStatus(5, "crit", "0 POSTS");
}

function setStatus(tier, level, text) {
  const dot = document.getElementById(`status-${tier}`);
  const txt = document.getElementById(`status-${tier}-text`);
  const icon = level === "ok" ? "✓" : level === "warn" ? "⚠" : "✗";
  dot.className = `tier-status ${level}`;
  dot.textContent = icon;
  txt.className = `tier-status-text ${level}`;
  txt.textContent = text;
}

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

  if (todayPlan.length) items.push(missionItem("📤", `待发 <strong>${todayPlan.length}</strong> 条 · ${todayPlan[0].plan_date.slice(11, 16)}`));
  if (todayPosted.length) items.push(missionItem("✅", `已发 <strong>${todayPosted.length}</strong> 条 — 等待数据回流`));
  if (needData.length) items.push(missionItem("⏰", `<strong>${needData.length}</strong> 条已过 24h，去填 imp_24h`));
  if (!todaySnap) items.push(missionItem("📊", `22:00 加 daily 快照`));
  else items.push(missionItem("📈", `已填快照 — 7日 +${last7Delta(data.daily, "x_followers")} X`));
  if (!todayPlan.length && !todayPosted.length) items.push(missionItem("⚠️", `今日空档 — 去 pipeline 加排期`));
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

function renderTempo(data, today) {
  const wkStart = new Date();
  const dow = wkStart.getDay() || 7;
  wkStart.setDate(wkStart.getDate() - (dow - 1));
  const labels = ["一", "二", "三", "四", "五", "六", "日"];
  let weekPostCount = 0;
  const html = labels.map((lbl, i) => {
    const d = new Date(wkStart); d.setDate(wkStart.getDate() + i);
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
  animateNumber(document.getElementById("week-posts"), weekPostCount, 600);

  let streak = 0;
  const sortedDates = data.daily.slice().sort((a, b) => b.date.localeCompare(a.date));
  for (const d of sortedDates) {
    const posted = data.posts.some(p => (p.published_at || "").startsWith(d.date));
    if (posted) streak++;
    else break;
  }
  animateNumber(document.getElementById("streak"), streak, 800);
}

function renderKPIs(data) {
  const last = data.daily[data.daily.length - 1] || {};
  const prev = data.daily[data.daily.length - 8] || {};
  const last14X = data.daily.slice(-14).map(d => d.x_followers || 0);
  const last14XHS = data.daily.slice(-14).map(d => d.xhs_followers || 0);
  const last14Imp = data.daily.slice(-14).map(d => (d.x_impressions || 0) + (d.xhs_impressions || 0));

  // KPI delta: 优先 7 日对比，不够则回退到首日对比
  const first = data.daily[0] || {};
  const xDelta = data.daily.length >= 8 ? deltaStr(last.x_followers, prev.x_followers, "7日")
                                        : deltaStr(last.x_followers, first.x_followers, `${data.daily.length}日`);
  const xhsDelta = data.daily.length >= 8 ? deltaStr(last.xhs_followers, prev.xhs_followers, "7日")
                                          : deltaStr(last.xhs_followers, first.xhs_followers, `${data.daily.length}日`);
  setKPI("kpi-x", "X FOLLOWERS", last.x_followers || 0, xDelta, last14X, "#ffffff");
  setKPI("kpi-xhs", "XHS FOLLOWERS", last.xhs_followers || 0, xhsDelta, last14XHS, "#FE2C55");

  const recent = data.posts.filter(p => p.metrics?.imp_24h > 0).slice(-10);
  const avgEng = recent.length ? recent.reduce((s, p) => s + engagement(p), 0) / recent.length : 0;
  const engCls = avgEng >= 5 ? "up" : avgEng >= 3 ? "flat" : avgEng > 0 ? "down" : "flat";
  const engNote = avgEng >= 5 ? "↑ 优秀 ≥5%" : avgEng >= 3 ? "· 良好 ≥3%" : avgEng > 0 ? "↓ 待提升" : "无数据";
  setKPIPercent("kpi-eng", "ENGAGEMENT RATE", avgEng, engNote, engCls);

  const total14 = last14Imp.reduce((s, n) => s + n, 0);
  const proj30 = last14Imp.length ? (total14 * 30 / last14Imp.length) : 0;
  setKPI("kpi-imp", "30D IMPRESSIONS", proj30, "30日预估", last14Imp, "#6366f1", "flat");
}

function setKPI(id, label, target, delta, sparkData, color, forceCls) {
  const cls = forceCls || (typeof delta === "string" && delta.includes("↑") ? "up" : delta && delta.includes("↓") ? "down" : "flat");
  const el = document.getElementById(id);
  el.innerHTML = `
    <div class="kpi-label">${label}</div>
    <div class="kpi-value" id="${id}-num">0</div>
    <div class="kpi-delta ${cls}">${delta || "—"}</div>
    <canvas class="kpi-spark" id="${id}-spark"></canvas>`;
  animateNumber(document.getElementById(`${id}-num`), target || 0, 1500, fmt);
  if (sparkData && sparkData.length > 1) setTimeout(() => drawSpark(`${id}-spark`, sparkData, color), 100);
}

function setKPIPercent(id, label, value, delta, cls) {
  const el = document.getElementById(id);
  el.innerHTML = `
    <div class="kpi-label">${label}</div>
    <div class="kpi-value" id="${id}-num">0%</div>
    <div class="kpi-delta ${cls}">${delta}</div>`;
  animateNumber(document.getElementById(`${id}-num`), value, 1500, n => (n || 0).toFixed(2) + "%");
}

function drawSpark(cid, data, color) {
  const el = document.getElementById(cid);
  if (!el) return;
  new Chart(el, {
    type: "line",
    data: { labels: data.map((_, i) => i), datasets: [{ data, borderColor: color, backgroundColor: color + "30", borderWidth: 2, pointRadius: 0, tension: 0.35, fill: true }] },
    options: { responsive: false, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: false } } },
  });
}

function deltaStr(curr, prev, periodLabel) {
  periodLabel = periodLabel || "7日";
  if (curr == null || prev == null) return "无对比";
  const diff = curr - prev;
  if (diff === 0) return `· 持平 / ${periodLabel}`;
  return `${diff > 0 ? "↑ +" : "↓ "}${Math.abs(diff)} · ${periodLabel}`;
}

function renderTimeline(data, today) {
  const el = document.getElementById("timeline");
  const rows = [];
  const todayPlan = data.pipeline.filter(p => (p.plan_date || "").startsWith(today)).sort((a, b) => a.plan_date.localeCompare(b.plan_date));
  todayPlan.forEach(p => rows.push(timelineRow("NOW", "tag-now", `T+0 · ${p.plan_date.slice(11, 16)}`, p)));
  const future = data.pipeline.filter(p => (p.plan_date || "").slice(0, 10) > today).sort((a, b) => a.plan_date.localeCompare(b.plan_date)).slice(0, 5);
  future.forEach(p => {
    const days = Math.round((new Date(p.plan_date.slice(0, 10)) - new Date(today)) / 86400000);
    rows.push(timelineRow("NEXT", "tag-next", `T+${days}d · ${p.plan_date.slice(11, 16)}`, p));
  });
  const recent = data.posts.slice().sort((a, b) => (b.published_at || "").localeCompare(a.published_at || "")).slice(0, 2);
  recent.forEach(p => {
    const h = Math.round((Date.now() - new Date(p.published_at).getTime()) / 3600000);
    const right = !p.metrics?.imp_24h ? "等待数据" : `${fmt(p.metrics.imp_24h)} imp`;
    rows.push(timelineRow("PAST", "tag-past", `T−${h}h`, p, right));
  });
  if (!rows.length) rows.push(`<div class="timeline-row"><div class="timeline-stamp">--</div><div><div class="timeline-title">时间线为空</div><div class="timeline-meta">去 pipeline 加排期</div></div><div></div></div>`);
  el.innerHTML = rows.join("");
}

function timelineRow(tag, tagCls, stamp, item, right = "") {
  return `<div class="timeline-row"><div class="timeline-stamp"><span class="tag ${tagCls}">${tag}</span>${stamp}</div><div><div class="timeline-title">${item.title}</div><div class="timeline-meta">${pillTag(item.platform)} ${pillarTag(item.pillar)}</div></div><div class="timeline-right">${right}</div></div>`;
}

function renderCharts(data) {
  const last30 = data.daily.slice(-30);
  new Chart(document.getElementById("chart-followers"), {
    type: "line",
    data: { labels: last30.map(d => d.date.slice(5)), datasets: [ lineDataset("X", last30.map(d => d.x_followers), "#ffffff"), lineDataset("小红书", last30.map(d => d.xhs_followers), "#FE2C55") ] },
    options: chartOpts(),
  });

  const counts = { WTF: 0, LIST: 0, HOOK: 0 };
  data.posts.forEach(p => { if (p.pillar in counts) counts[p.pillar]++; });
  new Chart(document.getElementById("chart-pillar"), {
    type: "doughnut",
    data: { labels: Object.keys(counts).map(k => `${PILLAR_LABEL[k]} (${counts[k]})`), datasets: [{ data: Object.values(counts), backgroundColor: Object.keys(counts).map(k => PILLAR_COLOR[k]), borderColor: "#131826", borderWidth: 3 }] },
    options: { ...chartOpts(), cutout: "62%", plugins: { ...chartOpts().plugins, legend: { position: "bottom", labels: { boxWidth: 10, padding: 10, font: { size: 11 } } } }, scales: {} },
  });

  const last14 = data.daily.slice(-14);
  new Chart(document.getElementById("chart-impressions"), {
    type: "bar",
    data: { labels: last14.map(d => d.date.slice(5)), datasets: [ { label: "X", data: last14.map(d => d.x_impressions || 0), backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 3 }, { label: "小红书", data: last14.map(d => d.xhs_impressions || 0), backgroundColor: "#FE2C55", borderRadius: 3 } ] },
    options: { ...chartOpts(), scales: { x: { stacked: true, ticks: { color: "#94a3b8" }, grid: { display: false } }, y: { stacked: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(35,42,61,0.5)" } } } },
  });

  const recent = data.posts.filter(p => p.metrics?.imp_24h > 0).slice(-15);
  new Chart(document.getElementById("chart-engagement"), {
    type: "line",
    data: { labels: recent.map(p => p.published_at.slice(5, 10)), datasets: [lineDataset("互动率%", recent.map(p => +engagement(p).toFixed(2)), "#6366f1")] },
    options: chartOpts(),
  });
}

function lineDataset(label, data, color) {
  return { label, data, borderColor: color, backgroundColor: color + "20", tension: 0.35, fill: true, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: color, pointBorderColor: "#131826", pointBorderWidth: 1.5 };
}

function chartOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    plugins: { legend: { labels: { color: "#94a3b8", boxWidth: 10, font: { size: 11 } } }, tooltip: { backgroundColor: "#1a2030", borderColor: "#6366f1", borderWidth: 1, padding: 10, titleColor: "#e2e8f0", bodyColor: "#94a3b8", cornerRadius: 6, displayColors: true, boxPadding: 4 } },
    scales: { x: { ticks: { color: "#94a3b8", font: { size: 11 } }, grid: { color: "rgba(35,42,61,0.5)", drawBorder: false } }, y: { ticks: { color: "#94a3b8", font: { size: 11 } }, grid: { color: "rgba(35,42,61,0.5)", drawBorder: false } } },
  };
}

function renderTopFlop({ posts }) {
  const scored = posts.filter(p => p.metrics?.imp_24h > 0).map(p => ({ ...p, eng: engagement(p) }));
  const top = [...scored].sort((a, b) => b.eng - a.eng).slice(0, 5);
  // 哑火榜只在样本 ≥ 6 条时出现，且不和 TOP 重复
  const topIds = new Set(top.map(p => p.id));
  const flop = scored.length >= 6
    ? [...scored].sort((a, b) => a.eng - b.eng).filter(p => !topIds.has(p.id)).slice(0, 5)
    : [];
  document.getElementById("top-posts").innerHTML = top.length
    ? top.map(postRow).join("")
    : `<div class="empty">发了几条 + 填了 imp_24h 后会出现</div>`;
  document.getElementById("flop-posts").innerHTML = flop.length
    ? flop.map(postRow).join("")
    : `<div class="empty">需积累 6+ 条数据才能识别哑火趋势<br>当前 ${scored.length} / 6</div>`;
}

function postRow(p) {
  return `<div class="post-row"><div class="post-title-cell"><a href="${p.url || "#"}" target="_blank">${p.title}</a></div><div class="post-meta">${fmt(p.metrics.imp_24h)} imp · <b>${p.eng.toFixed(1)}%</b></div></div>`;
}

function renderPostsTable({ posts }) {
  const t = document.getElementById("posts-table");
  const sorted = posts.slice().sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  t.innerHTML = `
    <thead><tr><th>DATE</th><th>TITLE</th><th>PLAT</th><th>PILLAR</th><th class="num">IMP</th><th class="num">ENG</th><th class="num">+F</th><th>RATE</th></tr></thead>
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
