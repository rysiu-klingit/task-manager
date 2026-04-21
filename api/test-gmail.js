jsexport default async function handler(req, res) {
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    return res.status(200).json({ error: 'Missing credentials', refreshToken: !!refreshToken, clientId: !!clientId, clientSecret: !!clientSecret })
  }

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

    if (!tokenData.access_token) {
      return res.status(200).json({ step: 'token_exchange_failed', tokenData })
    }

    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+label:inbox&maxResults=5',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    )
    const listData = await listRes.json()

    return res.status(200).json({ step: 'success', messageCount: listData.messages?.length || 0, listData })
  } catch (err) {
    return res.status(200).json({ step: 'exception', error: err.message })
  }
}jsexport default async function handler(req, res) {
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    return res.status(200).json({ error: 'Missing credentials', refreshToken: !!refreshToken, clientId: !!clientId, clientSecret: !!clientSecret })
  }

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

    if (!tokenData.access_token) {
      return res.status(200).json({ step: 'token_exchange_failed', tokenData })
    }

    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+label:inbox&maxResults=5',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    )
    const listData = await listRes.json()

    return res.status(200).json({ step: 'success', messageCount: listData.messages?.length || 0, listData })
  } catch (err) {
    return res.status(200).json({ step: 'exception', error: err.message })
  }
}