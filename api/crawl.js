export const config = { maxDuration: 120 }

const CRAWL_PROMPT = `You are a personal task extraction assistant for Rysiu at Klingit. Crawl Slack, Gmail and ClickUp and extract every item needing action. Ignore newsletters, marketing emails, calendar notifications, automated tool emails. Return ONLY a valid JSON array, no markdown, no explanation. Each item: { "id": "unique-string", "title": "what needs doing max 120 chars", "detail": "1 sentence context max 200 chars", "source": "slack or gmail or clickup", "category": "fire or email or client or clickup or internal", "urgency": "high or medium or low", "who": "person waiting or null", "when": "date string or null", "link": "url or null" }. Sort: fire first, then email, client, clickup, internal.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  const mcpServers = []
  if (process.env.SLACK_MCP_TOKEN) mcpServers.push({ type: 'url', url: 'https://mcp.slack.com/mcp', name: 'slack', authorization_token: process.env.SLACK_MCP_TOKEN })
  if (process.env.CLICKUP_MCP_TOKEN) mcpServers.push({ type: 'url', url: 'https://mcp.clickup.com/mcp', name: 'clickup', authorization_token: process.env.CLICKUP_MCP_TOKEN })

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'mcp-client-2025-04-04',
  }

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: CRAWL_PROMPT }],
    mcp_servers: mcpServers,
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return res.status(502).json({ error: 'Anthropic API error', detail: data?.error?.message })
    }

    const textBlock = data.content?.find(b => b.type === 'text')
    if (!textBlock) {
      console.error('Full response:', JSON.stringify(data))
      return res.status(502).json({ error: 'No text response', raw: JSON.stringify(data).slice(0, 1000) })
    }

    console.log('Claude raw response:', textBlock.text.slice(0, 500))

    let tasks
    try {
      const clean = textBlock.text.replace(/```json|```/g, '').trim()
      tasks = JSON.parse(clean)
    } catch {
      console.error('Parse failed, raw text:', textBlock.text.slice(0, 500))
      return res.status(502).json({ 
        error: 'Invalid JSON from Claude', 
        raw: textBlock.text.slice(0, 500) 
      })
    }

    return res.status(200).json({ tasks, crawledAt: new Date().toISOString() })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}