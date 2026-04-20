# Taskmaster

A personal task dashboard that crawls Slack, Gmail & ClickUp on demand and gives you a living, persistently updated checklist.

## How it works

- **Frontend**: React + Vite, hosted on Vercel
- **Backend**: One Vercel serverless function (`/api/crawl`) that calls Claude via the Anthropic API with your Slack, Gmail & ClickUp MCP servers attached
- **Persistence**: Checked-off tasks survive page refreshes via localStorage. New crawls merge in fresh items without losing your ticked state.

---

## Step-by-step deploy

### 1. Prerequisites

Install these if you don't have them:
- [Node.js](https://nodejs.org) (v18 or later)
- [Git](https://git-scm.com)
- A free [Vercel](https://vercel.com) account
- A free [GitHub](https://github.com) account

### 2. Get your Anthropic API key

1. Go to https://console.anthropic.com
2. Click **API Keys** → **Create Key**
3. Copy the key — you'll need it in step 6

### 3. Get your MCP OAuth tokens

The crawl function connects to Slack, Gmail and ClickUp via their MCP servers. You need to authenticate each one. The easiest way is to use Claude.ai's existing connections:

**Option A — Use your Claude.ai MCP tokens (easiest)**
- Open Claude.ai → Settings → Integrations
- You already have Slack, Gmail & ClickUp connected
- The tokens used there are what you need to pass as Authorization headers in `api/crawl.js`
- Update the `mcp_servers` array in `api/crawl.js` to add your auth headers:

```js
mcp_servers: [
  {
    type: 'url',
    url: 'https://mcp.slack.com/mcp',
    name: 'slack',
    authorization_token: process.env.SLACK_MCP_TOKEN,
  },
  {
    type: 'url',
    url: 'https://gmailmcp.googleapis.com/mcp/v1',
    name: 'gmail',
    authorization_token: process.env.GMAIL_MCP_TOKEN,
  },
  {
    type: 'url',
    url: 'https://mcp.clickup.com/mcp',
    name: 'clickup',
    authorization_token: process.env.CLICKUP_MCP_TOKEN,
  },
]
```

**Option B — OAuth each service directly**
- Slack: https://api.slack.com/apps → create app → get user token
- Gmail: https://console.cloud.google.com → OAuth 2.0 → get token
- ClickUp: https://app.clickup.com/settings/apps → API token

### 4. Set up the project locally

```bash
# Clone or download this folder, then:
cd taskmaster
npm install
```

### 5. Test locally

Create a `.env.local` file:
```
ANTHROPIC_API_KEY=sk-ant-...
SLACK_MCP_TOKEN=xoxp-...
GMAIL_MCP_TOKEN=ya29...
CLICKUP_MCP_TOKEN=...
```

Install Vercel CLI and run locally:
```bash
npm install -g vercel
vercel dev
```

Open http://localhost:3000 and hit **Crawl now**.

### 6. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/taskmaster.git
git push -u origin main
```

### 7. Deploy to Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Click **Deploy** (Vercel auto-detects Vite)
4. Once deployed, go to **Settings → Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = your Anthropic key
   - `SLACK_MCP_TOKEN` = your Slack token
   - `GMAIL_MCP_TOKEN` = your Gmail token
   - `CLICKUP_MCP_TOKEN` = your ClickUp token
5. Go to **Deployments** → **Redeploy** to pick up the env vars

Your app is now live at `https://taskmaster-xxx.vercel.app`

### 8. Every future update

Just edit the code and push to GitHub — Vercel redeploys automatically in ~30 seconds.

---

## Customising the crawl

Edit `api/crawl.js` → `CRAWL_PROMPT` to change what gets crawled, what gets ignored, or how items are categorised.

The prompt tells Claude:
- What sources to crawl (Slack, Gmail, ClickUp)
- What to ignore (newsletters, automated notifications)
- What JSON shape to return
- How to categorise items (fire / email / client / clickup / internal)

---

## File structure

```
taskmaster/
├── api/
│   └── crawl.js          # Vercel serverless function — calls Anthropic API
├── src/
│   ├── App.jsx            # Main React component
│   ├── storage.js         # localStorage + merge logic
│   └── main.jsx           # Entry point
├── index.html
├── vite.config.js
├── vercel.json            # Vercel routing config
├── package.json
└── .gitignore
```
