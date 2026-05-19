const random = (min, max) => Math.random() * (max - min) + min;

function normalRandom(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();

  return (
    mean +
    std *
      Math.sqrt(-2 * Math.log(u)) *
      Math.cos(2 * Math.PI * v)
  );
}

// -------------------- INTENT --------------------
function decideIntent(
  batsman,
  context,
  isFreeHit = false
) {
  // Free hit = always attack
  if (isFreeHit) return "attack";

  let aggression = batsman.aggression || 50;

  // ---------------- Chase pressure ----------------
  if (context.requiredRate > 9) aggression += 8;
  if (context.requiredRate > 12) aggression += 6;
  if (context.requiredRate > 15) aggression += 8;

  // ---------------- Phase adjustments ----------------
  if (context.over >= 16) aggression += 15;
  if (context.over <= 6) aggression += 5;

  // ---------------- Wicket pressure ----------------
  if (context.wickets <= 3) aggression -= 10;

  // ---------------- Recent wicket stabilization ----------------
  if (context.recentWicket) {
    aggression -= 8;
  }

  // ---------------- Anchor behavior ----------------
  if (
    (batsman.role || "")
      .toLowerCase()
      .includes("anchor")
  ) {
    aggression -= 10;
  }

  // ---------------- Pressure resistance ----------------
  const pressureResistance =
    ((batsman.consistency || 50) +
      (batsman.technique || 50)) /
    2;

  aggression -=
    (pressureResistance - 50) * 0.12;

  // ---------------- Clamp ----------------
  aggression = Math.max(
    5,
    Math.min(95, aggression)
  );

  // ---------------- Final intent ----------------
  if (aggression > 72) return "attack";
  if (aggression > 42) return "balanced";

  return "defensive";
}

// -------------------- BATTING SKILL --------------------
function getBattingSkill(
  batsman,
  isPacer,
  stadium,
  context
) {
  let skill =
    (batsman.technique || 50) * 0.32 +
    (batsman.timing || 50) * 0.28 +
    (batsman.power || 50) * 0.20 +
    (batsman.consistency || 50) * 0.20;

  // Pace vs Spin
  if (isPacer) {
    skill *=
      (batsman.againstPace || 50) / 55;
  } else {
    skill *=
      (batsman.againstSpin || 50) / 55;
  }

  // Stadium batting factor
  skill *=
    1 +
    ((stadium.batting || 5) - 5) * 0.05;

  // Form
  skill *=
    (batsman.battingForm || 50) / 55;

  // ---------------- Set batter bonus ----------------
  const ballsFaced =
    batsman.ballsFaced || 0;

  const setBonus = Math.min(
    12,
    ballsFaced * 0.35
  );

  skill += setBonus;

  // ---------------- New batter nervousness ----------------
  if (ballsFaced <= 5) {
    skill *= 0.92;
  }

  // ---------------- Death overs finishing ----------------
  if (context.over >= 16) {
    skill *=
      (batsman.finishing || 50) / 55;
  }

  return skill;
}

// -------------------- BALL QUALITY --------------------
function getBallQuality(
  bowler,
  stadium,
  isPacer,
  context
) {
  let quality =
    (bowler.control || 50) * 0.35 +
    (bowler.movement || 50) * 0.25 +
    (isPacer
      ? (bowler.paceSkill || 50)
      : (bowler.spinSkill || 50)) *
      0.25 +
    (bowler.economy || 50) * 0.15;

  // Pitch assistance
  if (isPacer) {
    quality *=
      ((stadium.pace || 5) +
        (stadium.swing || 5)) /
      10;
  } else {
    quality *=
      (stadium.turn || 5) / 5;
  }

  // Death bowling skill
  if (context.over >= 16) {
    quality *=
      (bowler.deathBowling || 50) / 55;
  }

  // Dew impact
  if (context.dew) {
    quality *= 0.92;
  }

  // Bowling form
  quality *=
    (bowler.bowlingForm || 50) / 50;

  // Slight randomness
  return (
    quality * 0.9 +
    normalRandom(0, 2.5)
  );
}

// -------------------- EXTRAS --------------------
function getExtra(
  bowler,
  bowlerMomentum = 0
) {
  const controlRating =
    (bowler.control || 50) / 100;

  const momentumEffect =
    bowlerMomentum < 0
      ? Math.abs(bowlerMomentum) / 10
      : 0;

  const extraChance = Math.max(
    1.5,
    Math.min(
      8,
      6 -
        controlRating * 5 +
        momentumEffect
    )
  );

  if (
    Math.random() * 100 <
    extraChance
  ) {
    return Math.random() < 0.55
      ? {
          type: "noball",
          runs: 1
        }
      : {
          type: "wide",
          runs: 1
        };
  }

  return null;
}

