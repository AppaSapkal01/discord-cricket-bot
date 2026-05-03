// match/resultHandler.js
const { createMatchSummaryEmbed, createInningsScorecardEmbed } = require("../utils/uiHelper");

async function saveAndAnnounceResult(interaction, matchState, innings1Stats, innings2Stats, target) {
  const { teamA, teamB, stadium } = matchState;
  
  const battingTeamInnings2 = matchState.battingTeam;
  const bowlingTeamInnings2 = matchState.bowlingTeam;
  
  let winner, wonBy;
  
  if (innings2Stats.runs >= target) {
    winner = battingTeamInnings2.teamName;
    const wicketsLeft = 10 - innings2Stats.wickets;
    wonBy = `${wicketsLeft} wickets`;
  } else {
    winner = bowlingTeamInnings2.teamName;
    const runsMargin = target - 1 - innings2Stats.runs;
    wonBy = `${runsMargin} runs`;
  }
  
  // Show both innings scorecards before match summary
  const innings1ScorecardEmbed = createInningsScorecardEmbed(
    1, 
    teamA.teamName, 
    innings1Stats.runs, 
    innings1Stats.wickets, 
    innings1Stats.overs,
    innings1Stats.batsmanStats, 
    innings1Stats.bowlerStats
  );
  
  const innings2ScorecardEmbed = createInningsScorecardEmbed(
    2, 
    teamB.teamName, 
    innings2Stats.runs, 
    innings2Stats.wickets, 
    innings2Stats.overs,
    innings2Stats.batsmanStats, 
    innings2Stats.bowlerStats,
    target
  );
  
  await interaction.channel.send({ embeds: [innings1ScorecardEmbed] });
  await interaction.channel.send({ embeds: [innings2ScorecardEmbed] });
  
  // Create and send match summary embed with top performers
  const matchSummaryEmbed = createMatchSummaryEmbed(
    innings1Stats, innings2Stats, teamA, teamB, winner, wonBy, stadium
  );
  
  await interaction.channel.send({ embeds: [matchSummaryEmbed] });
  
  // Send winner announcement
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