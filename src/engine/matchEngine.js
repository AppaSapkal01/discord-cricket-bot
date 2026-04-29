function random(min, max) {
  return Math.random() * (max - min) + min;
}

function ballOutcome(batsman, bowler) {
  let batSkill =
    (batsman.bat || 0) +
    (batsman.form || 0) +
    (batsman.power || 0) +
    (batsman.technique || 0);

  let bowlSkill =
    (bowler.bowl || 0) +
    (bowler.form || 0) +
    (bowler.pace || 0) +
    (bowler.spin || 0);

  let score = batSkill - bowlSkill + random(-20, 20);

  let wicketChance = 6 + (bowler.bowl / 15);

  if (Math.random() * 100 < wicketChance) {
    return { type: "W" };
  }

  if (score > 100) return { type: "RUN", runs: 6 };
  if (score > 80) return { type: "RUN", runs: 4 };
  if (score > 60) return { type: "RUN", runs: 3 };
  if (score > 40) return { type: "RUN", runs: 2 };
  if (score > 20) return { type: "RUN", runs: 1 };

  return { type: "RUN", runs: 0 };
}

function simulateInnings(team, playersMap, target = null) {
  let runs = 0;
  let wickets = 0;

  let strikerIndex = 0;
  let nonStrikerIndex = 1;
  let nextBatsmanIndex = 2;

  let commentary = [];

  for (let over = 0; over < 20; over++) { // ✅ FIXED (0–19)

    let bowlerName = team[Math.floor(Math.random() * team.length)];
    let bowler = playersMap.get(bowlerName.toLowerCase());

    for (let ball = 1; ball <= 6; ball++) {

      // ✅ STOP CONDITIONS
      if (wickets >= 10) break;
      if (target && runs >= target) break;

      let strikerName = team[strikerIndex];
      let batsman = playersMap.get(strikerName.toLowerCase());

      const result = ballOutcome(batsman, bowler);

      if (result.type === "W") {
        wickets++;

        commentary.push(
          `Over ${over}.${ball} 🟥 ${batsman.name} OUT! (bowled by ${bowler.name})`
        );

        // NEW BATSMAN COMES
        strikerIndex = nextBatsmanIndex;
        nextBatsmanIndex++;

      } else {
        runs += result.runs;

        commentary.push(
          `Over ${over}.${ball} 🏏 ${batsman.name} vs ${bowler.name} → ${result.runs}`
        );

        // STRIKE ROTATION
        if (result.runs % 2 === 1) {
          [strikerIndex, nonStrikerIndex] = [nonStrikerIndex, strikerIndex];
        }
      }
    }

    // ✅ OVER END → STRIKE CHANGE
    [strikerIndex, nonStrikerIndex] = [nonStrikerIndex, strikerIndex];

    if (wickets >= 10) break;
    if (target && runs >= target) break;
  }

  return { runs, wickets, commentary };
}

module.exports = { simulateInnings };