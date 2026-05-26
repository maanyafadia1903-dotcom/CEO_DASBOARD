const BASE = "http://127.0.0.1:5000";
let activeSection = "overview";
let revenueChart = null, deptChart = null, forecastChart = null, reportChart = null;

function fmt(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7)  return sign + "₹" + (abs/1e7).toFixed(1) + "Cr";
  if (abs >= 1e5)  return sign + "₹" + (abs/1e5).toFixed(1) + "L";
  return sign + "₹" + abs.toLocaleString("en-IN");
}
function initials(name) { return name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase(); }
function monthName(m) { return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]; }
function destroyCharts() {
  [revenueChart, deptChart, forecastChart, reportChart].forEach(c => { if(c) c.destroy(); });
  revenueChart = deptChart = forecastChart = reportChart = null;
}
function loading(msg="Loading…") { return `<div class="loading">${msg}</div>`; }
function errBox(msg) { return `<div class="error-msg">⚠ ${msg}</div>`; }

function chartDefaults() {
  Chart.defaults.color       = "#64748b";
  Chart.defaults.borderColor = "#1c2535";
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  Chart.defaults.font.size   = 10;
}

function startClock() {
  const el = document.getElementById("nav-time");
  const tick = () => {
    const n = new Date();
    el.textContent = n.toLocaleTimeString("en-IN",{hour12:false}) + "  " +
                     n.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  };
  tick(); setInterval(tick, 1000);
}

function setActive(section) {
  activeSection = section;
  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.section === section);
  });
  document.querySelectorAll(".sidebar-icon[data-section]").forEach(el => {
    el.classList.toggle("active", el.dataset.section === section);
  });
}

function navigate(section) {
  destroyCharts();
  setActive(section);
  const main = document.getElementById("main-content");
  if      (section === "overview")  loadOverview(main);
  else if (section === "forecast")  loadForecast(main);
  else if (section === "alerts")    loadAlerts(main);
  else if (section === "reports")   loadReports(main);
}

async function loadOverview(main) {
  main.innerHTML = loading("Fetching companies…");
  try {
    const companies = await fetch(`${BASE}/companies`).then(r=>r.json());
    main.innerHTML = "";

    const header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = `<span class="section-title">Portfolio Overview</span>
      <span class="badge">${companies.length} companies</span>`;
    main.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "companies-grid";

    for (const c of companies) {
      let rev="—", profit="—", emp="—", margin="—", trend="";
      try {
        const m = await fetch(`${BASE}/companies/${c.id}/metrics`).then(r=>r.json());
        if (m.length) {
          const last = m[m.length-1];
          const prev = m.length>1 ? m[m.length-2] : null;
          rev    = fmt(last.revenue);
          profit = fmt(last.profit);
          emp    = last.employee_count.toLocaleString("en-IN");
          margin = last.revenue ? (last.profit/last.revenue*100).toFixed(1)+"%" : "—";
          if (prev) trend = last.revenue >= prev.revenue ? "trend-up" : "trend-down";
        }
      } catch(_) {}

      const card = document.createElement("div");
      card.className = "company-card";
      card.innerHTML = `
        <div class="card-header">
          <div class="company-logo">${initials(c.name)}</div>
          <span class="badge">${c.industry}</span>
        </div>
        <h3>${c.name}</h3>
        <div class="card-metrics">
          <div class="mini-metric"><span class="label">Revenue</span><span class="val ${trend}">${rev}</span></div>
          <div class="mini-metric"><span class="label">Profit</span><span class="val">${profit}</span></div>
          <div class="mini-metric"><span class="label">Employees</span><span class="val">${emp}</span></div>
          <div class="mini-metric"><span class="label">Margin</span><span class="val">${margin}</span></div>
        </div>`;
      card.addEventListener("click", () => showCompanyDetail(c));
      grid.appendChild(card);
    }
    main.appendChild(grid);
  } catch(err) { main.innerHTML = errBox(err.message); }
}

