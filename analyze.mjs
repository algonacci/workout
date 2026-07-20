import { readFileSync, writeFileSync } from "fs";

const raw = readFileSync("data.js", "utf-8");
const activities = JSON.parse(
  raw.replace("const ACTIVITIES = ", "").replace(/;\nconst UPDATED_AT.*/s, "")
);
const timestamp = new Date().toISOString();

const typeNames = { WeightTraining: "Strength", Workout: "Workout" };

function generateAnalysis(activities) {
  const byType = {}, byDate = {}, byWeek = {};
  const allSorted = [...activities].sort((a, b) => new Date(a.start_date_local) - new Date(b.start_date_local));

  for (const a of activities) {
    const t = a.sport_type || a.type;
    if (!byType[t]) byType[t] = [];
    byType[t].push(a);

    const d = new Date(a.start_date_local);
    const y = d.getFullYear(), m = d.getMonth();
    const key = `${y}-${m}`;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(a);

    const startOfYear = new Date(y, 0, 1);
    const weekNum = Math.floor((d - startOfYear) / (7 * 86400000));
    const wk = `${y}-w${weekNum}`;
    if (!byWeek[wk]) byWeek[wk] = [];
    byWeek[wk].push(a);
  }

  for (const [type, list] of Object.entries(byType)) {
    list.sort((a, b) => new Date(a.start_date_local) - new Date(b.start_date_local));

    const isTimed = ["Run", "Walk", "Ride", "Swim", "Hike"].includes(type);

    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const displayType = typeNames[type] || type;
      const prev = i > 0 ? list[i - 1] : null;
      const next = i < list.length - 1 ? list[i + 1] : null;
      const date = new Date(a.start_date_local);
      const dateStr = date.toLocaleDateString("en-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const parts = [];

      const distKm = a.distance > 0 ? (a.distance / 1000).toFixed(2) : null;
      const movingMin = Math.floor((a.moving_time || 0) / 60);
      const paceMinKm = isTimed && a.distance > 0 && a.moving_time > 0
        ? `${Math.floor((a.moving_time / a.distance * 1000) / 60)}:${String(Math.floor((a.moving_time / a.distance * 1000) % 60)).padStart(2, "0")}/km` : null;

      const device = a.device_name || "unknown device";
      const source = a.manual ? "manually logged" : a.trainer ? "trainer session" : `tracked via ${device}`;
      const timeOfDay = date.getHours() < 10 ? "morning" : date.getHours() < 14 ? "midday" : date.getHours() < 18 ? "afternoon" : "evening";

      const metrics = [];
      if (distKm) metrics.push(`${distKm}km in ${movingMin}min`);
      if (paceMinKm) metrics.push(`pace ${paceMinKm}`);
      if (a.average_heartrate) metrics.push(`avg HR ${Math.round(a.average_heartrate)}bpm`);
      if (a.max_heartrate) metrics.push(`max HR ${Math.round(a.max_heartrate)}bpm`);
      if (a.total_elevation_gain > 0) metrics.push(`${Math.round(a.total_elevation_gain)}m elev`);
      if (a.average_speed > 0 && !isTimed) metrics.push(`${a.average_speed.toFixed(1)} km/h`);
      if (a.suffer_score > 0) metrics.push(`suffer score ${Math.round(a.suffer_score)}`);

      parts.push(`[SESSION] On ${dateStr} (${timeOfDay}), you did "${a.name}", ${source}. ${metrics.join(" · ")}.`);

      if (a.calories > 0) parts.push(`You burned approximately ${Math.round(a.calories)} calories.`);
      if (a.kudos_count > 0) parts.push(`${a.kudos_count} kudos were given by fellow athletes.`);
      if (a.description) parts.push(`Your notes: "${a.description}"`);

      if (prev) {
        const daysSince = Math.round((date - new Date(prev.start_date_local)) / 86400000);
        const prevDate = new Date(prev.start_date_local).toLocaleDateString("en-ID", { day: "numeric", month: "long" });
        parts.push(`[VS PREVIOUS] Last ${displayType} was ${daysSince} day${daysSince > 1 ? "s" : ""} ago (${prevDate}, "${prev.name}").`);

        if (distKm && prev.distance > 0 && isTimed) {
          const distDiff = a.distance - prev.distance;
          const distPct = Math.abs((distDiff / prev.distance) * 100);
          const distDir = distDiff > 0 ? "longer" : "shorter";

          const pace = a.moving_time / a.distance;
          const prevPace = prev.moving_time / prev.distance;
          const paceDiff = ((prevPace - pace) / prevPace) * 100;

          if (Math.abs(distDiff) > 50) {
            parts.push(`Distance: ${distPct.toFixed(0)}% ${distDir} (${(Math.abs(distDiff) / 1000).toFixed(1)}km difference).`);
          } else {
            parts.push(`Distance was similar to last time (${distPct.toFixed(0)}% difference).`);
          }

          if (Math.abs(paceDiff) > 0.5) {
            const dir = pace < prevPace ? "improved" : "slowed";
            parts.push(`Pace ${dir} by ${Math.abs(paceDiff).toFixed(0)}% — ${pace < prevPace ? "solid progress" : "possibly indicating fatigue or different terrain"}.`);
          } else {
            parts.push(`Pace was nearly identical to last session, showing good consistency.`);
          }
        }

        if (a.average_heartrate && prev.average_heartrate) {
          const hrDiff = Math.round(a.average_heartrate - prev.average_heartrate);
          if (Math.abs(hrDiff) >= 1) {
            const dir = hrDiff > 0 ? "higher" : "lower";
            parts.push(`HR: ${Math.abs(hrDiff)}bpm ${dir} — ${hrDiff > 0 ? "suggesting increased exertion" : "suggesting improved efficiency or lower effort"}.`);
          }
        }

        if (a.total_elevation_gain > 0 || prev.total_elevation_gain > 0) {
          const elevDiff = Math.round((a.total_elevation_gain || 0) - (prev.total_elevation_gain || 0));
          if (Math.abs(elevDiff) >= 3) {
            parts.push(`Elevation: ${Math.abs(elevDiff)}m ${elevDiff > 0 ? "more climbing" : "less climbing"} than last time.`);
          }
        }

        if (a.suffer_score > 0 && prev.suffer_score > 0) {
          const sDiff = Math.round(a.suffer_score - prev.suffer_score);
          if (Math.abs(sDiff) >= 5) {
            parts.push(`Suffer score ${sDiff > 0 ? "jumped" : "dropped"} by ${Math.abs(sDiff)} points vs previous.`);
          }
        }

        const allActsBetween = allSorted.filter(x => {
          const xd = new Date(x.start_date_local);
          return xd > new Date(prev.start_date_local) && xd < new Date(a.start_date_local);
        });
        if (allActsBetween.length > 0) {
          const types = [...new Set(allActsBetween.map(x => x.sport_type || x.type))];
          parts.push(`Between these two ${displayType} sessions, you also did ${allActsBetween.length} other workout${allActsBetween.length > 1 ? "s" : ""} (${types.join(", ")}), which may have affected your ${displayType} performance.`);
        }
      } else {
        parts.push(`This was your first recorded ${displayType} session — establishing a baseline for future comparison.`);
      }

      const window30 = list.filter(x => {
        const dd = new Date(a.start_date_local) - new Date(x.start_date_local);
        return dd > 0 && dd < 30 * 86400000;
      });

      if (window30.length >= 1 && isTimed && distKm && a.moving_time > 0) {
        const currPace = a.moving_time / a.distance;
        const allPaces = [...window30].filter(x => x.distance && x.moving_time).map(x => x.moving_time / x.distance);
        allPaces.push(currPace);

        const best = Math.min(...allPaces);
        const worst = Math.max(...allPaces);
        const avg = allPaces.reduce((s, p) => s + p, 0) / allPaces.length;
        const distances = [...window30.map(x => x.distance || 0), a.distance || 0];
        const longest = Math.max(...distances);

        const trendDir = currPace < avg ? "faster" : "slower";
        const trendPct = Math.abs(((avg - currPace) / avg) * 100).toFixed(0);

        if (currPace <= best * 1.002) {
          parts.push(`[30-DAY] This was your FASTEST pace in the last 30 days — across ${allPaces.length} ${displayType} sessions.`);
        } else if (Math.abs(trendPct) > 1) {
          parts.push(`[30-DAY] Your pace was ${trendPct}% ${trendDir} than your 30-day average (${allPaces.length} sessions). Best pace: ${Math.floor((best * 1000) / 60)}:${String(Math.floor((best * 1000) % 60)).padStart(2, "0")}/km, worst: ${Math.floor((worst * 1000) / 60)}:${String(Math.floor((worst * 1000) % 60)).padStart(2, "0")}/km.`);
        }

        if (a.distance >= longest * 0.99) {
          parts.push(`At ${distKm}km, this was ${a.distance === longest ? "your LONGEST" : "nearly your longest"} ${displayType} of the month.`);
        }

        const total30Dist = [...window30.map(x => x.distance || 0), a.distance || 0].reduce((s, v) => s + v, 0);
        const total30Time = [...window30.map(x => x.moving_time || 0), a.moving_time || 0].reduce((s, v) => s + v, 0);
        parts.push(`Total ${displayType} volume this month: ${(total30Dist / 1000).toFixed(1)}km across ${window30.length + 1} sessions, ${Math.floor(total30Time / 60)}min total.`);
      }

      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const monthActs = byDate[monthKey] || [];
      const allMonthCount = monthActs.length;
      const allMonthDist = monthActs.reduce((s, x) => s + (x.distance || 0), 0);
      const allMonthTime = monthActs.reduce((s, x) => s + (x.moving_time || 0), 0);
      const sportBreakdown = {};
      for (const x of monthActs) { const t = x.sport_type || x.type; sportBreakdown[t] = (sportBreakdown[t] || 0) + 1; }
      const breakdown = Object.entries(sportBreakdown).map(([k, v]) => `${v}x ${k}`).join(", ");

      parts.push(`[MONTHLY] So far ${date.toLocaleDateString("en-ID", { month: "long" })}, you've logged ${allMonthCount} total workouts (${breakdown}), ${(allMonthDist / 1000).toFixed(1)}km, ${Math.floor(allMonthTime / 3600)}h ${Math.floor((allMonthTime % 3600) / 60)}m of training.`);

      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const weekNum = Math.floor((date - startOfYear) / (7 * 86400000));
      const wkKey = `${date.getFullYear()}-w${weekNum}`;
      const weekActs = byWeek[wkKey] || [];
      if (weekActs.length > 1) {
        const weekDist = weekActs.reduce((s, x) => s + (x.distance || 0), 0);
        const weekTime = weekActs.reduce((s, x) => s + (x.moving_time || 0), 0);
        parts.push(`[WEEKLY] This week: ${weekActs.length} workouts, ${(weekDist / 1000).toFixed(1)}km, ${Math.floor(weekTime / 60)}min.`);
      }

      if (a.pr_count > 0) parts.push(`You hit ${a.pr_count} personal record${a.pr_count > 1 ? "s" : ""}!`);
      if (a.achievement_count > 0) parts.push(`🏆 ${a.achievement_count} achievement${a.achievement_count > 1 ? "s" : ""} earned.`);
      if (a.max_speed > 0 && isTimed) parts.push(`Top speed reached: ${a.max_speed.toFixed(1)} km/h.`);
      if (a.total_photo_count > 0) parts.push(`You captured ${a.total_photo_count} photo${a.total_photo_count > 1 ? "s" : ""} during this activity.`);

      if (next) {
        const daysToNext = Math.round((new Date(next.start_date_local) - date) / 86400000);
        const nextName = next.name;
        if (daysToNext <= 1) {
          parts.push(`[NEXT] The very next day you were back with "${nextName}" — impressive consistency!`);
        } else if (daysToNext <= 7) {
          parts.push(`[NEXT] ${daysToNext} days later, you followed up with "${nextName}".`);
        }
      }

      const cards = [];
      let currentSection = null;
      let currentContent = [];

      for (const p of parts) {
        const match = p.match(/^\[(\w[\w\s-]*)\]\s*(.*)/);
        if (match) {
          if (currentSection) {
            cards.push({ section: currentSection, content: currentContent.join("<br>") });
            currentContent = [];
          }
          currentSection = match[1];
          currentContent.push(match[2]);
        } else if (currentSection) {
          currentContent.push(p);
        } else {
          cards.push({ section: "", content: p });
        }
      }
      if (currentSection) {
        cards.push({ section: currentSection, content: currentContent.join("<br>") });
      }

      a.analysis = cards;
    }
  }

  for (const a of activities) delete a.prev_activity_id;
}

generateAnalysis(activities);
writeFileSync("data.js", `const ACTIVITIES = ${JSON.stringify(activities)};\nconst UPDATED_AT = "${timestamp}";\n`);
console.log(`Analysis regenerated for ${activities.length} activities → data.js`);
console.log(`Generated at: ${timestamp}`);
