const { simulateBall } = require("../engine/matchEngine");
const { selectBowlerForOver, selectNextBatsman, getAvailableBowlers } = require("./selectionHandler");
const matchManager = require("../managers/matchManager");

const sleep = ms => new Promise(r => setTimeout(r, ms));

const commentary = {
  0: [
    "Dot ball! Good tight delivery, the batter can't find the gap.",
    "Excellent bowling on that occasion, no run added to the total.",
    "Defended solidly back to the bowler, pressure continues to build.",
    "Beaten outside off! The batter had no answer to that delivery.",
    "Straight to the fielder and they'll get nothing from it.",
    "Watchful batting there, carefully played but no run available.",
    "The bowler keeps things nice and tight, another dot ball.",
    "Sharp fielding inside the circle cuts off any chance of a single.",
    "Nicely bowled into the channel, batter forced onto the back foot.",
    "Good discipline from the bowling side, they're building pressure here.",
    "Tapped gently towards point but the fielder is quick to it.",
    "The batter wanted a run there for a moment, but wisely sent back.",
    "A probing delivery outside off stump, left alone comfortably.",
    "Short of a length and defended cautiously, no room to score.",
    "That one rushed onto the batter and all they could do was block it.",
    "Another excellent delivery, the fielders are right on top of the batter.",
    "Driven firmly but straight to cover, no run there at all.",
    "Tidy cricket from the bowling unit, not giving away anything easy."
  ],
  1: [
    "Quick single taken! Good awareness between the wickets.",
    "Tapped softly into the gap and they'll comfortably get one.",
    "Easy rotation of strike, smart batting under pressure.",
    "Just a single, but every run matters in this situation.",
    "Worked away nicely towards square leg for a run.",
    "Guided down to third man and they'll collect a single.",
    "Soft hands from the batter, they steal a quick run there.",
    "Pushed gently towards mid-on and they move through swiftly.",
    "Good communication between the batters, no hesitation there.",
    "Placed delicately into the gap for a simple single.",
    "The batter keeps the scoreboard ticking with another run.",
    "Neatly tucked off the pads and they jog through for one.",
    "A risky single attempted, but they make it home safely.",
    "Driven towards long-off and they settle for a single.",
    "Calm batting under pressure, rotating strike effectively.",
    "The field was up and they smartly take advantage with one run.",
    "A gentle push into the off side and they scamper through quickly.",
    "Nicely played with soft hands, ensuring an easy single."
  ],
  2: [
    "Excellent running between the wickets, they'll come back for two.",
    "Well placed shot into the deep and the batters run hard.",
    "That was beautifully timed and they comfortably pick up a couple.",
    "Great commitment from both batters, turning one into two.",
    "Driven wide of the fielder and they hustle back for the second.",
    "Aggressive running there, putting pressure on the fielders.",
    "Good placement into the outfield allows them to collect two runs.",
    "Sharp work between the wickets, they never looked in trouble.",
    "The throw comes in late and they make the second easily.",
    "Clipped nicely off the legs and they race back for another.",
    "Strong running effort! The fitness levels are on display here.",
    "The fielders were a little slow getting to the ball and they capitalize.",
    "Punched through the covers and they return comfortably for two.",
    "Quick turn at the striker's end ensures they complete the second.",
    "Excellent awareness from the batting pair, good cricket all around.",
    "That was hit into a big gap and they make full use of it.",
    "Nicely worked into the deep and they collect two valuable runs.",
    "Brilliant placement combined with energetic running between the wickets."
  ],
  3: [
    "Outstanding running! They push hard and complete three runs.",
    "Excellent commitment from both batters, turning it into three.",
    "The ball rolled deep into the outfield and they come back again.",
    "That's brilliant awareness and fitness on display from the batting side.",
    "Huge gap in the field and they take full advantage with three runs.",
    "Aggressive running between the wickets, the crowd appreciates that effort.",
    "The fielders were slow to recover and the batters make them pay.",
    "Terrific placement and even better running earns them three.",
    "The chase from the fielder wasn't quick enough and they complete three.",
    "Fantastic effort from both batters, they never stopped running.",
    "The throw comes in late and the third run is completed safely.",
    "Driven beautifully into the deep and they run all three comfortably.",
    "That required real fitness and determination, excellent cricket.",
    "Brilliant judgment from the batters to recognize the opportunity for three.",
    "Hard running puts pressure on the fielding side once again.",
    "That was not an easy three, but they worked incredibly hard for it.",
    "Wonderful awareness of the field placement allows them to collect three.",
    "A rare triple in modern cricket, and the crowd loves it."
  ],
  4: [
    "FOUR! Cracked beautifully through the covers, no stopping that.",
    "What a glorious boundary! Timed to absolute perfection.",
    "Driven majestically down the ground and away for four runs.",
    "That raced to the fence in no time at all, brilliant shot.",
    "Short and punished! The batter puts it away with authority.",
    "Elegant stroke play from the batter, pure class on display.",
    "Pierced the field perfectly and the ball rockets away to the boundary.",
    "A classy cover drive and the crowd erupts in appreciation.",
    "That was hit with exquisite timing, no chance for the fielders.",
    "FOUR more! The batter is finding the gaps with ease now.",
    "Beautifully placed behind point and it races away to the ropes.",
    "The bowler overpitched slightly and gets punished immediately.",
    "Delicate touch combined with perfect timing brings another boundary.",
    "That's a trademark cricket shot, absolutely textbook stuff.",
    "The batter leans into the drive and sends it screaming to the fence.",
    "Superb placement! Split the fielders perfectly for four runs.",
    "Picked up off the pads and dispatched fine for a boundary.",
    "Pure elegance from the batter, that shot deserved four."
  ],
  6: [
    "SIX! That's been launched high and handsome into the stands!",
    "Massive hit! The crowd erupts as the ball disappears into the night sky.",
    "Clean strike from the batter and it sails well beyond the boundary.",
    "What a shot! That's gone a long, long way.",
    "Picked the length early and absolutely smashed it for six.",
    "Into the crowd it goes! The batter is dealing in maximums now.",
    "That was struck with incredible power and timing.",
    "Huge hit down the ground, the bowler can only watch helplessly.",
    "The batter stands tall and sends that delivery over the ropes with ease.",
    "A monstrous six! That nearly left the stadium.",
    "That's gone straight into the second tier, unbelievable striking.",
    "The sound off the bat told the whole story, massive maximum.",
    "Short ball punished brutally, that disappeared in a flash.",
    "The batter clears the front leg and launches it deep into the stands.",
    "What incredible power from the batter, that's a gigantic hit.",
    "No chance for any fielder there, that was always heading out of the ground.",
    "The crowd is loving this batting masterclass, another huge six.",
    "Absolutely hammered! That ball had wings on it."
  ],
  wicket: [
    "OUT! Clean bowled! The stumps are shattered and the batter has to walk back.",
    "Huge wicket for the bowling side and the crowd erupts in celebration.",
    "CAUGHT! Safe hands in the deep and the batter departs.",
    "TIMBER! The bowler completely outfoxed the batter there.",
    "LBW! Big appeal and the umpire raises the finger immediately.",
    "Gone! That's a massive breakthrough at a crucial moment in the game.",
    "Edges it behind and the keeper makes no mistake whatsoever.",
    "The batter tried to go big but holes out straight to the fielder.",
    "Excellent bowling strategy finally pays off with a wicket.",
    "Dragged it back onto the stumps, the batter looks disappointed.",
    "Caught at cover! Sharp reflexes from the fielder inside the ring.",
    "A soft dismissal and the batting side loses an important wicket.",
    "That's a brilliant catch under pressure, outstanding fielding effort.",
    "The bowler has been threatening for a while and finally gets rewarded.",
    "A massive moment in the match as the batter heads back to the pavilion.",
    "The slower ball does the trick and the batter mistimes it completely.",
    "Straight up in the air! The fielder settles under it comfortably.",
    "That could be a game-changing wicket for the bowling team."
  ],
  noball: [
    "No-ball called! The bowler has overstepped and that's an extra run.",
    "Free hit coming up next ball, huge opportunity for the batting side.",
    "The umpire stretches out the arm, it's a no-ball.",
    "That's poor discipline from the bowler, gifting away a free run.",
    "Overstepped by quite a margin there, the captain won't be happy.",
    "A costly mistake from the bowler and now a free hit follows.",
    "Front foot just lands beyond the line and it's called immediately.",
    "No-ball! The pressure eases slightly for the batting team.",
    "That delivery won't count and the batter gets another chance.",
    "The bowler loses rhythm there and sends down an illegal delivery.",
    "Big moment in the over as the umpire signals a no-ball.",
    "Free hit incoming! The crowd senses something exciting could happen.",
    "That's a momentum-shifting mistake from the bowling side.",
    "The batter survives thanks to the bowler overstepping.",
    "Careless error from the bowler and they'll have to reload again.",
    "No-ball signaled and the batting side gladly accepts the bonus run."
  ],
  wide: [
    "Wide ball! That was far beyond the batter's reach.",
    "The umpire spreads the arms, signaling a wide delivery.",
    "Wayward bowling there, gives away an extra run.",
    "Too far outside off stump and it's called wide immediately.",
    "Down the leg side and the keeper can't prevent the extra.",
    "That delivery slipped badly from the bowler's control.",
    "Pressure causing mistakes now as another wide is bowled.",
    "The batter didn't even think about playing at that one.",
    "That's a loose delivery and the bowling side won't want too many of those.",
    "Wide called! The line was completely wrong on that occasion.",
    "The bowler sprays it down the leg side for an easy extra.",
    "Another extra added to the total through poor bowling discipline.",
    "That one sailed well outside the tramline and is rightly called wide.",
    "The keeper has to dive across but cannot stop the wide.",
    "An unnecessary extra run conceded by the fielding side.",
    "The bowler will need to regroup quickly after that wayward delivery."
  ]
};

