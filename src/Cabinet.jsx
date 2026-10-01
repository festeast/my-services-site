import { useEffect, useRef, useState } from 'react'
import './cabinet.css'

const ADV = [
  { id: 'risk', icon: '🛡️', n: 'Риск-менеджер', c: '#ff7a59', p: 'Ты риск-менеджер литературного проекта. Назови самый опасный риск для книги, его вероятность и конкретную меру защиты.' },
  { id: 'edit', icon: '✒️', n: 'Редактор', c: '#2b7cff', p: 'Ты строгий редактор жанровой прозы. Оцени структуру, темп, героев или стиль и предложи одну конкретную правку.' },
  { id: 'hist', icon: '📜', n: 'Историк', c: '#c99a3b', p: 'Ты историк и фактчекер. Проверь достоверность деталей эпохи, техники, быта. Если не уверен в факте, скажи прямо.' },
  { id: 'read', icon: '👓', n: 'Читатель', c: '#19e3d1', p: 'Ты читатель платформы Автор Тудей, любитель жанра. Скажи честно, что зацепило, где заскучал бы и дочитал бы ты до конца.' },
  { id: 'pub', icon: '⚖️', n: 'Публикация', c: '#b48cff', p: 'Ты консультант по рискам публикации: правила площадок, возрастные ограничения, реальные лица и события, продвижение. Ты не юрист, по праву советуй проверить у специалиста.' },
  { id: 'idea', icon: '💡', n: 'Соавтор идей', c: '#7be36b', p: 'Ты креативный соавтор. Предложи один неожиданный, но логичный ход, поворот или название и коротко укажи его риск.' },
]
const MOD = { n: 'Модератор', c: '#f5e6a8', icon: '🎙️' }
const ME = { n: 'Вы', c: '#8fb0c9', icon: '🙂' }
// Рецензенты описаны творческим подходом, а не именами реальных людей. Чтобы заменить значок на картинку, добавьте поле img: '/avatars/имя.png'.
const MASTERS = [
  { id: 'm19', n: 'Мастер XIX века', c: '#c99a3b', icon: '🕰️', p: 'Твой подход: классический реализм XIX века. Широкая картина общества, психологизм, нравственный выбор героя, неспешное подробное повествование, характеры важнее приключений.' },
  { id: 'm20', n: 'Мастер XX века', c: '#9ad0ff', icon: '🎞️', p: 'Твой подход: литература XX века. Подтекст и лаконизм, эксперименты с формой, антиутопия и социальная фантастика-притча, идея важнее эффектов, читатель достраивает недосказанное.' },
  { id: 'm21', n: 'Мастер XXI века', c: '#19e3d1', icon: '📱', p: 'Твой подход: современная сетевая проза. Быстрый темп, короткие главы, крючки в конце, кинематографичность, смешение жанров, внимание к читателю платформы и серии.' },
]
const REVIEW_RULE = 'Напиши короткую рецензию-комментарий в духе этого подхода и по его логике. Это ИИ-имитация творческого подхода, а не реальный человек: не называй себя настоящим автором и не приписывай себе чужих цитат. От первого лица, 3-4 предложения, не больше 70 слов: что в тексте работает по твоим принципам, что нет, один главный совет. Отвечай по-русски.'
const who = (id) => (id === 'me' ? ME : id === 'mod' ? MOD : id === 'mc' ? CUSTOM : ADV.find((a) => a.id === id) || MASTERS.find((a) => a.id === id))
const Av = ({ w, size = '' }) => <span className={`av ${size}`} style={{ '--c': w.c }} aria-hidden="true">{w.img ? <img src={w.img} alt="" /> : w.icon}</span>
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

