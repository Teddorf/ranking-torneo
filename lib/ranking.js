export function buildScoreMap(scores) {
  const m = {};
  scores.forEach((s) => {
    m[`${s.player_id}_${s.date_id}`] = s;
  });
  return m;
}

export function computeRanking(players, dates, scoreMap) {
  return players
    .map((p) => {
      let total = 0;
      let played = 0;
      let byes = 0;
      dates.forEach((d) => {
        const s = scoreMap[`${p.id}_${d.id}`];
        if (!s) return;
        if (s.type === "points") {
          total += Number(s.value) || 0;
          played += 1;
        } else if (s.type === "bye") {
          byes += 1;
        }
      });
      return { ...p, total, played, byes, avg: played ? total / played : 0 };
    })
    .sort((a, b) => b.total - a.total || b.avg - a.avg);
}

export function sortRows(rows, column, direction, scoreMap) {
  if (!column) return rows;
  return [...rows].sort((a, b) => {
    if (column === "name") {
      return direction === "asc"
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }

    let valA, valB;

    if (column === "total" || column === "played" || column === "byes" || column === "avg") {
      valA = a[column] ?? 0;
      valB = b[column] ?? 0;
    } else if (column.startsWith("date:")) {
      const dateId = column.slice(5);
      const sA = scoreMap[`${a.id}_${dateId}`];
      const sB = scoreMap[`${b.id}_${dateId}`];
      valA = sA?.type === "points" ? Number(sA.value) : sA?.type === "bye" ? -1 : -2;
      valB = sB?.type === "points" ? Number(sB.value) : sB?.type === "bye" ? -1 : -2;
    } else {
      return 0;
    }

    return direction === "asc" ? valA - valB : valB - valA;
  });
}
