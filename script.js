const typeIcons = {
  Run: "🏃", Ride: "🚴", Swim: "🏊", Walk: "🚶",
  Padel: "🎾", WeightTraining: "🏋️", Workout: "🏋️"
};

const typeNames = {
  WeightTraining: "Strength", Workout: "Workout"
};

function formatDistance(meters) {
  if (!meters) return "-";
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}

function formatTime(seconds) {
  if (!seconds) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-ID", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });
}

function formatPace(meters, seconds) {
  if (!meters || !seconds || meters < 100) return "-";
  const pace = (seconds / 60) / (meters / 1000);
  const paceMin = Math.floor(pace);
  const paceSec = Math.floor((pace - paceMin) * 60);
  return `${paceMin}:${String(paceSec).padStart(2, "0")} /km`;
}

function formatSpeed(meters, seconds) {
  if (!meters || !seconds) return "-";
  return `${((meters / 1000) / (seconds / 3600)).toFixed(1)} km/h`;
}

function renderStats(activities, filtered) {
  const total = filtered.length;
  const totalDist = filtered.reduce((s, a) => s + (a.distance || 0), 0);
  const totalTime = filtered.reduce((s, a) => s + (a.moving_time || 0), 0);
  const totalH = Math.floor(totalTime / 3600);
  const totalM = Math.floor((totalTime % 3600) / 60);

  const colors = { Run: "#ff6b6b", Ride: "#4ea8de", Swim: "#48bfe3", Walk: "#ffb347", Padel: "#c084fc", WeightTraining: "#fb923c", other: "#6b7280" };

  let bars = "";
  const mainTypes = ["Run", "Ride", "Swim", "Walk", "Padel", "WeightTraining"];
  for (const type of mainTypes) {
    const count = activities.filter(a => a.sport_type === type || (type === "WeightTraining" && a.type === "WeightTraining")).length;
    if (count > 0) {
      bars += `<div class="stat-bar"><div class="stat-fill" style="width:${Math.max((count / total) * 100, 2)}%;background:${colors[type]}"></div><span>${typeIcons[type] || ""} ${typeNames[type] || type} <strong>${count}</strong></span></div>`;
    }
  }
  const otherCount = activities.filter(a => !["Run","Ride","Swim","Walk","Padel","WeightTraining"].includes(a.sport_type) && a.type !== "WeightTraining").length;
  if (otherCount > 0) {
    bars += `<div class="stat-bar"><div class="stat-fill" style="width:${Math.max((otherCount / total) * 100, 2)}%;background:#6b7280"></div><span>Other <strong>${otherCount}</strong></span></div>`;
  }

  return `
    <div class="stat-card"><span class="stat-num">${total}</span><span class="stat-label">workouts</span></div>
    <div class="stat-card"><span class="stat-num">${(totalDist / 1000).toFixed(1)}</span><span class="stat-label">km</span></div>
    <div class="stat-card"><span class="stat-num">${totalH}h ${totalM}m</span><span class="stat-label">moving time</span></div>
    <div class="stat-breakdown">${bars}</div>
  `;
}

