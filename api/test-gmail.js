export default async function handler(req, res) {
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    return res.status(200).json({ error: 'Missing credentials', has: { refreshToken: !!refreshToken, clientId: !!clientId, clientSecret: !!clientSecret } })
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) return res.status(200).json({ step: 'token_failed', tokenData })

    const access = tokenData.access_token

    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+label:inbox+newer_than:14d&maxResults=50',
      { headers: { Authorization: `Bearer ${access}` } }
    )
    const list = await listRes.json()
    const messages = list.messages || []

    const details = await Promise.all(
      messages.slice(0, 20).map(async m => {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${access}` } }
        )
        const msg = await r.json()
        const h = msg.payload?.headers || []
        const get = n => h.find(x => x.name === n)?.value || ''
        return { subject: get('Subject'), from: get('From'), date: get('Date'), snippet: msg.snippet?.slice(0, 100) }
      })
    )

    return res.status(200).json({ totalUnread: list.resultSizeEstimate, fetched: details.length, messages: details })
  } catch (err) {
    return res.status(200).json({ error: err.message })
  }
}
