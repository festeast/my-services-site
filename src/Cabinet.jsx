import { useEffect, useRef, useState } from 'react'
import './cabinet.css'

const ADV = [
  { id: 'risk', n: 'Риск-менеджер сюжета', d: 'Дыры в логике, слабые места, что может сломать книгу', p: 'Ты риск-менеджер литературного проекта. Разбирай идею автора как реестр рисков: для каждого риска укажи вероятность, влияние на читателя и меру снижения. Ищи сюжетные дыры, провисание темпа, нарушение логики мира, разрыв с ожиданиями жанра.' },
  { id: 'edit', n: 'Строгий редактор', d: 'Структура, темп, герои, стиль', p: 'Ты опытный редактор жанровой прозы (альтернативная история, попаданцы, спорт). Оценивай структуру, темп, мотивацию героев, диалоги и стиль. Будь честным и конкретным, предлагай правки с примерами.' },
  { id: 'hist', n: 'Историк-фактчекер', d: 'Достоверность эпох, оружия, быта, политики', p: 'Ты историк и фактчекер. Проверяй исторические, технологические и бытовые детали. Если не уверен в факте, прямо скажи и предложи, что проверить по источникам.' },
  { id: 'read', n: 'Читатель-скептик', d: 'Что зацепит и что оттолкнёт аудиторию', p: 'Ты читатель платформы Автор Тудей, любитель жанра. Реагируй как настоящий читатель: где заскучал бы, что зацепило, что раздражает, бросил бы после первой главы или нет.' },
  { id: 'pub', n: 'Риски публикации', d: 'Площадка, 18+, права, продвижение', p: 'Ты консультант по рискам публикации онлайн-книг: правила площадок, возрастные ограничения, реальные лица и события, чувствительные темы, продвижение. Ты не юрист: по правовым вопросам обозначай риски и советуй проверить у специалиста.' },
  { id: 'idea', n: 'Генератор идей', d: 'Развилки сюжета, повороты, названия', p: 'Ты креативный соавтор. Предлагай 3–5 неожиданных, но логичных вариантов: повороты, конфликты, названия, финалы. Для каждого коротко укажи плюс и риск.' },
]
const API = 'https://openrouter.ai/api/v1'
const ls = {
  get: (k, f) => { try { const v = localStorage.getItem(k); return v === null ? f : JSON.parse(v) } catch { return f } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage full or blocked */ } },
}