function renderActivity(a) {
  const icon = typeIcons[a.sport_type] || typeIcons[a.type] || "🏋️";
  const isTimed = ["Run", "Ride", "Walk", "Swim", "Hike"].includes(a.sport_type);
  const detail = isTimed
    ? `${formatDistance(a.distance)} · ${formatTime(a.moving_time)} · ${formatPace(a.distance, a.moving_time)} · ${formatSpeed(a.distance, a.moving_time)}`
    : a.distance > 0
      ? `${formatDistance(a.distance)} · ${formatTime(a.moving_time)}`
      : formatTime(a.moving_time);

  const analysis = a.analysis && a.analysis.length
    ? `<div class="act-analysis">
        <div class="analysis-title">AI Analysis</div>
        ${a.analysis.map(item => `
          <div class="analysis-card">
            ${item.section ? `<div class="card-section">${item.section}</div>` : ""}
            <div class="card-content">${item.content}</div>
          </div>
        `).join("")}
      </div>`
    : "";

  const hr = a.has_heartrate && a.average_heartrate
    ? `<span class="hr">❤️ ${Math.round(a.average_heartrate)} bpm</span>` : "";

  const elev = a.total_elevation_gain > 0
    ? `<span class="elev">⛰️ ${Math.round(a.total_elevation_gain)}m</span>` : "";

  const device = a.device_name
    ? `<span class="device">📱 ${a.device_name}</span>` : "";

  const manual = a.manual ? `<span class="tag">manual</span>` : "";
  const trainer = a.trainer ? `<span class="tag">trainer</span>` : "";

  const extra = [];
  if (a.max_speed > 0) extra.push(`<span class="ei speed">⚡ Max Speed: ${a.max_speed.toFixed(1)} km/h</span>`);
  if (a.max_heartrate) extra.push(`<span class="ei hr">❤️ Max HR: ${Math.round(a.max_heartrate)} bpm</span>`);
  if (a.suffer_score > 0) extra.push(`<span class="ei suffer">🔥 Suffer Score: ${Math.round(a.suffer_score)}</span>`);
  if (a.elev_high > 0) extra.push(`<span class="ei elev">⛰️ Max Elev: ${Math.round(a.elev_high)}m</span>`);
  if (a.elev_low < 0) extra.push(`<span class="ei elev">📉 Min Elev: ${Math.round(a.elev_low)}m</span>`);
  if (a.average_cadence) extra.push(`<span class="ei cadence">🔄 Cadence: ${Math.round(a.average_cadence * 2)} spm</span>`);
  if (a.average_watts) extra.push(`<span class="ei power">💪 Power: ${Math.round(a.average_watts)}W</span>`);
  if (a.kudos_count > 0) extra.push(`<span class="ei kudos">👍 Kudos: ${a.kudos_count}</span>`);
  if (a.achievement_count > 0) extra.push(`<span class="ei achieve">🏆 Achievements: ${a.achievement_count}</span>`);
  if (a.pr_count > 0) extra.push(`<span class="ei pr">🎯 PRs: ${a.pr_count}</span>`);
  if (a.calories > 0) extra.push(`<span class="ei cal">🔋 Calories: ${Math.round(a.calories)}</span>`);
  if (a.elapsed_time && a.elapsed_time > a.moving_time) {
    extra.push(`<span class="ei elapsed">⏱️ Elapsed: ${formatTime(a.elapsed_time)}</span>`);
  }

  const photos = a.photos && a.photos.length
    ? `<div class="act-photos" data-photos='${JSON.stringify(a.photos)}'></div>`
    : "";

  return `
    <div class="activity" data-type="${a.sport_type || a.type}" data-date="${a.start_date_local}" data-id="${a.id}">
      <div class="act-main">
        <div class="act-icon">${icon}</div>
        <div class="act-info">
          <div class="act-name">${a.name} ${manual} ${trainer}</div>
          <div class="act-detail">${detail} ${hr} ${elev}</div>
          <div class="act-meta">${device}</div>
        </div>
        <div class="act-right">
          <div class="act-date">${formatDate(a.start_date_local)}</div>
          <div class="act-expand">▼</div>
        </div>
      </div>
      <div class="act-extra" style="display:none">
        ${extra.map(e => `<span class="extra-item">${e}</span>`).join("")}
        ${!extra.length ? '<span class="extra-item extra-empty">No additional data</span>' : ""}
        ${analysis}
        ${photos}
      </div>
    </div>
  `;
}

function filterActivities(activities, type, year, month) {
  const mainTypes = ["Run", "Ride", "Swim", "Walk", "Padel", "WeightTraining"];
  return activities.filter(a => {
    const d = new Date(a.start_date_local);
    const matchYear = !year || d.getFullYear() === year;
    const matchMonth = !month || d.getMonth() + 1 === month;
    if (!matchYear || !matchMonth) return false;

    if (!type || type === "all") return true;
    if (type === "other") return !mainTypes.includes(a.sport_type) && a.type !== "WeightTraining";
    if (type === "WeightTraining") return a.sport_type === "WeightTraining" || a.type === "WeightTraining";
    return a.sport_type === type;
  });
}

let ACTIVITY_DATES = [];

function buildTimeOptions(activities) {
  ACTIVITY_DATES = activities.map(a => new Date(a.start_date_local));
  const years = [...new Set(ACTIVITY_DATES.map(d => d.getFullYear()))].sort((a, b) => b - a);

  const yearSelect = document.getElementById("year-select");
  yearSelect.innerHTML = '<option value="">All Years</option>';
  for (const y of years) yearSelect.innerHTML += `<option value="${y}">${y}</option>`;

  updateMonthOptions();
}

function updateMonthOptions() {
  const year = parseInt(document.getElementById("year-select").value) || null;
  const monthSelect = document.getElementById("month-select");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentVal = monthSelect.value;

  monthSelect.innerHTML = '<option value="">All Months</option>';
  for (let m = 0; m < 12; m++) {
    if (!year || ACTIVITY_DATES.some(d => d.getFullYear() === year && d.getMonth() === m)) {
      monthSelect.innerHTML += `<option value="${m + 1}">${months[m]}</option>`;
    }
  }
  monthSelect.value = [...monthSelect.options].some(o => o.value === currentVal) ? currentVal : "";
}

