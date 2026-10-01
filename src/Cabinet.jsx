import { useEffect, useRef, useState } from 'react'
import './cabinet.css'

const ADV = [
  { id: 'risk', n: 'Риск-менеджер', c: '#ff7a59', p: 'Ты риск-менеджер литературного проекта. Назови самый опасный риск для книги, его вероятность и конкретную меру защиты.' },
  { id: 'edit', n: 'Редактор', c: '#2b7cff', p: 'Ты строгий редактор жанровой прозы. Оцени структуру, темп, героев или стиль и предложи одну конкретную правку.' },
  { id: 'hist', n: 'Историк', c: '#c99a3b', p: 'Ты историк и фактчекер. Проверь достоверность деталей эпохи, техники, быта. Если не уверен в факте, скажи прямо.' },
  { id: 'read', n: 'Читатель', c: '#19e3d1', p: 'Ты читатель платформы Автор Тудей, любитель жанра. Скажи честно, что зацепило, где заскучал бы и дочитал бы ты до конца.' },
  { id: 'pub', n: 'Публикация', c: '#b48cff', p: 'Ты консультант по рискам публикации: правила площадок, возрастные ограничения, реальные лица и события, продвижение. Ты не юрист, по праву советуй проверить у специалиста.' },
  { id: 'idea', n: 'Соавтор идей', c: '#7be36b', p: 'Ты креативный соавтор. Предложи один неожиданный, но логичный ход, поворот или название и коротко укажи его риск.' },
]
const MOD = { n: 'Модератор', c: '#f5e6a8' }
const ME = { n: 'Вы', c: '#8fb0c9' }
const who = (id) => (id === 'me' ? ME : id === 'mod' ? MOD : ADV.find((a) => a.id === id))
const API = 'https://openrouter.ai/api/v1'
const RULE = 'Ответь ОЧЕНЬ коротко: 2-3 предложения, не больше 60 слов, без вступлений и списков. Только самое ценное и конкретное. Можешь коротко согласиться или возразить другому участнику по имени. Если в [Материале автора] есть фрагменты книги, опирайся на них. Отвечай по-русски.'
const M_INTRO = 'Ты модератор обсуждения книги. В одном-двух предложениях (до 35 слов) сформулируй главный вопрос, который сейчас стоит перед экспертами, и предложи им высказаться. Отвечай по-русски.'
const M_SUM = 'Ты модератор. Подведи итог сеанса, до 90 слов, тремя короткими пунктами: 1) в чём эксперты сошлись, 2) главный спор или риск, 3) что автору сделать дальше. В конце задай автору один уточняющий вопрос. Отвечай по-русски.'

const ls = {
  get: (k, f) => { try { const v = localStorage.getItem(k); return v === null ? f : JSON.parse(v) } catch { return f } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage blocked */ } },
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
const idbDo = async (mode, fn) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('cab_lib_db', 1); r.onupgradeneeded = () => r.result.createObjectStore('docs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  return new Promise((res, rej) => { const t = db.transaction('docs', mode); const rq = fn(t.objectStore('docs')); t.oncomplete = () => res(rq?.result); t.onerror = () => rej(t.error) })
}
const docGet = (id) => idbDo('readonly', (st) => st.get(id))
const docPut = (id, v) => idbDo('readwrite', (st) => st.put(v, id))
const docDel = (id) => idbDo('readwrite', (st) => st.delete(id))

