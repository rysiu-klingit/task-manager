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
      for (const ch of (convs.channels || []).slice(0, 8)) {
        try {
          const histRes = await fetch(
            `https://slack.com/api/conversations.history?channel=${ch.id}&limit=10`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const hist = await histRes.json()
          if (hist.ok) results.push(...(hist.messages || []).map(m => ({
            channel: ch.name || ch.id, text: m.text, ts: m.ts
          })))
        } catch {}
      }
      return results.slice(0, 40)
    }

    return messages.slice(0, 40).map(m => ({
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

  const [slackData, clickupData] = await Promise.all([
    process.env.SLACK_MCP_TOKEN ? getSlackData(process.env.SLACK_MCP_TOKEN) : 'No Slack token',
    process.env.CLICKUP_MCP_TOKEN ? getClickUpTasks(process.env.CLICKUP_MCP_TOKEN) : 'No ClickUp token',
  ])

  console.log('Slack:', Array.isArray(slackData) ? `${slackData.length} messages` : slackData)
  console.log('ClickUp:', Array.isArray(clickupData) ? `${clickupData.length} tasks` : clickupData)

  const prompt = `You are a personal task assistant for Rysiu at Klingit web agency. Extract every actionable item from the data below. Return ONLY a valid JSON array, no markdown.

SLACK MESSAGES:
${JSON.stringify(slackData).slice(0, 8000)}

CLICKUP TASKS:
${JSON.stringify(clickupData).slice(0, 4000)}

Each item: { "id": "unique-string", "title": "what needs doing max 120 chars", "detail": "who is waiting and context max 200 chars", "source": "slack or clickup", "category": "fire or email or client or clickup or internal", "urgency": "high or medium or low", "who": "person or null", "when": "date or null", "link": "url or null" }

Sort: fire first, then email, client, clickup, internal. Ignore bot messages, automated notifications, resolved items.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
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