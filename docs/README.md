# X-Growth 运营看板

可视化版本，部署在 GitHub Pages。

## 访问地址

启用后访问：**https://chiang126126.github.io/x-growth/**

## 你只需要编一个文件

每天晚上 22:00 打开 [`docs/data.json`](data.json)，做 3 件事：

### 1. 加今天的日快照（`daily` 数组里加一行）

```json
{
  "date": "2026-06-17",
  "x_followers": 25,
  "xhs_followers": 5,
  "x_impressions": 2300,
  "xhs_impressions": 150,
  "posts_today": 1,
  "log": "一句话日志"
}
```

### 2. 补昨天发的内容数据（`posts` 数组里找到那条，填 metrics）

```json
"metrics": {
  "imp_24h": 1820,
  "likes": 32,
  "reposts": 4,
  "replies": 7,
  "saves": null,
  "profile_clicks": 18,
  "follower_gain": 5
},
"rating": "中规中矩"
```

### 3. 加未来选题（`pipeline` 数组）

```json
{
  "id": "20260623-newpost",
  "title": "标题",
  "platform": "X",
  "pillar": "WTF",
  "status": "待发",
  "plan_date": "2026-06-23T20:00:00+08:00"
}
```

### 4. 改 `meta.updated_at`，commit + push

```bash
cd ~/x-growth
git add docs/data.json
git commit -m "data: 2026-06-17"
git push
```

约 60 秒后看板自动更新（GitHub Pages 部署时间）。

---

## 字段说明

### post.pillar 三选一
- `WTF` — 猎奇案例（60%）
- `LIST` — 信息差清单（25%）
- `HOOK` — 情绪共鸣（15%）

### post.rating（手动评估）
- `爆款` — 互动率 > 5%
- `中规中矩` — 互动率 1-5%
- `哑火` — 互动率 < 1%

### post.platform
- `X`
- `小红书`

---

## 启用 GitHub Pages（一次性配置）

1. 打开 https://github.com/chiang126126/x-growth/settings/pages
2. **Source**：Deploy from a branch
3. **Branch**：`main` → `/docs`
4. Save
5. 等 1-2 分钟，看板会出现在 https://chiang126126.github.io/x-growth/

---

## 移动端访问

直接在手机浏览器打开上面 URL，加入主屏（iOS：分享 → 添加到主屏幕），变成一个 App 图标。

---

## 自定义

- 改样式：编辑 `style.css`
- 加图表：在 `app.js` 里参考已有的 `renderChart...` 函数
- 改 KPI 计算：在 `app.js` 顶部的 `renderKPIs` 函数

不熟前端不要硬改 — 跟我说你想加什么，我给改好版本。