function chaptersOf(text) {
  const re = /^[ \t]*((?:глава|chapter|часть|пролог|эпилог)\b[^\n]{0,80})$/gim
  const out = []
  let m
  while ((m = re.exec(text))) out.push({ title: m[1].trim(), at: m.index })
  return out.length > 1 ? out : []
}
function plain(name, raw) {
  if (!/\.(fb2|html?|xml)$/i.test(name)) return raw
  const d = new DOMParser().parseFromString(raw, /\.(fb2|xml)$/i.test(name) ? 'application/xml' : 'text/html')
  const ps = [...d.querySelectorAll('p,h1,h2,h3')].map((e) => e.textContent.trim()).filter(Boolean)
  return ps.length ? ps.join('\n') : d.documentElement.textContent
}
// Достаём из книги нужное: главу по номеру ("глава 5") или самые подходящие фрагменты по словам вопроса.
function pickPassages(docs, query) {
  const used = []
  let out = ''
  const num = query.match(/глав\S*\s*(?:№\s*)?(\d+)/i)
  const stems = [...new Set((query.toLowerCase().match(/[a-zа-яё]{4,}/g) || []).map((w) => w.slice(0, 5)))]
  for (const d of docs) {
    const ch = chaptersOf(d.text)
    if (num && ch.length) {
      const n = +num[1]
      let i = ch.findIndex((c) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(c.title))
      if (i < 0 && n <= ch.length) i = n - 1
      if (i >= 0) {
        const a = ch[i].at, b = ch[i + 1]?.at ?? d.text.length
        out += `\n--- ${d.name}, ${ch[i].title} ---\n${d.text.slice(a, Math.min(b, a + 6000))}\n`
        used.push(`${d.name}: ${ch[i].title}`)
        continue
      }
    }
    const size = 1500, scored = []
    for (let p = 0; p < d.text.length; p += size) {
      const t = d.text.slice(p, p + size), l = t.toLowerCase()
      scored.push({ p, t, s: stems.reduce((n, w) => n + (l.split(w).length - 1), 0) })
    }
    const top = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).sort((a, b) => a.p - b.p)
    const use = top.length ? top : scored.slice(0, 2)
    out += `\n--- ${d.name} ---\n${use.map((x) => x.t).join('\n[…]\n')}\n`
    used.push(`${d.name}: ${top.length ? `фрагментов найдено: ${top.length}` : 'начало текста'}`)
  }
  return { text: out.slice(0, 14000), used }
}

async function stream(key, model, prompt, onText, signal) {
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'HTTP-Referer': location.origin },
    body: JSON.stringify({ model, stream: true, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(res.status === 401 ? 'Ключ не принят. Выйдите и введите заново.' : res.status === 429 ? 'Лимит бесплатной модели исчерпан. Выберите другую модель или подождите.' : j.error?.message || `Ошибка ${res.status}`)
  }
  const reader = res.body.getReader(), dec = new TextDecoder()
  let buf = '', acc = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n'); buf = lines.pop()
    for (const ln of lines) {
      if (!ln.startsWith('data: ') || ln.includes('[DONE]')) continue
      let j
      try { j = JSON.parse(ln.slice(6)) } catch { continue }
      if (j.error) throw new Error(j.error.message || 'Ошибка модели')
      const d = j.choices?.[0]?.delta?.content
      if (d) { acc += d; onText(acc) }
    }
  }
  return acc
}

function Chips({ pick, setPick, disabled }) {
  const all = pick.length === ADV.length
  const toggle = (id) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  return (
    <div className="chips" role="group" aria-label="Кто отвечает">
      <button type="button" disabled={disabled} aria-pressed={all} onClick={() => setPick(all ? [] : ADV.map((a) => a.id))}>Все</button>
      {ADV.map((a) => (
        <button key={a.id} type="button" disabled={disabled} aria-pressed={pick.includes(a.id)} style={{ '--c': a.c }} onClick={() => toggle(a.id)}>
          <i />{a.n}
        </button>
      ))}
    </div>
  )
}

