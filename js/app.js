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
  theme: document.getElementById("themeBtn"),
  greeting: document.getElementById("greetingText"),
  greetingArabic: document.getElementById("greetingArabic"),
  tabs: Array.from(document.querySelectorAll(".tab")),
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

  els.greeting.textContent = english;
  els.greetingArabic.textContent = arabic;
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
  els.view.innerHTML = `<div class="page-in cards-animate">${html}</div>`;
}

function updateTabs() {
  els.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.page === state.activePage);
  });
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

  setView(`
    <div class="grid">
      ${board("Today", summaryMetricGroup(today, true))}
      ${board("Yesterday", summaryMetricGroup(yesterday, false))}
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
  const employees = Object.entries(state.report?.employees || {})
    .sort((a, b) => (b[1].carsToday || 0) - (a[1].carsToday || 0));

  if (!employees.length) {
    setView(`<div class="empty">No employee data available.</div>`);
    return;
  }

  const cards = employees.map(([name, employee]) => {
    const attendance = attendanceFor(name);
    const last = lastWorkFor(name);
    const present = Boolean(attendance);

    return `
      <article class="card">
        <div class="split">
          <div>
            <p class="eyebrow">Employee</p>
            <h2 class="card-title">${escapeHtml(name)}</h2>
          </div>
          <span class="status ${present ? "present" : "absent"}">${present ? "Present" : "Absent"}</span>
        </div>
        <div class="detail-list">
          ${detail("First Work", clock(attendance?.first))}
          ${detail("Last Work", clock(last))}
          ${detail("Idle", idleText(last), true)}
          ${detail("Today", `${money(employee.daily)} / ${escapeHtml(cars(employee.carsToday))}`, false, true)}
          ${detail("Month", `${money(employee.monthly)} / ${escapeHtml(cars(employee.carsMonth))}`, false, true)}
        </div>
      </article>
    `;
  }).join("");

  setView(`<div class="grid cards-grid">${cards}</div>`);
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

  const companyCards = rows.map(([name, company]) => {
    const percentage = total.monthlyCars > 0
      ? Math.round(((Number(company.monthlyCars) || 0) / total.monthlyCars) * 100)
      : 0;

    return `
      <article class="card">
        <div class="split">
          <div>
            <p class="eyebrow">Company</p>
            <h2 class="card-title">${escapeHtml(name)}</h2>
          </div>
        </div>
        <div class="detail-list">
          ${detail("Today", `${money(company.dailyAmt)} / ${escapeHtml(cars(company.dailyCars))}`, false, true)}
          ${detail("Month", `${money(company.monthlyAmt)} / ${escapeHtml(cars(company.monthlyCars))}`, false, true)}
          ${detail("Cars", cars(company.monthlyCars))}
          ${detail("Percentage", `${percentage}%`)}
        </div>
      </article>
    `;
  }).join("");

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
    <div class="divider">Companies</div>
    ${companyCards ? `<div class="grid cards-grid">${companyCards}</div>` : `<div class="empty">No company account activity yet.</div>`}
  `);
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
    ? `<div class="skeleton-wrap"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`
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
        <span class="field-label">Month</span>
        ${lookup.employee ? `
          <div class="month-pills" id="employeeMonthInput" role="listbox" aria-label="Employee month">
            ${monthEntries.map(([key, label]) => `
              <button class="month-pill${key === lookup.month ? " is-active" : ""}" type="button" data-month="${escapeHtml(key)}">${escapeHtml(label)}</button>
            `).join("")}
            ${hasMonthData && !monthEntries.length ? `<span class="picker-note">No data available</span>` : ""}
            ${!hasMonthData ? `<span class="picker-note">Loading months</span>` : ""}
          </div>
        ` : `<div class="picker-note">Select an employee first</div>`}
      </div>
      <button class="load-button" type="submit"${canLoad ? "" : " disabled"}>Load</button>
    </form>
    <div id="employeeLookupResult">${resultHtml}</div>
  `);

  document.getElementById("employeeLookupForm").addEventListener("submit", handleEmployeeLookup);
  bindEmployeePicker();
  bindMonthPicker();

  if (!state.employeeList) {
    loadEmployeeList();
  }
}

function renderEmployeeLookupResult() {
  const lookup = state.employeeLookup;
  const result = lookup.result;

  if (!lookup.employee) {
    return `<div class="empty">Select an employee, choose a month, then load the report.</div>`;
  }

  if (!result) {
    return `<div class="empty">Ready to load ${escapeHtml(lookup.employee)}.</div>`;
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
    <div class="divider">Company Work</div>
    <div class="empty">Company contribution is not exposed by the current employee endpoint.</div>
    <div class="divider">Services</div>
    <div class="empty">Service breakdown is not exposed by the current employee endpoint.</div>
    <div class="divider">Oil Activity</div>
    <div class="empty">Oil activity is not exposed by the current employee endpoint.</div>
    <div class="divider">Monthly Breakdown</div>
    <div class="grid">
      ${board(monthLabel(result.month), `
        <div class="metric-grid">
          ${metric("Revenue", result.totalEarnings, result.totalCars)}
          ${countMetric("Worked Days", result.daysWorked, `${Number(result.daysWorked) || 0} days`)}
        </div>
      `)}
    </div>
    <div class="divider">Recent Activity</div>
    <div class="empty">Recent activity rows are not exposed by the current employee endpoint.</div>
  `;
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

function bindMonthPicker() {
  document.querySelectorAll(".month-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      state.employeeLookup.month = pill.dataset.month;
      document.querySelectorAll(".month-pill").forEach((item) => {
        item.classList.toggle("is-active", item === pill);
      });
    });
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
    : `<div class="empty">Search plate, employee, company, or service.</div>`;

  setView(`
    <form class="search-form" id="searchForm">
      <input class="search-input" id="searchInput" type="search" value="${escapeHtml(state.searchQuery)}" placeholder="Search plate, employee, company, or service" autocomplete="off">
      <button class="search-button" type="submit">Go</button>
    </form>
    <div class="hints">
      <span class="hint">Plate</span>
      <span class="hint">Employee</span>
      <span class="hint">Company</span>
      <span class="hint">Service</span>
    </div>
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
    const [report, yesterday] = await Promise.all([
      fetchJson(),
      fetchJson({ yesterday: "1" }),
    ]);
    state.report = report || {};
    state.yesterday = yesterday || {};
    els.updated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    renderActivePage();
  } catch (error) {
    console.error(error);
    els.updated.textContent = "Could not load report";
    showError("Could not load dashboard data.");
  } finally {
    state.loading = false;
    els.refresh.classList.remove("is-spinning");
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
  els.theme.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
  localStorage.setItem("arc-theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("arc-theme");
  applyTheme(saved === "light" ? "light" : "dark");
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setPage(tab.dataset.page));
  });

  els.refresh.addEventListener("click", refreshData);

  els.theme.addEventListener("click", () => {
    applyTheme(document.body.classList.contains("light") ? "dark" : "light");
  });

  document.addEventListener("click", (event) => {
    const picker = document.getElementById("employeePicker");
    if (picker && !picker.contains(event.target)) {
      picker.classList.remove("is-open");
      document.getElementById("employeePickerButton")?.setAttribute("aria-expanded", "false");
    }
  });
}

function boot() {
  const hashPage = window.location.hash.replace("#", "");
  if (pages[hashPage]) state.activePage = hashPage;
  updateGreeting();
  initTheme();
  bindEvents();
  updateTabs();
  refreshData();
}

boot();
