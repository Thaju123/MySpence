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
    mainApp: document.getElementById('mainApp'),
    progressStat: document.getElementById('progressStat'),
    streakStat: document.getElementById('streakStat'),
    bestStat: document.getElementById('bestStat'),
    listHeading: document.getElementById('listHeading'),
    listHint: document.getElementById('listHint'),
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
    exportExcelBtn: document.getElementById('exportExcelBtn'),
    viewReportBtn: document.getElementById('viewReportBtn'),
    reportView: document.getElementById('reportView'),
    reportPeriod: document.getElementById('reportPeriod'),
    reportCustom: document.getElementById('reportCustom'),
    reportFrom: document.getElementById('reportFrom'),
    reportTo: document.getElementById('reportTo'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
  }

  applyTheme(settings.theme)
  if (todayLocal() >= START) ensureDayHistory(toISO(clampDate(todayLocal())))
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

  els.reportPeriod.addEventListener('change', () => {
    els.reportCustom.hidden = els.reportPeriod.value !== 'custom'
    if (!els.reportView.hidden && els.reportPeriod.value !== 'custom') showTaskReport(false)
  })
  ;[els.reportFrom, els.reportTo].forEach((input) => {
    input.addEventListener('change', () => {
      if (els.reportPeriod.value === 'custom' && !els.reportView.hidden) showTaskReport(false)
    })
  })
  els.viewReportBtn.addEventListener('click', () => showTaskReport(false))

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
  els.exportExcelBtn.addEventListener('click', () => showTaskReport(true))
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
    if (todayLocal() < START) {
      alert('Ticking starts on Day 1 — 23 Nov 2026.')
      return
    }
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
    const master = masterTasks()
    const trackingLive = today >= START

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

    if (!trackingLive) {
      els.dayLabel.textContent = 'Ready'
      els.dayTitle.textContent = 'Day 1 starts tomorrow'
      els.daySub.textContent = `23 Nov 2026 · Add your habits now. Normal daily ticking begins tomorrow.`
      els.listHeading.textContent = 'Daily checklist'
      els.listHint.textContent =
        'Same checklist every day. Set it up now — mark done/not done from Day 1 (23 Nov).'
      els.progressStat.textContent = '—'
      els.streakStat.textContent = '0'
      els.bestStat.textContent = '0'
      els.progressText.textContent = 'Starts tomorrow'
      els.progressPct.textContent = '—'
      els.progressFill.style.width = '0%'
      els.prevDay.disabled = true
      els.nextDay.disabled = true
      els.emptyTasks.hidden = master.length > 0
      els.emptyTasks.textContent = 'No tasks yet. Add habits below — they’ll show every day.'
      els.taskList.innerHTML = master
        .map(
          (task) => `
          <li class="task-item">
            <span class="check" aria-hidden="true">${CHECK_SVG}</span>
            <p class="task-title">${escapeHtml(task.title)}</p>
          </li>`,
        )
        .join('')
      els.calendar.innerHTML = '<p class="list-hint">Calendar unlocks on Day 1 (23 Nov 2026).</p>'
      return
    }

    viewDate = clampDate(viewDate)
    const iso = toISO(viewDate)
    const dayNum = dayNumber(viewDate)
    const isToday = iso === toISO(today)

    els.dayLabel.textContent = isToday ? 'Today' : 'Viewing'
    els.dayTitle.textContent = `Day ${dayNum}`
    els.daySub.textContent = formatFull(viewDate)
    els.listHeading.textContent = isToday ? 'Daily checklist' : `Checklist · ${formatShort(viewDate)}`
    els.listHint.textContent =
      'Same checklist every day. Tap to mark done or not done. Use Add / edit checklist to change habits.'

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
    if (today < START) {
      els.calendar.innerHTML = '<p class="list-hint">Calendar unlocks on Day 1 (23 Nov 2026).</p>'
      return
    }

    const heads = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    let html = heads.map((h) => `<div class="cal-head">${h}</div>`).join('')

    const startDow = (START.getDay() + 6) % 7
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

  function csvEscape(value) {
    const str = String(value ?? '')
    if (/[",\n\r]/.test(str)) return `"${str.replaceAll('"', '""')}"`
    return str
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function startOfWeekLocal(d) {
    const copy = new Date(d)
    const day = copy.getDay()
    const diff = day === 0 ? 6 : day - 1
    copy.setDate(copy.getDate() - diff)
    copy.setHours(0, 0, 0, 0)
    return copy
  }

  function endOfWeekLocal(d) {
    const start = startOfWeekLocal(d)
    return addDays(start, 6)
  }

  function startOfMonthLocal(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1)
  }

  function endOfMonthLocal(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0)
  }

  function getReportRange(period) {
    const now = todayLocal()
    if (period === 'week') {
      return { from: toISO(startOfWeekLocal(now)), to: toISO(endOfWeekLocal(now)), label: 'this-week' }
    }
    if (period === 'lastWeek') {
      const day = addDays(startOfWeekLocal(now), -1)
      return { from: toISO(startOfWeekLocal(day)), to: toISO(endOfWeekLocal(day)), label: 'last-week' }
    }
    if (period === 'month') {
      return { from: toISO(startOfMonthLocal(now)), to: toISO(now), label: 'this-month' }
    }
    if (period === 'lastMonth') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return {
        from: toISO(startOfMonthLocal(prev)),
        to: toISO(endOfMonthLocal(prev)),
        label: 'last-month',
      }
    }
    if (period === 'year') {
      return {
        from: `${now.getFullYear()}-01-01`,
        to: toISO(now),
        label: `year-${now.getFullYear()}`,
      }
    }
    const from = els.reportFrom.value
    const to = els.reportTo.value
    if (!from || !to || from > to) return null
    return { from, to, label: `custom-${from}-to-${to}` }
  }

  function buildTaskReportRows(from, to) {
    const rows = []
    let doneCount = 0
    let totalCount = 0
    let perfectDays = 0
    let trackedDays = 0

    for (let d = parseISO(from); d <= parseISO(to); d = addDays(d, 1)) {
      const iso = toISO(d)
      const dayNum = dayNumber(d)
      const list = checklistForDay(iso)
      const dayHistory = history[iso] || {}
      if (list.length === 0) continue
      trackedDays += 1
      let dayDone = 0
      for (const task of list) {
        const done = Boolean(dayHistory[task.id])
        totalCount += 1
        if (done) {
          doneCount += 1
          dayDone += 1
        }
        rows.push({
          date: iso,
          day: dayNum,
          task: task.title,
          done,
          status: done ? 'Done' : 'Missed',
        })
      }
      if (dayDone === list.length) perfectDays += 1
    }

    return { rows, doneCount, totalCount, perfectDays, trackedDays }
  }

  function showTaskReport(download) {
    const range = getReportRange(els.reportPeriod.value)
    if (!range) {
      alert('Pick a valid From and To date for the custom report.')
      return
    }

    let from = range.from < toISO(START) ? toISO(START) : range.from
    const todayIso = toISO(todayLocal())
    let to = range.to > todayIso ? todayIso : range.to

    els.reportView.hidden = false

    if (todayLocal() < START || from > to) {
      const habits = masterTasks()
      els.reportView.innerHTML =
        habits.length === 0
          ? `<div class="report-empty">No data yet. Tracking starts 23 Nov 2026.</div>`
          : `
            <p class="list-hint">Tracking starts 23 Nov 2026. Your checklist so far:</p>
            <div class="report-table-wrap">
              <table class="report-table">
                <thead><tr><th>Task</th><th>Created on</th></tr></thead>
                <tbody>
                  ${habits
                    .map((t) => `<tr><td>${escapeHtml(t.title)}</td><td>${t.createdOn}</td></tr>`)
                    .join('')}
                </tbody>
              </table>
            </div>`

      if (download) {
        if (habits.length === 0) {
          alert('No data in that period yet. Tracking starts 23 Nov 2026.')
          return
        }
        downloadCsv(`mytask-report-${range.label}.csv`, [
          ['Report', range.label],
          ['Note', 'Tracking starts 23 Nov 2026 — checklist only for now'],
          [],
          ['Task', 'Created On'],
          ...habits.map((t) => [t.title, t.createdOn]),
        ])
      }
      return
    }

    const built = buildTaskReportRows(from, to)
    if (built.rows.length === 0) {
      els.reportView.innerHTML = `<div class="report-empty">No checklist activity from <strong>${from}</strong> to <strong>${to}</strong>.</div>`
      if (download) alert('No checklist activity in that period yet.')
      return
    }

    const pct = built.totalCount ? Math.round((built.doneCount / built.totalCount) * 100) : 0
    els.reportView.innerHTML = `
      <div class="report-summary">
        <div class="stat-card">
          <p class="stat-label">Completion</p>
          <p class="stat-value">${pct}%</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Done</p>
          <p class="stat-value">${built.doneCount}/${built.totalCount}</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Perfect days</p>
          <p class="stat-value">${built.perfectDays}/${built.trackedDays}</p>
        </div>
      </div>
      <p class="list-hint" style="margin-bottom:0.65rem">${from} → ${to}</p>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr><th>Date</th><th>Day</th><th>Task</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${built.rows
              .map(
                (r) => `
              <tr>
                <td>${r.date}</td>
                <td>${r.day}</td>
                <td>${escapeHtml(r.task)}</td>
                <td>${r.status}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`

    if (download) {
      downloadCsv(`mytask-report-${range.label}.csv`, [
        ['Report', range.label],
        ['From', from],
        ['To', to],
        ['Completion %', pct],
        [],
        ['Date', 'Day', 'Task', 'Done', 'Status'],
        ...built.rows.map((r) => [r.date, r.day, r.task, r.done ? 'Yes' : 'No', r.status]),
      ])
    }
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