function getCommentary(runs, isWicket = false, extraType = null) {
  if (extraType === "noball") return commentary.noball[Math.floor(Math.random() * commentary.noball.length)];
  if (extraType === "wide") return commentary.wide[Math.floor(Math.random() * commentary.wide.length)];
  if (isWicket) return commentary.wicket[Math.floor(Math.random() * commentary.wicket.length)];
  const key = runs === 0 ? 0 : runs >= 4 ? (runs === 4 ? 4 : 6) : runs;
  return commentary[key][Math.floor(Math.random() * commentary[key].length)];
}

function getBallSymbol(runs, isWicket, extraType) {
  if (extraType === "noball") return "NB";
  if (extraType === "wide") return "WD";
  if (isWicket) return "W";
  if (runs === 0) return "•";
  return runs.toString();
}

function getRequiredMessage(target, runs, overNumber, ballsBowled) {
  if (!target) return "";
  const runsNeeded = target - runs;
  if (runsNeeded <= 0) return "";
  const totalOvers = 20;
  const ballsLeft = (totalOvers - overNumber - 1) * 6 + (6 - ballsBowled);
  return `🎯 **${runsNeeded} runs needed from ${ballsLeft} balls** (RRR: ${(runsNeeded / ballsLeft * 6).toFixed(2)})`;
}