async function showCompanyDetail(company) {
  destroyCharts();
  const main = document.getElementById("main-content");
  main.innerHTML = loading(`Loading ${company.name}…`);
  try {
    const [metrics, departments] = await Promise.all([
      fetch(`${BASE}/companies/${company.id}/metrics`).then(r=>r.json()),
      fetch(`${BASE}/companies/${company.id}/departments`).then(r=>r.json())
    ]);
    const last      = metrics[metrics.length-1];
    const latestD   = departments.filter(d=>d.year===last.year && d.month===last.month);
    const maxHead   = Math.max(...latestD.map(d=>d.headcount));
    const labels    = metrics.map(m=>`${monthName(m.month)} ${String(m.year).slice(2)}`);

    main.innerHTML = `
      <div class="detail-view">
        <div class="detail-top">
          <button id="back-btn">← Back</button>
          <div class="company-logo" style="width:44px;height:44px;font-size:.85rem">${initials(company.name)}</div>
          <div>
            <div class="detail-company-name">${company.name}</div>
            <div class="industry-tag">${company.industry}</div>
          </div>
        </div>
        <div class="kpi-strip">
          <div class="kpi-card revenue"><div class="kpi-label">Revenue</div><div class="kpi-value">${fmt(last.revenue)}</div></div>
          <div class="kpi-card profit"><div class="kpi-label">Net Profit</div><div class="kpi-value">${fmt(last.profit)}</div></div>
          <div class="kpi-card employees"><div class="kpi-label">Headcount</div><div class="kpi-value">${last.employee_count.toLocaleString("en-IN")}</div></div>
        </div>
        <div class="charts-row">
          <div class="chart-card">
            <div class="chart-card-title"><span style="background:#00d4aa"></span>Revenue vs Profit</div>
            <canvas id="revenue-chart" height="180"></canvas>
          </div>
          <div class="chart-card">
            <div class="chart-card-title"><span style="background:#3b82f6"></span>Dept Headcount</div>
            <canvas id="dept-chart" height="180"></canvas>
          </div>
        </div>
        <div class="dept-section">
          <div class="section-header">
            <span class="section-title">Department Breakdown</span>
            <span class="badge">${monthName(last.month)} ${last.year}</span>
          </div>
          <div class="dept-grid">
            ${latestD.map(d=>`
              <div class="dept-card">
                <span class="dept-name">${d.department}</span>
                <span class="dept-count">${d.headcount}</span>
                <div class="dept-bar"><div class="dept-bar-fill" style="width:${(d.headcount/maxHead*100).toFixed(1)}%"></div></div>
              </div>`).join("")}
          </div>
        </div>
      </div>`;

    document.getElementById("back-btn").addEventListener("click", () => loadOverview(main));
    chartDefaults();

    const revCtx = document.getElementById("revenue-chart").getContext("2d");
    const grad = revCtx.createLinearGradient(0,0,0,200);
    grad.addColorStop(0,"rgba(0,212,170,.25)"); grad.addColorStop(1,"rgba(0,212,170,0)");
    revenueChart = new Chart(revCtx, {
      type:"line",
      data:{ labels, datasets:[
        { label:"Revenue", data:metrics.map(m=>m.revenue), borderColor:"#00d4aa", backgroundColor:grad, borderWidth:2, pointRadius:2, fill:true, tension:.4 },
        { label:"Profit",  data:metrics.map(m=>m.profit),  borderColor:"#3b82f6", backgroundColor:"transparent", borderWidth:2, borderDash:[4,3], pointRadius:2, tension:.4 }
      ]},
      options:{ responsive:true, interaction:{mode:"index",intersect:false},
        plugins:{ legend:{labels:{usePointStyle:true,color:"#94a3b8",font:{size:10}}},
          tooltip:{backgroundColor:"#0d1117",borderColor:"#1c2535",borderWidth:1,titleColor:"#e2e8f0",bodyColor:"#94a3b8",callbacks:{label:ctx=>" "+ctx.dataset.label+": "+fmt(ctx.parsed.y)}}},
        scales:{ x:{grid:{color:"#1c2535"},ticks:{maxTicksLimit:8}}, y:{grid:{color:"#1c2535"},ticks:{callback:v=>fmt(v)}} }
      }
    });

    deptChart = new Chart(document.getElementById("dept-chart").getContext("2d"), {
      type:"doughnut",
      data:{ labels:latestD.map(d=>d.department), datasets:[{ data:latestD.map(d=>d.headcount),
        backgroundColor:["#00d4aa","#3b82f6","#f59e0b","#8b5cf6","#ec4899"],
        borderColor:"#0d1117", borderWidth:3, hoverOffset:6 }]},
      options:{ responsive:true, cutout:"65%",
        plugins:{ legend:{position:"bottom",labels:{color:"#94a3b8",font:{size:9},boxWidth:10,padding:8}},
          tooltip:{backgroundColor:"#0d1117",borderColor:"#1c2535",borderWidth:1} } }
    });
  } catch(err) { main.innerHTML = errBox(err.message); }
}


