import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Login from './Login.jsx'

function Root() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('tm_auth') === '1')
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode><Root /></StrictMode>
)