const day = () => new Date().toISOString().slice(0, 10)
let onUsage = () => {}
function bump() { const u = ls.get('cab_used', {}); ls.set('cab_used', { d: day(), n: (u.d === day() ? u.n : 0) + 1 }); onUsage() }
const used = () => { const u = ls.get('cab_used', {}); return u.d === day() ? u.n : 0 }
function hit(id, raw) {
  const daily = /day|daily|сут/i.test(raw || '')
  const h = ls.get('cab_hit', {})
  h[id] = { until: daily ? Date.parse(day()) + 864e5 : Date.now() + 60000, daily }
  ls.set('cab_hit', h); onUsage()
}
const hits = () => Object.entries(ls.get('cab_hit', {})).filter(([, v]) => v.until > Date.now()).map(([id, v]) => ({ id, daily: v.daily }))
// Модели, которые не подходят для обычного чата (ошибки 400/403/404 или «только для агентов»), отключаются на 7 дней.
const markBad = (id) => { const b = ls.get('cab_bad', {}); b[id] = Date.now() + 6048e5; ls.set('cab_bad', b); onUsage() }
const isBad = (id) => (ls.get('cab_bad', {})[id] || 0) > Date.now()
const alive = (ids) => { const h = hits().map((x) => x.id), ok = ids.filter((i) => !isBad(i)), a = ok.filter((i) => !h.includes(i)); return a.length ? a : ok }
const short = (id) => id.split('/').pop().replace(':free', '') + (id.endsWith(':free') ? '' : ' 💳')
function UsageBar({ cap }) {
  const n = used(), pct = Math.min(100, Math.round((n / cap) * 100)), out = hits()
  return (
    <div className="usage" role="status">
      <span>Запросов сегодня: {n} из ~{cap} ({pct}%)</span>
      <span className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
      {out.length > 0 && <span className="out">Лимит исчерпан: {out.map((o) => `${short(o.id)} (${o.daily ? 'до завтра' : 'на минуту'})`).join(', ')}</span>}
    </div>
  )
}
const THEMES = [['aurora', 'Северное сияние'], ['sakura', 'Аниме: сакура'], ['neon', 'Аниме: неон-город'], ['fantasy', 'Фэнтези'], ['scifi', 'Фантастика'], ['history', 'Историческая проза'], ['noir', 'Детектив'], ['custom', 'Своя картинка']]
const CUSTOM = { id: 'mc', n: 'Свой мастер', c: '#ffd166', icon: '🧭' }
// Скорость моделей запоминается: быстрые и стабильные уходят в начало очереди «Авто».
const stat = () => ls.get('cab_stats', {})
function note(id, ok, ms) {
  const st = stat(), r = st[id] || { t: 6000 }
  r.t = ok ? Math.round(r.t * 0.6 + ms * 0.4) : r.t + 5000
  st[id] = r; ls.set('cab_stats', st)
}
async function stream(key, model, prompt, onText, signal, ttf = 0) {
  if (model.endsWith(':free')) bump()
  else { ls.set('cab_paidn', ls.get('cab_paidn', 0) + 1); onUsage() }
  const ac = new AbortController()
  const fwd = () => ac.abort()
  signal?.addEventListener('abort', fwd)
  const timer = ttf ? setTimeout(() => ac.abort(), ttf) : 0
  try { return await streamRaw(key, model, prompt, (x) => { clearTimeout(timer); onText(x) }, ac.signal) }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', fwd) }
}
async function streamRaw(key, model, prompt, onText, signal) {
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'HTTP-Referer': location.origin },
    body: JSON.stringify({ model, stream: true, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw Object.assign(new Error(res.status === 401 ? 'Ключ не принят. Выйдите и введите заново.' : res.status === 429 ? 'Лимит бесплатной модели исчерпан. Выберите другую модель или подождите.' : res.status === 402 ? 'Не хватает баланса на OpenRouter. Пополните его или выключите платные запросы.' : j.error?.message || `Ошибка ${res.status}`), { status: res.status, raw: JSON.stringify(j.error || {}) })
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
          <Av w={a} size="sm" />{a.n}
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
  const [model, setModel] = useState(() => ls.get('cab_model', 'auto'))
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
  const rot = useRef(0)
  const [fast, setFast] = useState(() => ls.get('cab_fast', true))
  const [theme, setTheme] = useState(() => ls.get('cab_theme', 'aurora'))
  const [custom, setCustom] = useState(() => ls.get('cab_custom', ''))
  const [, setTick] = useState(0)
  const [cap, setCap] = useState(50)
  const [showSet, setShowSet] = useState(false)
  const [paid, setPaid] = useState([])
  const [usePaid, setUsePaid] = useState(() => ls.get('cab_usepaid', false))
  const [paidModel, setPaidModel] = useState(() => ls.get('cab_paidm', ''))
  const [capMan, setCapMan] = useState(() => ls.get('cab_capman', 'auto'))
  const capEff = capMan === 'auto' ? cap : +capMan
  useEffect(() => { ls.set('cab_usepaid', usePaid); ls.set('cab_paidm', paidModel); ls.set('cab_capman', capMan) }, [usePaid, paidModel, capMan])
  useEffect(() => { onUsage = () => setTick((t) => t + 1); return () => { onUsage = () => {} } }, [])
  useEffect(() => {
    if (!key) return
    fetch(`${API}/key`, { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json()).then((j) => { if (j.data) setCap(j.data.is_free_tier === false ? 1000 : 50) }).catch(() => {})
  }, [key])
  const [showRev, setShowRev] = useState(() => innerWidth > 800)
  const [revQ, setRevQ] = useState('')
  const cur = sessions.find((s) => s.id === sid)
  const warn = used() >= capEff * 0.9 || hits().length > 0
  const masters = [...MASTERS, { ...CUSTOM, p: `Твой подход: ${custom}` }]

  useEffect(() => { document.title = 'Кабинет автора' }, [])
  useEffect(() => {
    fetch(`${API}/models`).then((r) => r.json()).then((j) => {
      const free = (j.data || []).filter((m) => m.id.endsWith(':free')).sort((a, b) => (b.context_length || 0) - (a.context_length || 0)).map((m) => ({ id: m.id, name: m.name || m.id }))
      setModels(free)
      setPaid((j.data || []).filter((m) => !m.id.endsWith(':free') && +m.pricing?.prompt > 0 && +m.pricing?.completion > 0 && (m.context_length || 0) >= 16000).map((m) => ({ id: m.id, name: m.name || m.id, c: (+m.pricing.prompt + +m.pricing.completion) * 1e6 })).sort((a, b) => a.c - b.c).slice(0, 15))
      setModel((m) => (m === 'auto' || (free.some((x) => x.id === m) && !isBad(m)) ? m : 'auto'))
    }).catch(() => setErr('Не удалось загрузить список бесплатных моделей.'))
  }, [])
  useEffect(() => { if (!busy) ls.set('cab_sessions', sessions.slice(0, 30)) }, [sessions, busy])
  useEffect(() => { ls.set('cab_notes', notes) }, [notes])
  useEffect(() => { ls.set('cab_lib', lib) }, [lib])
  useEffect(() => { ls.set('cab_fast', fast) }, [fast])
  useEffect(() => { ls.set('cab_custom', custom) }, [custom])
  useEffect(() => {
    ls.set('cab_theme', theme)
    document.body.dataset.cabTheme = theme
    return () => { delete document.body.dataset.cabTheme }
  }, [theme])
  useEffect(() => {
    docGet('bg_img').then((u) => u && document.body.style.setProperty('--bgimg', `url("${u}")`)).catch(() => {})
    return () => document.body.style.removeProperty('--bgimg')
  }, [])
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
  function onBg(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const r = new FileReader()
    r.onload = async () => {
      try { await docPut('bg_img', r.result) } catch { /* picture just won't persist */ }
      document.body.style.setProperty('--bgimg', `url("${r.result}")`); setTheme('custom')
    }
    r.readAsDataURL(f)
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

  // «Авто»: берутся 4 самые быстрые модели из истории; если модель молчит дольше 15 секунд или сбоит, идём к следующей.
  async function streamAuto(prompt, onText, signal, onModel) {
    const auto = model === 'auto'
    const st = stat()
    const paidOn = usePaid && paidModel
    const goPaid = () => { onModel(paidModel); return stream(key, paidModel, prompt, onText, signal, 0) }
    if (paidOn && used() >= capEff) return goPaid()
    const list = auto ? alive(models.map((m) => m.id)).sort((a, b) => (st[a]?.t ?? 6000) - (st[b]?.t ?? 6000)).slice(0, 4) : [model]
    if (!list.length && paidOn) return goPaid()
    if (!list.length) throw new Error('Нет доступных бесплатных моделей: список не загрузился или все отключены.')
    const from = auto ? rot.current++ : 0
    let last
    let lim = false
    for (let k = 0; k < list.length; k++) {
      const id = list[(from + k) % list.length], t0 = Date.now()
      try {
        onModel(id)
        const t = await stream(key, id, prompt, onText, signal, auto ? 15000 : 0)
        if (!t.trim()) throw new Error('Модель ничего не ответила.')
        note(id, true, Date.now() - t0)
        return t
      } catch (e) {
        if (signal.aborted || e.status === 401) throw e
        note(id, false)
        if (e.status === 429) { hit(id, e.raw); lim = true }
        const unfit = [400, 403, 404, 422].includes(e.status) || /harness|agentic|no endpoints|unsupported/i.test(`${e.raw || ''} ${e.message}`)
        if (unfit) { markBad(id); if (!auto) setModel('auto') }
        last = unfit ? new Error(`Модель ${short(id)} не подходит для обычного чата, я её отключил.`) : e.name === 'AbortError' ? new Error('Модель слишком долго молчит.') : e
      }
    }
    if (paidOn && lim) return goPaid()
    throw last
  }
  async function loadDocs(ids) {
    const out = []
    for (const d of ids || []) {
      const m = lib.find((x) => x.id === d), t = await docGet(d).catch(() => null)
      if (m && t) out.push({ name: m.name, text: t })
    }
    return out
  }
  async function runReview(m) {
    if (busy || !cur) return
    const id = cur.id
    const query = revQ.trim() || [...cur.turns].reverse().find((t) => t.kind === 'q')?.text || cur.title
    setBusy(true); setErr('')
    const ac = new AbortController(); ctl.current = ac
    const setR = (mid, v) => setSessions((ss) => ss.map((x) => (x.id === id ? { ...x, reviews: { ...(x.reviews || {}), [mid]: v } } : x)))
    try {
      const docs = await loadDocs(cur.docs)
      const mat = docs.length ? pickPassages(docs, query) : { text: '', used: [] }
      const target = mat.text || query
      if (target.length < 200) throw new Error('Добавьте книгу в материалы или вставьте отрывок (от 200 знаков) в поле рецензий.')
      setSessions((ss) => ss.map((x) => (x.id === id ? { ...x, revSrc: mat.used.join('; ') } : x)))
      {
        let cm = ''
        setSpeaking(m.id); setR(m.id, { text: '', m: '' })
        const prompt = `${m.p}\n${REVIEW_RULE}\n\n[О книге автора]\n${notes || 'не указано'}\n[Что рецензировать]\n${target.slice(0, 12000)}\n\nТвоя рецензия:`
        await streamAuto(prompt, (x) => setR(m.id, { text: x, m: cm }), ac.signal, (mid) => { cm = mid })
      }
    } catch (e) { if (e.name !== 'AbortError') setErr(e.message || 'Сбой сети') }
    setSpeaking(''); setBusy(false)
  }
  async function runRound(id, question, base) {
    const ids = ADV.filter((a) => pick.includes(a.id))
    setBusy(true); setErr('')
    const ac = new AbortController(); ctl.current = ac
    const tr = [...base.turns]
    let material = ''
    const upd = (fn) => setSessions((s) => s.map((x) => (x.id === id ? { ...x, turns: fn(x.turns) } : x)))
    const add = (t) => { tr.push(t); upd((ts) => [...ts, t]); return tr.length - 1 }
    const say = async (w, kind, instr, upto) => {
      const i = add({ who: w, kind, text: '' })
      setSpeaking(upto !== undefined ? 'all' : w)
      const u = upto ?? i
      const hist = tr.slice(Math.max(0, u - 16), u).filter((t) => t.kind !== 'src').map((t) => `${who(t.who).n}: ${t.text.slice(0, 600)}`).join('\n')
      const prompt = `${instr}\n\n[О книге автора]\n${notes || 'не указано'}\n[Материал автора]\n${material || 'нет'}\n[Ход обсуждения]\n${hist}\n\nТвоя реплика (${who(w).n}):`
      try {
        const t = await streamAuto(prompt, (x) => { tr[i].text = x; upd((ts) => { const a = [...ts]; a[i] = { ...a[i], text: x }; return a }) }, ac.signal, (mid) => { tr[i].m = mid; upd((ts) => { const a = [...ts]; a[i] = { ...a[i], m: mid }; return a }) })
        if (!t.trim()) throw new Error('Модель ничего не ответила. Выберите другую модель.')
      } catch (e) {
        if (!tr[i].text) { const msg = e.name === 'AbortError' ? 'Остановлено' : `Не смог ответить: ${e.message || 'ошибка'}`; tr[i].text = msg; upd((ts) => { const a = [...ts]; a[i] = { ...a[i], text: msg }; return a }) }
        throw e
      }
    }
    try {
      add({ who: 'me', kind: 'q', text: question })
      const docs = await loadDocs(base.docs)
      if (docs.length) {
        const r = pickPassages(docs, question)
        material = r.text
        add({ who: 'mod', kind: 'src', text: `Из книги взято: ${r.used.join('; ')}` })
      }
      await say('mod', 'mod', M_INTRO)
      if (fast) {
        const upto = tr.length
        const res = await Promise.allSettled(ids.map((a) => say(a.id, 'adv', `${a.p}\n${RULE}`, upto)))
        const bad = res.find((r) => r.status === 'rejected')
        if (bad && ac.signal.aborted) throw bad.reason
        if (bad) setErr(bad.reason.message)
      } else for (const a of ids) await say(a.id, 'adv', `${a.p}\n${RULE}`)
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
    <>
    <header>
      {cur ? <button className="ghost" disabled={busy} onClick={() => setSid(null)}>← К началу</button> : <h1>Кабинет автора</h1>}
      {cur && <h1 className="ttl">{cur.title}</h1>}
      <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Бесплатная модель ИИ" disabled={busy}>
        <option value="auto">Авто: модели меняются сами</option>
        {models.filter((m) => !isBad(m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button className={`ghost pill${warn ? ' warn' : ''}`} aria-expanded={showSet} onClick={() => setShowSet((v) => !v)} title="Лимиты и платные запросы">⚙ {used()}/{capEff}</button>
      <button className="ghost" aria-pressed={fast} disabled={busy} onClick={() => setFast((f) => !f)} title="Все сразу быстрее, по очереди эксперты отвечают друг другу">{fast ? '⚡ Все сразу' : '⛓ По очереди'}</button>
      <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Фон">{THEMES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
      <label className="ghost file" title="Загрузить свою картинку для фона" aria-label="Загрузить свою картинку для фона">🖼<input type="file" accept="image/*" hidden onChange={onBg} /></label>
      {cur && <button className="ghost" onClick={() => setShowRev((v) => !v)} aria-pressed={showRev}>Рецензии мастеров</button>}
      <a href="#" className="ghost">На главную</a>
      <button className="ghost" onClick={logout}>Выйти</button>
    </header>
    {showSet && (
    <div className="set">
      <UsageBar cap={capEff} />
      <p className="muted small">Платных запросов: {ls.get('cab_paidn', 0)}</p>
      <label className="chk"><input type="checkbox" checked={usePaid} disabled={!paidModel} onChange={(e) => setUsePaid(e.target.checked)} /> Когда бесплатный лимит исчерпан, использовать платную модель (деньги спишутся с баланса OpenRouter)</label>
      <div className="row">
        <select value={paidModel} onChange={(e) => setPaidModel(e.target.value)} aria-label="Платная модель"><option value="">Выберите платную модель…</option>{paid.map((m) => <option key={m.id} value={m.id}>{m.name} · ${m.c.toFixed(2)}/1М</option>)}</select>
        <select value={capMan} onChange={(e) => setCapMan(e.target.value)} aria-label="Дневной лимит бесплатных запросов"><option value="auto">Лимит: определить сам</option><option value="50">Лимит: 50 в день</option><option value="1000">Лимит: 1000 в день</option></select>
      </div>
      <p className="muted small">Цена за миллион токенов (вход и выход вместе). Платная модель включается только после отказа бесплатных, её ответы помечены 💳.</p>
    </div>
    )}
    </>
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
      <div className="stage">
        {showRev && (
          <aside className="rev">
            <h2>Рецензии мастеров</h2>
            <p className="muted small">Нажмите на нужного мастера, чтобы получить короткую рецензию.</p>
            <textarea rows={3} value={revQ} onChange={(e) => setRevQ(e.target.value)} placeholder="Что рецензировать: «глава 5» или вставьте отрывок. Пусто: возьмём по вашему последнему вопросу" aria-label="Что рецензировать" />
            {cur.revSrc && <p className="muted small">Взято: {cur.revSrc}</p>}
            {masters.map((m) => {
              const r = cur.reviews?.[m.id]
              return (
                <article key={m.id} className="card rv" style={{ '--c': m.c }}>
                  <button type="button" className="mbtn" disabled={busy || (m.id === 'mc' && !custom.trim())} onClick={() => runReview(m)}>
                    <Av w={m} />{m.n}<small className="mdl">{r ? 'ещё раз' : 'получить рецензию'}</small>
                  </button>
                  {r && <p>{r.text}{busy && speaking === m.id && <span className="cur" />}{r.m && <small className="mdl2">{short(r.m)}</small>}</p>}
                </article>
              )
            })}
            <textarea rows={2} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Свой мастер: опишите подход (например: короткие фразы, юмор, упор на диалоги)" aria-label="Подход своего мастера" />
            <p className="muted small foot">Рецензии пишет ИИ: он только имитирует творческий подход эпохи, а не высказывает точное мнение каких-либо реальных людей.</p>
          </aside>
        )}
        <div className="col">
      <div className="table" ref={feed}>
        {cur.turns.map((t, i) => {
          if (t.kind === 'src') return <p key={i} className="muted srcnote">{t.text}</p>
          const w = who(t.who)
          const live = busy && speaking === t.who && i === cur.turns.length - 1
          return (
            <article key={i} className={`card ${t.kind}`} style={{ '--c': w.c }}>
              <h3><Av w={w} />{w.n}{t.kind === 'sum' && ' · вывод сеанса'}{t.m && <small className="mdl">{short(t.m)}</small>}</h3>
              <p>{t.text}{live && <span className="cur" />}</p>
            </article>
          )
        })}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="ask">
        {busy ? (
          <div className="row"><span className="say"><i />Сейчас говорит: {speaking === 'all' ? 'все сразу' : who(speaking)?.n}</span><button className="go" onClick={() => ctl.current?.abort()}>Стоп</button></div>
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
      </div>
    </div>
  )
}