async function loadForecast(main) {
  main.innerHTML = loading("Loading companies…");
  try {
    const companies = await fetch(`${BASE}/companies`).then(r=>r.json());
    main.innerHTML = `
      <div class="section-header">
        <span class="section-title">Revenue Forecast — Next 6 Months</span>
        <span class="badge">ML · Linear Regression</span>
      </div>
      <div class="forecast-controls">
        <label class="fc-label">Select Company</label>
        <select id="fc-select" class="fc-select">
          ${companies.map(c=>`<option value="${c.id}">${c.name}</option>`).join("")}
        </select>
      </div>
      <div id="forecast-body"></div>`;

    const sel = document.getElementById("fc-select");
    sel.addEventListener("change", () => renderForecast(sel.value));
    renderForecast(companies[0].id);
  } catch(err) { main.innerHTML = errBox(err.message); }
}

async function renderForecast(id) {
  const body = document.getElementById("forecast-body");
  body.innerHTML = loading("Running model…");
  if (forecastChart) { forecastChart.destroy(); forecastChart = null; }
  try {
    const data = await fetch(`${BASE}/companies/${id}/forecast`).then(r=>r.json());
    const hist = data.history;
    const fc   = data.forecast;
    const histLabels = hist.map(h=>`${monthName(h.month)} ${String(h.year).slice(2)}`);
    const fcLabels   = fc.map(f=>`${monthName(f.month)} ${String(f.year).slice(2)}`);
    const allLabels  = [...histLabels, ...fcLabels];

    const histRev  = hist.map(h=>h.revenue);
    const lastActual = histRev[histRev.length - 1];  
    const fcRev    = fc.map(f=>f.predicted_revenue);
    const actualData   = [...histRev, ...new Array(fc.length).fill(null)];

    const forecastData = [...new Array(hist.length - 1).fill(null), lastActual, ...fcRev];

    body.innerHTML = `
      <div class="charts-row" style="grid-template-columns:1fr">
        <div class="chart-card">
          <div class="chart-card-title"><span style="background:#f59e0b"></span>Historical + Forecast Revenue</div>
          <canvas id="forecast-chart" height="200"></canvas>
        </div>
      </div>
      <div class="section-header" style="margin-top:1rem">
        <span class="section-title">Predicted Values</span>
      </div>
      <div class="forecast-table-wrap">
        <table class="dash-table">
          <thead><tr><th>Month</th><th>Year</th><th>Predicted Revenue</th></tr></thead>
          <tbody>
            ${fc.map(f=>`<tr>
              <td>${monthName(f.month)}</td>
              <td>${f.year}</td>
              <td class="trend-up">${fmt(f.predicted_revenue)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    chartDefaults();
    const ctx = document.getElementById("forecast-chart").getContext("2d");
    const grad = ctx.createLinearGradient(0,0,0,220);
    grad.addColorStop(0,"rgba(245,158,11,.2)"); grad.addColorStop(1,"rgba(245,158,11,0)");
    forecastChart = new Chart(ctx, {
      type:"line",
      data:{ labels:allLabels, datasets:[
        { label:"Actual Revenue", data: actualData,
          borderColor:"#00d4aa", backgroundColor:"transparent", borderWidth:2, pointRadius:2, tension:.4,
          spanGaps: false },
        { label:"Forecast", data: forecastData,
          borderColor:"#f59e0b", backgroundColor:grad, borderWidth:2,
          borderDash:[6,3], pointRadius:4, pointBackgroundColor:"#f59e0b", fill:true, tension:.4,
          spanGaps: false }
      ]},
      options:{ responsive:true, interaction:{mode:"index",intersect:false},
        plugins:{
          legend:{labels:{usePointStyle:true,color:"#94a3b8",font:{size:10}}},
          tooltip:{backgroundColor:"#0d1117",borderColor:"#1c2535",borderWidth:1,titleColor:"#e2e8f0",bodyColor:"#94a3b8",
            callbacks:{label:ctx=>ctx.parsed.y!=null?" "+ctx.dataset.label+": "+fmt(ctx.parsed.y):""}}},
        scales:{ x:{grid:{color:"#1c2535"},ticks:{maxTicksLimit:10}}, y:{grid:{color:"#1c2535"},ticks:{callback:v=>fmt(v)}} }
      }
    });
  } catch(err) { body.innerHTML = errBox(err.message); }
}

async function loadAlerts(main) {
  main.innerHTML = loading("Running anomaly detection…");
  try {
    const companies = await fetch(`${BASE}/companies`).then(r=>r.json());
    main.innerHTML = `
      <div class="section-header">
        <span class="section-title">Anomaly Alerts</span>
        <span class="badge">ML · Isolation Forest</span>
      </div>
      <div class="alerts-filter">
        <span class="filter-label">Company:</span>
        <div class="filter-btns" id="filter-btns">
          <button class="filter-btn active" data-id="all">All</button>
          ${companies.map(c=>`<button class="filter-btn" data-id="${c.id}">${c.name}</button>`).join("")}
        </div>
      </div>
      <div id="alerts-body"></div>`;

    let allAlerts = [];
    for (const c of companies) {
      try {
        const data = await fetch(`${BASE}/companies/${c.id}/anomalies`).then(r=>r.json());
        data.anomalies.forEach(a => { a.company_name = c.name; a.company_id = c.id; a.industry = c.industry; });
        allAlerts.push(...data.anomalies);
      } catch(_) {}
    }

    function renderAlerts(filtered) {
      const body = document.getElementById("alerts-body");
      if (!filtered.length) { body.innerHTML = `<div class="empty-state">No anomalies detected</div>`; return; }
      body.innerHTML = `
        <div class="alerts-count">${filtered.length} anomalies detected</div>
        <div class="alerts-list">
          ${filtered.map(a=>`
            <div class="alert-card">
              <div class="alert-left">
                <div class="alert-company-logo">${initials(a.company_name)}</div>
              </div>
              <div class="alert-body">
                <div class="alert-header">
                  <span class="alert-company">${a.company_name}</span>
                  <span class="alert-industry">${a.industry}</span>
                  <span class="alert-period">${monthName(a.month)} ${a.year}</span>
                </div>
                <div class="alert-metrics">
                  <div class="alert-metric"><span class="label">Revenue</span><span class="val">${fmt(a.revenue)}</span></div>
                  <div class="alert-metric"><span class="label">Profit</span><span class="val ${a.profit<0?"trend-down":"trend-up"}">${fmt(a.profit)}</span></div>
                  <div class="alert-metric"><span class="label">Employees</span><span class="val">${a.employee_count}</span></div>
                </div>
                <div class="alert-tag">⚠ Statistical Anomaly Detected</div>
              </div>
            </div>`).join("")}
        </div>`;
    }

    renderAlerts(allAlerts);

    document.getElementById("filter-btns").addEventListener("click", e => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const id = btn.dataset.id;
      renderAlerts(id === "all" ? allAlerts : allAlerts.filter(a=>String(a.company_id)===id));
    });

  } catch(err) { main.innerHTML = errBox(err.message); }
}

