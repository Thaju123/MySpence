const KEY = 'myspence-expenses'
const PAGE_SIZE = 8
const CATEGORY_COLORS = {
  Food: '#e2a66a',
  Transport: '#7aa3c4',
  Shopping: '#d18a9e',
  Bills: '#9a8f7a',
  Health: '#d08a78',
  Entertainment: '#a890c4',
  Other: '#8f877c',
}

function todayISO() {
  return toISODate(new Date())
}

function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatMoney(amount) {
  return `₹${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function startOfWeek(d) {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfWeek(d) {
  const start = startOfWeek(d)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return end
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function addDays(d, days) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

function isInCurrentWeek(iso) {
  const start = startOfWeek(new Date())
  const end = endOfWeek(new Date())
  return iso >= toISODate(start) && iso <= toISODate(end)
}

function friendlyDate(iso) {
  const d = new Date(iso + 'T12:00:00')
  if (iso === todayISO()) return 'Today'
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (iso === toISODate(y)) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function shortDay(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })
}

function loadExpenses() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveExpenses(expenses) {
  localStorage.setItem(KEY, JSON.stringify(expenses))
}

let expenses = loadExpenses()
let activePreset = 'all'
let visibleCount = PAGE_SIZE

const els = {
  todayTotal: document.getElementById('todayTotal'),
  weekTotal: document.getElementById('weekTotal'),
  expenseForm: document.getElementById('expenseForm'),
  amount: document.getElementById('amount'),
  category: document.getElementById('category'),
  date: document.getElementById('date'),
  note: document.getElementById('note'),
  expenseList: document.getElementById('expenseList'),
  emptyState: document.getElementById('emptyState'),
  filterEmpty: document.getElementById('filterEmpty'),
  filterTotal: document.getElementById('filterTotal'),
  filterFrom: document.getElementById('filterFrom'),
  filterTo: document.getElementById('filterTo'),
  filterCategory: document.getElementById('filterCategory'),
  filterSearch: document.getElementById('filterSearch'),
  clearFilters: document.getElementById('clearFilters'),
  loadMore: document.getElementById('loadMore'),
  exportExcel: document.getElementById('exportExcel'),
  viewReport: document.getElementById('viewReport'),
  reportView: document.getElementById('reportView'),
  reportPeriod: document.getElementById('reportPeriod'),
  reportCustom: document.getElementById('reportCustom'),
  reportFrom: document.getElementById('reportFrom'),
  reportTo: document.getElementById('reportTo'),
  homeView: document.getElementById('homeView'),
  analyticsView: document.getElementById('analyticsView'),
  barChart: document.getElementById('barChart'),
  catRows: document.getElementById('catRows'),
  catEmpty: document.getElementById('catEmpty'),
  insight: document.getElementById('insight'),
  monthlyMood: document.getElementById('monthlyMood'),
}

els.date.value = todayISO()

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'))
    tab.classList.add('active')
    const name = tab.dataset.tab
    const home = name === 'home'
    els.homeView.hidden = !home
    els.analyticsView.hidden = home
    if (!home) renderAnalytics()
  })
})

document.querySelectorAll('[data-preset]').forEach((chip) => {
  chip.addEventListener('click', () => {
    applyPreset(chip.dataset.preset)
    resetVisible()
    render()
  })
})

;[els.filterFrom, els.filterTo, els.filterCategory, els.filterSearch].forEach((input) => {
  input.addEventListener('input', () => {
    if (input === els.filterFrom || input === els.filterTo) {
      activePreset = 'custom'
      syncPresetChips()
    }
    resetVisible()
    render()
  })
})

els.clearFilters.addEventListener('click', () => {
  applyPreset('all')
  els.filterCategory.value = 'all'
  els.filterSearch.value = ''
  resetVisible()
  render()
})

els.loadMore.addEventListener('click', () => {
  visibleCount += PAGE_SIZE
  render()
})

els.reportPeriod.addEventListener('change', () => {
  els.reportCustom.hidden = els.reportPeriod.value !== 'custom'
})

els.viewReport.addEventListener('click', () => showExpensesReport(false))
els.exportExcel.addEventListener('click', () => showExpensesReport(true))
;[els.reportFrom, els.reportTo].forEach((input) => {
  input.addEventListener('change', () => {
    if (els.reportPeriod.value === 'custom' && !els.reportView.hidden) showExpensesReport(false)
  })
})
els.reportPeriod.addEventListener('change', () => {
  if (!els.reportView.hidden && els.reportPeriod.value !== 'custom') showExpensesReport(false)
})

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

function addDaysDate(d, days) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function getReportRange(period) {
  const now = new Date()
  if (period === 'week') {
    return { from: toISODate(startOfWeek(now)), to: toISODate(endOfWeek(now)), label: 'this-week' }
  }
  if (period === 'lastWeek') {
    const day = addDaysDate(startOfWeek(now), -1)
    return { from: toISODate(startOfWeek(day)), to: toISODate(endOfWeek(day)), label: 'last-week' }
  }
  if (period === 'month') {
    return { from: toISODate(startOfMonth(now)), to: todayISO(), label: 'this-month' }
  }
  if (period === 'lastMonth') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return { from: toISODate(startOfMonth(prev)), to: toISODate(endOfMonth(prev)), label: 'last-month' }
  }
  if (period === 'year') {
    return {
      from: `${now.getFullYear()}-01-01`,
      to: todayISO(),
      label: `year-${now.getFullYear()}`,
    }
  }
  // custom
  const from = els.reportFrom.value
  const to = els.reportTo.value
  if (!from || !to) return null
  if (from > to) return null
  return { from, to, label: `custom-${from}-to-${to}` }
}

function getExpensesForReport() {
  const range = getReportRange(els.reportPeriod.value)
  if (!range) return { error: 'Pick a valid From and To date for the custom report.' }

  const sorted = expenses
    .filter((e) => e.date >= range.from && e.date <= range.to)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.createdAt.localeCompare(b.createdAt)
    })

  return { range, sorted }
}

function showExpensesReport(download) {
  if (expenses.length === 0) {
    alert('No expenses to report yet.')
    return
  }

  const result = getExpensesForReport()
  if (result.error) {
    alert(result.error)
    return
  }

  const { range, sorted } = result
  const total = sorted.reduce((s, e) => s + e.amount, 0)
  const byCat = new Map()
  for (const e of sorted) byCat.set(e.category, (byCat.get(e.category) || 0) + e.amount)
  const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]

  els.reportView.hidden = false
  if (sorted.length === 0) {
    els.reportView.innerHTML = `
      <div class="report-empty">No expenses from <strong>${range.from}</strong> to <strong>${range.to}</strong>.</div>`
    if (download) alert('No expenses in that period.')
    return
  }

  els.reportView.innerHTML = `
    <div class="report-summary">
      <div class="stat-card">
        <p class="stat-label">Total</p>
        <p class="stat-value">${formatMoney(total)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Entries</p>
        <p class="stat-value">${sorted.length}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Top category</p>
        <p class="stat-value">${topCat ? topCat[0] : '—'}</p>
      </div>
    </div>
    <p class="filter-hint" style="margin-bottom:0.65rem">${range.from} → ${range.to}</p>
    <div class="report-table-wrap">
      <table class="report-table">
        <thead>
          <tr><th>Date</th><th>Category</th><th>Amount</th><th>Note</th></tr>
        </thead>
        <tbody>
          ${sorted
            .map(
              (e) => `
            <tr>
              <td>${e.date}</td>
              <td>${escapeHtml(e.category)}</td>
              <td>${formatMoney(e.amount)}</td>
              <td>${escapeHtml(e.note || '—')}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`

  if (download) {
    const rows = [
      ['Report', range.label],
      ['From', range.from],
      ['To', range.to],
      ['Total (₹)', total],
      [],
      ['Date', 'Category', 'Amount (₹)', 'Note', 'Created At'],
      ...sorted.map((e) => [e.date, e.category, e.amount, e.note || '', e.createdAt]),
    ]
    downloadCsv(`myspence-report-${range.label}.csv`, rows)
  }
}

els.expenseForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const value = Number(els.amount.value)
  if (!Number.isFinite(value) || value <= 0) return

  expenses = [
    {
      id: crypto.randomUUID(),
      amount: Math.round(value * 100) / 100,
      category: els.category.value,
      note: els.note.value.trim(),
      date: els.date.value,
      createdAt: new Date().toISOString(),
    },
    ...expenses,
  ]
  saveExpenses(expenses)
  els.amount.value = ''
  els.note.value = ''
  els.date.value = todayISO()
  els.category.value = 'Food'
  resetVisible()
  render()
  els.amount.focus()
})

els.expenseList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-delete]')
  if (!btn) return
  expenses = expenses.filter((item) => item.id !== btn.dataset.delete)
  saveExpenses(expenses)
  render()
})

