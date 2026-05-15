const { createMatchSummaryEmbed, createInningsScorecardEmbed } = require("../utils/uiHelper");
const {
  updateBattingStats,
  updateBowlingStats,
  updatePositionStats,
} = require("../services/playerStatsService");

const {
  buildFinalScorecard
} = require("../utils/buildFinalScorecard");

async function saveAndAnnounceResult(interaction, matchState, innings1Stats, innings2Stats, target, battingOrder1, battingOrder2) {
  const { teamA, teamB, stadium } = matchState;

  let teamABattedFirst = matchState.teamABattedFirst;

  if (teamABattedFirst === undefined || teamABattedFirst === null) {
    const innings1FirstBatsman = Object.keys(innings1Stats.batsmanStats)[0];
    const isTeamABatsman = teamA.players.some(p => p.toLowerCase() === innings1FirstBatsman?.toLowerCase());
    teamABattedFirst = isTeamABatsman;
  }

  const innings1BattingTeam = teamABattedFirst ? teamA.teamName : teamB.teamName;
  const innings2BattingTeam = teamABattedFirst ? teamB.teamName : teamA.teamName;

  let winner, wonBy;
  if (innings2Stats.runs >= target) {
    winner = innings2BattingTeam;
    const wicketsLeft = 10 - innings2Stats.wickets;
    wonBy = `${wicketsLeft} wickets`;
  } else {
    winner = innings1BattingTeam;
    const runsMargin = target - 1 - innings2Stats.runs;
    wonBy = `${runsMargin} runs`;
  }

  // ---- Build batters with innings info ----
  const battersInnings1 = Object.values(innings1Stats.batsmanStats).map(b => ({
    ...b,
    innings: 1
  }));
  const battersInnings2 = Object.values(innings2Stats.batsmanStats).map(b => ({
    ...b,
    innings: 2
  }));
  const allBattersWithInnings = [...battersInnings1, ...battersInnings2];

 
  const validBatters = allBattersWithInnings.filter(b => b.name && b.name.trim() !== "");
  if (validBatters.length !== allBattersWithInnings.length) {
    console.warn(`Filtered out ${allBattersWithInnings.length - validBatters.length} batters due to missing name`);
  }

  // ---- Bowling data ----
  const innings1BowlingTeam = (innings1BattingTeam === teamA.teamName) ? teamB : teamA;
  const innings2BowlingTeam = (innings2BattingTeam === teamA.teamName) ? teamB : teamA;
  const innings1BowlingSquad = innings1BowlingTeam.players.map(p => p.trim());
  const innings2BowlingSquad = innings2BowlingTeam.players.map(p => p.trim());

  const bowlersInnings1 = Array.from(innings1Stats.bowlerStats.values()).map(b => ({
    name: b.name,
    overs: b.overs,
    runs: b.runs,
    wickets: b.wickets
  }));
  const bowlersInnings2 = Array.from(innings2Stats.bowlerStats.values()).map(b => ({
    name: b.name,
    overs: b.overs,
    runs: b.runs,
    wickets: b.wickets
  }));

  // Collect phase wickets from matchState
  const bowlingPhases = {};
  if (matchState.bowlerPhases) {
    for (const [name, phases] of matchState.bowlerPhases.entries()) {
      bowlingPhases[name.toLowerCase().trim()] = phases;
    }
  }

  const positionStats = [];

  // Innings 1
  for (let idx = 0; idx < battingOrder1.length; idx++) {
    const playerName = battingOrder1[idx];
    const key = playerName.toLowerCase().trim();
    const stats = innings1Stats.batsmanStats[key];
    if (stats && (stats.balls > 0 || stats.runs > 0)) {
      positionStats.push({
        name: playerName,
        position: idx + 1,
        runs: stats.runs || 0,
        balls: stats.balls || 0,
        out: stats.out === true
      });
    }
  }

  // Innings 2
  for (let idx = 0; idx < battingOrder2.length; idx++) {
    const playerName = battingOrder2[idx];
    const key = playerName.toLowerCase().trim();
    const stats = innings2Stats.batsmanStats[key];
    if (stats && (stats.balls > 0 || stats.runs > 0)) {
      positionStats.push({
        name: playerName,
        position: idx + 1,
        runs: stats.runs || 0,
        balls: stats.balls || 0,
        out: stats.out === true
      });
    }
  }

  // ---- Update stats with filtered data ----
  await updateBattingStats(validBatters, {});
  await updateBowlingStats(bowlersInnings1, innings1BowlingSquad, bowlingPhases);
  await updateBowlingStats(bowlersInnings2, innings2BowlingSquad, bowlingPhases);
  await updatePositionStats(positionStats);

  // ---- Send scorecards and summary (unchanged) ----
  const innings1ScorecardEmbed = createInningsScorecardEmbed(
    1, innings1BattingTeam, innings1Stats.runs, innings1Stats.wickets, innings1Stats.overs,
    innings1Stats.batsmanStats, innings1Stats.bowlerStats, null, battingOrder1
  );
  const innings2ScorecardEmbed = createInningsScorecardEmbed(
    2, innings2BattingTeam, innings2Stats.runs, innings2Stats.wickets, innings2Stats.overs,
    innings2Stats.batsmanStats, innings2Stats.bowlerStats, target, battingOrder2
  );
  await interaction.channel.send({ embeds: [innings1ScorecardEmbed] });
  await interaction.channel.send({ embeds: [innings2ScorecardEmbed] });

  const teamAObj = { teamName: innings1BattingTeam };
  const teamBObj = { teamName: innings2BattingTeam };
  const matchSummaryEmbed = createMatchSummaryEmbed(
    innings1Stats, innings2Stats, teamAObj, teamBObj, winner, wonBy, stadium
  );
  await interaction.channel.send({ embeds: [matchSummaryEmbed] });

  let winnerMessage = `\n🏆 **${winner} WINS!** 🏆\n`;
  winnerMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  winnerMessage += `✅ **${winner}** won by **${wonBy}**\n`;
  winnerMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  await interaction.channel.send(winnerMessage);

  return { winner, wonBy };
}

module.exports = {
  saveAndAnnounceResult
};