import { readFileSync, writeFileSync } from "fs";

const raw = readFileSync("data.js", "utf-8");
const activities = JSON.parse(
  raw.replace("const ACTIVITIES = ", "").replace(/;\nconst UPDATED_AT.*/s, "")
);
const timestamp = new Date().toISOString();

const typeNames = { WeightTraining: "Strength", Workout: "Workout" };
const TIMED = ["Run", "Walk", "Ride", "Swim", "Hike"];

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function paceStr(secPerKm) {
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, "0")}/km`;
}

function pick(options, seed) {
  return options[seed % options.length];
}

function dayKey(iso) {
  return iso.slice(0, 10);
}

function generateAnalysis(activities) {
  const byType = {};
  for (const a of activities) {
    const t = a.sport_type || a.type;
    (byType[t] ||= []).push(a);
  }

  const byDay = {};
  for (const a of activities) {
    (byDay[dayKey(a.start_date_local)] ||= []).push(a);
  }

  const stats = {};
  for (const [type, list] of Object.entries(byType)) {
    const timed = TIMED.includes(type);
    const paces = timed
      ? list.filter(x => x.distance > 500 && x.moving_time > 0).map(x => x.moving_time / (x.distance / 1000))
      : [];
    stats[type] = {
      pace: median(paces),
      dist: median(list.filter(x => x.distance > 0).map(x => x.distance)),
      dur: median(list.map(x => x.moving_time || 0)),
      hr: median(list.filter(x => x.average_heartrate > 0).map(x => x.average_heartrate)),
      suffer: median(list.filter(x => x.suffer_score > 0).map(x => x.suffer_score)),
      maxDist: Math.max(0, ...list.map(x => x.distance || 0)),
      durMin: Math.min(...list.map(x => x.moving_time || 0)),
      durMax: Math.max(0, ...list.map(x => x.moving_time || 0)),
    };
  }

  for (const [type, list] of Object.entries(byType)) {
    list.sort((a, b) => new Date(a.start_date_local) - new Date(b.start_date_local));

    const timed = TIMED.includes(type);
    const label = (typeNames[type] || type).toLowerCase();
    const st = stats[type];

    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      const date = new Date(a.start_date_local);
      const seed = i;

      const distKm = a.distance > 0 ? (a.distance / 1000).toFixed(2) : null;
      const movingMin = Math.round((a.moving_time || 0) / 60);
      const pace = timed && a.distance > 500 && a.moving_time > 0
        ? a.moving_time / (a.distance / 1000)
        : null;

      const rate = pace
        ? (type === "Ride" ? `${(3600 / pace).toFixed(1)} km/h` : paceStr(pace))
        : null;

      const priorPaces = list
        .slice(Math.max(0, i - 10), i)
        .filter(x => x.distance > 500 && x.moving_time > 0)
        .map(x => x.moving_time / (x.distance / 1000));
      const basePace = priorPaces.length >= 3 ? median(priorPaces) : null;

      let opener;
      let isCourt = false;

      if (pace && basePace) {
        const paceDelta = ((basePace - pace) / basePace) * 100;
        const isLongest = a.distance >= st.maxDist * 0.995;
        const distDelta = st.dist ? Math.abs(a.distance - st.dist) / st.dist : 0;

        if (isLongest && list.length > 4) {
          opener = `Your longest ${label} on record — ${distKm}km at ${rate}.`;
        } else if (paceDelta >= 5) {
          opener = pick([
            `${distKm}km at ${rate}, about ${Math.round(paceDelta)}% quicker than your recent ${label} sessions.`,
            `Sharp one: ${distKm}km at ${rate}, ${Math.round(paceDelta)}% up on your recent ${label} form.`,
          ], seed);
        } else if (paceDelta <= -7) {
          const why = distDelta > 0.4 && a.distance > st.dist
            ? "which is what a longer effort should look like"
            : "an easy-effort day rather than a hard one";
          opener = `${distKm}km at ${rate}, ${Math.round(-paceDelta)}% down on recent form — ${why}.`;
        } else {
          opener = pick([
            `Routine ${distKm}km at ${rate}, right in your normal ${label} groove.`,
            `Standard ${distKm}km outing at ${rate} — the pace you hold when nothing special is happening.`,
            `Another ${distKm}km at ${rate}, consistent with where your ${label} pace has been sitting.`,
          ], seed);
        }
      } else if (pace) {
        opener = pick([
          `${distKm}km at ${rate}, early in the log with little to compare against yet.`,
          `${distKm}km at ${rate} — one of the first ${label} sessions on record.`,
        ], seed);
      } else if (timed && distKm) {
        opener = `${distKm}km over ${movingMin} minutes.`;
      } else if (a.distance > 0 && a.distance < 3000 && a.elapsed_time > a.moving_time * 3) {
        isCourt = true;
        opener = `${Math.round((a.elapsed_time || 0) / 60)} minutes on court — the distance figure is GPS noise, court sports don't track meaningfully.`;
      } else {
        opener = pick([
          `${movingMin} minutes of ${label}.`,
          `A ${movingMin}-minute ${label} block.`,
        ], seed);
      }

      const notes = [];

      const sameDay = (byDay[dayKey(a.start_date_local)] || []).filter(x => x.id !== a.id);
      if (sameDay.length) {
        const name = x => (typeNames[x.sport_type || x.type] || x.sport_type || x.type).toLowerCase();
        const before = [...new Set(sameDay.filter(x => new Date(x.start_date_local) < date).map(name))];
        const after = [...new Set(sameDay.filter(x => new Date(x.start_date_local) > date).map(name))];
        if (before.length) {
          const hard = sameDay.some(x => new Date(x.start_date_local) < date && ((x.moving_time || 0) >= 1500 || (x.distance || 0) >= 3000));
          notes.push(hard
            ? `You'd already done a ${before.join(" and ")} session earlier that day, so this went out on tired legs.`
            : `It followed a short ${before.join(" and ")} earlier that day.`);
        } else if (after.length) {
          notes.push(`This was the opening leg — a ${after.join(" and ")} session followed later the same day.`);
        }
      }

      if (!pace && !isCourt && st.dur && a.moving_time > 0 && list.length > 2) {
        const durDelta = (a.moving_time - st.dur) / st.dur;
        if (durDelta >= 0.2) {
          notes.push(`That is ${Math.round(durDelta * 100)}% longer than your typical ${label} session — a heavier block than usual.`);
        } else if (durDelta <= -0.2) {
          notes.push(`${Math.round(-durDelta * 100)}% shorter than your typical ${label} session, so likely a trimmed or interrupted one.`);
        } else {
          notes.push(pick([
            `Your ${label} sessions run ${Math.round(st.durMin / 60)}–${Math.round(st.durMax / 60)} minutes; this one sits mid-pack.`,
            `Ordinary volume for you — neither your longest nor your shortest ${label} block.`,
            `Duration is unremarkable against the ${Math.round(st.durMin / 60)}–${Math.round(st.durMax / 60)} minute spread of your ${label} work.`,
          ], seed));
        }
      }

      if (a.achievement_count >= 8 || a.pr_count >= 3) {
        const ach = `${a.achievement_count} achievement${a.achievement_count === 1 ? "" : "s"}`;
        const pr = `${a.pr_count} PR${a.pr_count === 1 ? "" : "s"}`;
        notes.push(`${ach} and ${pr} — this route is dense with segments you hadn't covered before.`);
      }

      if (a.average_heartrate > 0 && st.hr) {
        const hrDelta = Math.round(a.average_heartrate - st.hr);
        if (hrDelta >= 8) {
          notes.push(`Heart rate averaged ${hrDelta}bpm above your ${label} norm, so the effort cost more than the pace suggests.`);
        } else if (hrDelta <= -8) {
          notes.push(`Heart rate sat ${-hrDelta}bpm below your ${label} norm at this pace — a sign of efficiency, or simply a relaxed day.`);
        }
      }

      if (a.suffer_score > 0 && st.suffer && st.suffer > 0) {
        const ratio = a.suffer_score / st.suffer;
        if (ratio >= 1.5) notes.push(`Suffer score ${Math.round(a.suffer_score)} is well past your typical ${Math.round(st.suffer)} for this — one of the harder sessions in the set.`);
        else if (ratio <= 0.55) notes.push(`Suffer score ${Math.round(a.suffer_score)} against a typical ${Math.round(st.suffer)} puts this firmly in recovery territory.`);
      }

      if (a.total_elevation_gain >= 40) {
        notes.push(`${Math.round(a.total_elevation_gain)}m of climbing is real terrain, not a flat loop.`);
      }

      if (prev) {
        const gap = Math.round((date - new Date(prev.start_date_local)) / 86400000);
        if (gap >= 14) notes.push(`First ${label} in ${gap} days.`);
        else if (gap === 0) notes.push(`Second ${label} of the same day.`);
      } else if (list.length > 3) {
        notes.push(`The first ${label} in this log — the baseline everything after is measured against.`);
      }

      const stopped = (a.elapsed_time || 0) - (a.moving_time || 0);
      if (!isCourt && stopped >= 600 && a.moving_time > 0 && stopped / a.moving_time >= 0.25) {
        notes.push(`${Math.round(stopped / 60)} minutes of it was spent stopped, so treat the clock time as loose.`);
      }

      const content = [opener, ...notes.slice(0, 3)].join(" ");
      a.analysis = [{ section: "", content }];
    }
  }

  for (const a of activities) delete a.prev_activity_id;
}

generateAnalysis(activities);
writeFileSync("data.js", `const ACTIVITIES = ${JSON.stringify(activities)};\nconst UPDATED_AT = "${timestamp}";\n`);
console.log(`Analysis regenerated for ${activities.length} activities → data.js`);
console.log(`Generated at: ${timestamp}`);