// ─────────────────────────────────────────────────────────────
// Determine bowler type from the player object.
// Adjust the property name to match whatever your playersMap stores
// (common options: bowler.type, bowler.bowlingType, bowler.style).
// Returns "pace" | "spin" | "unknown"
// ─────────────────────────────────────────────────────────────
function getBowlerType(bowler) {
  if (!bowler) return "unknown";
  const raw = (bowler.type || bowler.bowlingType || bowler.style || "").toLowerCase();
  if (raw.includes("pace") || raw.includes("fast") || raw.includes("medium")) return "pace";
  if (raw.includes("spin") || raw.includes("off") || raw.includes("leg") || raw.includes("slow")) return "spin";
  return "unknown";
}

// ─────────────────────────────────────────────────────────────
// Ensure a full batsmanStats entry exists (including pace/spin
// breakdown fields) and return the normalised key.
// All accumulator fields default to 0 (integers, not booleans).
// ─────────────────────────────────────────────────────────────
function ensureBatsmanEntry(matchState, playerName) {
  const key = playerName.toLowerCase().trim();
  if (!matchState.batsmanStats[key]) {
    matchState.batsmanStats[key] = {
      name: playerName,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      runsVsPace: 0,
      ballsVsPace: 0,
      runsVsSpin: 0,
      ballsVsSpin: 0,
      outVsPace: 0,   // integer count
      outVsSpin: 0,   // integer count
    };
  }
  return key;
}

