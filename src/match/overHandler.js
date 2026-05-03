// match/overHandler.js
const { simulateBall } = require("../engine/matchEngine");
const { selectBowlerForOver, selectNextBatsman, getAvailableBowlers } = require("./selectionHandler");
const matchManager = require("../managers/matchManager");

const sleep = ms => new Promise(r => setTimeout(r, ms));

const commentary = {
  0: ["Dot ball! Good delivery.", "No run there.", "Defended solidly.", "Beaten! No run.", "Excellent bowling!", "Played straight to fielder."],
  1: ["Quick single taken.", "Tap and run, they get one.", "Easy single to rotate strike.", "Just a single, good cricket.", "They scamper through for one!"],
  2: ["Good running, two runs!", "Well placed, couple of runs.", "They'll take two, excellent running.", "Hard running gives them two."],
  3: ["Excellent running, three runs!", "Hard running gives them three!", "They push hard for three!", "Great commitment for three!"],
  4: ["FOUR! Cracked to the boundary!", "Beautiful timing! Races away for four!", "Smashed through covers for four!", "That's a classy shot for four!"],
  6: ["SIX! Out of the park!", "Huge hit! Maximum!", "Clean strike! Gone all the way!", "What a strike! Into the stands!"],
  wicket: ["OUT! Bowled him!", "CAUGHT! Big wicket!", "TIMBER! Middle stump flattened!", "LBW! The umpire agrees!", "Gone! Huge breakthrough!"]
};

function getCommentary(runs, isWicket = false) {
  if (isWicket) return commentary.wicket[Math.floor(Math.random() * commentary.wicket.length)];
  const key = runs === 0 ? 0 : runs >= 4 ? (runs === 4 ? 4 : 6) : runs;
  return commentary[key][Math.floor(Math.random() * commentary[key].length)];
}

function getBallSymbol(runs, isWicket) {
  if (isWicket) return "W";
  if (runs === 0) return "0";
  return runs.toString();
}

