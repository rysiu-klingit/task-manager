export const config = { maxDuration: 120 }

async function getSlackData(token) {
  try {
    const results = []

    // Search messages mentioning Rysiu or directed at him
    for (const q of ['to:me', 'Rysiu', 'mentioned:me']) {
      try {
        const r = await fetch(
          `https://slack.com/api/search.messages?query=${encodeURIComponent(q)}&count=50&sort=timestamp&sort_dir=desc`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const d = await r.json()
        if (d.ok && d.messages?.matches) {
          results.push(...d.messages.matches.map(m => ({
            channel: m.channel?.name, text: m.text, ts: m.ts,
            username: m.username, permalink: m.permalink,
          })))
        }
      } catch {}
    }

    // Pull recent history from all channels
    const convsR = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel,im,mpim&limit=50&exclude_archived=true',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const convs = await convsR.json()
    const cutoff = (Date.now()/1000 - 14*86400).toFixed(0)
    for (const ch of (convs.channels || []).slice(0, 20)) {
      try {
        const h = await fetch(
          `https://slack.com/api/conversations.history?channel=${ch.id}&limit=20&oldest=${cutoff}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const hd = await h.json()
        if (hd.ok) {
          results.push(...(hd.messages || []).map(m => ({
            channel: ch.name || ch.id, text: m.text, ts: m.ts,
          })))
        }
      } catch {}
    }

    // Deduplicate
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

async function getGmailData(refreshToken, clientId, clientSecret) {
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) return `Gmail token error: ${JSON.stringify(tokenData)}`
    const access = tokenData.access_token

    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+label:inbox+newer_than:14d&maxResults=50',
      { headers: { Authorization: `Bearer ${access}` } }
    )
    const list = await listRes.json()
    const messages = list.messages || []

    const details = await Promise.all(
      messages.slice(0, 40).map(async m => {
        try {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${access}` } }
          )
          const msg = await r.json()
          const h = msg.payload?.headers || []
          const get = n => h.find(x => x.name === n)?.value || ''
          return { id: m.id, subject: get('Subject'), from: get('From'), date: get('Date'), snippet: msg.snippet }
        } catch { return null }
      })
    )
    return details.filter(Boolean)
  } catch (err) {
    return `Gmail error: ${err.message}`
  }
}

async function getClickUpTasks(token) {
  try {
    const teamsRes = await fetch('https://api.clickup.com/api/v2/team', {
      headers: { Authorization: token }
    })
    const teams = await teamsRes.json()
    if (!teams.teams?.length) return 'No ClickUp teams found'
    const teamId = teams.teams[0].id

    const tasksRes = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/task?assignee=me&include_closed=false&subtasks=true&page=0`,
      { headers: { Authorization: token } }
    )
    const tasks = await tasksRes.json()
    return (tasks.tasks || []).map(t => ({
      id: t.id, name: t.name, status: t.status?.status,
      priority: t.priority?.priority, due_date: t.due_date,
      list: t.list?.name, folder: t.folder?.name, url: t.url,
      overdue: t.due_date && parseInt(t.due_date) < Date.now(),
    }))
  } catch (err) {
    return `ClickUp error: ${err.message}`
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  const [slackData, gmailData, clickupData] = await Promise.all([
    process.env.SLACK_MCP_TOKEN ? getSlackData(process.env.SLACK_MCP_TOKEN) : 'No Slack token',
    (process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET)
      ? getGmailData(process.env.GMAIL_REFRESH_TOKEN, process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET)
      : 'No Gmail credentials',
    process.env.CLICKUP_MCP_TOKEN ? getClickUpTasks(process.env.CLICKUP_MCP_TOKEN) : 'No ClickUp token',
  ])

  console.log('Slack items:', Array.isArray(slackData) ? slackData.length : slackData)
  console.log('Gmail items:', Array.isArray(gmailData) ? gmailData.length : gmailData)
  console.log('ClickUp items:', Array.isArray(clickupData) ? clickupData.length : clickupData)

  const prompt = `You are a task extraction assistant for Rysiu Moscicki, Project Manager at Klingit (a web/creative agency).

Your job is to extract EVERY SINGLE actionable item — be COMPREHENSIVE, do NOT filter aggressively.

Extract an item for EACH of:
- Every Slack message where someone is waiting for Rysiu's reply, decision, review, or approval
- Every Slack message where Rysiu committed to something or was asked to do something
- Every unread Gmail email from a client or colleague that needs a response or action
- Every ClickUp task assigned to Rysiu that is not closed/complete — list EACH task separately
- Any overdue items

ONLY skip: pure automated bot messages with zero human action needed, product marketing newsletters from tools like ClickUp/Loom/Slack, calendar accept/decline auto-responses.

INCLUDE everything else. More items is ALWAYS better than fewer. If in doubt, include it.

Return ONLY a raw JSON array. No markdown, no explanation, no code fences.

Each item:
{
  "id": "unique-stable-string",
  "title": "clear action needed in plain English, max 120 chars",
  "detail": "who is waiting and context, max 200 chars",
  "source": "slack" or "gmail" or "clickup",
  "category": "fire" or "email" or "client" or "clickup" or "internal",
  "urgency": "high" or "medium" or "low",
  "who": "person name or null",
  "when": "readable date or null",
  "link": "url or null"
}

Categories:
- fire = urgent, blocking a client, escalating, needs action TODAY
- email = needs an email reply
- client = client coordination, estimates, sign-offs, project updates
- clickup = open ClickUp task (use this for ALL clickup tasks)
- internal = internal Klingit process, finance, scheduling, team

Sort: fire first, then email, client, clickup, internal.

## SLACK (${Array.isArray(slackData) ? slackData.length : 0} messages):
${JSON.stringify(slackData).slice(0, 10000)}

## GMAIL (${Array.isArray(gmailData) ? gmailData.length : 0} emails):
${JSON.stringify(gmailData).slice(0, 6000)}

## CLICKUP (${Array.isArray(clickupData) ? clickupData.length : 0} tasks):
${JSON.stringify(clickupData).slice(0, 4000)}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(502).json({ error: 'Anthropic API error', detail: data?.error?.message })

    const textBlock = data.content?.find(b => b.type === 'text')
    if (!textBlock) return res.status(502).json({ error: 'No response from Claude' })

    let tasks
    try {
      tasks = JSON.parse(textBlock.text.replace(/```json|```/g, '').trim())
    } catch {
      return res.status(502).json({ error: 'Invalid JSON', raw: textBlock.text.slice(0, 500) })
    }

    return res.status(200).json({ tasks, crawledAt: new Date().toISOString() })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}