function resetVisible() {
  visibleCount = PAGE_SIZE
}

function applyPreset(preset) {
  activePreset = preset
  const now = new Date()

  if (preset === 'all') {
    els.filterFrom.value = ''
    els.filterTo.value = ''
  } else if (preset === 'today') {
    const t = todayISO()
    els.filterFrom.value = t
    els.filterTo.value = t
  } else if (preset === 'yesterday') {
    const y = toISODate(addDays(now, -1))
    els.filterFrom.value = y
    els.filterTo.value = y
  } else if (preset === 'week') {
    els.filterFrom.value = toISODate(startOfWeek(now))
    els.filterTo.value = toISODate(endOfWeek(now))
  } else if (preset === 'lastWeek') {
    const lastWeekDay = addDays(startOfWeek(now), -1)
    els.filterFrom.value = toISODate(startOfWeek(lastWeekDay))
    els.filterTo.value = toISODate(endOfWeek(lastWeekDay))
  } else if (preset === 'month') {
    els.filterFrom.value = toISODate(startOfMonth(now))
    els.filterTo.value = todayISO()
  } else if (preset === 'lastMonth') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    els.filterFrom.value = toISODate(startOfMonth(prev))
    els.filterTo.value = toISODate(endOfMonth(prev))
  } else if (preset === 'last30') {
    els.filterFrom.value = toISODate(addDays(now, -29))
    els.filterTo.value = todayISO()
  }

  syncPresetChips()
}

