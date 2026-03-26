# 個人助理 PWA

語音紀錄、行事曆同步、運動追蹤、行程規劃。

## 快速開始

### 1. 建立 Supabase 專案

1. 前往 [supabase.com](https://supabase.com) → New Project
2. Dashboard > SQL Editor → 貼上並執行 `supabase-schema.sql`
3. Authentication > Providers > Google → 開啟，填入 Google OAuth Client ID / Secret
4. 複製 Project URL 和 anon key

### 2. 設定 Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com) → 新增專案
2. APIs & Services > Credentials > OAuth 2.0 Client ID（Web application）
3. Authorized redirect URIs 加入：
   - `https://your-project.supabase.co/auth/v1/callback`
   - `https://your-username.github.io/personal-assistant/auth/callback`

### 3. 設定 Claude API Proxy

因為 API Key 不能放前端，需要一個簡單的 proxy：

```js
// Cloudflare Worker（免費方案每天 10 萬次請求）
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    const { prompt, max_tokens = 512 } = await request.json()
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',  // 速度快、費用低，適合 NLP 解析
        max_tokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const content = data.content?.[0]?.text ?? ''
    return new Response(JSON.stringify({ content }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
```

部署到 Cloudflare Workers，設定環境變數 `ANTHROPIC_API_KEY`。

### 4. GitHub Pages 部署

```bash
# Clone 後安裝依賴
npm install

# 複製環境變數範本
cp .env.example .env
# 填入你的 keys

# 本地開發
npm run dev
```

GitHub Actions 設定：
1. Settings > Pages > Source: GitHub Actions
2. Settings > Secrets > 加入以下 secrets：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_CLAUDE_PROXY_URL`
   - `VITE_APP_URL`（例如 `https://james.github.io/personal-assistant`）

推送到 main branch 即自動部署。

## 技術架構

| 層 | 技術 |
|---|---|
| 前端框架 | React 18 + Vite |
| 路由 | React Router v7 |
| PWA | vite-plugin-pwa + Service Worker |
| 資料庫 | Supabase (PostgreSQL + Auth + Storage) |
| 語音辨識 | Web Speech API (瀏覽器原生，免費) |
| AI 解析 | Claude Haiku via Cloudflare Worker proxy |
| 行事曆 | Google Calendar API v3 |
| 部署 | GitHub Pages + GitHub Actions |
| 費用 | **完全免費**（在 Supabase / Cloudflare 免費額度內）|
