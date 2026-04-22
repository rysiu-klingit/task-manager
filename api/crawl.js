export const config = { maxDuration: 120 }

async function getSlackData(token) {
  try {
    const results = []

    // Run all searches in parallel
    const [s1, s2, s3] = await Promise.allSettled([
      fetch('https://slack.com/api/search.messages?query=to%3Ame&count=50&sort=timestamp&sort_dir=desc', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('https://slack.com/api/search.messages?query=Rysiu&count=50&sort=timestamp&sort_dir=desc', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('https://slack.com/api/search.messages?query=mentioned%3Ame&count=50&sort=timestamp&sort_dir=desc', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])

    for (const s of [s1, s2, s3]) {
      if (s.status === 'fulfilled' && s.value?.ok) {
        results.push(...(s.value.messages?.matches || []).map(m => ({
          channel: m.channel?.name, text: m.text?.slice(0, 500),
          ts: m.ts, username: m.username, permalink: m.permalink,
        })))
      }
    }

    // Pull history from all channels in parallel
    const convsRes = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel,im,mpim&limit=50&exclude_archived=true',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const convs = await convsRes.json()
    const cutoff = (Date.now()/1000 - 14*86400).toFixed(0)

    const histories = await Promise.allSettled(
      (convs.channels || []).slice(0, 25).map(ch =>
        fetch(`https://slack.com/api/conversations.history?channel=${ch.id}&limit=20&oldest=${cutoff}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => d.ok ? (d.messages || []).map(m => ({ channel: ch.name || ch.id, text: m.text?.slice(0, 500), ts: m.ts })) : [])
          .catch(() => [])
      )
    )

    for (const h of histories) {
      if (h.status === 'fulfilled') results.push(...h.value)
    }

    // Deduplicate
    const seen = new Set()
    return results.filter(m => {
      const key = (m.channel || '') + (m.text || '').slice(0, 60)
      if (seen.has(key)) return false
      seen.add(key); return true
    }).slice(0, 150)
  } catch (err) {
    return `Slack error: ${err.message}`
  }
}

async function getSupportTickets(token) {
  try {
    const SUPPORT_CHANNEL = 'C037YQ0TNJ0'
    const cutoff = (Date.now()/1000 - 14*86400).toFixed(0)
    const res = await fetch(
      `https://slack.com/api/conversations.history?channel=${SUPPORT_CHANNEL}&limit=100&oldest=${cutoff}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    if (!data.ok) return `Support channel error: ${data.error}`

    const tickets = (data.messages || []).filter(m => {
      const txt = (m.text || '').toLowerCase()
      if (txt.includes('uptimerobot')) return false
      if (txt.includes('incident started')) return false
      if (txt.includes('incident resolved')) return false
      if (txt.includes('downtime alert')) return false
      if (!m.text || m.text.trim() === '') return false
      return true
    })

    // Fetch thread replies in parallel
    const withThreads = await Promise.allSettled(
      tickets.slice(0, 50).map(async m => {
        let replies = []
        if (m.reply_count > 0) {
          try {
            const tr = await fetch(
              `https://slack.com/api/conversations.replies?channel=${SUPPORT_CHANNEL}&ts=${m.ts}&limit=10`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            const td = await tr.json()
            replies = (td.messages || []).slice(1).map(r => r.text?.slice(0, 300)).filter(Boolean)
          } catch {}
        }
        return { ts: m.ts, text: m.text, user: m.username || m.bot_profile?.name || 'Unknown', replies, replyCount: m.reply_count || 0, channel: 'support' }
      })
    )

    return withThreads.filter(r => r.status === 'fulfilled').map(r => r.value)
  } catch (err) {
    return `Support error: ${err.message}`
  }
}

async function getGmailData(refreshToken, clientId, clientSecret) {
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) return `Gmail token error: ${JSON.stringify(tokenData)}`
    const access = tokenData.access_token

    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+label:inbox+newer_than:14d&maxResults=100',
      { headers: { Authorization: `Bearer ${access}` } }
    )
    const list = await listRes.json()
    const messages = list.messages || []

    // Fetch all email metadata in parallel — much faster than sequential
    const details = await Promise.allSettled(
      messages.slice(0, 80).map(m =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${access}` } }
        )
        .then(r => r.json())
        .then(msg => {
          const h = msg.payload?.headers || []
          const get = n => h.find(x => x.name === n)?.value || ''
          return { id: m.id, subject: get('Subject'), from: get('From'), date: get('Date'), snippet: msg.snippet?.slice(0, 200) }
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
    if (!teams.teams?.length) return 'No ClickUp teams found'
    const teamId = teams.teams[0].id

    // Fetch page 0 and page 1 in parallel to get more tasks
    const [p0, p1] = await Promise.allSettled([
      fetch(`https://api.clickup.com/api/v2/team/${teamId}/task?assignee=me&include_closed=false&subtasks=true&page=0`, { headers: { Authorization: token } }).then(r => r.json()),
      fetch(`https://api.clickup.com/api/v2/team/${teamId}/task?assignee=me&include_closed=false&subtasks=true&page=1`, { headers: { Authorization: token } }).then(r => r.json()),
    ])

    const tasks = []
    if (p0.status === 'fulfilled') tasks.push(...(p0.value.tasks || []))
    if (p1.status === 'fulfilled') tasks.push(...(p1.value.tasks || []))

    return tasks.map(t => ({
      id: t.id, name: t.name, status: t.status?.status,
      priority: t.priority?.priority, due_date: t.due_date,
      list: t.list?.name, folder: t.folder?.name, url: t.url,
      overdue: t.due_date && parseInt(t.due_date) < Date.now(),
      date_created: t.date_created, date_updated: t.date_updated,
    }))
  } catch (err) {
    return `ClickUp error: ${err.message}`
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  // Run all 4 sources in parallel
  const [slackData, gmailData, clickupData, supportData] = await Promise.all([
    process.env.SLACK_MCP_TOKEN ? getSlackData(process.env.SLACK_MCP_TOKEN) : 'No Slack token',
    (process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET)
      ? getGmailData(process.env.GMAIL_REFRESH_TOKEN, process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET)
      : 'No Gmail credentials',
    process.env.CLICKUP_MCP_TOKEN ? getClickUpTasks(process.env.CLICKUP_MCP_TOKEN) : 'No ClickUp token',
    process.env.SLACK_MCP_TOKEN ? getSupportTickets(process.env.SLACK_MCP_TOKEN) : [],
  ])

  console.log('Slack:', Array.isArray(slackData) ? slackData.length : slackData)
  console.log('Gmail:', Array.isArray(gmailData) ? gmailData.length : gmailData)
  console.log('ClickUp:', Array.isArray(clickupData) ? clickupData.length : clickupData)
  console.log('Support:', Array.isArray(supportData) ? supportData.length : supportData)

  const prompt = `You are a task extraction assistant for Rysiu Moscicki, Project Manager at Klingit (web/creative agency).

Extract EVERY actionable item. Be comprehensive — more items is always better.

INCLUDE:
- Every Slack message needing Rysiu's reply, decision, review, or approval
- Every unread Gmail from a client or colleague needing action
- Every open ClickUp task assigned to Rysiu — list EACH task individually
- Every support ticket from the #support channel

SKIP ONLY: pure automated bot messages, product marketing newsletters, calendar accept/decline automations, ClickUp/Loom/Slack marketing emails.

Return ONLY a raw JSON array. No markdown, no explanation.

Each item:
{
  "id": "unique-stable-string",
  "title": "clear action needed, max 120 chars",
  "detail": "who is waiting and context, max 200 chars",
  "source": "slack" or "gmail" or "clickup",
  "priority": "p1" or "p2" or "p3" or "p4",
  "who": "person name or null",
  "receivedAt": "ISO 8601 datetime from email Date header, Slack ts*1000, or ClickUp date_created",
  "link": "url or null",
  "assignee": "most likely developer: Rysiu (PM/client comms), Dmytro (dev/code/bugs), Hans or Elias (design/UX), Huy (design support)",
  "client": "client company or null: Geomatikk, Nabo, LanoPro, Ekovilla, Verisec, Optifit, Xensam, Odevo, 1825, Schibsted, Arvid Nordquist, Pinerock, Gladsheim, Ozzlights, Migränhjälpen, Other"
}

Priority:
- p1 = Critical: client blocked, live site broken, urgent escalation
- p2 = High: client waiting for reply, overdue task, important update
- p3 = Medium: needs doing this week
- p4 = Low: FYI, backlog, minor task

## SLACK (${Array.isArray(slackData) ? slackData.length : 0} messages):
${JSON.stringify(slackData).slice(0, 10000)}

## GMAIL (${Array.isArray(gmailData) ? gmailData.length : 0} emails):
${JSON.stringify(gmailData).slice(0, 6000)}

## CLICKUP (${Array.isArray(clickupData) ? clickupData.length : 0} tasks):
${JSON.stringify(clickupData).slice(0, 4000)}

## SUPPORT TICKETS from #support channel (${Array.isArray(supportData) ? supportData.length : 0} tickets — treat ALL as actionable):
${JSON.stringify(supportData).slice(0, 3000)}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
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
