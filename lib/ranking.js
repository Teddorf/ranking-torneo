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