export default function Cabinet() {
  const [key, setKey] = useState(() => sessionStorage.getItem('or_key') || ls.get('or_key', ''))
  const [input, setInput] = useState('')
  const [remember, setRemember] = useState(true)
  const [models, setModels] = useState([])
  const [model, setModel] = useState(() => ls.get('cab_model', ''))
  const [sessions, setSessions] = useState(() => ls.get('cab_sessions', []))
  const [sid, setSid] = useState(null)
  const [notes, setNotes] = useState(() => ls.get('cab_notes', ''))
  const [topic, setTopic] = useState('')
  const [lib, setLib] = useState(() => ls.get('cab_lib', []))
  const [attach, setAttach] = useState([])
  const [link, setLink] = useState('')
  const [busyLib, setBusyLib] = useState(false)
  const [pick, setPick] = useState(ADV.map((a) => a.id))
  const [q, setQ] = useState('')
  const [speaking, setSpeaking] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ctl = useRef(null)
  const feed = useRef(null)
  const cur = sessions.find((s) => s.id === sid)

  useEffect(() => { document.title = 'Кабинет автора' }, [])
  useEffect(() => {
    fetch(`${API}/models`).then((r) => r.json()).then((j) => {
      const free = (j.data || []).filter((m) => m.id.endsWith(':free')).map((m) => ({ id: m.id, name: m.name || m.id }))
      setModels(free)
      setModel((m) => (free.some((x) => x.id === m) ? m : free[0]?.id || ''))
    }).catch(() => setErr('Не удалось загрузить список бесплатных моделей.'))
  }, [])
  useEffect(() => { if (!busy) ls.set('cab_sessions', sessions.slice(0, 30)) }, [sessions, busy])
  useEffect(() => { ls.set('cab_notes', notes) }, [notes])
  useEffect(() => { ls.set('cab_lib', lib) }, [lib])
  useEffect(() => { ls.set('cab_model', model) }, [model])
  useEffect(() => { feed.current && (feed.current.scrollTop = feed.current.scrollHeight) }, [sessions, sid])

  function login(e) {
    e.preventDefault()
    const k = input.trim()
    if (!k) return
    sessionStorage.setItem('or_key', k)
    if (remember) ls.set('or_key', k)
    setKey(k)
  }
  function logout() {
    sessionStorage.removeItem('or_key'); localStorage.removeItem('or_key'); setKey(''); setInput(''); setSid(null)
  }
  async function addDoc(meta, text) {
    await docPut(meta.id, text)
    setLib((l) => [meta, ...l]); setAttach((a) => [meta.id, ...a])
  }
  async function onFile(e) {
    const fs = [...(e.target.files || [])]
    e.target.value = ''
    setBusyLib(true); setErr('')
    for (const f of fs) {
      if (!/\.(txt|md|text|fb2|html?|xml)$/i.test(f.name)) { setErr('Поддерживаются .txt, .md, .fb2, .html. Word сохраните как .txt или вставьте текст в поле.'); continue }
      try {
        const buf = await f.arrayBuffer()
        let raw
        try { raw = new TextDecoder('utf-8', { fatal: true }).decode(buf) } catch { raw = new TextDecoder('windows-1251').decode(buf) }
        const text = plain(f.name, raw)
        await addDoc({ id: uid(), name: f.name, kind: 'file', size: text.length, chapters: chaptersOf(text).length }, text)
      } catch { setErr(`Не удалось сохранить файл ${f.name}`) }
    }
    setBusyLib(false)
  }
  async function addLink() {
    const u = link.trim()
    if (!/^https?:\/\//i.test(u)) { setErr('Ссылка должна начинаться с http:// или https://'); return }
    setBusyLib(true); setErr('')
    try {
      const r = await fetch(`https://r.jina.ai/${u}`)
      if (!r.ok) throw new Error('bad')
      const text = (await r.text()).trim()
      if (text.length < 200) throw new Error('short')
      await addDoc({ id: uid(), name: u.replace(/^https?:\/\//, '').slice(0, 60), kind: 'link', url: u, size: text.length, chapters: chaptersOf(text).length }, text)
      setLink('')
    } catch { setErr('Не удалось прочитать страницу по ссылке (возможно, нужен вход на сайт). Сохраните главу в .txt и добавьте файлом.') }
    setBusyLib(false)
  }
  async function removeDoc(id) {
    if (!confirm('Убрать из библиотеки?')) return
    await docDel(id).catch(() => {})
    setLib((l) => l.filter((d) => d.id !== id)); setAttach((a) => a.filter((x) => x !== id))
    setSessions((ss) => ss.map((x) => ({ ...x, docs: (x.docs || []).filter((d) => d !== id) })))
  }
  const toggleDoc = (id) => setSessions((ss) => ss.map((x) => (x.id === sid ? { ...x, docs: (x.docs || []).includes(id) ? x.docs.filter((d) => d !== id) : [...(x.docs || []), id] } : x)))

  async function runRound(id, question, base) {
    const ids = ADV.filter((a) => pick.includes(a.id))
    setBusy(true); setErr('')
    const ac = new AbortController(); ctl.current = ac
    const tr = [...base.turns]
    let material = ''
    const upd = (fn) => setSessions((s) => s.map((x) => (x.id === id ? { ...x, turns: fn(x.turns) } : x)))
    const add = (t) => { tr.push(t); upd((ts) => [...ts, t]); return tr.length - 1 }
    const say = async (w, kind, instr) => {
      const i = add({ who: w, kind, text: '' })
      setSpeaking(w)
      const hist = tr.slice(Math.max(0, i - 16), i).filter((t) => t.kind !== 'src').map((t) => `${who(t.who).n}: ${t.text.slice(0, 600)}`).join('\n')
      const prompt = `${instr}\n\n[О книге автора]\n${notes || 'не указано'}\n[Материал автора]\n${material || 'нет'}\n[Ход обсуждения]\n${hist}\n\nТвоя реплика (${who(w).n}):`
      try {
        const t = await stream(key, model, prompt, (x) => { tr[i].text = x; upd((ts) => { const a = [...ts]; a[i] = { ...a[i], text: x }; return a }) }, ac.signal)
        if (!t.trim()) throw new Error('Модель ничего не ответила. Выберите другую модель.')
      } catch (e) {
        if (!tr[i].text) { tr.pop(); upd((ts) => ts.slice(0, -1)) }
        throw e
      }
    }
    try {
      add({ who: 'me', kind: 'q', text: question })
      const docs = []
      for (const d of base.docs || []) {
        const m = lib.find((x) => x.id === d), t = await docGet(d).catch(() => null)
        if (m && t) docs.push({ name: m.name, text: t })
      }
      if (docs.length) {
        const r = pickPassages(docs, question)
        material = r.text
        add({ who: 'mod', kind: 'src', text: `Из книги взято: ${r.used.join('; ')}` })
      }
      await say('mod', 'mod', M_INTRO)
      for (const a of ids) await say(a.id, 'adv', `${a.p}\n${RULE}`)
      await say('mod', 'sum', M_SUM)
    } catch (e) { if (e.name !== 'AbortError') setErr(e.message || 'Сбой сети') }
    setSpeaking(''); setBusy(false)
  }

  function start(e) {
    e.preventDefault()
    const t = topic.trim()
    if (!t || busy || !model || !pick.length) return
    const s = { id: uid(), title: t.slice(0, 60), created: Date.now(), docs: attach, turns: [] }
    setSessions((x) => [s, ...x]); setSid(s.id); setTopic('')
    runRound(s.id, t, s)
  }
  function ask(e) {
    e.preventDefault()
    const v = q.trim()
    if (!v || busy || !pick.length) return
    setQ(''); runRound(cur.id, v, cur)
  }
  function del(id) { if (confirm('Удалить это обсуждение?')) setSessions((s) => s.filter((x) => x.id !== id)) }

  if (!key) {
    return (
      <div className="cab cab-login">
        <form onSubmit={login}>
          <h1>Кабинет автора</h1>
          <p>Личное пространство для обсуждения книги с ИИ-советниками. Введите ключ OpenRouter, чтобы войти.</p>
          <input type="password" autoComplete="off" placeholder="sk-or-v1-…" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Ключ OpenRouter" />
          <label className="chk"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Запомнить на этом устройстве</label>
          <button className="go" disabled={!input.trim()}>Войти</button>
          <p className="muted">Ключ бесплатно создаётся на <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>. Он хранится только в вашем браузере. <a href="#">На главную</a></p>
        </form>
      </div>
    )
  }

  const top = (
    <header>
      {cur ? <button className="ghost" disabled={busy} onClick={() => setSid(null)}>← К началу</button> : <h1>Кабинет автора</h1>}
      {cur && <h1 className="ttl">{cur.title}</h1>}
      <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Бесплатная модель ИИ" disabled={busy}>
        {models.length === 0 && <option>Загрузка моделей…</option>}
        {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <a href="#" className="ghost">На главную</a>
      <button className="ghost" onClick={logout}>Выйти</button>
    </header>
  )

  if (!cur) {
    return (
      <div className="cab">
        {top}
        <div className="home">
          <form onSubmit={start}>
            <h2>Что сегодня обсуждаем?</h2>
            <textarea rows={5} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Опишите идею, вставьте главу или сформулируйте вопрос…" aria-label="Тема обсуждения" />
            <p className="lbl">Библиотека книги (хранится в этом браузере, отметьте, что брать в обсуждение)</p>
            <div className="lib">
              {lib.map((d) => (
                <div key={d.id} className="doc">
                  <label>
                    <input type="checkbox" checked={attach.includes(d.id)} onChange={() => setAttach((a) => (a.includes(d.id) ? a.filter((x) => x !== d.id) : [...a, d.id]))} />
                    <span><b>{d.name}</b><small>{d.kind === 'link' ? 'ссылка' : 'файл'} · {Math.round(d.size / 1000)} тыс. знаков · глав: {d.chapters}</small></span>
                  </label>
                  <button type="button" className="ghost" onClick={() => removeDoc(d.id)}>Убрать</button>
                </div>
              ))}
              <div className="row">
                <label className="ghost file">{busyLib ? 'Загружаю…' : 'Добавить файлы (.txt .md .fb2 .html)'}
                  <input type="file" multiple accept=".txt,.md,.text,.fb2,.html,.htm,.xml" onChange={onFile} hidden />
                </label>
              </div>
              <div className="row">
                <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Ссылка на главу или книгу" aria-label="Ссылка на книгу"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} />
                <button type="button" className="ghost" disabled={!link.trim() || busyLib} onClick={addLink}>Добавить ссылку</button>
              </div>
            </div>
            <p className="lbl">Кто участвует</p>
            <Chips pick={pick} setPick={setPick} />
            <details>
              <summary>О моей книге (видят все участники)</summary>
              <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Жанр, сюжет, герои, мир, аудитория…" />
            </details>
            {err && <p className="err" role="alert">{err}</p>}
            <button className="go" disabled={!topic.trim() || !model || !pick.length}>Начать обсуждение</button>
          </form>
          {sessions.length > 0 && (
            <section className="prev">
              <h3>Продолжить прошлый разговор</h3>
              {sessions.slice(0, 5).map((s) => (
                <div key={s.id} className="sess">
                  <button onClick={() => setSid(s.id)}><b>{s.title}</b><small>{new Date(s.created).toLocaleDateString('ru-RU')} · реплик: {s.turns.length}</small></button>
                  <button className="ghost" onClick={() => del(s.id)} aria-label="Удалить обсуждение">Удалить</button>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="cab">
      {top}
      <div className="table" ref={feed}>
        {cur.turns.map((t, i) => {
          if (t.kind === 'src') return <p key={i} className="muted srcnote">{t.text}</p>
          const w = who(t.who)
          const live = busy && speaking === t.who && i === cur.turns.length - 1
          return (
            <article key={i} className={`card ${t.kind}`} style={{ '--c': w.c }}>
              <h3><i />{w.n}{t.kind === 'sum' && ' · вывод сеанса'}</h3>
              <p>{t.text}{live && <span className="cur" />}</p>
            </article>
          )
        })}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="ask">
        {busy ? (
          <div className="row"><span className="say"><i />Сейчас говорит: {who(speaking)?.n}</span><button className="go" onClick={() => ctl.current?.abort()}>Стоп</button></div>
        ) : (
          <form onSubmit={ask}>
            {lib.length > 0 && (
              <>
                <p className="lbl">Материалы из книги для ответа</p>
                <div className="chips">
                  {lib.map((d) => <button type="button" key={d.id} aria-pressed={(cur.docs || []).includes(d.id)} onClick={() => toggleDoc(d.id)}><i />{d.name}</button>)}
                </div>
              </>
            )}
            <p className="lbl">Кто отвечает на ваш вопрос</p>
            <Chips pick={pick} setPick={setPick} />
            <div className="row">
              <textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ваш вопрос… например: «проверь главу 5»" aria-label="Следующий вопрос" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(e) }} />
              <button className="go" disabled={!q.trim() || !pick.length}>Спросить</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