function syncPresetChips() {
  document.querySelectorAll('[data-preset]').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.preset === activePreset)
  })
}

function getFilteredExpenses() {
  const from = els.filterFrom.value
  const to = els.filterTo.value
  const category = els.filterCategory.value
  const search = els.filterSearch.value.trim().toLowerCase()

  return expenses.filter((item) => {
    if (from && item.date < from) return false
    if (to && item.date > to) return false
    if (category !== 'all' && item.category !== category) return false
    if (search && !item.note.toLowerCase().includes(search) && !item.category.toLowerCase().includes(search)) {
      return false
    }
    return true
  })
}

function filtersActive() {
  return Boolean(
    els.filterFrom.value ||
      els.filterTo.value ||
      els.filterCategory.value !== 'all' ||
      els.filterSearch.value.trim(),
  )
}

function render() {
  const today = todayISO()
  const todaySum = expenses.filter((e) => e.date === today).reduce((s, e) => s + e.amount, 0)
  const weekSum = expenses.filter((e) => isInCurrentWeek(e.date)).reduce((s, e) => s + e.amount, 0)
  els.todayTotal.textContent = formatMoney(todaySum)
  els.weekTotal.textContent = formatMoney(weekSum)

  const filtered = getFilteredExpenses().sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return b.createdAt.localeCompare(a.createdAt)
  })
  const filteredSum = filtered.reduce((s, e) => s + e.amount, 0)
  const visible = filtered.slice(0, visibleCount)
  const remaining = filtered.length - visible.length

  if (expenses.length === 0) {
    els.filterTotal.textContent = ''
  } else if (filtersActive()) {
    els.filterTotal.textContent = `${visible.length}/${filtered.length} shown · ${formatMoney(filteredSum)}`
  } else {
    els.filterTotal.textContent = `${visible.length}/${expenses.length} shown · ${formatMoney(filteredSum)}`
  }

  const noData = expenses.length === 0
  const noMatch = !noData && filtered.length === 0
  els.emptyState.hidden = !noData
  els.filterEmpty.hidden = !noMatch
  els.expenseList.hidden = noData || noMatch

  els.expenseList.innerHTML = visible
    .map(
      (item) => `
      <li class="expense-item">
        <span class="cat-dot" style="background:${CATEGORY_COLORS[item.category] || '#8a9a94'}"></span>
        <div class="expense-main">
          <div class="expense-top">
            <span class="expense-cat">${escapeHtml(item.category)}</span>
            <span class="expense-amount">${formatMoney(item.amount)}</span>
          </div>
          <div class="expense-meta">
            ${friendlyDate(item.date)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}
          </div>
        </div>
        <button type="button" class="btn btn-ghost" data-delete="${item.id}" aria-label="Delete expense">Delete</button>
      </li>`,
    )
    .join('')

  if (remaining > 0 && !noData && !noMatch) {
    els.loadMore.hidden = false
    els.loadMore.textContent = `Load more (${remaining} left)`
  } else {
    els.loadMore.hidden = true
  }

  if (!els.analyticsView.hidden) renderAnalytics()
}