// -------------------- SHOT RESOLUTION --------------------
function resolveShot(
  intent,
  battingSkill,
  ballQuality,
  isFreeHit
) {
  const diff =
    battingSkill - ballQuality;

  const normalized = Math.max(
    -20,
    Math.min(20, diff)
  );

  let score =
    normalized +
    normalRandom(0, 3);

  // Attack no longer punished too hard
  if (intent === "attack") {
    score -= 2;
  }

  // Defensive more stable
  if (intent === "defensive") {
    score += 3;
  }

  // Free hit boost
  if (isFreeHit) {
    score += 8;
  }

  return score;
}

// -------------------- WICKET CHANCE --------------------
function getWicketChance(
  intent,
  success,
  isSafe = false
) {
  if (isSafe) return 0;

  let chance = 2;

  if (intent === "attack") {
    chance += 2.5;
  }

  if (intent === "balanced") {
    chance += 1;
  }

  if (success < -10) {
    chance += 3;
  }

  if (success < -18) {
    chance += 4;
  }

  return Math.min(14, chance);
}

// -------------------- RUNS --------------------
function getRuns(
  success,
  batsman,
  stadium,
  bowler,
  isFreeHit = false
) {
  const power =
    (batsman.power || 50) / 100;

  const boundarySize =
    stadium.boundarySize || 5;

  let boundaryChance =
    (0.18 + power * 0.42) *
    (4.5 / boundarySize);

  // Free hit boost
  if (isFreeHit) {
    boundaryChance *= 1.45;
    success += 6;
  }

  // ---------------- Dot ball ----------------
  if (success < -12) {
    return 0;
  }

  // ---------------- Low confidence ----------------
  if (success < -2) {
    return Math.random() < 0.72
      ? 0
      : 1;
  }

  // ---------------- Rotation phase ----------------
  if (success < 10) {
    const r = Math.random();

    if (r < 0.58) return 1;
    if (r < 0.80) return 2;

    return 0;
  }

  // ---------------- Positive batting ----------------
  if (success < 25) {
    const r = Math.random();

    if (r < 0.45) return 1;
    if (r < 0.72) return 2;
    if (r < 0.86) return 3;

    return Math.random() <
      boundaryChance
      ? 4
      : 0;
  }

  // ---------------- Dominating shot ----------------
  const r = Math.random();

  if (r < boundaryChance) {
    return Math.random() < 0.38
      ? 6
      : 4;
  }

  return Math.random() < 0.6
    ? 2
    : 1;
}

// -------------------- MAIN FUNCTION --------------------
function simulateBall(
  batsman,
  bowler,
  stadium,
  context,
  isFreeHit = false,
  bowlerMomentum = 0
) {
  // ---------------- Extras ----------------
  const extra = getExtra(
    bowler,
    bowlerMomentum
  );

  // Wide = dead ball
  if (
    extra &&
    extra.type === "wide"
  ) {
    return {
      type: "wide",
      runs: extra.runs,
      isExtra: true,
      freeHit: false
    };
  }

  const isNoBall =
    extra &&
    extra.type === "noball";

  const isPacer =
    (bowler.role || "")
      .toLowerCase()
      .includes("fast") ||
    (bowler.role || "")
      .toLowerCase()
      .includes("pace");

  // ---------------- Intent ----------------
  const intent = decideIntent(
    batsman,
    context,
    isFreeHit
  );

  // ---------------- Skills ----------------
  const battingSkill =
    getBattingSkill(
      batsman,
      isPacer,
      stadium,
      context
    );

  const ballQuality =
    getBallQuality(
      bowler,
      stadium,
      isPacer,
      context
    );

  // ---------------- Shot resolution ----------------
  const success = resolveShot(
    intent,
    battingSkill,
    ballQuality,
    isFreeHit
  );

  // ---------------- Wicket ----------------
  const wicketSafe =
    isFreeHit || isNoBall;

  const wicketChance =
    getWicketChance(
      intent,
      success,
      wicketSafe
    );

  if (
    !wicketSafe &&
    Math.random() * 100 <
      wicketChance
  ) {
    return {
      type: "wicket",
      runs: 0,
      intent
    };
  }

  // ---------------- Runs ----------------
  let runs = getRuns(
    success,
    batsman,
    stadium,
    bowler,
    isFreeHit
  );

  const isBoundary =
    runs === 4 || runs === 6;

  let totalRuns = runs;

  // ---------------- No ball ----------------
  if (isNoBall) {
    totalRuns += 1;

    return {
      type: "noball",
      runs: totalRuns,
      runsFromBall: runs,
      isBoundary,
      freeHit: true,
      intent,
      success:
        success.toFixed(2)
    };
  }

  // ---------------- Ball speed ----------------
  const speed = isPacer
    ? random(125, 150).toFixed(1)
    : random(75, 105).toFixed(1);

  // ---------------- Final ----------------
  return {
    type: "run",
    runs: totalRuns,
    isBoundary,
    intent,
    success:
      success.toFixed(2),
    speed
  };
}

module.exports = {
  simulateBall
};