async function playOver(interaction, matchState, playersMap, stadium, overNumber, inningNumber, target, channelId) {
  const match = matchManager.getMatch(channelId);
  if (!match || !match.isActive || match.stopped) {
    return { endReason: "match_stopped" };
  }

  if (!matchState.bowlerOvers) matchState.bowlerOvers = new Map();
  if (!matchState.bowlerStats) matchState.bowlerStats = new Map();
  if (!matchState.dismissedBatsmen) matchState.dismissedBatsmen = new Set();

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

  const bowlerName = await selectBowlerForOver(
    interaction, availableBowlers, overNumber, inningNumber, matchState, playersMap
  );

  if (!bowlerName) return { endReason: "match_stopped" };

  const bowler = playersMap.get(bowlerName.toLowerCase().trim());

  if (!matchState.bowlerStats.has(bowlerName)) {
    matchState.bowlerStats.set(bowlerName, { name: bowlerName, runs: 0, wickets: 0, overs: 0 });
  }
  const bowlerStats = matchState.bowlerStats.get(bowlerName);
  bowlerStats.overs++;
  matchState.bowlerOvers.set(bowlerName, bowlerStats.overs);
  matchState.lastBowler = bowlerName;

  const displayOverNumber = overNumber - 1;
  let commentaryText = `\n🎯 **Over ${overNumber}** - ${bowlerName} comes into bowl\n`;
  commentaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  const overMessage = await interaction.channel.send(commentaryText);
  
  let ballEvents = [];
  let overRuns = 0;
  let overWickets = 0;

  for (let ball = 1; ball <= 6; ball++) {
    const currentMatch = matchManager.getMatch(channelId);
    if (!currentMatch || !currentMatch.isActive || currentMatch.stopped) {
      return { endReason: "match_stopped" };
    }
    if (matchState.wickets >= 10) break;
    if (target && matchState.runs >= target) break;

    const strikerName = matchState.battingOrder[matchState.strikerIdx];
    const striker = playersMap.get(strikerName.toLowerCase().trim());
    
    const isPacer = (bowler.role || "").toLowerCase().includes("fast") || (bowler.role || "").toLowerCase().includes("pace");
    const speed = isPacer ? (Math.random() * 35 + 120).toFixed(1) : (Math.random() * 40 + 70).toFixed(1);

    const outcome = simulateBall(striker, bowler, stadium, overNumber);

    const ballDisplay = `${displayOverNumber}.${ball}`;

    if (outcome.type === "wicket") {
      matchState.wickets++;
      overWickets++;
      const comment = getCommentary(0, true);
      
      commentaryText += `\`${ballDisplay}\` ${bowlerName} to ${strikerName} (${speed} km/h) | **WICKET!** ${comment}\n`;
      commentaryText += `📊 Score: **${matchState.runs}/${matchState.wickets}**\n`;
      
      ballEvents.push(getBallSymbol(0, true));
      bowlerStats.wickets++;
      
      // Mark batsman as dismissed
      matchState.dismissedBatsmen.add(strikerName);
      
      const strikerKey = strikerName.toLowerCase().trim();
      const wicketRuns = matchState.batsmanStats[strikerKey]?.runs || 0;
      const wicketBalls = matchState.batsmanStats[strikerKey]?.balls || 0;
      
      matchState.lastWicket = {
        batsman: strikerName,
        bowler: bowlerName,
        runs: wicketRuns,
        balls: wicketBalls
      };
      matchState.partnershipRuns = 0;
      matchState.partnershipBalls = 0;

      await overMessage.edit(commentaryText);
      await sleep(1500);

      if (matchState.wickets >= 10) break;

      const remaining = matchState.battingOrder.slice(matchState.nextBatsmanIdx);
      const newBatsman = await selectNextBatsman(
        interaction, remaining, overNumber, inningNumber, matchState
      );

      if (!newBatsman) return { endReason: "match_stopped" };

      // New batsman comes in at striker's position
      matchState.battingOrder[matchState.strikerIdx] = newBatsman;
      matchState.nextBatsmanIdx++;
      
      if (!matchState.batsmanStats[newBatsman.toLowerCase().trim()]) {
        matchState.batsmanStats[newBatsman.toLowerCase().trim()] = { 
          name: newBatsman, runs: 0, balls: 0, fours: 0, sixes: 0 
        };
      }

      commentaryText += `🏏 **${newBatsman}** walks out to the crease\n`;
      await overMessage.edit(commentaryText);
      await sleep(1500);
      
      // After wicket, new batsman is on strike (strikerIdx stays same)
      continue;
    }

    // Normal run
    matchState.runs += outcome.runs;
    overRuns += outcome.runs;
    matchState.partnershipRuns += outcome.runs;
    matchState.partnershipBalls++;
    
    const strikerKey = strikerName.toLowerCase().trim();
    if (!matchState.batsmanStats[strikerKey]) {
      matchState.batsmanStats[strikerKey] = { name: strikerName, runs: 0, balls: 0, fours: 0, sixes: 0 };
    }
    matchState.batsmanStats[strikerKey].runs += outcome.runs;
    matchState.batsmanStats[strikerKey].balls++;
    if (outcome.runs === 4) matchState.batsmanStats[strikerKey].fours++;
    if (outcome.runs === 6) matchState.batsmanStats[strikerKey].sixes++;
    
    bowlerStats.runs += outcome.runs;
    
    const comment = getCommentary(outcome.runs, false);
    
    commentaryText += `\`${ballDisplay}\` ${bowlerName} to ${strikerName} (${speed} km/h) | ${outcome.runs} run(s) | ${comment}\n`;
    commentaryText += `📊 Score: **${matchState.runs}/${matchState.wickets}**\n`;
    
    ballEvents.push(getBallSymbol(outcome.runs, false));

    await overMessage.edit(commentaryText);

    // STRIKE ROTATION RULES:
    // On odd runs (1,3): batsmen swap strike
    // On even runs (0,2,4,6): stay on same strike
    if (outcome.runs % 2 === 1) {
      [matchState.strikerIdx, matchState.nonStrikerIdx] = [matchState.nonStrikerIdx, matchState.strikerIdx];
    }

    await sleep(1500);
  }

  // END OF OVER SUMMARY
  commentaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  const ballString = ballEvents.join(" | ");
  commentaryText += `📈 **Over ${overNumber} Summary:** ${overRuns} runs, ${overWickets} wickets | [ ${ballString} ]\n`;
  
  const strikerName = matchState.battingOrder[matchState.strikerIdx];
  const nonStrikerName = matchState.battingOrder[matchState.nonStrikerIdx];
  
  const strikerStats = matchState.batsmanStats[strikerName.toLowerCase().trim()] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  const nonStrikerStats = matchState.batsmanStats[nonStrikerName.toLowerCase().trim()] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  
  commentaryText += `📊 **${matchState.battingTeam.teamName}:** ${matchState.runs}/${matchState.wickets} (${overNumber} overs)\n`;
  commentaryText += `🏏 **${strikerName}:** ${strikerStats.runs} off ${strikerStats.balls} balls`;
  if (strikerStats.fours > 0) commentaryText += ` (${strikerStats.fours} fours)`;
  if (strikerStats.sixes > 0) commentaryText += ` (${strikerStats.sixes} sixes)`;
  commentaryText += `\n`;
  commentaryText += `🏏 **${nonStrikerName}:** ${nonStrikerStats.runs} off ${nonStrikerStats.balls} balls`;
  if (nonStrikerStats.fours > 0) commentaryText += ` (${nonStrikerStats.fours} fours)`;
  if (nonStrikerStats.sixes > 0) commentaryText += ` (${nonStrikerStats.sixes} sixes)`;
  commentaryText += `\n`;
  
  commentaryText += `🤝 **Partnership:** ${matchState.partnershipRuns} runs (${matchState.partnershipBalls} balls)\n`;
  
  if (matchState.lastWicket && matchState.wickets > 0) {
    const lastWicket = matchState.lastWicket;
    commentaryText += `💀 **Last Wicket:** ${lastWicket.batsman} b ${lastWicket.bowler} ${lastWicket.runs}(${lastWicket.balls})\n`;
  }
  
  commentaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  await overMessage.edit(commentaryText);

  // END OF OVER STRIKE SWAP:
  // After over completes, swap strike if last ball was odd run
  // But if last ball was wicket, new batsman is already on strike
  // If last ball was even run (0,2,4,6), strike stays same
  // The strike rotation during the over already handled odd/even runs
  // So no additional swap needed here
  
  return { inningsComplete: false, overRuns, overWickets };
}

module.exports = { playOver };