export default function Cabinet() {
  const [key, setKey] = useState(() => sessionStorage.getItem('or_key') || ls.get('or_key', ''))
  const [input, setInput] = useState('')
  const [remember, setRemember] = useState(true)
  const [models, setModels] = useState([])
  const [model, setModel] = useState(() => ls.get('cab_model', ''))
  const [cur, setCur] = useState(ADV[0].id)
  const [chats, setChats] = useState(() => ls.get('cab_chats', {}))
  const [notes, setNotes] = useState(() => ls.get('cab_notes', ''))
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ctl = useRef(null)
  const logRef = useRef(null)

  useEffect(() => { document.title = 'Кабинет автора' }, [])
  useEffect(() => {
    fetch(`${API}/models`).then((r) => r.json()).then((j) => {
      const free = (j.data || []).filter((m) => m.id.endsWith(':free')).map((m) => ({ id: m.id, name: m.name || m.id }))
      setModels(free)
      setModel((m) => (free.some((x) => x.id === m) ? m : free[0]?.id || ''))
    }).catch(() => setErr('Не удалось загрузить список бесплатных моделей.'))
  }, [])
  useEffect(() => { ls.set('cab_chats', chats) }, [chats])
  useEffect(() => { ls.set('cab_notes', notes) }, [notes])
  useEffect(() => { ls.set('cab_model', model) }, [model])
  useEffect(() => { logRef.current && (logRef.current.scrollTop = logRef.current.scrollHeight) }, [chats, cur])

  const adv = ADV.find((a) => a.id === cur)
  const msgs = chats[cur] || []
  const setMsgs = (fn) => setChats((c) => ({ ...c, [cur]: fn(c[cur] || []) }))

  function login(e) {
    e.preventDefault()
    const k = input.trim()
    if (!k) return
    sessionStorage.setItem('or_key', k)
    if (remember) ls.set('or_key', k)
    setKey(k)
  }
  function logout() {
    sessionStorage.removeItem('or_key')
    localStorage.removeItem('or_key')
    setKey(''); setInput('')
  }

  async function send(e) {
    e.preventDefault()
    const v = text.trim()
    if (!v || busy || !model) return
    const id = cur
    const history = [...(chats[id] || []), { role: 'user', content: v }]
    setChats((c) => ({ ...c, [id]: [...history, { role: 'assistant', content: '' }] }))
    setText(''); setErr(''); setBusy(true)
    const ctx = `[Роль]\n${adv.p}\nОтвечай по-русски, по делу, без воды. Ты помогаешь автору обсуждать его будущую книгу.\n[О книге автора]\n${notes || '(автор пока ничего не указал)'}\n[Конец инструкций. Далее диалог.]\n\n`
    const payload = history.slice(-20).map((m, i) => (i === 0 ? { ...m, content: ctx + m.content } : m))
    ctl.current = new AbortController()
    let acc = ''
    const write = (t) => setChats((c) => { const a = [...(c[id] || [])]; a[a.length - 1] = { role: 'assistant', content: t }; return { ...c, [id]: a } })
    try {
      const res = await fetch(`${API}/chat/completions`, {
        method: 'POST', signal: ctl.current.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'HTTP-Referer': location.origin },
        body: JSON.stringify({ model, stream: true, messages: payload }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(res.status === 401 ? 'Ключ не принят. Проверьте его или выйдите и введите заново.' : res.status === 429 ? 'Лимит бесплатной модели исчерпан. Выберите другую модель или подождите.' : j.error?.message || `Ошибка ${res.status}`)
      }
      const reader = res.body.getReader(), dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop()
        for (const ln of lines) {
          if (!ln.startsWith('data: ') || ln.includes('[DONE]')) continue
          try {
            const j = JSON.parse(ln.slice(6))
            if (j.error) throw new Error(j.error.message || 'Ошибка модели')
            const d = j.choices?.[0]?.delta?.content
            if (d) { acc += d; write(acc) }
          } catch (x) { if (x.message && !(x instanceof SyntaxError)) throw x }
        }
      }
      if (!acc) throw new Error('Модель ничего не ответила. Попробуйте другую.')
    } catch (x) {
      if (x.name !== 'AbortError') setErr(x.message || 'Сбой сети')
      if (!acc) setChats((c) => ({ ...c, [id]: (c[id] || []).slice(0, -2) })), setText(v)
    }
    setBusy(false)
  }

  if (!key) {
    return (
      <div className="cab cab-login">
        <form onSubmit={login}>
          <h1>Кабинет автора</h1>
          <p>Личное пространство для обсуждения книги с ИИ-советниками. Введите ключ OpenRouter, чтобы войти.</p>
          <input type="password" autoComplete="off" placeholder="sk-or-v1-…" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Ключ OpenRouter" />
          <label className="chk"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Запомнить на этом устройстве</label>
          <button className="go" disabled={!input.trim()}>Войти</button>
          <p className="muted">Ключ бесплатно создаётся на <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>. Он хранится только в вашем браузере и не попадает на GitHub. <a href="#">На главную</a></p>
        </form>
      </div>
    )
  }

  return (
    <div className="cab">
      <header>
        <h1>Кабинет автора</h1>
        <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Бесплатная модель ИИ">
          {models.length === 0 && <option>Загрузка моделей…</option>}
          {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <a href="#" className="ghost">На главную</a>
        <button className="ghost" onClick={logout}>Выйти</button>
      </header>
      <div className="wrap">
        <nav>
          {ADV.map((a) => (
            <button key={a.id} className={a.id === cur ? 'on' : ''} disabled={busy} onClick={() => setCur(a.id)}>
              {a.n}<small>{a.d}</small>
            </button>
          ))}
          <div className="notes">
            <label htmlFor="bk">О моей книге (видят все советники)</label>
            <textarea id="bk" rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Жанр, сюжет, герои, мир, аудитория…" />
          </div>
        </nav>
        <main>
          <div className="log" ref={logRef}>
            {msgs.length === 0 && <p className="hint">{adv.n}: {adv.d}. Опишите идею и начнём. Чем подробнее заполнено поле «О моей книге», тем точнее советы.</p>}
            {msgs.map((m, i) => <div key={i} className={'m' + (m.role === 'user' ? ' me' : '')}>{m.content || '…'}</div>)}
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <form className="send" onSubmit={send}>
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Опишите идею, сцену или проблему…"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e) }} />
            {busy ? <button type="button" className="go" onClick={() => ctl.current?.abort()}>Стоп</button> : <button className="go" disabled={!text.trim() || !model}>Отправить</button>}
          </form>
          <div className="bar">
            <button className="ghost" disabled={busy || !msgs.length} onClick={() => confirm('Очистить этот чат?') && setMsgs(() => [])}>Очистить чат</button>
          </div>
        </main>
      </div>
    </div>
  )
}
