// engine/matchEngine.js (with momentum - FULLY FIXED)
const random = (min, max) => Math.random() * (max - min) + min;

function normalRandom(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * std;
}

function getBowlerSpeed(bowler, stadium, momentum = 0) {
  let baseSpeed = 0;
  const role = (bowler.role || "").toLowerCase();

  if (role.includes("fast") || role.includes("pace")) {
    baseSpeed = random(130, 155);
    baseSpeed += (bowler.paceSkill || 50) / 12;
    baseSpeed += (stadium.pace - 5) * 1.5;
    baseSpeed -= momentum * 2;
  } else if (role.includes("spin")) {
    baseSpeed = random(75, 110);
    baseSpeed += (bowler.spinSkill || 50) / 15;
    baseSpeed += (stadium.turn - 5) * 0.5;
  } else {
    baseSpeed = random(110, 135);
  }
  return Math.min(160, Math.max(70, baseSpeed)).toFixed(1);
}

function getMomentumFactors(overState, ballNumber) {
  const {
    runsInOver,
    wicketsInOver,
    boundariesInOver,
    consecutiveDots,
    consecutiveBoundaries
  } = overState;

  let bowlerMomentum = 0;
  let batsmanMomentum = 0;

  if (consecutiveDots >= 2) bowlerMomentum += 5;
  if (consecutiveDots >= 3) bowlerMomentum += 8;
  if (consecutiveDots >= 4) bowlerMomentum += 12;

  if (consecutiveBoundaries >= 1) batsmanMomentum += 10;
  if (consecutiveBoundaries >= 2) batsmanMomentum += 20;

  if (wicketsInOver > 0) bowlerMomentum += 15 * wicketsInOver;

  if (runsInOver >= 15) bowlerMomentum -= 10;
  if (runsInOver >= 20) bowlerMomentum -= 20;

  if (overState.lastBallWasBoundary) batsmanMomentum += 15;

  return { bowlerMomentum, batsmanMomentum };
}

const phrases = {
  0: ["Dot ball!", "No run there.", "Good defensive shot.", "Beaten! No run.", "Pressure building.", "Wicket maiden in progress!", "The pressure is mounting!"],
  1: ["Quick single.", "Tap and run.", "Easy single.", "Just a single.", "Rotate the strike.", "They'll take a quick one."],
  2: ["Good running, two runs.", "Well placed, couple of runs.", "They'll take two.", "Excellent running between wickets."],
  3: ["Excellent running, three runs!", "Hard running gives them three.", "They push hard for three."],
  4: ["Cracked to the boundary!", "Four runs! Beautiful shot.", "Races away for four.", "That's a classy shot for four!", "Smashed through the covers!"],
  6: ["MAXIMUM! Six runs!", "Huge hit! Out of the park!", "That's a big six!", "Gone all the way! Six!", "What a strike! Clean as a whistle!"],
  wicket: ["OUT! Big wicket!", "Bowled him!", "Caught! Gone!", "Timber! Huge breakthrough!", "The bowler gets his man!", "That's a massive wicket!"],
  noball: ["No-ball! Free hit coming.", "Oversteps! No-ball called.", "The umpire signals a no-ball!", "Free hit coming next!"],
  wide: ["Wide! Too far outside.", "Down leg, called wide.", "Wayward delivery, called wide."]
};

function getPhrase(type, runs = null, momentum = 0) {
  if (type === "wicket") return phrases.wicket[Math.floor(Math.random() * phrases.wicket.length)];
  if (type === "noball") return phrases.noball[Math.floor(Math.random() * phrases.noball.length)];
  if (type === "wide") return phrases.wide[Math.floor(Math.random() * phrases.wide.length)];
  if (runs !== null && phrases[runs]) return phrases[runs][Math.floor(Math.random() * phrases[runs].length)];
  return "Good cricket.";
}