async function loadReports(main) {
  main.innerHTML = loading("Compiling reports…");
  try {
    const data = await fetch(`${BASE}/reports`).then(r=>r.json());
    const totalRev  = data.reduce((s,c)=>s+c.latest_revenue, 0);
    const totalProf = data.reduce((s,c)=>s+c.latest_profit,  0);
    const totalEmp  = data.reduce((s,c)=>s+c.latest_employees,0);
    const topRev    = [...data].sort((a,b)=>b.latest_revenue-a.latest_revenue)[0];

    main.innerHTML = `
      <div class="section-header">
        <span class="section-title">Portfolio Reports</span>
        <span class="badge">${data.length} companies · ${data[0]?.months_tracked || 0} months</span>
      </div>
      <div class="kpi-strip">
        <div class="kpi-card revenue"><div class="kpi-label">Portfolio Revenue</div><div class="kpi-value">${fmt(totalRev)}</div></div>
        <div class="kpi-card profit"><div class="kpi-label">Portfolio Profit</div><div class="kpi-value">${fmt(totalProf)}</div></div>
        <div class="kpi-card employees"><div class="kpi-label">Total Workforce</div><div class="kpi-value">${totalEmp.toLocaleString("en-IN")}</div></div>
      </div>
      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-card-title"><span style="background:#00d4aa"></span>Revenue by Company</div>
          <canvas id="report-chart" height="200"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-card-title"><span style="background:#f59e0b"></span>Top Performer</div>
          <div class="top-performer">
            <div class="company-logo" style="width:52px;height:52px;font-size:1rem;margin-bottom:.75rem">${initials(topRev.company_name)}</div>
            <div class="tp-name">${topRev.company_name}</div>
            <div class="tp-industry">${topRev.industry}</div>
            <div class="tp-metrics">
              <div class="mini-metric"><span class="label">Revenue</span><span class="val trend-up">${fmt(topRev.latest_revenue)}</span></div>
              <div class="mini-metric"><span class="label">Margin</span><span class="val">${topRev.profit_margin}%</span></div>
              <div class="mini-metric"><span class="label">Best Month</span><span class="val">${topRev.best_month}</span></div>
              <div class="mini-metric"><span class="label">Peak Rev</span><span class="val">${fmt(topRev.best_revenue)}</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="section-header" style="margin-top:1rem">
        <span class="section-title">Company Breakdown</span>
      </div>
      <div class="forecast-table-wrap">
        <table class="dash-table">
          <thead><tr><th>Company</th><th>Industry</th><th>Revenue</th><th>Profit</th><th>Margin</th><th>Employees</th><th>Best Month</th></tr></thead>
          <tbody>
            ${[...data].sort((a,b)=>b.latest_revenue-a.latest_revenue).map(c=>`
              <tr>
                <td><span class="table-logo">${initials(c.company_name)}</span> ${c.company_name}</td>
                <td class="muted">${c.industry}</td>
                <td>${fmt(c.latest_revenue)}</td>
                <td class="${c.latest_profit>=0?"trend-up":"trend-down"}">${fmt(c.latest_profit)}</td>
                <td class="${c.profit_margin>=15?"trend-up":c.profit_margin>=5?"":"trend-down"}">${c.profit_margin}%</td>
                <td>${c.latest_employees.toLocaleString("en-IN")}</td>
                <td class="muted">${c.best_month}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    chartDefaults();
    const sorted = [...data].sort((a,b)=>b.latest_revenue-a.latest_revenue);
    reportChart = new Chart(document.getElementById("report-chart").getContext("2d"), {
      type:"bar",
      data:{ labels:sorted.map(c=>c.company_name),
        datasets:[
          { label:"Revenue", data:sorted.map(c=>c.latest_revenue),
            backgroundColor:"rgba(0,212,170,.7)", borderColor:"#00d4aa", borderWidth:1, borderRadius:4 },
          { label:"Profit",  data:sorted.map(c=>c.latest_profit),
            backgroundColor:"rgba(59,130,246,.7)", borderColor:"#3b82f6", borderWidth:1, borderRadius:4 }
        ]},
      options:{ responsive:true, interaction:{mode:"index",intersect:false},
        plugins:{ legend:{labels:{usePointStyle:true,color:"#94a3b8",font:{size:10}}},
          tooltip:{backgroundColor:"#0d1117",borderColor:"#1c2535",borderWidth:1,titleColor:"#e2e8f0",bodyColor:"#94a3b8",
            callbacks:{label:ctx=>" "+ctx.dataset.label+": "+fmt(ctx.parsed.y)}}},
        scales:{ x:{grid:{color:"#1c2535"}}, y:{grid:{color:"#1c2535"},ticks:{callback:v=>fmt(v)}} }
      }
    });
  } catch(err) { main.innerHTML = errBox(err.message); }
}

startClock();
document.querySelectorAll(".nav-item").forEach(el => {
  el.addEventListener("click", () => navigate(el.dataset.section));
});
document.querySelectorAll(".sidebar-icon[data-section]").forEach(el => {
  el.addEventListener("click", () => navigate(el.dataset.section));
});
navigate("overview");

const themePanel   = document.getElementById("theme-panel");
const settingsBtn  = document.getElementById("settings-btn");
const btnDark      = document.getElementById("btn-dark");
const btnLight     = document.getElementById("btn-light");

settingsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  themePanel.classList.toggle("open");
});

document.addEventListener("click", () => {
  themePanel.classList.remove("open");
});

function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.add("light");
    btnLight.classList.add("active");
    btnDark.classList.remove("active");
  } else {
    document.body.classList.remove("light");
    btnDark.classList.add("active");
    btnLight.classList.remove("active");
  }

  navigate(activeSection);
  localStorage.setItem("ceo-theme", theme);
}

btnDark.addEventListener("click",  () => applyTheme("dark"));
btnLight.addEventListener("click", () => applyTheme("light"));

// restore saved theme
const savedTheme = localStorage.getItem("ceo-theme");
if (savedTheme === "light") applyTheme("light");