async function playOver(interaction, matchState, playersMap, stadium, overNumber, inningNumber, target, channelId) {
  const match = matchManager.getMatch(channelId);
  if (!match || !match.isActive || match.stopped) return { endReason: "match_stopped" };

  if (!matchState.bowlerOvers) matchState.bowlerOvers = new Map();
  if (!matchState.bowlerStats) matchState.bowlerStats = new Map();
  if (!matchState.dismissedBatsmen) matchState.dismissedBatsmen = new Set();

  let overState = {
    runsInOver: 0,
    wicketsInOver: 0,
    boundariesInOver: 0,
    consecutiveDots: 0,
    consecutiveBoundaries: 0,
    lastBallWasBoundary: false
  };

  // --- Bowler selection ---
  let availableBowlers = getAvailableBowlers(matchState.bowlingTeam, playersMap);
  availableBowlers = availableBowlers.filter(name => {
    const oversBowled = matchState.bowlerOvers.get(name) || 0;
    return oversBowled < 4 && name !== matchState.lastBowler;
  });
  if (availableBowlers.length === 0) {
    availableBowlers = getAvailableBowlers(matchState.bowlingTeam, playersMap).filter(name => {
      const oversBowled = matchState.bowlerOvers.get(name) || 0;
      return oversBowled < 4;
    });
  }

  const bowlerName = await selectBowlerForOver(interaction, availableBowlers, overNumber, inningNumber, matchState, playersMap);
  if (!bowlerName) return { endReason: "match_stopped" };
  const bowler = playersMap.get(bowlerName.toLowerCase().trim());

  // Resolve bowler type once per over — used for every ball in this over
  const bowlerType = getBowlerType(bowler);

  if (!matchState.bowlerStats.has(bowlerName)) {
    matchState.bowlerStats.set(bowlerName, { name: bowlerName, runs: 0, wickets: 0, overs: 0 });
  }
  const bowlerStats = matchState.bowlerStats.get(bowlerName);
  bowlerStats.overs++;
  matchState.bowlerOvers.set(bowlerName, bowlerStats.overs);
  matchState.lastBowler = bowlerName;

  const displayOverNumber = overNumber + 1;
  let commentaryText = `\n🎯 **Over ${displayOverNumber}** - ${bowlerName} comes into bowl\n`;
  commentaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  const overMessage = await interaction.channel.send(commentaryText);

  let ballEvents = [];
  let overRuns = 0;
  let overWickets = 0;
  let isFreeHit = false;
  let ballsBowled = 0;

  while (ballsBowled < 6) {
    const currentMatch = matchManager.getMatch(channelId);
    if (!currentMatch || !currentMatch.isActive || currentMatch.stopped) return { endReason: "match_stopped" };
    if (matchState.wickets >= 10) break;
    if (target && matchState.runs >= target) break;

    const strikerName = matchState.striker;
    const striker = playersMap.get(strikerName.toLowerCase().trim());
    if (!striker) {
      console.error(`Striker not found: ${strikerName}`);
      break;
    }

    const momentumFactors = getMomentumFactors(overState, ballsBowled + 1);
    const ballNumber = ballsBowled + 1;
    const ballDisplay = `${overNumber}.${ballNumber}`;

    let requiredRate = 0;
    if (target) {
      const ballsLeft = (20 - overNumber) * 6 - ballsBowled;
      const runsNeeded = target - matchState.runs;
      requiredRate = ballsLeft > 0 ? (runsNeeded / ballsLeft) * 6 : 0;
    }

    const context = {
      over: overNumber,
      wickets: matchState.wickets,
      requiredRate,
      dew: stadium.dew > 5 && inningNumber === 2
    };

    const outcome = simulateBall(striker, bowler, stadium, context, isFreeHit, momentumFactors.bowler);

    matchState.runs += outcome.runs;
    overRuns += outcome.runs;
    overState.runsInOver += outcome.runs;
    bowlerStats.runs += outcome.runs;

    // ─────────── WIDE ───────────
    if (outcome.type === "wide") {
      const comment = getCommentary(0, false, "wide");
      commentaryText += `\`${ballDisplay}\` ${bowlerName} to ${strikerName} | **WIDE** | ${comment}\n`;
      commentaryText += `📊 Score: **${matchState.runs}/${matchState.wickets}**\n`;
      ballEvents.push("WD");
      await overMessage.edit(commentaryText);
      await sleep(1000);
      isFreeHit = false;
      continue; // wide does not count as a legal ball
    }

    // ─────────── NO-BALL ───────────
    if (outcome.type === "noball") {
      const runsFromBall = outcome.runsFromBall || (outcome.runs - 1);
      const comment = getCommentary(runsFromBall, false, "noball");
      commentaryText += `\`${ballDisplay}\` ${bowlerName} to ${strikerName} | **NO BALL + ${runsFromBall}** | ${comment}\n`;
      commentaryText += `🎯 **FREE HIT NEXT BALL!**\n`;
      commentaryText += `📊 Score: **${matchState.runs}/${matchState.wickets}**\n`;
      ballEvents.push(`NB+${runsFromBall}`);
      await overMessage.edit(commentaryText);
      await sleep(1000);

      // No-ball is not a legal delivery — don't increment ballsBowled
      isFreeHit = true;

      // Still counts as a ball faced and runs scored by the batter
      const strikerKey = ensureBatsmanEntry(matchState, strikerName);
      const bs = matchState.batsmanStats[strikerKey];
      bs.runs += runsFromBall;
      bs.balls++;
      if (bowlerType === "pace") { bs.runsVsPace += runsFromBall; bs.ballsVsPace++; }
      else if (bowlerType === "spin") { bs.runsVsSpin += runsFromBall; bs.ballsVsSpin++; }
      if (runsFromBall === 4) bs.fours++;
      if (runsFromBall === 6) bs.sixes++;

      if (runsFromBall % 2 === 1) {
        [matchState.striker, matchState.nonStriker] = [matchState.nonStriker, matchState.striker];
      }
      continue;
    }

    // ─────────── WICKET ───────────
    if (outcome.type === "wicket") {
      const outBatsmanTrim = matchState.striker.trim();

      matchState.wickets++;
      overWickets++;
      overState.wicketsInOver++;
      overState.consecutiveDots = 0;
      overState.consecutiveBoundaries = 0;
      overState.lastBallWasBoundary = false;

      bowlerStats.wickets++;
      matchState.dismissedBatsmen.add(outBatsmanTrim);

      const outKey = ensureBatsmanEntry(matchState, outBatsmanTrim);
      const outBs = matchState.batsmanStats[outKey];

      // Wicket delivery counts as a ball faced
      outBs.balls++;
      outBs.out = true;

      // Pace / spin breakdown — outVsPace and outVsSpin are integer counts
      if (bowlerType === "pace") { outBs.ballsVsPace++; outBs.outVsPace++; }
      else if (bowlerType === "spin") { outBs.ballsVsSpin++; outBs.outVsSpin++; }

      matchState.lastWicket = {
        batsman: outBatsmanTrim,
        bowler: bowlerName,
        runs: outBs.runs || 0,
        balls: outBs.balls || 0,
        partnershipRuns: matchState.partnershipRuns,
        partnershipBalls: matchState.partnershipBalls
      };
      matchState.partnershipRuns = 0;
      matchState.partnershipBalls = 0;

      const comment = getCommentary(0, true);
      commentaryText += `\`${ballDisplay}\` ${bowlerName} to ${strikerName} | **WICKET!** ${comment}\n`;
      commentaryText += `📊 Score: **${matchState.runs}/${matchState.wickets}**\n`;
      ballEvents.push("W");
      await overMessage.edit(commentaryText);
      await sleep(1500);

      if (matchState.wickets >= 10) break;

      const newBatsman = await selectNextBatsman(interaction, overNumber, inningNumber, matchState);
      if (!newBatsman) break;

      ensureBatsmanEntry(matchState, newBatsman.trim());
      matchState.striker = newBatsman;

      matchState.actualBattingOrder.push(newBatsman.trim());

      commentaryText += `🏏 **${newBatsman}** walks out to the crease\n`;
      await overMessage.edit(commentaryText);
      await sleep(1500);

      let phase = overNumber < 6 ? "pp" : overNumber < 15 ? "middle" : "death";
      if (!matchState.bowlerPhases) matchState.bowlerPhases = new Map();
      const bowlerPhaseStats = matchState.bowlerPhases.get(bowlerName) || { pp: 0, middle: 0, death: 0 };
      bowlerPhaseStats[phase]++;
      matchState.bowlerPhases.set(bowlerName, bowlerPhaseStats);

      ballsBowled++;
      isFreeHit = false;
      continue;
    }

    // ─────────── NORMAL RUNS ───────────
    if (outcome.type === "run") {
      matchState.partnershipRuns += outcome.runs;
      matchState.partnershipBalls++;

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

      // Use ensureBatsmanEntry so pace/spin fields are always present
      const strikerKey = ensureBatsmanEntry(matchState, strikerName);
      const bs = matchState.batsmanStats[strikerKey];

      bs.runs += outcome.runs;
      bs.balls++;

      // Pace / spin breakdown for every normal delivery
      if (bowlerType === "pace") { bs.runsVsPace += outcome.runs; bs.ballsVsPace++; }
      else if (bowlerType === "spin") { bs.runsVsSpin += outcome.runs; bs.ballsVsSpin++; }

      if (outcome.runs === 4) bs.fours++;
      if (outcome.runs === 6) bs.sixes++;

      const comment = getCommentary(outcome.runs, false);
      let momentumText = "";
      if (momentumFactors.bowler >= 10) momentumText = " 🔥 Bowler on fire!";
      else if (momentumFactors.batsman >= 15) momentumText = " 💪 Batsman in full flow!";
      commentaryText += `\`${ballDisplay}\` ${bowlerName} to ${strikerName} | ${outcome.runs} run(s) | ${comment}${momentumText}\n`;
      commentaryText += `📊 Score: **${matchState.runs}/${matchState.wickets}**\n`;
      ballEvents.push(getBallSymbol(outcome.runs, false, null));
      await overMessage.edit(commentaryText);

      if (outcome.runs % 2 === 1) {
        [matchState.striker, matchState.nonStriker] = [matchState.nonStriker, matchState.striker];
      }

      ballsBowled++;
      isFreeHit = false;
      await sleep(1000);
    }
  }

  // End of over: swap strike
  if (ballsBowled === 6 && matchState.wickets < 10 && (!target || matchState.runs < target)) {
    [matchState.striker, matchState.nonStriker] = [matchState.nonStriker, matchState.striker];
  }

  // --- OVER SUMMARY ---
  commentaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  const ballString = ballEvents.join(" | ");
  commentaryText += `📈 **Over ${displayOverNumber} Summary:** ${overRuns} runs, ${overWickets} wickets | [ ${ballString} ] \n`;
  const currentBowlerStats = matchState.bowlerStats.get(bowlerName);
  if (currentBowlerStats) {
    const bowlerEcon = (currentBowlerStats.runs / currentBowlerStats.overs).toFixed(2);
    commentaryText += `🎯 **${bowlerName}:** ${currentBowlerStats.overs}.0-${currentBowlerStats.runs}-${currentBowlerStats.wickets} (Econ: ${bowlerEcon})\n`;
  }

  const strikerStats = matchState.batsmanStats[matchState.striker.toLowerCase().trim()] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  const nonStrikerStats = matchState.batsmanStats[matchState.nonStriker.toLowerCase().trim()] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  commentaryText += `📊 **${matchState.battingTeam.teamName}:** ${matchState.runs}/${matchState.wickets} (${displayOverNumber} overs)\n`;
  commentaryText += `🏏 **${matchState.striker}:** ${strikerStats.runs}* off ${strikerStats.balls} balls`;
  if (strikerStats.fours > 0) commentaryText += ` (${strikerStats.fours}×4)`;
  if (strikerStats.sixes > 0) commentaryText += ` (${strikerStats.sixes}×6)`;
  commentaryText += `\n`;
  commentaryText += `🏏 **${matchState.nonStriker}:** ${nonStrikerStats.runs} off ${nonStrikerStats.balls} balls`;
  if (nonStrikerStats.fours > 0) commentaryText += ` (${nonStrikerStats.fours}×4)`;
  if (nonStrikerStats.sixes > 0) commentaryText += ` (${nonStrikerStats.sixes}×6)`;
  commentaryText += `\n`;
  commentaryText += `🤝 **Partnership:** ${matchState.partnershipRuns} runs (${matchState.partnershipBalls} balls)\n`;

  if (matchState.lastWicket && matchState.wickets > 0) {
    const lw = matchState.lastWicket;
    commentaryText += `💀 **Last Wicket:** ${lw.batsman} b ${lw.bowler} ${lw.runs}(${lw.balls}) | Partnership: ${lw.partnershipRuns} runs\n`;
  }

  if (target) {
    commentaryText += `\n${getRequiredMessage(target, matchState.runs, overNumber, 6)}\n`;
  }
  commentaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  await overMessage.edit(commentaryText);
  return { inningsComplete: false, overRuns, overWickets };
}

function getMomentumFactors(overState, ballNumber) {
  const { runsInOver, wicketsInOver, consecutiveDots, consecutiveBoundaries, lastBallWasBoundary } = overState;
  let bowlerMomentum = 0, batsmanMomentum = 0;
  if (consecutiveDots >= 2) bowlerMomentum += 5;
  if (consecutiveDots >= 3) bowlerMomentum += 8;
  if (consecutiveDots >= 4) bowlerMomentum += 12;
  if (consecutiveBoundaries >= 1) batsmanMomentum += 10;
  if (consecutiveBoundaries >= 2) batsmanMomentum += 20;
  if (wicketsInOver > 0) bowlerMomentum += 15 * wicketsInOver;
  if (runsInOver >= 15) bowlerMomentum -= 10;
  if (runsInOver >= 20) bowlerMomentum -= 20;
  if (lastBallWasBoundary) batsmanMomentum += 15;
  return { bowlerMomentum, batsmanMomentum };
}

module.exports = { playOver };