function getBattingSkill(batsman, stadium, isPowerplay, isDeath, isPacerBowler, batsmanMomentum = 0) {
  let skill = (batsman.technique || 50) * 0.25 +
    (batsman.power || 50) * 0.20 +
    (batsman.timing || 50) * 0.25 +
    (batsman.aggression || 50) * 0.15 +
    (batsman.consistency || 50) * 0.15;

  if (isPacerBowler) {
    skill *= (batsman.againstPace || 50) / 50;
  } else {
    skill *= (batsman.againstSpin || 50) / 50;
  }

  skill *= (stadium.batting / 5);
  if (isPowerplay) skill *= 1.1;
  if (isDeath) skill *= 1.05;

  skill += batsmanMomentum;

  return Math.min(130, Math.max(20, skill));
}

function getBowlingSkill(bowler, stadium, isPowerplay, isDeath, isPacer, bowlerMomentum = 0) {
  let skill = 0;

  if (isPacer) {
    skill = (bowler.paceSkill || 50) * 0.35 +
      (bowler.movement || 50) * 0.35 +
      (bowler.control || 50) * 0.30;
    skill *= (stadium.pace / 5) * (stadium.swing / 5);
  } else {
    skill = (bowler.spinSkill || 50) * 0.40 +
      (bowler.turn || 50) * 0.30 +
      (bowler.control || 50) * 0.30;
    skill *= (stadium.turn / 5);
  }

  if (isPowerplay) skill *= 0.9;
  if (isDeath) skill *= (bowler.deathBowling || 50) / 50;

  skill += bowlerMomentum;

  return Math.min(110, Math.max(20, skill));
}

function getExtra(bowler, bowlerMomentum = 0) {
  const controlRating = (bowler.control || 50) / 100;
  const momentumEffect = bowlerMomentum < 0 ? Math.abs(bowlerMomentum) / 10 : 0;
  const extraChance = Math.max(1.5, Math.min(8, 6 - (controlRating * 5) + momentumEffect));

  if (Math.random() * 100 < extraChance) {
    return Math.random() < 0.4 ? { type: "noball", runs: 1 } : { type: "wide", runs: 1 };
  }
  return null;
}

function getBoundaryModifier(stadium) {
  if (stadium.boundarySize >= 8) return 0.6;
  if (stadium.boundarySize >= 6) return 0.8;
  if (stadium.boundarySize >= 4) return 1.0;
  return 1.2;
}

function simulateBall(batsman, bowler, stadium, overNumber, isFreeHit = false, momentumFactors = { bowler: 0, batsman: 0 }) {
  const isPowerplay = overNumber <= 6;
  const isDeath = overNumber >= 16;
  const isPacer = (bowler.role || "").toLowerCase().includes("fast") ||
    (bowler.role || "").toLowerCase().includes("pace");

  let battingSkill = getBattingSkill(batsman, stadium, isPowerplay, isDeath, isPacer, momentumFactors.batsman);
  let bowlingSkill = getBowlingSkill(bowler, stadium, isPowerplay, isDeath, isPacer, momentumFactors.bowler);

  let net = battingSkill - bowlingSkill + normalRandom(0, 15);

  const boundaryMod = getBoundaryModifier(stadium);

  let wicketChance = isFreeHit ? 0.5 : (4 + (bowlingSkill - battingSkill) / 20);

  if (momentumFactors.bowler > 0) {
    wicketChance += momentumFactors.bowler / 10;
  }

  if (momentumFactors.batsman > 0) {
    wicketChance -= momentumFactors.batsman / 15;
  }

  wicketChance = Math.min(15, Math.max(1.5, wicketChance));

  if (Math.random() * 100 < wicketChance && !isFreeHit) {
    return { type: "wicket", runs: 0 };
  }

  let runs = 0;
  const rand = Math.random() * 100;
  let adjustedNet = net;

  if (momentumFactors.batsman > 0) {
    adjustedNet += momentumFactors.batsman / 2;
  }

  if (momentumFactors.bowler > 0) {
    adjustedNet -= momentumFactors.bowler / 2;
  }

  if (adjustedNet > 85) {
    if (rand < 45) runs = 6;
    else if (rand < 75) runs = 4;
    else if (rand < 88) runs = 2;
    else runs = 1;
  } else if (adjustedNet > 55) {
    if (rand < 12) runs = 6;
    else if (rand < 28) runs = 4;
    else if (rand < 55) runs = 2;
    else if (rand < 85) runs = 1;
    else runs = 0;
  } else if (adjustedNet > 25) {
    if (rand < 4) runs = 6;
    else if (rand < 12) runs = 4;
    else if (rand < 40) runs = 2;
    else if (rand < 70) runs = 1;
    else runs = 0;
  } else if (adjustedNet > 0) {
    if (rand < 1.5) runs = 6;
    else if (rand < 7) runs = 4;
    else if (rand < 30) runs = 2;
    else if (rand < 60) runs = 1;
    else runs = 0;
  } else {
    if (rand < 3) runs = 4;
    else if (rand < 18) runs = 2;
    else if (rand < 45) runs = 1;
    else runs = 0;
  }

  if (runs === 4 || runs === 6) {
    if (Math.random() > boundaryMod) {
      runs = runs === 4 ? 2 : 3;
    }
  }
  
  const speed = isPacer ? (Math.random() * 35 + 120).toFixed(1) : (Math.random() * 40 + 70).toFixed(1);

  return { type: "run", runs: runs, isBoundary: (runs === 4 || runs === 6), speed: speed };
}

