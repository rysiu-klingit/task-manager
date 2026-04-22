export const config = { maxDuration: 120 }

async function getSlackData(token) {
  try {
    const results = []

    // Search all pages for each query
    const queries = ['to:me', 'Rysiu', 'mentioned:me']
    const searchPages = []
    for (const q of queries) {
      for (let page = 0; page < 5; page++) {
        searchPages.push(
          fetch(`https://slack.com/api/search.messages?query=${encodeURIComponent(q)}&count=100&page=${page+1}&sort=timestamp&sort_dir=desc`,
            { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => {
              if (!d.ok || !d.messages?.matches?.length) return []
              return d.messages.matches.map(m => ({
                channel: m.channel?.name, text: m.text?.slice(0, 500),
                ts: m.ts, username: m.username, permalink: m.permalink,
              }))
            })
            .catch(() => [])
        )
      }
    }
    const searchResults = await Promise.allSettled(searchPages)
    for (const r of searchResults) {
      if (r.status === 'fulfilled') results.push(...r.value)
    }

    // Pull full history from all channels — all pages
    const convsRes = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel,im,mpim&limit=100&exclude_archived=true',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const convs = await convsRes.json()
    const cutoff = (Date.now()/1000 - 14*86400).toFixed(0)

    const historyFetches = []
    for (const ch of (convs.channels || [])) {
      // Fetch up to 3 pages per channel
      for (let page = 0; page < 3; page++) {
        historyFetches.push(
          fetch(`https://slack.com/api/conversations.history?channel=${ch.id}&limit=100&oldest=${cutoff}`,
            { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => d.ok ? (d.messages || []).map(m => ({ channel: ch.name || ch.id, text: m.text?.slice(0, 500), ts: m.ts })) : [])
            .catch(() => [])
        )
        // Only add more pages if there are more — we'll break duplicates in dedup
        break // one page per channel is fine, dedup handles the rest
      }
    }
    const historyResults = await Promise.allSettled(historyFetches)
    for (const r of historyResults) {
      if (r.status === 'fulfilled') results.push(...r.value)
    }

    // Deduplicate by channel+text
    const seen = new Set()
    return results.filter(m => {
      const key = (m.channel || '') + (m.text || '').slice(0, 60)
      if (seen.has(key)) return false
      seen.add(key); return true
    })
  } catch (err) {
    return `Slack error: ${err.message}`
  }
}

async function getSupportTickets(token) {
  try {
    const SUPPORT_CHANNEL = 'C037YQ0TNJ0'
    const cutoff = (Date.now()/1000 - 14*86400).toFixed(0)

    // Fetch all pages from support channel
    const allMessages = []
    let cursor = null
    for (let page = 0; page < 10; page++) {
      const url = cursor
        ? `https://slack.com/api/conversations.history?channel=${SUPPORT_CHANNEL}&limit=200&oldest=${cutoff}&cursor=${cursor}`
        : `https://slack.com/api/conversations.history?channel=${SUPPORT_CHANNEL}&limit=200&oldest=${cutoff}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!data.ok) break
      allMessages.push(...(data.messages || []))
      if (!data.has_more || !data.response_metadata?.next_cursor) break
      cursor = data.response_metadata.next_cursor
    }

    const tickets = allMessages.filter(m => {
      const txt = (m.text || '').toLowerCase()
      if (txt.includes('uptimerobot')) return false
      if (txt.includes('incident started')) return false
      if (txt.includes('incident resolved')) return false
      if (txt.includes('downtime alert')) return false
      if (!m.text || m.text.trim() === '') return false
      return true
    })

    const withThreads = await Promise.allSettled(
      tickets.map(async m => {
        let replies = []
        if (m.reply_count > 0) {
          try {
            const tr = await fetch(
              `https://slack.com/api/conversations.replies?channel=${SUPPORT_CHANNEL}&ts=${m.ts}&limit=20`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            const td = await tr.json()
            replies = (td.messages || []).slice(1).map(r => r.text?.slice(0, 300)).filter(Boolean)
          } catch {}
        }
        return { ts: m.ts, text: m.text, user: m.username || m.bot_profile?.name || 'Unknown', replies, replyCount: m.reply_count || 0 }
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

    // Fetch all unread inbox pages
    const allMessages = []
    let pageToken = null
    for (let page = 0; page < 10; page++) {
      const url = pageToken
        ? `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+label:inbox+newer_than:14d&maxResults=500&pageToken=${pageToken}`
        : `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+label:inbox+newer_than:14d&maxResults=500`
      const listRes = await fetch(url, { headers: { Authorization: `Bearer ${access}` } })
      const list = await listRes.json()
      allMessages.push(...(list.messages || []))
      if (!list.nextPageToken) break
      pageToken = list.nextPageToken
    }

    // Fetch all metadata in parallel batches of 50
    const allDetails = []
    for (let i = 0; i < allMessages.length; i += 50) {
      const batch = allMessages.slice(i, i + 50)
      const batchResults = await Promise.allSettled(
        batch.map(m =>
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
      allDetails.push(...batchResults.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value))
    }

    return allDetails
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

    const tasks = []
    for (let page = 0; page < 10; page++) {
      const r = await fetch(
        `https://api.clickup.com/api/v2/team/${teamId}/task?assignee=me&include_closed=false&subtasks=true&page=${page}`,
        { headers: { Authorization: token } }
      )
      const d = await r.json()
      const batch = d.tasks || []
      tasks.push(...batch)
      if (batch.length === 0 || d.last_page) break
    }

    const filtered = tasks.filter(t => {
      const name = (t.name || '').toLowerCase()
      const list = (t.list?.name || '').toLowerCase()
      const folder = (t.folder?.name || '').toLowerCase()
      if (name.includes('marker') || name.includes('marker.io')) return false
      if (name.includes('widget for ')) return false
      if (name.includes('clickup setup')) return false
      if (name.includes('double check clients')) return false
      if (name.includes('replace this picture') || name.includes('repalce this picture')) return false
      if (name.includes('change the image with the uploaded image')) return false
      if (list.includes('marker') || folder.includes('marker')) return false
      return true
    })

    return filtered.map(t => ({
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

Extract EVERY actionable item. Be comprehensive — more items is always better than fewer.

INCLUDE:
- Every Slack message needing Rysiu's reply, decision, review, or approval
- Every unread Gmail from a client or colleague needing action
- Every open ClickUp task assigned to Rysiu — list EACH task individually
- Every support ticket from the #support channel

SKIP ONLY:
- Pure automated bot messages with no human action needed
- Product marketing newsletters and tool emails (ClickUp product updates, Loom, Slack marketing)
- Calendar accept/decline automations
- ClickUp tasks that are internal tool setup (Marker.io widgets, ClickUp setup, template tasks)
- ClickUp bulk QA image tasks (change image, replace picture) — bulk template tasks
- Any ClickUp task with status complete or closed

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
${JSON.stringify(slackData).slice(0, 12000)}

## GMAIL (${Array.isArray(gmailData) ? gmailData.length : 0} emails):
${JSON.stringify(gmailData).slice(0, 8000)}

## CLICKUP (${Array.isArray(clickupData) ? clickupData.length : 0} tasks):
${JSON.stringify(clickupData).slice(0, 5000)}

## SUPPORT TICKETS from #support channel (${Array.isArray(supportData) ? supportData.length : 0} tickets — treat ALL as actionable):
${JSON.stringify(supportData).slice(0, 4000)}`

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
