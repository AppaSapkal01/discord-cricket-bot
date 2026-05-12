// engine/matchEngine.js (REALISTIC ENGINE FIXED)

const random = (min, max) => Math.random() * (max - min) + min;

function normalRandom(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// -------------------- INTENT --------------------
function decideIntent(batsman, context) {
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

  if (context.dew) {
    quality *= 0.92;
  }

  quality *= (bowler.bowlingForm || 50) / 50;

  return quality * 0.9 + normalRandom(0, 3);
}

// -------------------- EXTRAS --------------------
function getExtra(bowler) {
  const control = (bowler.control || 50) / 100;
  const chance = 5 - control * 4;

  if (Math.random() * 100 < chance) {
    return Math.random() < 0.5
      ? { type: "wide", runs: 1 }
      : { type: "noball", runs: 1 };
  }

  return null;
}

// -------------------- SHOT RESOLUTION --------------------
function resolveShot(intent, battingSkill, ballQuality) {
  const diff = battingSkill - ballQuality;

  // normalize into -20 to +20 range
  const normalized = Math.max(-20, Math.min(20, diff));

  let score = normalized + normalRandom(0, 5);

  if (intent === "attack") score -= 5;
  if (intent === "defensive") score += 4;

  return score;
}

// -------------------- WICKET --------------------
function getWicketChance(intent, success) {
  let chance = 1.5; // base lowered

  if (intent === "attack") chance += 4.5;
  if (intent === "balanced") chance += 2;

  // only harsh failure matters
  if (success < -10) chance += 5;
  if (success < -18) chance += 6;

  // cap realism
  return Math.min(18, chance);
}

// -------------------- RUNS (FIXED CORE) --------------------
function getRuns(success, batsman, stadium, bowler) {
  const power = (batsman.power || 50) / 100;
  const boundarySize = stadium.boundarySize || 5;

  const boundaryChance = power * (4.5 / boundarySize);

  // DOT BALLS
  if (success < -12) return 0;

  // SAFE DEFENSE ZONE
  if (success < -2) {
    return Math.random() < 0.75 ? 0 : 1;
  }

  // NORMAL CRICKET ZONE
  if (success < 10) {
    const r = Math.random();
    if (r < 0.55) return 1;
    if (r < 0.75) return 2;
    return 0;
  }

  // GOOD SHOTS
  if (success < 25) {
    const r = Math.random();
    if (r < 0.5) return 1;
    if (r < 0.75) return 2;
    if (r < 0.9) return 3;
    return Math.random() < boundaryChance ? 4 : 0;
  }

  // BIG HITS
  const r = Math.random();
  if (r < boundaryChance) {
    return Math.random() < 0.4 ? 6 : 4;
  }

  return Math.random() < 0.6 ? 2 : 1;
}

// -------------------- MAIN FUNCTION --------------------
function simulateBall(
  batsman,
  bowler,
  stadium,
  context,
  isFreeHit = false
) {
  const isPacer =
    (bowler.role || "").toLowerCase().includes("fast") ||
    (bowler.role || "").toLowerCase().includes("pace");

  // Extras
  const extra = getExtra(bowler);
  if (extra) {
    return {
      type: extra.type,
      runs: extra.runs,
      isExtra: true,
      freeHit: extra.type === "noball"
    };
  }

  const intent = decideIntent(batsman, context);

  const battingSkill = getBattingSkill(batsman, isPacer, stadium);
  const ballQuality = getBallQuality(bowler, stadium, isPacer, context);

  const success = resolveShot(intent, battingSkill, ballQuality);

  const wicketChance = getWicketChance(intent, success);

  if (!isFreeHit && Math.random() * 100 < wicketChance) {
    return {
      type: "wicket",
      runs: 0,
      intent
    };
  }

  const runs = getRuns(success, batsman, stadium, bowler);

  const speed = isPacer
    ? random(125, 150).toFixed(1)
    : random(75, 105).toFixed(1);

  return {
    type: "run",
    runs,
    isBoundary: runs === 4 || runs === 6,
    intent,
    success: success.toFixed(2),
    speed
  };
}

module.exports = { simulateBall };