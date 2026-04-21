export const config = { maxDuration: 120 }

async function getSlackData(token) {
  try {
    const searchRes = await fetch(
      'https://slack.com/api/search.messages?query=to%3Ame&count=50&sort=timestamp&sort_dir=desc',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const search = await searchRes.json()
    const messages = search?.messages?.matches || []

    if (!messages.length) {
      const convsRes = await fetch(
        'https://slack.com/api/conversations.list?types=public_channel,private_channel,im,mpim&limit=20',
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const convs = await convsRes.json()
      const results = []
      for (const ch of (convs.channels || []).slice(0, 10)) {
        try {
          const histRes = await fetch(
            `https://slack.com/api/conversations.history?channel=${ch.id}&limit=15`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const hist = await histRes.json()
          if (hist.ok) results.push(...(hist.messages || []).map(m => ({
            channel: ch.name || ch.id, text: m.text, ts: m.ts
          })))
        } catch {}
      }
      return results.slice(0, 50)
    }

    return messages.slice(0, 50).map(m => ({
      channel: m.channel?.name,
      text: m.text,
      ts: m.ts,
      username: m.username,
      permalink: m.permalink,
    }))
  } catch (err) {
    return `Slack error: ${err.message}`
  }
}

async function getGmailData(refreshToken, clientId, clientSecret) {
  try {
    // Exchange refresh token for access token
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

    const accessToken = tokenData.access_token

    // Search for unread emails in inbox
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+label:inbox+newer_than:14d&maxResults=30',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const list = await listRes.json()
    const messages = list.messages || []

    // Fetch details for each message
    const details = await Promise.all(
      messages.slice(0, 20).map(async m => {
        try {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          const msg = await msgRes.json()
          const headers = msg.payload?.headers || []
          const get = name => headers.find(h => h.name === name)?.value || ''
          return {
            id: m.id,
            subject: get('Subject'),
            from: get('From'),
            date: get('Date'),
            snippet: msg.snippet,
          }
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
      `https://api.clickup.com/api/v2/team/${teamId}/task?assignee=me&include_closed=false&subtasks=true`,
      { headers: { Authorization: token } }
    )
    const tasks = await tasksRes.json()

    return (tasks.tasks || []).slice(0, 50).map(t => ({
      id: t.id,
      name: t.name,
      status: t.status?.status,
      priority: t.priority?.priority,
      due_date: t.due_date,
      list: t.list?.name,
      folder: t.folder?.name,
      url: t.url,
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

  console.log('Slack:', Array.isArray(slackData) ? `${slackData.length} messages` : slackData)
  console.log('Gmail:', Array.isArray(gmailData) ? `${gmailData.length} emails` : gmailData)
  console.log('ClickUp:', Array.isArray(clickupData) ? `${clickupData.length} tasks` : clickupData)

  const prompt = `You are a personal task assistant for Rysiu at Klingit, a creative web agency in Stockholm. Extract every actionable item from the data below. Return ONLY a valid JSON array, no markdown, no explanation.

SLACK MESSAGES (recent):
${JSON.stringify(slackData).slice(0, 6000)}

GMAIL UNREAD EMAILS:
${JSON.stringify(gmailData).slice(0, 4000)}

CLICKUP TASKS (assigned to Rysiu):
${JSON.stringify(clickupData).slice(0, 3000)}

Each item must have:
{
  "id": "unique stable string e.g. slack-linn-nav or gmail-geomatikk-invoice",
  "title": "plain English, what needs doing, max 120 chars",
  "detail": "who is waiting and context, max 200 chars",
  "source": "slack" or "gmail" or "clickup",
  "category": "fire" or "email" or "client" or "clickup" or "internal",
  "urgency": "high" or "medium" or "low",
  "who": "person name or null",
  "when": "readable date or null",
  "link": "url or null"
}

Ignore: bot messages, newsletters, automated notifications, marketing emails, calendar accepts/declines, tool emails (ClickUp/Loom/Slack marketing).
Sort: fire first, email, client, clickup, internal.`

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