function onFilterChange(allActivities, allActEls) {
  const activeType = document.querySelector(".tab.active")?.dataset.tab || "all";
  const year = parseInt(document.getElementById("year-select").value) || null;
  const month = parseInt(document.getElementById("month-select").value) || null;

  const timeFiltered = allActivities.filter(a => {
    const d = new Date(a.start_date_local);
    const matchYear = !year || d.getFullYear() === year;
    const matchMonth = !month || d.getMonth() + 1 === month;
    return matchYear && matchMonth;
  });

  const mainTypes = ["Run", "Ride", "Swim", "Walk", "Padel", "WeightTraining"];
  const newCounts = {};
  newCounts.all = timeFiltered.length;
  for (const t of mainTypes) newCounts[t] = timeFiltered.filter(a => a.sport_type === t || (t === "WeightTraining" && a.type === t)).length;
  newCounts.other = timeFiltered.filter(a => !mainTypes.includes(a.sport_type) && a.type !== "WeightTraining").length;

  document.querySelectorAll(".tab .count").forEach(c => {
    const type = c.parentElement.dataset.tab;
    c.textContent = newCounts[type] || 0;
  });

  document.querySelectorAll(".tab").forEach(tab => {
    const type = tab.dataset.tab;
    if (type !== "all" && newCounts[type] === 0) {
      tab.classList.add("disabled");
      if (tab.classList.contains("active")) {
        tab.classList.remove("active");
        document.querySelector('.tab[data-tab="all"]').classList.add("active");
      }
    } else {
      tab.classList.remove("disabled");
    }
  });

  const filtered = filterActivities(allActivities, activeType, year, month);
  const visibleIds = new Set(filtered.map(a => String(a.id)));

  document.getElementById("stats").innerHTML = renderStats(timeFiltered, filtered);

  allActEls.forEach(el => {
    el.style.display = visibleIds.has(el.dataset.id) ? "" : "none";
  });
}

function init() {
  const activities = typeof ACTIVITIES !== "undefined" ? ACTIVITIES : [];
  const updatedAt = typeof UPDATED_AT !== "undefined" ? UPDATED_AT : null;

  document.getElementById("loading").style.display = "none";

  if (!activities.length) {
    document.getElementById("loading").innerHTML = "No data. Run: <code>node fetch.mjs</code>";
    document.getElementById("loading").style.display = "block";
    return;
  }

  document.getElementById("last-updated").textContent =
    `Last updated: ${new Date(updatedAt).toLocaleString("id-ID")} · ${activities.length} activities`;

  const mainTypes = ["Run", "Ride", "Swim", "Walk", "Padel", "WeightTraining"];
  const counts = {};
  counts.all = activities.length;
  for (const t of mainTypes) counts[t] = activities.filter(a => a.sport_type === t || (t === "WeightTraining" && a.type === t)).length;
  counts.other = activities.filter(a => !mainTypes.includes(a.sport_type) && a.type !== "WeightTraining").length;

  document.querySelectorAll(".tab").forEach(tab => {
    const type = tab.dataset.tab;
    tab.insertAdjacentHTML("beforeend", `<span class="count">${counts[type] || 0}</span>`);
  });

  buildTimeOptions(activities);

  const statsEl = document.getElementById("stats");
  const activitiesEl = document.getElementById("activities");

  statsEl.innerHTML = renderStats(activities, activities);
  activitiesEl.innerHTML = activities.map(renderActivity).join("");

  const allActEls = document.querySelectorAll(".activity");

  document.querySelectorAll(".act-main").forEach(main => {
    main.addEventListener("click", () => {
      const activity = main.closest(".activity");
      const extra = activity.querySelector(".act-extra");
      const expand = activity.querySelector(".act-expand");
      if (extra.style.display === "none") {
        extra.style.display = "flex";

        const photosEl = extra.querySelector(".act-photos");
        if (photosEl && !photosEl.hasChildNodes()) {
          const urls = JSON.parse(photosEl.dataset.photos);
          photosEl.innerHTML = urls.map(url => `<img src="${url}" loading="lazy" onclick="this.classList.toggle('zoomed')">`).join("");
        }

        expand.classList.add("open");
      } else {
        extra.style.display = "none";
        expand.classList.remove("open");
      }
    });
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      if (tab.classList.contains("disabled")) return;
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      onFilterChange(activities, allActEls);
    });
  });

  document.getElementById("year-select").addEventListener("change", () => {
    updateMonthOptions();
    onFilterChange(activities, allActEls);
  });
  document.getElementById("month-select").addEventListener("change", () => onFilterChange(activities, allActEls));
  document.getElementById("filter-clear").addEventListener("click", () => {
    document.getElementById("year-select").value = "";
    document.getElementById("month-select").value = "";
    updateMonthOptions();
    onFilterChange(activities, allActEls);
  });
}

init();
