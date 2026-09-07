const API_URL = "https://script.google.com/macros/s/AKfycbw_q3WkDF_g-Nen-r3Km68Uf_Z0Uvu4vUo8bXG4RUvNbK3nMMVj33-ldbM1Ub1osHEU/exec";
const API_KEY = "013187";

const pages = {
  overview: "Overview",
  employees: "Employees",
  services: "Services",
  oil: "Oil",
  zeena: "Zeena",
  company: "Company",
  employeeLookup: "Employee Lookup",
  search: "Search",
};

const state = {
  activePage: "overview",
  report: null,
  yesterday: null,
  loading: false,
  searchQuery: "",
  searchResults: null,
  employeeList: null,
  employeeMonths: {},
  trend: null,
  employeeSort: "carsToday",
  employeeLookup: {
    employee: "",
    month: currentMonthKey(),
    result: null,
    loading: false,
  },
};

const els = {
  view: document.getElementById("view"),
  title: document.getElementById("pageTitle"),
  updated: document.getElementById("updatedText"),
  refresh: document.getElementById("refreshBtn"),
  greeting: document.getElementById("greetingText"),
  greetingArabic: document.getElementById("greetingArabic"),
  greetingWrap: document.querySelector(".greeting"),
  tabs: Array.from(document.querySelectorAll(".tab")),
};

const splashState = {
  el: null,
  shownAt: 0,
  hidden: false,
  minDuration: 420,
};

