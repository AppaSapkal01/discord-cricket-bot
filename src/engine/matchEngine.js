const random = (min, max) => Math.random() * (max - min) + min;

function normalRandom(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// -------------------- INTENT --------------------
function decideIntent(batsman, context, isFreeHit = false) {
  // Free hit → always attack
  if (isFreeHit) return "attack";

  let aggression = batsman.aggression || 50;

  if (context.requiredRate > 9) aggression += 20;
  if (context.wickets <= 3) aggression -= 10;
  if (context.over >= 16) aggression += 25;
  if (context.over <= 6) aggression += 5;

  if (aggression > 75) return "attack";
  if (aggression > 45) return "balanced";
  return "defensive";
}

// -------------------- BATTING SKILL --------------------
function getBattingSkill(batsman, isPacer, stadium) {
  let skill =
    (batsman.technique || 50) * 0.28 +
    (batsman.timing || 50) * 0.25 +
    (batsman.power || 50) * 0.18 +
    (batsman.consistency || 50) * 0.17 +
    (batsman.aggression || 50) * 0.12;

  if (isPacer) {
    skill *= (batsman.againstPace || 50) / 55;
  } else {
    skill *= (batsman.againstSpin || 50) / 55;
  }

  skill *= 1 + ((stadium.batting || 5) - 5) * 0.05;
  skill *= (batsman.battingForm || 50) / 55;
  return skill;
}

// -------------------- BALL QUALITY --------------------
function getBallQuality(bowler, stadium, isPacer, context) {
  let quality =
    (bowler.control || 50) * 0.35 +
    (bowler.movement || 50) * 0.25 +
    (isPacer ? (bowler.paceSkill || 50) : (bowler.spinSkill || 50)) * 0.25 +
    (bowler.economy || 50) * 0.15;

  if (isPacer) {
    quality *= ((stadium.pace || 5) + (stadium.swing || 5)) / 10;
  } else {
    quality *= (stadium.turn || 5) / 5;
  }

  //Note: need to check this and come with better plan
  
  // if (context.over >= 16) {
  //   quality *= (bowler.deathBowling || 50) / 50;
  // }

  if (context.dew) quality *= 0.92;
  quality *= (bowler.bowlingForm || 50) / 50;

  return quality * 0.9 + normalRandom(0, 3);
}

// -------------------- EXTRAS (with momentum) --------------------
function getExtra(bowler, bowlerMomentum = 0) {
  const controlRating = (bowler.control || 50) / 100;
  const momentumEffect = bowlerMomentum < 0 ? Math.abs(bowlerMomentum) / 10 : 0;
  const extraChance = Math.max(1.5, Math.min(8, 6 - (controlRating * 5) + momentumEffect));

  if (Math.random() * 100 < extraChance) {
    // wide or no‑ball (no‑ball slightly more common in T20)
    return Math.random() < 0.55 ? { type: "noball", runs: 1 } : { type: "wide", runs: 1 };
  }
  return null;
}

// -------------------- SHOT RESOLUTION --------------------
function resolveShot(intent, battingSkill, ballQuality) {
  const diff = battingSkill - ballQuality;
  const normalized = Math.max(-20, Math.min(20, diff));
  let score = normalized + normalRandom(0, 5);
  if (intent === "attack") score -= 5;
  if (intent === "defensive") score += 4;
  return score;
}

// -------------------- WICKET (ignored on free‑hit or no‑ball) --------------------
function getWicketChance(intent, success, isSafe = false) {
  if (isSafe) return 0; // no‑ball or free‑hit → no wicket (run‑out not implemented)
  let chance = 1.5;
  if (intent === "attack") chance += 4.5;
  if (intent === "balanced") chance += 2;
  if (success < -10) chance += 5;
  if (success < -18) chance += 6;
  return Math.min(18, chance);
}

// -------------------- RUNS (same logic, but we'll add extra runs later) --------------------
function getRuns(success, batsman, stadium, bowler) {
  const power = (batsman.power || 50) / 100;
  const boundarySize = stadium.boundarySize || 5;
  const boundaryChance = power * (4.5 / boundarySize);

  if (success < -12) return 0;
  if (success < -2) return Math.random() < 0.75 ? 0 : 1;
  if (success < 10) {
    const r = Math.random();
    if (r < 0.55) return 1;
    if (r < 0.75) return 2;
    return 0;
  }
  if (success < 25) {
    const r = Math.random();
    if (r < 0.5) return 1;
    if (r < 0.75) return 2;
    if (r < 0.9) return 3;
    return Math.random() < boundaryChance ? 4 : 0;
  }
  const r = Math.random();
  if (r < boundaryChance) return Math.random() < 0.4 ? 6 : 4;
  return Math.random() < 0.6 ? 2 : 1;
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
  // 1. Extras (only wide is an immediate dead ball; no‑ball will be simulated)
  const extra = getExtra(bowler, bowlerMomentum);
  if (extra && extra.type === "wide") {
    return {
      type: "wide",
      runs: extra.runs,        // 1 run
      isExtra: true,
      freeHit: false
    };
  }

  const isNoBall = extra && extra.type === "noball";
  const isPacer = (bowler.role || "").toLowerCase().includes("fast") ||
                  (bowler.role || "").toLowerCase().includes("pace");

  // Free hit forces attack intent; no‑ball does not (the shot is still played)
  const intent = decideIntent(batsman, context, isFreeHit);

  const battingSkill = getBattingSkill(batsman, isPacer, stadium);
  const ballQuality = getBallQuality(bowler, stadium, isPacer, context);
  const success = resolveShot(intent, battingSkill, ballQuality);

  // No wicket on free‑hit or no‑ball
  const wicketSafe = isFreeHit || isNoBall;
  const wicketChance = getWicketChance(intent, success, wicketSafe);

  if (!wicketSafe && Math.random() * 100 < wicketChance) {
    return {
      type: "wicket",
      runs: 0,
      intent
    };
  }

  // Normal runs from the ball
  let runs = getRuns(success, batsman, stadium, bowler);
  let isBoundary = (runs === 4 || runs === 6);
  let totalRuns = runs;

  // If it's a no‑ball, add the extra run and mark the delivery
  if (isNoBall) {
    totalRuns = runs + 1;
    return {
      type: "noball",
      runs: totalRuns,            // bat runs + 1
      runsFromBall: runs,         // only for info (optional)
      isBoundary: isBoundary,     // boundary based on bat runs, not the extra
      freeHit: true,              // next ball is free hit
      intent,
      success: success.toFixed(2)
    };
  }

  // Normal delivery (including free‑hit without no‑ball)
  const speed = isPacer ? random(125, 150).toFixed(1) : random(75, 105).toFixed(1);
  return {
    type: "run",
    runs: totalRuns,
    isBoundary,
    intent,
    success: success.toFixed(2),
    speed
  };
}

module.exports = { simulateBall };