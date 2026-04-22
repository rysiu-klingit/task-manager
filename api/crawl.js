export const config = { maxDuration: 120 }

// Fetch with a per-request timeout
const fetchWithTimeout = (url, opts, ms = 5000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...opts, signal: controller.signal })
    .then(r => r.json())
    .catch(() => null)
    .finally(() => clearTimeout(timer))
}

async function getSlackData(token) {
  try {
    const cutoff = (Date.now()/1000 - 14*86400).toFixed(0)
    const headers = { Authorization: `Bearer ${token}` }

    const [search, convsData] = await Promise.all([
      fetchWithTimeout('https://slack.com/api/search.messages?query=to%3Ame+OR+Rysiu&count=50&sort=timestamp&sort_dir=desc', { headers }, 8000),
      fetchWithTimeout('https://slack.com/api/conversations.list?types=public_channel,private_channel,im&limit=50&exclude_archived=true', { headers }, 8000),
    ])

    const results = []
    if (search?.ok) {
      results.push(...(search.messages?.matches||[]).map(m => ({
        ch: m.channel?.name, txt: (m.text||'').slice(0,200), ts: m.ts, user: m.username, url: m.permalink,
      })))
    }

    // 15 channels, all in parallel with 5s timeout each
    const channels = (convsData?.channels||[]).slice(0, 15)
    const histories = await Promise.allSettled(
      channels.map(ch =>
        fetchWithTimeout(
          `https://slack.com/api/conversations.history?channel=${ch.id}&limit=15&oldest=${cutoff}`,
          { headers }, 5000
        ).then(d => d?.ok ? (d.messages||[]).map(m => ({ ch: ch.name||ch.id, txt: (m.text||'').slice(0,200), ts: m.ts })) : [])
         .catch(() => [])
      )
    )
    for (const h of histories) if (h.status==='fulfilled') results.push(...(h.value||[]))

    const seen = new Set()
    return results.filter(m => {
      const k = (m.ch||'')+(m.txt||'').slice(0,40)
      if (seen.has(k)) return false; seen.add(k); return true
    }).slice(0, 100)
  } catch { return [] }
}

async function getSupportTickets(token) {
  try {
    const cutoff = (Date.now()/1000 - 14*86400).toFixed(0)
    const d = await fetchWithTimeout(
      `https://slack.com/api/conversations.history?channel=C037YQ0TNJ0&limit=30&oldest=${cutoff}`,
      { headers: { Authorization: `Bearer ${token}` } }, 6000
    )
    if (!d?.ok) return []
    return (d.messages||[]).filter(m => {
      const t = (m.text||'').toLowerCase()
      return !t.includes('uptimerobot') && !t.includes('incident') && !t.includes('downtime') && m.text?.trim()
    }).map(m => ({ ts: m.ts, txt: (m.text||'').slice(0,200) })).slice(0, 20)
  } catch { return [] }
}

