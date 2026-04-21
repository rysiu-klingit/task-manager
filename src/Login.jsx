import { useState } from 'react'

const PASSWORD = 'DemoKlingit2026'

const B = {
  cream: '#f6ecd8',
  white: '#ffffff',
  black: '#0f0f0f',
  border: '#e2e8f0',
  textMuted: '#718096',
  textLight: '#a0aec0',
  error: '#e53e3e',
}

export default function Login({ onSuccess }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const attempt = () => {
    if (value === PASSWORD) {
      sessionStorage.setItem('tm_auth', '1')
      onSuccess()
    } else {
      setError(true)
      setShake(true)
      setValue('')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: B.cream,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
    }}>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        @keyframes fadeIn {
          from{opacity:0;transform:translateY(12px)}
          to{opacity:1;transform:translateY(0)}
        }
        *{box-sizing:border-box}
        input{font-family:inherit}
        button{font-family:inherit;cursor:pointer}
      `}</style>

      <div style={{
        background: B.white, borderRadius: 20, padding: '48px 44px',
        width: '100%', maxWidth: 400,
        border: `1px solid ${B.border}`,
        boxShadow: '0 8px 40px rgba(0,0,0,.08)',
        animation: 'fadeIn .3s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="/klingit-logo.png" alt="Klingit" style={{ height: 28, marginBottom: 20 }} />
          <div style={{ fontSize: 20, fontWeight: 800, color: B.black, marginBottom: 6 }}>Task Manager</div>
          <div style={{ fontSize: 13, color: B.textMuted }}>Enter your password to continue</div>
        </div>

        {/* Input */}
        <div style={{ animation: shake ? 'shake .5s ease' : 'none', marginBottom: 14 }}>
          <input
            type="password"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false) }}
            onKeyDown={e => e.key === 'Enter' && attempt()}
            placeholder="Password"
            autoFocus
            style={{
              width: '100%', fontSize: 14, padding: '12px 16px',
              borderRadius: 10, outline: 'none',
              border: `1.5px solid ${error ? B.error : B.border}`,
              background: error ? '#fff5f5' : B.white,
              color: B.black, transition: 'border-color .15s',
            }}
          />
          {error && <div style={{ fontSize: 12, color: B.error, marginTop: 6, fontWeight: 500 }}>Incorrect password. Try again.</div>}
        </div>

        {/* Button */}
        <button onClick={attempt} style={{
          width: '100%', fontSize: 13, fontWeight: 700, padding: '12px',
          borderRadius: 10, border: 'none',
          background: B.black, color: B.white,
          letterSpacing: '.02em', transition: 'opacity .15s',
        }}>
          Sign in
        </button>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: B.textLight }}>
          Klingit internal tool · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