function renderAnalytics() {
  const dayBars = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const iso = toISODate(d)
    dayBars.push({
      date: iso,
      total: expenses.filter((e) => e.date === iso).reduce((s, e) => s + e.amount, 0),
    })
  }
  const maxDay = Math.max(...dayBars.map((d) => d.total), 1)
  els.barChart.innerHTML = dayBars
    .map((d) => {
      const h = Math.max((d.total / maxDay) * 100, d.total ? 6 : 2)
      return `
        <div class="bar-col">
          <div class="bar-track">
            <div class="bar" style="height:${h}%" title="${formatMoney(d.total)}"></div>
          </div>
          <span class="bar-value">${d.total ? Math.round(d.total) : '–'}</span>
          <span class="bar-label">${shortDay(d.date)}</span>
        </div>`
    })
    .join('')

  const weekItems = expenses.filter((e) => isInCurrentWeek(e.date))
  const weekTotal = weekItems.reduce((s, e) => s + e.amount, 0)
  const map = new Map()
  for (const e of weekItems) map.set(e.category, (map.get(e.category) || 0) + e.amount)
  const breakdown = [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
  const maxCat = breakdown[0]?.total || 1

  els.catEmpty.hidden = breakdown.length > 0
  els.catRows.innerHTML = breakdown
    .map(
      (row) => `
      <div class="cat-row">
        <div class="cat-row-head">
          <span>${escapeHtml(row.category)}</span>
          <span>${formatMoney(row.total)} · ${weekTotal ? Math.round((row.total / weekTotal) * 100) : 0}%</span>
        </div>
        <div class="cat-track">
          <div class="cat-fill" style="width:${(row.total / maxCat) * 100}%;background:${CATEGORY_COLORS[row.category] || '#8a9a94'}"></div>
        </div>
      </div>`,
    )
    .join('')

  if (breakdown[0] && weekTotal > 0) {
    const top = breakdown[0]
    els.insight.hidden = false
    els.insight.innerHTML = `You spent the most on <em>${escapeHtml(top.category)}</em> this week — ${formatMoney(top.total)} (${Math.round((top.total / weekTotal) * 100)}% of weekly total).`
  } else {
    els.insight.hidden = true
  }

  renderMonthlyMood()
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function sumByCategory(items) {
  const map = new Map()
  for (const e of items) map.set(e.category, (map.get(e.category) || 0) + e.amount)
  return map
}

function renderMonthlyMood() {
  const now = new Date()
  const thisKey = monthKey(now)
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastKey = monthKey(lastDate)

  const thisMonth = expenses.filter((e) => e.date.slice(0, 7) === thisKey)
  const lastMonth = expenses.filter((e) => e.date.slice(0, 7) === lastKey)

  if (thisMonth.length === 0) {
    els.monthlyMood.hidden = true
    return
  }

  const thisMap = sumByCategory(thisMonth)
  const lastMap = sumByCategory(lastMonth)
  const categories = new Set([...thisMap.keys(), ...lastMap.keys()])

  let best = null
  for (const category of categories) {
    const current = thisMap.get(category) || 0
    const previous = lastMap.get(category) || 0
    if (current === 0 && previous === 0) continue

    let score = 0
    let kind = 'same'
    let pct = 0

    if (previous > 0 && current > 0) {
      pct = Math.round(((current - previous) / previous) * 100)
      score = Math.abs(pct)
      kind = pct > 0 ? 'more' : pct < 0 ? 'less' : 'same'
    } else if (previous === 0 && current > 0) {
      score = 1000 + current
      kind = 'new'
    } else if (current === 0 && previous > 0) {
      score = 500 + previous
      kind = 'gone'
    }

    if (!best || score > best.score) {
      best = { category, current, previous, pct: Math.abs(pct), kind, score }
    }
  }

  if (!best) {
    els.monthlyMood.hidden = true
    return
  }

  let line = ''
  if (best.kind === 'more') {
    line = `This month you spent <em>${best.pct}% more</em> on <em>${escapeHtml(best.category)}</em> than last month.`
  } else if (best.kind === 'less') {
    line = `This month you spent <em>${best.pct}% less</em> on <em>${escapeHtml(best.category)}</em> than last month.`
  } else if (best.kind === 'same') {
    line = `This month your <em>${escapeHtml(best.category)}</em> spend is about the same as last month.`
  } else if (best.kind === 'new') {
    line = `New this month: you’ve spent <em>${formatMoney(best.current)}</em> on <em>${escapeHtml(best.category)}</em>.`
  } else if (best.kind === 'gone') {
    line = `Nice — no <em>${escapeHtml(best.category)}</em> spend this month (was ${formatMoney(best.previous)} last month).`
  }

  if (lastMonth.length === 0 && thisMonth.length > 0) {
    const topCat = [...thisMap.entries()].sort((a, b) => b[1] - a[1])[0]
    line = `This month so far, most of your spend is on <em>${escapeHtml(topCat[0])}</em> (${formatMoney(topCat[1])}). Keep logging to unlock month-over-month mood.`
  }

  els.monthlyMood.hidden = false
  els.monthlyMood.innerHTML = `<span class="mood-label">Monthly mood</span>${line}`
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

render()
