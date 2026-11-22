(() => {
  const START = localDate(2026, 11, 23) // 23 Nov 2026 = Day 1
  const KEYS = {
    tasks: 'mytask_tasks',
    history: 'mytask_history',
    settings: 'mytask_settings',
  }

  const CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>'

  /** @typedef {{ id: string, title: string, createdOn: string, deletedOn: string|null }} Task */
  /** @typedef {Record<string, Record<string, boolean>>} History */

  let tasks = loadJSON(KEYS.tasks, /** @type {Task[]} */ ([]))
  let history = loadJSON(KEYS.history, /** @type {History} */ ({}))
  let settings = loadJSON(KEYS.settings, { theme: 'dark' })

  let viewDate = clampDate(todayLocal())

  const els = {
    themeToggle: document.getElementById('themeToggle'),
    dayLabel: document.getElementById('dayLabel'),
    dayTitle: document.getElementById('dayTitle'),
    daySub: document.getElementById('daySub'),
    preStart: document.getElementById('preStart'),
    mainApp: document.getElementById('mainApp'),
    progressStat: document.getElementById('progressStat'),
    streakStat: document.getElementById('streakStat'),
    bestStat: document.getElementById('bestStat'),
    listHeading: document.getElementById('listHeading'),
    listHint: document.getElementById('listHint'),
    statsRow: document.getElementById('statsRow'),
    navDay: document.getElementById('navDay'),
    progressWrap: document.getElementById('progressWrap'),
    overviewPanel: document.getElementById('overviewPanel'),
    prevDay: document.getElementById('prevDay'),
    todayBtn: document.getElementById('todayBtn'),
    nextDay: document.getElementById('nextDay'),
    progressText: document.getElementById('progressText'),
    progressPct: document.getElementById('progressPct'),
    progressFill: document.getElementById('progressFill'),
    taskList: document.getElementById('taskList'),
    manageList: document.getElementById('manageList'),
    emptyTasks: document.getElementById('emptyTasks'),
    addForm: document.getElementById('addForm'),
    taskInput: document.getElementById('taskInput'),
    calendar: document.getElementById('calendar'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
  }

  applyTheme(settings.theme)
  ensureDayHistory(toISO(clampDate(todayLocal())))
  render()

  els.themeToggle.addEventListener('click', () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark'
    saveJSON(KEYS.settings, settings)
    applyTheme(settings.theme)
  })

  els.prevDay.addEventListener('click', () => {
    const prev = addDays(viewDate, -1)
    if (prev < START) return
    viewDate = prev
    ensureDayHistory(toISO(viewDate))
    render()
  })

  els.nextDay.addEventListener('click', () => {
    const next = addDays(viewDate, 1)
    if (next > todayLocal()) return
    viewDate = next
    ensureDayHistory(toISO(viewDate))
    render()
  })

  els.todayBtn.addEventListener('click', () => {
    viewDate = clampDate(todayLocal())
    ensureDayHistory(toISO(viewDate))
    render()
  })

  els.addForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const title = els.taskInput.value.trim()
    if (!title) return

    const today = todayLocal()
    // Before Day 1, habits are ready from Day 1; after that, from today.
    const createdOn = toISO(today < START ? START : today)
    /** @type {Task} */
    const task = {
      id: crypto.randomUUID(),
      title,
      createdOn,
      deletedOn: null,
    }
    tasks = [task, ...tasks]
    saveJSON(KEYS.tasks, tasks)

    // Shared daily list — seed ticks only once tracking has started.
    if (today >= START) {
      if (!history[createdOn]) history[createdOn] = {}
      history[createdOn][task.id] = false
      saveJSON(KEYS.history, history)
      viewDate = today
    }

    els.taskInput.value = ''
    render()
    els.taskInput.focus()
  })

  // Main list: tap a row to mark done / not done
  els.taskList.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target)
    const row = target.closest('[data-check]')
    if (!row) return
    toggleTask(row.getAttribute('data-check'))
  })

  // Manage list: edit / delete master checklist
  els.manageList.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target)
    const editBtn = target.closest('[data-edit]')
    const deleteBtn = target.closest('[data-delete]')
    if (editBtn) {
      editTask(editBtn.getAttribute('data-edit'))
      return
    }
    if (deleteBtn) {
      deleteTask(deleteBtn.getAttribute('data-delete'))
    }
  })

  els.calendar.addEventListener('click', (e) => {
    const btn = /** @type {HTMLElement} */ (e.target).closest('[data-date]')
    if (!btn) return
    const iso = btn.getAttribute('data-date')
    if (!iso) return
    viewDate = parseISO(iso)
    ensureDayHistory(iso)
    render()
  })

  els.exportBtn.addEventListener('click', exportData)
  els.importBtn.addEventListener('click', () => els.importFile.click())
  els.importFile.addEventListener('change', importData)

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light')
    els.themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark'
  }

  function ensureDayHistory(iso) {
    if (parseISO(iso) < START) return
    if (!history[iso]) history[iso] = {}
    // Same shared checklist: seed each active habit as unticked for this day
    for (const task of checklistForDay(iso)) {
      if (history[iso][task.id] === undefined) history[iso][task.id] = false
    }
    saveJSON(KEYS.history, history)
  }

  /** Master habits that belong on this day (same list every day once added). */
  function checklistForDay(iso) {
    return tasks.filter((t) => {
      if (t.deletedOn) return false
      if (t.createdOn > iso) return false
      return true
    })
  }

  function masterTasks() {
    return tasks.filter((t) => !t.deletedOn)
  }

  function dayProgress(iso) {
    const list = checklistForDay(iso)
    const dayHistory = history[iso] || {}
    let done = 0
    for (const t of list) {
      if (dayHistory[t.id]) done += 1
    }
    return { total: list.length, done, pct: list.length ? Math.round((done / list.length) * 100) : 0 }
  }

  function toggleTask(id) {
    if (!id) return
    const iso = toISO(viewDate)
    if (!history[iso]) history[iso] = {}
    history[iso][id] = !history[iso][id]
    saveJSON(KEYS.history, history)
    render()
  }

  function editTask(id) {
    if (!id) return
    const task = tasks.find((t) => t.id === id && !t.deletedOn)
    if (!task) return
    const next = prompt('Edit task', task.title)
    if (next === null) return
    const title = next.trim()
    if (!title) return
    task.title = title
    saveJSON(KEYS.tasks, tasks)
    render()
  }

  function deleteTask(id) {
    if (!id) return
    const task = tasks.find((t) => t.id === id && !t.deletedOn)
    if (!task) return
    if (!confirm(`Delete “${task.title}”? Past days keep their records.`)) return
    task.deletedOn = toISO(todayLocal())
    saveJSON(KEYS.tasks, tasks)
    render()
  }

  function dayStatus(iso) {
    const { total, done } = dayProgress(iso)
    if (total === 0) return 'empty'
    if (done === total) return 'done'
    if (done === 0) return 'missed'
    return 'partial'
  }

  function computeStreaks() {
    const today = todayLocal()
    if (today < START) return { current: 0, best: 0 }

    let best = 0
    let run = 0
    let current = 0
    let countingCurrent = true

    // Walk from today back to start
    for (let d = today; d >= START; d = addDays(d, -1)) {
      const iso = toISO(d)
      const status = dayStatus(iso)
      const perfect = status === 'done'

      if (perfect) {
        run += 1
        best = Math.max(best, run)
        if (countingCurrent) current = run
      } else {
        run = 0
        // Today incomplete shouldn't break "current" until end of day — streak requires all done
        countingCurrent = false
      }
    }

    return { current, best }
  }

  function render() {
    const today = todayLocal()
    const beforeStart = today < START
    const master = masterTasks()

    els.mainApp.hidden = false
    els.preStart.hidden = !beforeStart

    // Always render manage list so habits can be added anytime
    els.manageList.innerHTML = master
      .map(
        (task) => `
        <li class="task-item">
          <p class="task-title">${escapeHtml(task.title)}</p>
          <div class="task-actions">
            <button type="button" class="ghost edit" data-edit="${task.id}">Edit</button>
            <button type="button" class="ghost" data-delete="${task.id}">Delete</button>
          </div>
        </li>`,
      )
      .join('')

    if (beforeStart) {
      els.dayLabel.textContent = 'Coming soon'
      els.dayTitle.textContent = 'Tracking starts on 23 Nov 2026'
      els.daySub.textContent = `Today is ${formatFull(today)}. Build your checklist now — Day 1 begins Mon, 23 Nov 2026.`
      els.listHeading.textContent = 'Set up your checklist'
      els.listHint.textContent =
        'Add the habits you want to do every day. Ticking starts on Day 1.'
      els.statsRow.hidden = true
      els.navDay.hidden = true
      els.progressWrap.hidden = true
      els.overviewPanel.hidden = true
      els.emptyTasks.hidden = master.length > 0
      els.emptyTasks.textContent = 'No habits yet. Type one below and tap Add to list.'
      els.taskList.innerHTML = master
        .map(
          (task) => `
          <li class="task-item">
            <span class="check" aria-hidden="true">${CHECK_SVG}</span>
            <p class="task-title">${escapeHtml(task.title)}</p>
          </li>`,
        )
        .join('')
      return
    }

    els.statsRow.hidden = false
    els.navDay.hidden = false
    els.progressWrap.hidden = false
    els.overviewPanel.hidden = false
    els.listHint.textContent =
      'Same checklist every day. Tap to mark done or not done. Use Add / edit checklist to change habits.'

    viewDate = clampDate(viewDate)
    const iso = toISO(viewDate)
    const dayNum = dayNumber(viewDate)
    const isToday = iso === toISO(today)

    els.dayLabel.textContent = isToday ? 'Today' : 'Viewing'
    els.dayTitle.textContent = `Day ${dayNum}`
    els.daySub.textContent = formatFull(viewDate)
    els.listHeading.textContent = isToday ? 'Daily checklist' : `Checklist · ${formatShort(viewDate)}`

    els.prevDay.disabled = viewDate <= START
    els.nextDay.disabled = viewDate >= today

    ensureDayHistory(iso)
    const list = checklistForDay(iso)
    const dayHistory = history[iso] || {}
    const { done, total, pct } = dayProgress(iso)
    const streaks = computeStreaks()

    els.progressStat.textContent = `${done}/${total}`
    els.streakStat.textContent = String(streaks.current)
    els.bestStat.textContent = String(streaks.best)
    els.progressText.textContent = `${done}/${total} done`
    els.progressPct.textContent = `${pct}%`
    els.progressFill.style.width = `${pct}%`

    els.emptyTasks.hidden = list.length > 0
    els.emptyTasks.textContent = 'No tasks yet. Add habits below — they’ll show every day.'
    // Main view: same habits, only mark done / not done
    els.taskList.innerHTML = list
      .map((task) => {
        const checked = Boolean(dayHistory[task.id])
        return `
          <li class="task-item tickable${checked ? ' done' : ''}" data-check="${task.id}" role="button" tabindex="0" aria-pressed="${checked}">
            <span class="check${checked ? ' checked' : ''}" aria-hidden="true">${CHECK_SVG}</span>
            <p class="task-title">${escapeHtml(task.title)}</p>
          </li>`
      })
      .join('')

    renderCalendar(today, iso)
  }

  function renderCalendar(today, selectedIso) {
    const heads = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    let html = heads.map((h) => `<div class="cal-head">${h}</div>`).join('')

    // Pad to Monday-start grid from START
    const startDow = (START.getDay() + 6) % 7 // Mon=0
    for (let i = 0; i < startDow; i++) html += `<div class="cal-cell empty"></div>`

    for (let d = new Date(START); d <= today; d = addDays(d, 1)) {
      const iso = toISO(d)
      const status = dayStatus(iso)
      const selected = iso === selectedIso ? ' selected' : ''
      const cls = status === 'empty' ? 'missed' : status
      html += `<button type="button" class="cal-cell ${cls}${selected}" data-date="${iso}" title="${formatFull(d)}">${d.getDate()}</button>`
    }

    els.calendar.innerHTML = html
  }

  function exportData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks,
      history,
      settings,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mytask-backup-${toISO(todayLocal())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importData(e) {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (!data || !Array.isArray(data.tasks) || typeof data.history !== 'object') {
          alert('Invalid MyTask backup file.')
          return
        }
        if (!confirm('Import will replace your current MyTask data. Continue?')) return
        tasks = data.tasks
        history = data.history || {}
        settings = { theme: data.settings?.theme === 'dark' ? 'dark' : 'light', ...(data.settings || {}) }
        saveJSON(KEYS.tasks, tasks)
        saveJSON(KEYS.history, history)
        saveJSON(KEYS.settings, settings)
        applyTheme(settings.theme)
        viewDate = clampDate(todayLocal())
        ensureDayHistory(toISO(clampDate(todayLocal())))
        render()
        alert('Import complete.')
      } catch {
        alert('Could not read that JSON file.')
      } finally {
        els.importFile.value = ''
      }
    }
    reader.readAsText(file)
  }

  // ——— date helpers (local, not UTC) ———

  function localDate(y, m, d) {
    return new Date(y, m - 1, d)
  }

  function todayLocal() {
    const n = new Date()
    return localDate(n.getFullYear(), n.getMonth() + 1, n.getDate())
  }

  function toISO(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number)
    return localDate(y, m, d)
  }

  function addDays(d, n) {
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
    return copy
  }

  function clampDate(d) {
    const today = todayLocal()
    if (d < START) return new Date(START)
    if (d > today) return today
    return d
  }

  function dayNumber(d) {
    const ms = localDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) - START
    return Math.floor(ms / 86400000) + 1
  }

  function formatFull(d) {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function formatShort(d) {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return fallback
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
  }
})()
