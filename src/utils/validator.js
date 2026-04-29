function validateTeam(team, playersMap) {
  let overseas = 0;
  let hasWK = false;


  for (let name of team.players) {

    const player = playersMap.get(name.trim().toLowerCase());

    if (!player) {
      console.log(`❌ MISSING PLAYER: ${name}`);
      return { ok: false, reason: `${name} not in player DB` };
    }

    const country = (player.country || "").trim().toLowerCase();

    console.log(`➡️ ${player.name} | ${country} | ${player.role}`);

    if (player.role?.toLowerCase() === "wicketkeeper") {
      hasWK = true;
    }

    if (country !== "india") {
      overseas++;
      console.log(`🌍 Overseas +1 → ${player.name}`);
    }
  }

  console.log(`\n📊 TEAM SUMMARY: ${team.teamName}`);
  console.log(`🌍 Overseas Players: ${overseas}`);
  console.log(`🧤 Wicketkeeper: ${hasWK ? "YES" : "NO"}`);

  const valid = hasWK && overseas <= 4;

  console.log(`✅ VALID STATUS: ${valid}\n`);

  if (!hasWK) return { ok: false, reason: "No wicketkeeper" };
  if (overseas > 4) return { ok: false, reason: "More than 4 overseas players" };

  return { ok: true };
}

module.exports = { validateTeam };