async function getGmailData(refreshToken, clientId, clientSecret) {
  try {
    const tokenData = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
    }, 8000)
    if (!tokenData?.access_token) return []
    const access = tokenData.access_token

    const list = await fetchWithTimeout(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+label:inbox+newer_than:14d&maxResults=50',
      { headers: { Authorization: `Bearer ${access}` } }, 8000
    )
    const msgs = (list?.messages||[]).slice(0, 40)

    // Batch in groups of 10 to avoid overwhelming the API
    const allDetails = []
    for (let i = 0; i < msgs.length; i += 10) {
      const batch = msgs.slice(i, i+10)
      const results = await Promise.allSettled(batch.map(m =>
        fetchWithTimeout(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${access}` } }, 4000
        ).then(msg => {
          if (!msg) return null
          const h = msg.payload?.headers||[]
          const g = n => h.find(x=>x.name===n)?.value||''
          return { sub: g('Subject'), from: g('From'), date: g('Date'), snip: (msg.snippet||'').slice(0,120) }
        })
      ))
      allDetails.push(...results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value))
    }
    return allDetails
  } catch { return [] }
}

async function getClickUpTasks(token) {
  try {
    const teams = await fetchWithTimeout('https://api.clickup.com/api/v2/team', { headers: { Authorization: token } }, 6000)
    if (!teams?.teams?.length) return []
    const teamId = teams.teams[0].id
    const d = await fetchWithTimeout(
      `https://api.clickup.com/api/v2/team/${teamId}/task?assignee=me&include_closed=false&subtasks=false&page=0`,
      { headers: { Authorization: token } }, 8000
    )
    return (d?.tasks||[]).filter(t => {
      const n = (t.name||'').toLowerCase()
      return !n.includes('marker') && !n.includes('widget for') && !n.includes('replace this picture') && !n.includes('repalce') && !n.includes('change the image with')
    }).map(t => ({
      id: t.id, name: t.name, status: t.status?.status,
      due: t.due_date, list: t.list?.name, url: t.url,
      overdue: t.due_date && parseInt(t.due_date) < Date.now(),
    })).slice(0, 40)
  } catch { return [] }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  // All sources in parallel, 40s total budget for fetching
  const fetchDeadline = new Promise(resolve => setTimeout(() => resolve([[], [], [], []]), 40000))
  const fetching = Promise.all([
    process.env.SLACK_MCP_TOKEN ? getSlackData(process.env.SLACK_MCP_TOKEN) : [],
    (process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET)
      ? getGmailData(process.env.GMAIL_REFRESH_TOKEN, process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET) : [],
    process.env.CLICKUP_MCP_TOKEN ? getClickUpTasks(process.env.CLICKUP_MCP_TOKEN) : [],
    process.env.SLACK_MCP_TOKEN ? getSupportTickets(process.env.SLACK_MCP_TOKEN) : [],
  ])

  const [slack, gmail, clickup, support] = await Promise.race([fetching, fetchDeadline])
  console.log(`slack=${slack.length} gmail=${gmail.length} clickup=${clickup.length} support=${support.length}`)

  const prompt = `Task assistant for Rysiu (PM at Klingit). Return the top 100 most important actionable items as a JSON array. No text before or after — start with [ end with ].

Skip: bots, newsletters, marketing emails, calendar automations, UptimeRobot, Marker.io tasks, bulk image QA tasks.
Priority order: Slack > Gmail > ClickUp > Support.

Each item: {"id":"str","title":"max 100 chars","detail":"max 150 chars","source":"slack|gmail|clickup","priority":"p1|p2|p3|p4","who":"str|null","receivedAt":"ISO|null","link":"url|null","assignee":"Rysiu|Dmytro|Hans|Elias|Huy","client":"str|null"}

p1=blocking/urgent p2=client waiting/overdue p3=this week p4=low

SLACK(${slack.length}): ${JSON.stringify(slack).slice(0,8000)}
GMAIL(${gmail.length}): ${JSON.stringify(gmail).slice(0,6000)}
CLICKUP(${clickup.length}): ${JSON.stringify(clickup).slice(0,3000)}
SUPPORT(${support.length}): ${JSON.stringify(support).slice(0,2000)}`

  console.log('prompt length:', prompt.length)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
    })

    const data = await response.json()
    if (!response.ok) return res.status(502).json({ error: 'Anthropic API error', detail: data?.error?.message || JSON.stringify(data) })

    const textBlock = data.content?.find(b => b.type === 'text')
    if (!textBlock) return res.status(502).json({ error: 'No text response' })

    const raw = textBlock.text.trim()
    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    if (start === -1 || end === -1) return res.status(502).json({ error: 'No JSON array', raw: raw.slice(0,200) })

    let tasks
    try { tasks = JSON.parse(raw.slice(start, end+1)) }
    catch (e) { return res.status(502).json({ error: 'JSON parse failed', raw: raw.slice(start, start+200) }) }

    return res.status(200).json({ tasks, crawledAt: new Date().toISOString() })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
