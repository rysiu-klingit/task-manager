export const config = { maxDuration: 120 }

async function getSlackData(token) {
  try {
    const results = []
    const cutoff = (Date.now()/1000 - 14*86400).toFixed(0)

    const [s1, s2] = await Promise.allSettled([
      fetch('https://slack.com/api/search.messages?query=to%3Ame&count=50&sort=timestamp&sort_dir=desc', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('https://slack.com/api/search.messages?query=Rysiu&count=50&sort=timestamp&sort_dir=desc', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])

    for (const s of [s1, s2]) {
      if (s.status === 'fulfilled' && s.value?.ok) {
        results.push(...(s.value.messages?.matches || []).map(m => ({
          channel: m.channel?.name, text: m.text?.slice(0, 300),
          ts: m.ts, username: m.username, permalink: m.permalink,
        })))
      }
    }

    const convsRes = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel,im,mpim&limit=30&exclude_archived=true',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const convs = await convsRes.json()

    const histories = await Promise.allSettled(
      (convs.channels || []).slice(0, 15).map(ch =>
        fetch(`https://slack.com/api/conversations.history?channel=${ch.id}&limit=15&oldest=${cutoff}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => d.ok ? (d.messages || []).map(m => ({ channel: ch.name || ch.id, text: m.text?.slice(0, 300), ts: m.ts })) : [])
          .catch(() => [])
      )
    )
    for (const h of histories) if (h.status === 'fulfilled') results.push(...h.value)

    const seen = new Set()
    return results.filter(m => {
      const key = (m.channel || '') + (m.text || '').slice(0, 60)
      if (seen.has(key)) return false
      seen.add(key); return true
    }).slice(0, 100)
  } catch (err) {
    return `Slack error: ${err.message}`
  }
}

async function getSupportTickets(token) {
  try {
    const SUPPORT_CHANNEL = 'C037YQ0TNJ0'
    const cutoff = (Date.now()/1000 - 14*86400).toFixed(0)
    const res = await fetch(
      `https://slack.com/api/conversations.history?channel=${SUPPORT_CHANNEL}&limit=50&oldest=${cutoff}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    if (!data.ok) return []
    return (data.messages || []).filter(m => {
      const txt = (m.text || '').toLowerCase()
      return !txt.includes('uptimerobot') && !txt.includes('incident') && !txt.includes('downtime') && m.text?.trim()
    }).map(m => ({ ts: m.ts, text: (m.text || '').slice(0, 300), user: m.username || 'Unknown' })).slice(0, 20)
  } catch { return [] }
}

async function getGmailData(refreshToken, clientId, clientSecret) {
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) return `Gmail token error`
    const access = tokenData.access_token

    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+label:inbox+newer_than:14d&maxResults=50',
      { headers: { Authorization: `Bearer ${access}` } }
    )
    const list = await listRes.json()
    const messages = (list.messages || []).slice(0, 40)

    const details = await Promise.allSettled(
      messages.map(m =>
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers: { Authorization: `Bearer ${access}` } })
          .then(r => r.json())
          .then(msg => {
            const h = msg.payload?.headers || []
            const get = n => h.find(x => x.name === n)?.value || ''
            return { id: m.id, subject: get('Subject'), from: get('From'), date: get('Date'), snippet: msg.snippet?.slice(0, 150) }
          })
          .catch(() => null)
      )
    )
    return details.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value)
  } catch (err) {
    return `Gmail error: ${err.message}`
  }
}

async function getClickUpTasks(token) {
  try {
    const teamsRes = await fetch('https://api.clickup.com/api/v2/team', { headers: { Authorization: token } })
    const teams = await teamsRes.json()
    if (!teams.teams?.length) return []
    const teamId = teams.teams[0].id
    const r = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/task?assignee=me&include_closed=false&subtasks=true&page=0`, { headers: { Authorization: token } })
    const d = await r.json()
    return (d.tasks || []).filter(t => {
      const name = (t.name || '').toLowerCase()
      return !name.includes('marker') && !name.includes('widget for') && !name.includes('replace this picture') && !name.includes('repalce') && !name.includes('change the image with')
    }).map(t => ({
      id: t.id, name: t.name, status: t.status?.status,
      priority: t.priority?.priority, due_date: t.due_date,
      list: t.list?.name, folder: t.folder?.name, url: t.url,
      overdue: t.due_date && parseInt(t.due_date) < Date.now(),
      date_created: t.date_created,
    })).slice(0, 50)
  } catch (err) {
    return `ClickUp error: ${err.message}`
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  const [slackData, gmailData, clickupData, supportData] = await Promise.all([
    process.env.SLACK_MCP_TOKEN ? getSlackData(process.env.SLACK_MCP_TOKEN) : [],
    (process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET)
      ? getGmailData(process.env.GMAIL_REFRESH_TOKEN, process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET) : [],
    process.env.CLICKUP_MCP_TOKEN ? getClickUpTasks(process.env.CLICKUP_MCP_TOKEN) : [],
    process.env.SLACK_MCP_TOKEN ? getSupportTickets(process.env.SLACK_MCP_TOKEN) : [],
  ])

  console.log(`slack=${Array.isArray(slackData)?slackData.length:slackData} gmail=${Array.isArray(gmailData)?gmailData.length:gmailData} clickup=${Array.isArray(clickupData)?clickupData.length:clickupData} support=${Array.isArray(supportData)?supportData.length:supportData}`)

  const prompt = `You are a task extraction assistant for Rysiu Moscicki, PM at Klingit web agency.

Extract every actionable item from the data below. Slack and Gmail are highest priority sources.

SKIP ONLY: automated bot messages, newsletters, marketing emails, calendar accept/decline, UptimeRobot, Marker.io tasks, bulk image QA tasks (replace picture, change image).

Return ONLY a valid JSON array. No markdown, no explanation. Start with [ and end with ].

Each item:
{"id":"unique-string","title":"action needed max 120 chars","detail":"context max 150 chars","source":"slack or gmail or clickup","priority":"p1 or p2 or p3 or p4","who":"person or null","receivedAt":"ISO8601 datetime or null","link":"url or null","assignee":"Rysiu or Dmytro or Hans or Elias or Huy","client":"client name or null"}

p1=critical/blocking, p2=client waiting/overdue, p3=this week, p4=low/backlog

SLACK (${Array.isArray(slackData)?slackData.length:0} messages):
${JSON.stringify(slackData).slice(0, 8000)}

GMAIL (${Array.isArray(gmailData)?gmailData.length:0} emails):
${JSON.stringify(gmailData).slice(0, 6000)}

CLICKUP (${Array.isArray(clickupData)?clickupData.length:0} tasks):
${JSON.stringify(clickupData).slice(0, 3000)}

SUPPORT TICKETS (${Array.isArray(supportData)?supportData.length:0} — treat all as actionable):
${JSON.stringify(supportData).slice(0, 2000)}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
    })

    const data = await response.json()
    if (!response.ok) return res.status(502).json({ error: 'Anthropic API error', detail: data?.error?.message })

    const textBlock = data.content?.find(b => b.type === 'text')
    if (!textBlock) return res.status(502).json({ error: 'No text response' })

    const raw = textBlock.text.trim()
    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    if (start === -1 || end === -1) return res.status(502).json({ error: 'No JSON array', raw: raw.slice(0, 300) })

    let tasks
    try { tasks = JSON.parse(raw.slice(start, end + 1)) }
    catch (e) { return res.status(502).json({ error: 'JSON parse failed', raw: raw.slice(start, start + 200) }) }

    return res.status(200).json({ tasks, crawledAt: new Date().toISOString() })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