function simulateOver(state, bowler, stadium, overNumber, playersMap, getNewBatsman) {
  // Working variables that will be modified
  let strikerIdx = state.strikerIdx;
  let nonStrikerIdx = state.nonStrikerIdx;
  let nextBatsmanIdx = state.nextBatsmanIdx;
  let runs = state.runs;
  let wickets = state.wickets;
  let partnershipRuns = state.partnershipRuns;
  let partnershipBalls = state.partnershipBalls;
  let lastWicket = state.lastWicket;
  let batsmanStats = { ...state.batsmanStats };

  let ballLines = [];
  let overRuns = 0;
  let overWickets = 0;
  let ballEvents = [];
  let isFreeHit = false;

  // Track momentum within this over
  let overState = {
    runsInOver: 0,
    wicketsInOver: 0,
    boundariesInOver: 0,
    consecutiveDots: 0,
    consecutiveBoundaries: 0,
    lastBallWasBoundary: false
  };

  const getBatsmanObj = (idx) => {
    const name = state.battingOrder[idx];
    if (!name) return null;
    return playersMap.get(name.toLowerCase().trim());
  };

  const updateBatsmanStats = (name, runsScored, ballFaced, isBoundary = false) => {
    const key = name.toLowerCase().trim();
    if (!batsmanStats[key]) {
      batsmanStats[key] = { name: name, runs: 0, balls: 0, fours: 0, sixes: 0 };
    }
    batsmanStats[key].runs += runsScored;
    if (ballFaced) batsmanStats[key].balls++;
    if (runsScored === 4) batsmanStats[key].fours++;
    if (runsScored === 6) batsmanStats[key].sixes++;
  };

  // Bowl all 6 balls or until innings ends
  for (let ballNum = 1; ballNum <= 6;) {
    // Check if innings should end
    if (wickets >= 10) break;
    if (state.target && runs >= state.target) break;

    // Calculate momentum factors for this ball
    const momentumFactors = getMomentumFactors(overState, ballNum);

    // Check for extras
    let extra = null;
    if (!isFreeHit) extra = getExtra(bowler, momentumFactors.bowler);

    const striker = getBatsmanObj(strikerIdx);
    if (!striker) break;

    // Handle extras (no-ball, wide)
    if (extra) {
      const speed = getBowlerSpeed(bowler, stadium, momentumFactors.bowler);
      const phrase = getPhrase(extra.type);
      runs += extra.runs;
      overRuns += extra.runs;
      overState.runsInOver += extra.runs;
      updateBatsmanStats(striker.name, extra.runs, extra.type !== "noball");

      const line = `${overNumber}.${ballNum} ${extra.type.toUpperCase()} ${bowler.name} to ${striker.name} | ${speed} km/h | ${extra.runs} run(s) (${extra.type}) | ${phrase} | ${runs}/${wickets}`;
      ballLines.push(line);
      ballEvents.push(extra.type === "noball" ? "Nb" : "Wd");

      if (extra.type === "noball") {
        isFreeHit = true;
        // NOBALL: Extra ball, do NOT increment ballNum
        continue;
      } else if (extra.type === "wide") {
        // WIDE: Extra ball, do NOT increment ballNum
        isFreeHit = false;
        continue;
      }
    }

    // Normal ball delivery
    const outcome = simulateBall(striker, bowler, stadium, overNumber, isFreeHit, momentumFactors);
    const speed = getBowlerSpeed(bowler, stadium, momentumFactors.bowler);

    if (outcome.type === "wicket") {
      // WICKET!
      wickets++;
      overWickets++;
      overState.wicketsInOver++;
      overState.consecutiveDots = 0;
      overState.consecutiveBoundaries = 0;
      updateBatsmanStats(striker.name, 0, true);

      const phrase = getPhrase("wicket");
      const line = `${overNumber}.${ballNum} ${bowler.name} to ${striker.name} | ${speed} km/h | WICKET | ${phrase} | ${runs}/${wickets}`;
      ballLines.push(line);
      ballEvents.push("W");

      lastWicket = {
        runs: partnershipRuns,
        balls: partnershipBalls,
        batsman: striker.name,
        bowler: bowler.name
      };
      partnershipRuns = 0;
      partnershipBalls = 0;

      // Check if innings is over
      if (wickets >= 10 || nextBatsmanIdx >= state.battingOrder.length) {
        wickets = 10;
        break;
      }

      // Get the new batsman
      const newBatsmanName = state.battingOrder[nextBatsmanIdx]?.trim();
      if (!newBatsmanName) {
        wickets = 10;
        break;
      }

      // Add a line announcing the new batsman
      ballLines.push(`🏏 New batsman: **${newBatsmanName}** comes to the crease`);

      // Update the batting order index for next batsman
      nextBatsmanIdx++;

      // CRITICAL FIX: The new batsman takes the striker's position
      // strikerIdx remains the same (new batsman is now on strike)
      // The ball is complete, move to next ball
      ballNum++;

      // Reset free hit flag
      isFreeHit = false;

      // Continue to next ball with the new batsman
      // Do NOT break the loop - continue bowling remaining balls
      continue;
    }

    // Normal run outcome
    runs += outcome.runs;
    overRuns += outcome.runs;
    partnershipRuns += outcome.runs;
    partnershipBalls++;
    overState.runsInOver += outcome.runs;

    // Track momentum
    if (outcome.isBoundary) {
      overState.boundariesInOver++;
      overState.consecutiveBoundaries++;
      overState.consecutiveDots = 0;
      overState.lastBallWasBoundary = true;
    } else if (outcome.runs === 0) {
      overState.consecutiveDots++;
      overState.consecutiveBoundaries = 0;
      overState.lastBallWasBoundary = false;
    } else {
      overState.consecutiveDots = 0;
      overState.consecutiveBoundaries = 0;
      overState.lastBallWasBoundary = false;
    }

    updateBatsmanStats(striker.name, outcome.runs, true, outcome.isBoundary);

    const phrase = getPhrase("run", outcome.runs);

    let momentumText = "";
    if (momentumFactors.bowler >= 10) momentumText = " 🔥 Bowler on fire!";
    else if (momentumFactors.batsman >= 15) momentumText = " 💪 Batsman in full flow!";

    const line = `${overNumber}.${ballNum} ${bowler.name} to ${striker.name} | ${speed} km/h | ${outcome.runs} run(s) | ${phrase}${momentumText} | ${runs}/${wickets}`;
    ballLines.push(line);
    const runSymbol = outcome.runs === 0 ? "•" : outcome.runs.toString();
    ballEvents.push(runSymbol);

    // Change strike if odd number of runs
    if (outcome.runs % 2 === 1) {
      [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
    }

    ballNum++;
    isFreeHit = false;
  }

  // Swap strike at end of over if all 6 balls were bowled
  if (ballLines.filter(line => !line.includes("New batsman")).length === 6 && wickets < 10 && (!state.target || runs < state.target)) {
    [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
  }

  return {
    ballLines,
    overRuns,
    overWickets,
    ballEvents,
    requiresBatsmanChoice: false,
    newState: {
      strikerIdx,
      nonStrikerIdx,
      nextBatsmanIdx,
      runs,
      wickets,
      partnershipRuns,
      partnershipBalls,
      lastWicket,
      batsmanStats
    }
  };
}

module.exports = { simulateOver, simulateBall };