function endpoint(params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("key", API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function fetchJson(params) {
  const response = await fetch(endpoint(params), { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString("en-US");
}

function moneyText(value) {
  return `AED ${formatNumber(value)}`;
}

function money(value) {
  return `
    <span class="money" aria-label="${escapeHtml(moneyText(value))}">
      <span class="dirham" aria-hidden="true"></span>
      <span class="currency-fallback" aria-hidden="true">AED</span>
      <span>${formatNumber(value)}</span>
    </span>
  `;
}

function cars(value) {
  const count = Number(value) || 0;
  return `${count} ${count === 1 ? "car" : "cars"}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clock(value) {
  const date = asDate(value);
  if (!date) return "No work";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function idleText(value) {
  const date = asDate(value);
  if (!date) return "No work";

  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

function dateStamp(value) {
  const date = asDate(value);
  if (!date) return "-";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey) {
  const [year, month] = String(monthKey || currentMonthKey()).split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return monthKey || "-";
  return date.toLocaleDateString([], { month: "long", year: "numeric" });
}

function updateGreeting() {
  const hour = new Date().getHours();
  let english = "Good evening, Sir";
  let arabic = "مساء الخير يا سيدي";

  if (hour < 12) {
    english = "Good morning, Sir";
    arabic = "صباح الخير يا سيدي";
  } else if (hour < 17) {
    english = "Good afternoon, Sir";
    arabic = "مساء الخير يا سيدي";
  }

  if (els.greetingWrap) {
    els.greetingWrap.classList.add("is-fading");
  }

  window.setTimeout(() => {
    els.greeting.textContent = english;
    els.greetingArabic.textContent = arabic;
    els.greetingWrap?.classList.remove("is-fading");
  }, 120);
}

function metric(label, amount, count) {
  return `
    <div class="metric">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${money(amount)}</div>
      <div class="metric-cars">${cars(count)}</div>
    </div>
  `;
}

let chartId = 0;

function smoothChartPath(points) {
  if (points.length < 2) return `M ${points[0]?.x || 0} ${points[0]?.y || 0}`;
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function sparkline(values, color = "red") {
  const clean = values.map((value) => Number(value) || 0);
  if (!clean.length) clean.push(0, 0);
  if (clean.length === 1) clean.unshift(0);
  const width = 420;
  const height = 112;
  const padX = 18;
  const padTop = 12;
  const padBottom = 5;
  const max = Math.max(...clean, 1);
  const min = Math.min(...clean, 0);
  const range = Math.max(max - min, 1);
  const points = clean.map((value, index) => {
    const x = padX + (index / Math.max(clean.length - 1, 1)) * (width - padX * 2);
    const y = height - padBottom - ((value - min) / range) * (height - padTop - padBottom);
    return { x, y };
  });
  const path = smoothChartPath(points);
  const areaPath = `${path} L ${points.at(-1).x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;
  const id = `chartFade${chartId++}`;
  return `
    <svg class="sparkline sparkline-${color}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.30"></stop>
          <stop offset="58%" stop-color="currentColor" stop-opacity="0.11"></stop>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <g class="chart-grid"><line x1="18" y1="34" x2="402" y2="34"></line><line x1="18" y1="70" x2="402" y2="70"></line><line x1="18" y1="106" x2="402" y2="106"></line></g>
      <path class="spark-area" d="${areaPath}" fill="url(#${id})"></path>
      <path class="spark-path" d="${path}" pathLength="1"></path>
      <circle class="spark-dot" cx="${points.at(-1).x.toFixed(1)}" cy="${points.at(-1).y.toFixed(1)}" r="3.8"></circle>
    </svg>
  `;
}

function trendValues(field) {
  const rows = Array.isArray(state.trend?.rows) ? state.trend.rows : [];
  return rows.map((row) => row[field]);
}

function heroMetric(label, valueHtml, note, values, color, icon) {
  return `
    <article class="trend-card trend-${color}">
      <div class="trend-card-head">
        <span class="trend-icon" aria-hidden="true">${icon}</span>
        <span class="metric-label">${escapeHtml(label)}</span>
      </div>
      <div class="trend-value">${valueHtml}</div>
      <div class="trend-note">${escapeHtml(note)}</div>
      ${sparkline(values, color)}
    </article>
  `;
}

function countMetric(label, value, suffix) {
  const count = Number(value) || 0;
  return `
    <div class="metric">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${formatNumber(count)}</div>
      <div class="metric-cars">${escapeHtml(suffix || cars(value))}</div>
    </div>
  `;
}

function board(title, content) {
  return `
    <section class="board">
      <h2 class="board-title">${escapeHtml(title)}</h2>
      ${content}
    </section>
  `;
}

function detail(label, value, wide = false, html = false) {
  return `
    <div class="detail${wide ? " wide" : ""}">
      <span class="field-label">${escapeHtml(label)}</span>
      <strong>${html ? value : escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function showSkeleton(title = pages[state.activePage]) {
  els.title.textContent = title;
  els.view.innerHTML = `
    <div class="page-in">
      <div class="skeleton-wrap">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      </div>
    </div>
  `;
}

function showError(message) {
  els.view.innerHTML = `
    <div class="page-in">
      <div class="empty">${escapeHtml(message)}</div>
    </div>
  `;
}

function setView(html) {
  els.view.innerHTML = `<div class="page-in">${html}</div>`;
  window.requestAnimationFrame(animateVisibleCards);
}

function animateVisibleCards() {
  const items = Array.from(els.view.querySelectorAll(".card, .board"));
  if (!items.length) return;

  let revealIndex = 0;
  const viewportCutoff = window.innerHeight * 0.92;

  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    if (rect.top <= viewportCutoff) {
      const delay = Math.min(revealIndex, 4) * 50;
      item.style.setProperty("--reveal-delay", `${delay}ms`);
      item.classList.add("is-reveal");
      revealIndex += 1;
    }
  });
}

function updateTabs() {
  els.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.page === state.activePage);
  });
  const activeTab = els.tabs.find((tab) => tab.dataset.page === state.activePage);
  const indicator = document.querySelector(".tab-indicator");
  if (activeTab && indicator) {
    indicator.style.width = `${activeTab.offsetWidth}px`;
    indicator.style.transform = `translateX(${activeTab.offsetLeft - 3}px)`;
  }
  els.title.textContent = pages[state.activePage];
}

function summaryMetricGroup(summary, includeMonth) {
  if (!summary) return "";
  const cards = [
    metric("Without Company", summary.today?.earnings, summary.today?.cars),
    metric("With Company", summary.todayIncl?.earnings, summary.todayIncl?.cars),
  ];

  if (includeMonth) {
    cards.push(
      metric("This Month", summary.month?.earnings, summary.month?.cars),
      metric("Month + Company", summary.monthIncl?.earnings, summary.monthIncl?.cars),
    );
  }

  return `<div class="metric-grid">${cards.join("")}</div>`;
}

function renderOverview() {
  const today = state.report?.summary;
  const yesterday = state.yesterday?.summary;
  const revenueTrend = trendValues("earnings");
  const carsTrend = trendValues("cars");

  setView(`
    <section class="trend-grid" aria-label="Today's performance">
      ${heroMetric("Today's revenue", money(today?.todayIncl?.earnings), `${cars(today?.todayIncl?.cars)} completed`, revenueTrend, "red", `<svg viewBox="0 0 24 24"><path d="M5 7h14v10H5z"></path><path d="M8 10h8M8 14h5"></path></svg>`)}
      ${heroMetric("Cars today", `<span>${formatNumber(today?.todayIncl?.cars)}</span>`, `${moneyText(today?.todayIncl?.earnings)} total revenue`, carsTrend, "blue", `<svg viewBox="0 0 24 24"><path d="m5 15 1.5-5h11l1.5 5"></path><path d="M4 15h16v4H4z"></path><circle cx="7" cy="18" r="1"></circle><circle cx="17" cy="18" r="1"></circle></svg>`)}
    </section>
    <div class="summary-grid">
      ${board("Today", summaryMetricGroup(today, false))}
      ${board("Yesterday", summaryMetricGroup(yesterday, false))}
      ${board("This Month", `
        <div class="metric-grid">
          ${metric("Without Company", today?.month?.earnings, today?.month?.cars)}
          ${metric("With Company", today?.monthIncl?.earnings, today?.monthIncl?.cars)}
        </div>
      `)}
    </div>
  `);
}

function attendanceFor(name) {
  const attendance = state.report?.attendance || {};
  return attendance[name] || attendance[String(name).toUpperCase()] || null;
}

function lastWorkFor(name) {
  const lastWork = state.report?.lastWork || {};
  const attendance = attendanceFor(name);
  return attendance?.last || lastWork[name] || lastWork[String(name).toUpperCase()] || null;
}

function renderEmployees() {
  const sorters = {
    carsToday: (a, b) => (b[1].carsToday || 0) - (a[1].carsToday || 0),
    revenueToday: (a, b) => (b[1].daily || 0) - (a[1].daily || 0),
    carsMonth: (a, b) => (b[1].carsMonth || 0) - (a[1].carsMonth || 0),
    name: (a, b) => a[0].localeCompare(b[0]),
  };
  const employees = Object.entries(state.report?.employees || {})
    .sort(sorters[state.employeeSort] || sorters.carsToday);

  if (!employees.length) {
    setView(`<div class="empty">No employee data available.</div>`);
    return;
  }

  const rows = employees.map(([name, employee]) => {
    const attendance = attendanceFor(name);
    const last = lastWorkFor(name);
    const present = Boolean(attendance);

    return `
      <article class="employee-row card">
        <div class="employee-person">
          <span class="employee-avatar" aria-hidden="true">${escapeHtml(name.charAt(0))}</span>
          <div><h2 class="card-title">${escapeHtml(name)}</h2><span class="status ${present ? "present" : "absent"}">${present ? "Present" : "Absent"}</span></div>
        </div>
        <div class="employee-stat"><span>Today</span><strong>${money(employee.daily)}</strong><small>${escapeHtml(cars(employee.carsToday))}</small></div>
        <div class="employee-stat"><span>This month</span><strong>${money(employee.monthly)}</strong><small>${escapeHtml(cars(employee.carsMonth))}</small></div>
        <div class="employee-stat"><span>Last work</span><strong>${escapeHtml(clock(last))}</strong><small>${escapeHtml(idleText(last))} ago</small></div>
      </article>
    `;
  }).join("");

  setView(`
    <div class="section-tools">
      <label for="employeeSort">Sort employees</label>
      <select class="select-input compact-select" id="employeeSort">
        <option value="carsToday"${state.employeeSort === "carsToday" ? " selected" : ""}>Cars today</option>
        <option value="revenueToday"${state.employeeSort === "revenueToday" ? " selected" : ""}>Revenue today</option>
        <option value="carsMonth"${state.employeeSort === "carsMonth" ? " selected" : ""}>Cars this month</option>
        <option value="name"${state.employeeSort === "name" ? " selected" : ""}>Name</option>
      </select>
    </div>
    <div class="employee-board">${rows}</div>
  `);
  document.getElementById("employeeSort").addEventListener("change", (event) => {
    state.employeeSort = event.target.value;
    renderEmployees();
  });
}

function serviceActivity(service) {
  return Number(service?.monthIncl?.cars || 0) + Number(service?.todayIncl?.cars || 0);
}

function renderServices() {
  const rows = Object.entries(state.report?.services || {})
    .filter(([, service]) => serviceActivity(service) > 0)
    .sort((a, b) => {
      if (a[0] === "Hot Water") return -1;
      if (b[0] === "Hot Water") return 1;
      return (b[1].monthIncl?.cars || 0) - (a[1].monthIncl?.cars || 0);
    });

  if (!rows.length) {
    setView(`<div class="empty">No service usage available.</div>`);
    return;
  }

  const cards = rows.map(([name, service]) => {
    const todayCompanyAmt = (service.todayIncl?.earnings || 0) - (service.today?.earnings || 0);
    const todayCompanyCars = (service.todayIncl?.cars || 0) - (service.today?.cars || 0);
    const monthCompanyAmt = (service.monthIncl?.earnings || 0) - (service.month?.earnings || 0);
    const monthCompanyCars = (service.monthIncl?.cars || 0) - (service.month?.cars || 0);

    return board(name, `
      <div class="metric-grid">
        ${metric("Today", service.today?.earnings, service.today?.cars)}
        ${metric("Company", todayCompanyAmt, todayCompanyCars)}
        ${metric("Month", service.month?.earnings, service.month?.cars)}
        ${metric("Company Month", monthCompanyAmt, monthCompanyCars)}
      </div>
    `);
  }).join("");

  setView(`<div class="grid cards-grid">${cards}</div>`);
}

function aggregateRows(rows) {
  return rows.reduce((total, [, row]) => {
    total.dailyAmt += Number(row.dailyAmt) || 0;
    total.dailyCars += Number(row.dailyCars) || 0;
    total.monthlyAmt += Number(row.monthlyAmt) || 0;
    total.monthlyCars += Number(row.monthlyCars) || 0;
    return total;
  }, { dailyAmt: 0, dailyCars: 0, monthlyAmt: 0, monthlyCars: 0 });
}

function renderSimpleUsage(pageTitle, dividerTitle, data) {
  const rows = Object.entries(data || {})
    .filter(([, row]) => (Number(row.dailyCars) || 0) + (Number(row.monthlyCars) || 0) > 0)
    .sort((a, b) => {
      const bActivity = (b[1].monthlyCars || 0) + (b[1].dailyCars || 0);
      const aActivity = (a[1].monthlyCars || 0) + (a[1].dailyCars || 0);
      return bActivity - aActivity;
    });

  const total = aggregateRows(rows);
  const cards = rows.map(([name, row]) => board(name, `
    <div class="metric-grid">
      ${metric("Today", row.dailyAmt, row.dailyCars)}
      ${metric("Month", row.monthlyAmt, row.monthlyCars)}
    </div>
  `)).join("");

  setView(`
    <div class="grid">
      ${board(pageTitle, `
        <div class="metric-grid">
          ${metric("Today", total.dailyAmt, total.dailyCars)}
          ${metric("Month", total.monthlyAmt, total.monthlyCars)}
        </div>
      `)}
    </div>
    <div class="divider">${escapeHtml(dividerTitle)}</div>
    ${cards ? `<div class="grid cards-grid">${cards}</div>` : `<div class="empty">No ${escapeHtml(dividerTitle.toLowerCase())} activity yet.</div>`}
  `);
}

function renderOil() {
  renderSimpleUsage("Total", "Oil Types", state.report?.oils);
}

function renderZeena() {
  renderSimpleUsage("Total", "Entries", state.report?.zeena);
}

function renderCompany() {
  const rows = Object.entries(state.report?.companies || {})
    .filter(([, company]) => (Number(company.dailyCars) || 0) + (Number(company.monthlyCars) || 0) > 0)
    .sort((a, b) => {
      const todayDelta = (b[1].dailyAmt || 0) - (a[1].dailyAmt || 0);
      if (todayDelta !== 0) return todayDelta;
      return (b[1].monthlyAmt || 0) - (a[1].monthlyAmt || 0);
    });

  const total = rows.reduce((sum, [, company]) => {
    sum.dailyAmt += Number(company.dailyAmt) || 0;
    sum.dailyCars += Number(company.dailyCars) || 0;
    sum.monthlyAmt += Number(company.monthlyAmt) || 0;
    sum.monthlyCars += Number(company.monthlyCars) || 0;
    return sum;
  }, { dailyAmt: 0, dailyCars: 0, monthlyAmt: 0, monthlyCars: 0 });

  const companyChart = renderCompanyChart(rows, total);

  setView(`
    <div class="grid">
      ${board("Total", `
        <div class="metric-grid">
          ${metric("Today", total.dailyAmt, total.dailyCars)}
          ${metric("Month", total.monthlyAmt, total.monthlyCars)}
          ${countMetric("Total Cars", total.monthlyCars)}
        </div>
      `)}
    </div>
    <div class="divider">Company Share</div>
    ${companyChart || `<div class="empty">No company account activity yet.</div>`}
  `);
}

function renderCompanyChart(rows, total) {
  if (!rows.length || total.monthlyCars <= 0) return "";
  const colors = ["#ff493f", "#ff8a48", "#5aa7ff", "#8b7bff", "#3ed6aa", "#f5c84b", "#dc62ff", "#61d7ed"];
  let offset = 0;
  const segments = rows.map(([name, company], index) => {
    const value = Number(company.monthlyCars) || 0;
    const percentage = (value / total.monthlyCars) * 100;
    const color = colors[index % colors.length];
    const start = offset;
    offset += percentage;
    const segment = `<path class="donut-segment" d="${donutSegmentPath(start, offset)}" style="--delay:${index * 70}ms;--segment-color:${color}"></path>`;
    return { segment, name, company, percentage, color };
  });

  return `
    <section class="company-chart card">
      <div class="donut-wrap">
        <svg class="company-donut" viewBox="0 0 100 100" role="img" aria-label="Company share by cars this month">
          <circle class="donut-track" cx="50" cy="50" r="42"></circle>
          ${segments.map((item) => item.segment).join("")}
        </svg>
        <div class="donut-center"><strong>${formatNumber(total.monthlyCars)}</strong><span>cars this month</span></div>
      </div>
      <div class="company-legend">
        ${segments.map((item) => `
          <div class="legend-row">
            <span class="legend-dot" style="--segment-color:${item.color}"></span>
            <div><strong>${escapeHtml(item.name)}</strong><span>${money(item.company.monthlyAmt)} · ${escapeHtml(cars(item.company.monthlyCars))}</span></div>
            <b>${Math.round(item.percentage)}%</b>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function donutPoint(percent, radius) {
  const angle = (percent / 100) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
}

function donutSegmentPath(startPercent, endPercent) {
  const gap = Math.min(0.45, Math.max((endPercent - startPercent) * 0.08, 0.08));
  const start = startPercent + gap;
  const end = endPercent - gap;
  const outerRadius = 44;
  const innerRadius = 31;
  const outerStart = donutPoint(start, outerRadius);
  const outerEnd = donutPoint(end, outerRadius);
  const innerEnd = donutPoint(end, innerRadius);
  const innerStart = donutPoint(start, innerRadius);
  const largeArc = end - start > 50 ? 1 : 0;
  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function employeeOptions() {
  const fromEndpoint = Array.isArray(state.employeeList) ? state.employeeList : [];
  const fromReport = state.report?.allEmployees || Object.keys(state.report?.employees || {});
  return Array.from(new Set([...fromEndpoint, ...fromReport].filter(Boolean).map((name) => String(name).toUpperCase()))).sort();
}

function monthOptionsFor(employee) {
  if (!employee) return [];
  const months = state.employeeMonths[employee] || {};
  const entries = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
  return entries;
}

function renderEmployeeLookup() {
  const lookup = state.employeeLookup;
  const employees = employeeOptions();
  const monthEntries = monthOptionsFor(lookup.employee);
  const hasMonthData = lookup.employee && Object.prototype.hasOwnProperty.call(state.employeeMonths, lookup.employee);
  const canLoad = lookup.employee && monthEntries.length > 0 && lookup.month;
  const resultHtml = lookup.loading
    ? `<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><strong>Loading employee data</strong><span>Preparing the selected monthly report.</span></div>`
    : renderEmployeeLookupResult();

  setView(`
    <form class="lookup-form" id="employeeLookupForm">
      <div class="form-field">
        <span class="field-label">Employee</span>
        <div class="employee-picker" id="employeePicker">
          <button class="picker-button" id="employeePickerButton" type="button" aria-expanded="false">
            <span>${lookup.employee ? escapeHtml(lookup.employee) : "Select employee"}</span>
            <i class="chevron" aria-hidden="true"></i>
          </button>
          <div class="picker-panel" id="employeePickerPanel">
            <input class="picker-search" id="employeePickerSearch" type="search" placeholder="Filter employees" autocomplete="off">
            <div class="picker-list" id="employeePickerList">
              ${employees.map((name) => `
                <button class="picker-option${name === lookup.employee ? " is-selected" : ""}" type="button" data-employee="${escapeHtml(name)}">${escapeHtml(name)}</button>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
      <div class="form-field">
        <label class="field-label" for="employeeMonthInput">Month</label>
        ${lookup.employee ? `
          ${hasMonthData && monthEntries.length ? `
            <select class="select-input" id="employeeMonthInput" aria-label="Employee month">
              ${monthEntries.map(([key, label]) => `<option value="${escapeHtml(key)}"${key === lookup.month ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}
            </select>
          ` : `<div class="picker-note"><span class="loading-spinner small" aria-hidden="true"></span>${hasMonthData ? "No monthly data available" : "Loading available months"}</div>`}
        ` : `<div class="picker-note">Select an employee first</div>`}
      </div>
      <button class="load-button" type="submit"${canLoad ? "" : " disabled"}>Load</button>
    </form>
    <div id="employeeLookupResult">${resultHtml}</div>
  `);

  document.getElementById("employeeLookupForm").addEventListener("submit", handleEmployeeLookup);
  bindEmployeePicker();
  bindMonthSelect();

  if (!state.employeeList) {
    loadEmployeeList();
  }
}

function renderEmployeeLookupResult() {
  const lookup = state.employeeLookup;
  const result = lookup.result;

  if (!lookup.employee) {
    return `<div class="empty lookup-empty"><strong>Waiting for employee and month</strong><span>Select both fields to load performance details.</span></div>`;
  }

  if (!result) {
    const message = lookup.month
      ? `Choose Load to view ${escapeHtml(lookup.employee)} for ${escapeHtml(monthLabel(lookup.month))}.`
      : `Loading the available months for ${escapeHtml(lookup.employee)}.`;
    return `<div class="empty lookup-empty"><strong>${lookup.month ? "Selection ready" : "Loading details"}</strong><span>${message}</span></div>`;
  }

  const current = state.report?.employees?.[result.employee] || state.report?.employees?.[String(result.employee).toUpperCase()] || {};
  const attendance = attendanceFor(result.employee);
  const last = lastWorkFor(result.employee);

  return `
    <div class="grid">
      ${board("Identity", `
        <div class="detail-list">
          ${detail("Employee", result.employee)}
          ${detail("Presence", attendance ? "Present" : "Absent")}
          ${detail("First Work", result.firstWork || clock(attendance?.first))}
          ${detail("Last Active", result.lastWork || clock(last))}
        </div>
      `)}
      ${board("Today", `
        <div class="metric-grid">
          ${countMetric("Cars", current.carsToday || 0)}
          ${metric("Revenue", current.daily || 0, current.carsToday || 0)}
        </div>
      `)}
      ${board("Month", `
        <div class="metric-grid">
          ${countMetric("Cars", result.totalCars)}
          ${metric("Revenue", result.totalEarnings, result.totalCars)}
        </div>
      `)}
      ${board("Performance", `
        <div class="detail-list">
          ${detail("Days Worked", result.daysWorked)}
          ${detail("Avg Cars / Day", Number(result.averageCarsPerDay || 0).toFixed(1))}
          ${detail("Avg Earnings / Day", money(result.averageEarningsPerDay), false, true)}
          ${detail("Month", monthLabel(result.month))}
        </div>
      `)}
    </div>
    ${Object.prototype.hasOwnProperty.call(result, "companies") ? renderEmployeeBreakdown("Company Work", result.companies, "No company work recorded for this month.") : ""}
    ${Object.prototype.hasOwnProperty.call(result, "services") ? renderEmployeeBreakdown("Services", result.services, "No service activity recorded for this month.") : ""}
    ${Object.prototype.hasOwnProperty.call(result, "oils") ? renderEmployeeBreakdown("Oil Activity", result.oils, "No oil activity recorded for this month.") : ""}
    <div class="divider">Monthly Breakdown</div>
    ${renderDailyBreakdown(result.dailyBreakdown, result)}
    ${Object.prototype.hasOwnProperty.call(result, "recentActivity") ? `<div class="divider">Recent Activity</div>${renderRecentActivity(result.recentActivity)}` : ""}
  `;
}

function renderEmployeeBreakdown(title, data, emptyText) {
  const rows = Object.entries(data || {}).sort((a, b) => (b[1].cars || 0) - (a[1].cars || 0));
  if (!rows.length) return `<div class="divider">${escapeHtml(title)}</div><div class="empty">${escapeHtml(emptyText)}</div>`;
  return `
    <div class="divider">${escapeHtml(title)}</div>
    <div class="breakdown-list">
      ${rows.map(([name, item]) => `
        <div class="breakdown-row"><strong>${escapeHtml(name)}</strong><span>${money(item.earnings)} · ${escapeHtml(cars(item.cars))}</span></div>
      `).join("")}
    </div>
  `;
}

function renderDailyBreakdown(rows, result) {
  if (!Array.isArray(rows) || !rows.length) {
    return `<div class="grid">${board(monthLabel(result.month), `<div class="metric-grid">${metric("Revenue", result.totalEarnings, result.totalCars)}${countMetric("Worked Days", result.daysWorked, `${Number(result.daysWorked) || 0} days`)}</div>`)}</div>`;
  }
  return `<div class="breakdown-list">${rows.map((row) => `<div class="breakdown-row"><strong>${escapeHtml(row.label || row.date)}</strong><span>${money(row.earnings)} · ${escapeHtml(cars(row.cars))}</span></div>`).join("")}</div>`;
}

function renderRecentActivity(rows) {
  if (!Array.isArray(rows) || !rows.length) return `<div class="empty">No recent activity recorded for this month.</div>`;
  return `<div class="activity-list">${rows.map((row) => `
    <article class="activity-row">
      <div><strong>${escapeHtml(row.plate || "No plate")}</strong><span>${escapeHtml(row.service || "Service not specified")}</span></div>
      <div><strong>${money(row.earnings)}</strong><span>${escapeHtml(dateStamp(row.timestamp))}</span></div>
    </article>
  `).join("")}</div>`;
}

async function loadEmployeeList() {
  try {
    state.employeeList = await fetchJson({ employeeList: "1" });
    if (state.activePage === "employeeLookup") renderEmployeeLookup();
  } catch (error) {
    console.error(error);
    state.employeeList = [];
  }
}

function bindEmployeePicker() {
  const picker = document.getElementById("employeePicker");
  const button = document.getElementById("employeePickerButton");
  const search = document.getElementById("employeePickerSearch");
  const options = Array.from(document.querySelectorAll(".picker-option"));

  button.addEventListener("click", () => {
    const isOpen = picker.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
      window.requestAnimationFrame(() => search.focus());
    }
  });

  search.addEventListener("input", () => {
    const query = search.value.trim().toUpperCase();
    options.forEach((option) => {
      option.hidden = query && !option.dataset.employee.includes(query);
    });
  });

  options.forEach((option) => {
    option.addEventListener("click", () => {
      picker.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      selectEmployee(option.dataset.employee);
    });
  });
}

function bindMonthSelect() {
  const select = document.getElementById("employeeMonthInput");
  if (!select || select.tagName !== "SELECT") return;
  select.addEventListener("change", () => {
    state.employeeLookup.month = select.value;
    state.employeeLookup.result = null;
    renderEmployeeLookup();
  });
}

async function selectEmployee(employee) {
  employee = String(employee || "").trim().toUpperCase();
  state.employeeLookup.employee = employee;
  state.employeeLookup.result = null;
  state.employeeLookup.month = "";
  renderEmployeeLookup();
  if (!employee || state.employeeMonths[employee]) return;

  try {
    state.employeeMonths[employee] = await fetchJson({ employeeMonths: employee });
    const entries = monthOptionsFor(employee);
    state.employeeLookup.month = entries[0]?.[0] || "";
    if (state.activePage === "employeeLookup") renderEmployeeLookup();
  } catch (error) {
    console.error(error);
    state.employeeMonths[employee] = {};
  }
}

async function handleEmployeeLookup(event) {
  event.preventDefault();
  const employee = state.employeeLookup.employee;
  const month = state.employeeLookup.month || currentMonthKey();

  state.employeeLookup.employee = employee;
  state.employeeLookup.month = month;
  state.employeeLookup.result = null;

  if (!employee) {
    renderEmployeeLookup();
    return;
  }

  state.employeeLookup.loading = true;
  renderEmployeeLookup();

  try {
    state.employeeLookup.result = await fetchJson({ employeePerformance: employee, month });
  } catch (error) {
    console.error(error);
    state.employeeLookup.result = null;
  } finally {
    state.employeeLookup.loading = false;
    renderEmployeeLookup();
  }
}

function renderSearch() {
  const results = state.searchResults;
  const resultHtml = Array.isArray(results)
    ? renderSearchResults(results)
    : `<div class="empty lookup-empty"><strong>Vehicle history</strong><span>Enter a plate number to find its records.</span></div>`;

  setView(`
    <form class="search-form" id="searchForm">
      <input class="search-input" id="searchInput" type="search" value="${escapeHtml(state.searchQuery)}" placeholder="Enter plate number" aria-label="Plate number" autocomplete="off">
      <button class="search-button" type="submit">Search plate</button>
    </form>
    <div id="searchResults">${resultHtml}</div>
  `);

  document.getElementById("searchForm").addEventListener("submit", handleSearch);
}

function renderSearchResults(results) {
  if (!results.length) {
    return `<div class="empty">No entries found.</div>`;
  }

  return `
    <div class="grid cards-grid">
      ${results.map((row) => `
        <article class="card">
          <div class="split">
            <div>
              <p class="eyebrow">${escapeHtml(dateStamp(row.timestamp))}</p>
              <h2 class="card-title">${escapeHtml(row.plate || "No plate")}</h2>
            </div>
            <span class="status present">${money(row.price)}</span>
          </div>
          <div class="detail-list">
            ${detail("Employee", row.employee)}
            ${detail("Foreman", row.foreman)}
            ${detail("Service", row.service, true)}
            ${detail("Company", row.company)}
            ${detail("Oil", row.oil)}
            ${detail("Sheet", row.sheet, true)}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

async function handleSearch(event) {
  event.preventDefault();
  const input = document.getElementById("searchInput");
  const query = input.value.trim();
  state.searchQuery = query;

  if (!query) {
    state.searchResults = null;
    renderSearch();
    return;
  }

  document.getElementById("searchResults").innerHTML = `
    <div class="skeleton-wrap">
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    </div>
  `;

  try {
    state.searchResults = await fetchJson({ search: query });
    renderSearch();
  } catch (error) {
    showError("Search failed. Refresh and try again.");
  }
}

function renderActivePage() {
  updateTabs();

  if (!state.report && state.activePage !== "search") {
    showSkeleton();
    return;
  }

  const renderers = {
    overview: renderOverview,
    employees: renderEmployees,
    services: renderServices,
    oil: renderOil,
    zeena: renderZeena,
    company: renderCompany,
    employeeLookup: renderEmployeeLookup,
    search: renderSearch,
  };

  renderers[state.activePage]();
}

async function refreshData() {
  state.loading = true;
  els.refresh.classList.add("is-spinning");
  showSkeleton(pages[state.activePage]);
  updateGreeting();

  try {
    const [report, yesterday, trend] = await Promise.all([
      fetchJson(),
      fetchJson({ yesterday: "1" }),
      fetchJson({ trend: "1", month: currentMonthKey() }),
    ]);
    state.report = report || {};
    state.yesterday = yesterday || {};
    state.trend = trend || { rows: [] };
    els.updated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    renderActivePage();
  } catch (error) {
    console.error(error);
    els.updated.textContent = "Could not load report";
    showError("Could not load dashboard data.");
  } finally {
    state.loading = false;
    els.refresh.classList.remove("is-spinning");
    requestHideSplash();
  }
}

function setPage(page) {
  if (!pages[page] || page === state.activePage) return;
  state.activePage = page;
  window.history.replaceState(null, "", `#${page}`);
  showSkeleton(pages[page]);
  window.requestAnimationFrame(renderActivePage);
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document.body.classList.toggle("light", theme === "light");
}

function initTheme() {
  const preference = window.matchMedia("(prefers-color-scheme: light)");
  const syncTheme = () => applyTheme(preference.matches ? "light" : "dark");
  syncTheme();
  preference.addEventListener?.("change", syncTheme);
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setPage(tab.dataset.page));
  });

  els.refresh.addEventListener("click", refreshData);

  document.addEventListener("click", (event) => {
    const picker = document.getElementById("employeePicker");
    if (picker && !picker.contains(event.target)) {
      picker.classList.remove("is-open");
      document.getElementById("employeePickerButton")?.setAttribute("aria-expanded", "false");
    }
  });

  window.addEventListener("resize", updateTabs, { passive: true });
}

function boot() {
  const hashPage = window.location.hash.replace("#", "");
  if (pages[hashPage]) state.activePage = hashPage;
  updateGreeting();
  initTheme();
  mountSplash();
  bindEvents();
  updateTabs();
  document.fonts?.ready.then(updateTabs);
  refreshData();
}

function mountSplash() {
  const splash = document.createElement("div");
  splash.className = "splash";
  splash.innerHTML = `<div class="splash-logo" role="img" aria-label="Al Raked logo"></div>`;
  document.body.appendChild(splash);
  splashState.el = splash;
  splashState.shownAt = performance.now();
  splashState.hidden = false;

  window.requestAnimationFrame(() => {
    splash.classList.add("is-visible");
  });
  document.addEventListener("pointerdown", () => requestHideSplash(true), { once: true });
  document.addEventListener("keydown", () => requestHideSplash(true), { once: true });
}

function requestHideSplash(force = false) {
  const splash = splashState.el;
  if (!splash || splashState.hidden) return;

  const elapsed = performance.now() - splashState.shownAt;
  const remaining = Math.max(0, splashState.minDuration - elapsed);
  const delay = force ? 0 : remaining;

  window.setTimeout(() => {
    if (!splash.isConnected || splashState.hidden) return;
    splashState.hidden = true;
    splash.classList.add("is-hiding");
    splash.addEventListener("transitionend", () => splash.remove(), { once: true });
    setTimeout(() => splash.remove(), 1400);
  }, delay);
}

boot();
