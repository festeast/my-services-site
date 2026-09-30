import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Cabinet from './Cabinet.jsx'
import './App.css'

// Кабинет открывается только по адресу /#cabinet и нигде не упомянут на сайте.
function Root() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash === '#cabinet' ? <><div className="aurora" aria-hidden="true"><i /><i /><i /></div><Cabinet /></> : <App />
}

createRoot(document.getElementById('root')).render(<Root />)
