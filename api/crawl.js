export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

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
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: 'Return a JSON array of 5 sample work tasks. Each must have: id, title, detail, source (slack/gmail/clickup), category (fire/email/client/clickup/internal), urgency (high/medium/low), who, when, link (null). Return ONLY the JSON array, no markdown.'
        }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(502).json({ error: 'Anthropic API error', detail: data?.error?.message })
    }

    const textBlock = data.content?.find(b => b.type === 'text')
    const tasks = JSON.parse(textBlock.text.replace(/```json|```/g, '').trim())
    return res.status(200).json({ tasks, crawledAt: new Date().toISOString() })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}