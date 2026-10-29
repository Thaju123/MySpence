const KEY = 'myspence-expenses'
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

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function isInCurrentWeek(iso) {
  const start = startOfWeek(new Date())
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
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
    render()
  })
})

;[els.filterFrom, els.filterTo, els.filterCategory, els.filterSearch].forEach((input) => {
  input.addEventListener('input', () => {
    if (input === els.filterFrom || input === els.filterTo) {
      activePreset = 'custom'
      syncPresetChips()
    }
    render()
  })
})

els.clearFilters.addEventListener('click', () => {
  applyPreset('all')
  els.filterCategory.value = 'all'
  els.filterSearch.value = ''
  render()
})

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
  } else if (preset === 'week') {
    const start = startOfWeek(now)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    els.filterFrom.value = toISODate(start)
    els.filterTo.value = toISODate(end)
  } else if (preset === 'month') {
    els.filterFrom.value = toISODate(startOfMonth(now))
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

  if (expenses.length === 0) {
    els.filterTotal.textContent = ''
  } else if (filtersActive()) {
    els.filterTotal.textContent = `${filtered.length} shown · ${formatMoney(filteredSum)}`
  } else {
    els.filterTotal.textContent = `${expenses.length} total · ${formatMoney(filteredSum)}`
  }

  const noData = expenses.length === 0
  const noMatch = !noData && filtered.length === 0
  els.emptyState.hidden = !noData
  els.filterEmpty.hidden = !noMatch
  els.expenseList.hidden = noData || noMatch

  els.expenseList.innerHTML = filtered
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
