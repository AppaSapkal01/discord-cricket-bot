const { SlashCommandBuilder } = require("discord.js");
const { getTeamByName, getAllPlayers, getRandomStadium, getStadiumByName, saveMatchResult, updateStadiumStats } = require("../services/sheets");
const { validateTeam } = require("../utils/validator");
const { handleToss } = require("../match/tossHandler");
const { selectOpeners } = require("../match/selectionHandler");
const { simulateInnings } = require("../match/inningsHandler");
const { saveAndAnnounceResult } = require("../match/resultHandler");
const matchManager = require("../managers/matchManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play-match")
    .setDescription("Start an interactive cricket match")
    .addStringOption(opt => opt.setName("team_a").setDescription("Your team name").setRequired(true))
    .addStringOption(opt => opt.setName("team_b").setDescription("Opponent team name").setRequired(true))
    .addStringOption(opt => opt.setName("stadium").setDescription("Stadium name (optional)").setRequired(false)),

  async execute(interaction) {
    const channel = interaction.channel;
    try {
      await interaction.deferReply();
      if (matchManager.getMatch(interaction.channelId)) matchManager.deleteMatch(interaction.channelId);

      const teamAName = interaction.options.getString("team_a");
      const teamBName = interaction.options.getString("team_b");
      const stadiumInput = interaction.options.getString("stadium");

      const teamA = await getTeamByName(teamAName);
      const teamB = await getTeamByName(teamBName);
      if (!teamA) return interaction.editReply(`❌ Team "${teamAName}" not found`);
      if (!teamB) return interaction.editReply(`❌ Team "${teamBName}" not found`);

      let stadium;
      if (stadiumInput) {
        stadium = await getStadiumByName(stadiumInput);
        if (!stadium) return interaction.editReply(`❌ Stadium "${stadiumInput}" not found`);
      } else {
        stadium = await getRandomStadium();
        if (!stadium) return interaction.editReply(`❌ No stadiums found`);
      }

      const allPlayers = await getAllPlayers();
      const playersMap = new Map(allPlayers.map(p => [p.name.toLowerCase().trim(), p]));

      const valA = await validateTeam(teamA, allPlayers);
      const valB = await validateTeam(teamB, allPlayers);
      if (!valA.ok) return interaction.editReply(`❌ ${teamA.teamName}: ${valA.reason}`);
      if (!valB.ok) return interaction.editReply(`❌ ${teamB.teamName}: ${valB.reason}`);

      const matchMessage = await interaction.editReply(
        `🏏 **${teamA.teamName} vs ${teamB.teamName}**
📍 Stadium: ${stadium.name} (${stadium.type})
🌍 Location: ${stadium.country}

Starting T20 match between ${teamA.teamName} and ${teamB.teamName} at ${stadium.name}!`
      );

      const { tossWinnerTeam, tossDecision } = await handleToss(interaction, teamA, teamB, stadium, matchMessage);

      let battingTeam, bowlingTeam;
      if (tossDecision === "bat") {
        battingTeam = tossWinnerTeam;
        bowlingTeam = tossWinnerTeam.teamName === teamA.teamName ? teamB : teamA;
      } else {
        bowlingTeam = tossWinnerTeam;
        battingTeam = tossWinnerTeam.teamName === teamA.teamName ? teamB : teamA;
      }

      let content = matchMessage.content;
      content += `\n\n🏏 **${battingTeam.teamName} will bat first**\n🧤 **${bowlingTeam.teamName} will bowl**`;
      await matchMessage.edit({ content });

      const matchState = {
        teamA, teamB,
        battingTeam, bowlingTeam,
        battingUser: battingTeam.owner,
        bowlingUser: bowlingTeam.owner,
        stadium,
        target: null,
        currentInnings: 1,
        maxOvers: 20,
        isActive: true,
        stopped: false,
        channelId: interaction.channelId,
        runs: 0,
        wickets: 0,
        partnershipRuns: 0,
        partnershipBalls: 0,
        lastWicket: null,
        currentOver: 0,
        batsmanStats: {},
        bowlerStats: new Map(),
        bowlerOvers: new Map(),
        lastBowler: null,
        dismissedBatsmen: new Set(),
        battingOrder: [],      // original immutable list (trimmed)
        striker: "",           // current batsman on strike
        nonStriker: "",        // current non‑striker
        hasBatted: new Set(),  // every player who has walked to crease (trimmed)
        teamABattedFirst: (battingTeam.teamName === teamA.teamName),
        actualBattingOrder: []
      };

      matchManager.createMatch(interaction.channelId, matchState);

      const openers = await selectOpeners(interaction, battingTeam, 1);
      const currentMatch = matchManager.getMatch(interaction.channelId);
      if (!currentMatch || !currentMatch.isActive || currentMatch.stopped || !openers) {
        await channel.send("🛑 Match was stopped.");
        return;
      }


      // Initialise immutable batting order and current batsmen
      matchState.battingOrder = [
        openers[0].trim(),
        openers[1].trim(),
        ...battingTeam.players.filter(
          p => p.trim() !== openers[0].trim() && p.trim() !== openers[1].trim()
        ).map(p => p.trim())
      ];
      matchState.striker = openers[0].trim();
      matchState.nonStriker = openers[1].trim();
      matchState.actualBattingOrder = [openers[0].trim(), openers[1].trim()];

      matchState.hasBatted = new Set([openers[0].trim(), openers[1].trim()]);

      // Initialise batsman stats
      matchState.battingOrder.forEach(name => {
        const key = name.toLowerCase().trim();
        if (!matchState.batsmanStats[key]) {
          matchState.batsmanStats[key] = { name, runs: 0, balls: 0, fours: 0, sixes: 0 };
        }
      });

      matchManager.updateMatch(interaction.channelId, matchState);

      await channel.send(`🥇 **INNINGS 1: ${battingTeam.teamName} batting**`);
      const innings1 = await simulateInnings(interaction, matchState, playersMap, stadium, 1, null);

      const matchAfterInnings1 = matchManager.getMatch(interaction.channelId);
      if (!matchAfterInnings1 || !matchAfterInnings1.isActive || matchAfterInnings1.stopped) {
        matchManager.deleteMatch(interaction.channelId);
        await channel.send("🛑 Match was stopped.");
        return;
      }

      const innings1Stats = {
        runs: innings1.runs,
        wickets: innings1.wickets,
        overs: innings1.overs,
        batsmanStats: { ...innings1.batsmanStats },
        bowlerStats: new Map(innings1.bowlerStats),
        battingOrder: innings1.battingOrder
      };
      await channel.send(`📊 **${battingTeam.teamName}:** ${innings1.runs}/${innings1.wickets} (${innings1.overs} overs)`);

      // INNINGS 2
      const target = innings1.runs + 1;
      const newBattingTeam = bowlingTeam;
      const newBowlingTeam = battingTeam;
      await channel.send(`🥈 **INNINGS 2: ${newBattingTeam.teamName} needs ${target} runs to win`);

      // Reset match state for second innings
      matchState.battingTeam = newBattingTeam;
      matchState.bowlingTeam = newBowlingTeam;
      matchState.battingUser = newBattingTeam.owner;
      matchState.bowlingUser = newBowlingTeam.owner;
      matchState.target = target;
      matchState.currentInnings = 2;
      matchState.runs = 0;
      matchState.wickets = 0;
      matchState.partnershipRuns = 0;
      matchState.partnershipBalls = 0;
      matchState.lastWicket = null;
      matchState.currentOver = 0;
      matchState.batsmanStats = {};
      matchState.bowlerStats.clear();
      matchState.bowlerOvers.clear();
      matchState.lastBowler = null;
      matchState.dismissedBatsmen.clear();
      matchState.hasBatted.clear();
      matchState.actualBattingOrder = []

      const newOpeners = await selectOpeners(interaction, newBattingTeam, 2);
      const matchBeforeInnings2 = matchManager.getMatch(interaction.channelId);
      if (!matchBeforeInnings2 || !matchBeforeInnings2.isActive || matchBeforeInnings2.stopped || !newOpeners) {
        matchManager.deleteMatch(interaction.channelId);
        await channel.send("🛑 Match was stopped.");
        return;
      }

      matchState.battingOrder = [
        newOpeners[0].trim(),
        newOpeners[1].trim(),
        ...newBattingTeam.players.filter(p => p.trim() !== newOpeners[0].trim() && p.trim() !== newOpeners[1].trim()).map(p => p.trim())
      ];
      matchState.striker = newOpeners[0].trim();
      matchState.nonStriker = newOpeners[1].trim();
      matchState.actualBattingOrder = [newOpeners[0].trim(), newOpeners[1].trim()];
      matchState.hasBatted = new Set([newOpeners[0].trim(), newOpeners[1].trim()]);

      matchState.battingOrder.forEach(name => {
        const key = name.toLowerCase().trim();
        if (!matchState.batsmanStats[key]) {
          matchState.batsmanStats[key] = { name, runs: 0, balls: 0, fours: 0, sixes: 0 };
        }
      });

      const innings2 = await simulateInnings(interaction, matchState, playersMap, stadium, 2, target);

      const matchAfterInnings2 = matchManager.getMatch(interaction.channelId);
      if (!matchAfterInnings2 || !matchAfterInnings2.isActive || matchAfterInnings2.stopped) {
        matchManager.deleteMatch(interaction.channelId);
        await channel.send("🛑 Match was stopped.");
        return;
      }

      const innings2Stats = {
        runs: innings2.runs,
        wickets: innings2.wickets,
        overs: innings2.overs,
        batsmanStats: { ...innings2.batsmanStats },
        bowlerStats: new Map(innings2.bowlerStats),
        battingOrder: innings2.battingOrder
      };

      const { winner, wonBy } = await saveAndAnnounceResult(
        interaction, matchState, innings1Stats, innings2Stats, target, innings1.battingOrder, innings2.battingOrder
      );

      let teamAScore, teamAWickets, teamAOvers;
      let teamBScore, teamBWickets, teamBOvers;
      if (matchState.teamABattedFirst) {
        teamAScore = innings1.runs;
        teamAWickets = innings1.wickets;
        teamAOvers = innings1.overs;
        teamBScore = innings2.runs;
        teamBWickets = innings2.wickets;
        teamBOvers = innings2.overs;
      } else {
        teamAScore = innings2.runs;
        teamAWickets = innings2.wickets;
        teamAOvers = innings2.overs;
        teamBScore = innings1.runs;
        teamBWickets = innings1.wickets;
        teamBOvers = innings1.overs;
      }

      await saveMatchResult({
        teamA: teamA.teamName,
        teamB: teamB.teamName,
        scoreA: teamAScore,
        wicketsA: teamAWickets,
        oversA: teamAOvers,
        scoreB: teamBScore,
        wicketsB: teamBWickets,
        oversB: teamBOvers,
        winner,
        wonBy,
        ground: stadium.name,
        timestamp: Date.now()
      }).catch(err => console.error("Error saving match result:", err));


      // ========== UPDATE STADIUM STATISTICS ==========
      try {
        // First innings = innings1, Second innings = innings2 (always correct as per simulation flow)
        const firstInningsScore = innings1.runs;
        const secondInningsScore = innings2.runs;

        const totalWickets = innings1.wickets + innings2.wickets;

        // Classify wickets
        let pacerWickets = 0;
        let spinnerWickets = 0;
        const allBowlerStats = [
          ...innings1Stats.bowlerStats.entries(),
          ...innings2Stats.bowlerStats.entries()
        ];
        for (const [bowlerName, stats] of allBowlerStats) {
          const player = playersMap.get(bowlerName.toLowerCase().trim());
          if (!player) continue;
          const role = player.role.toLowerCase();
          if (role.includes('fast')) {
            pacerWickets += stats.wickets;
          } else if (role.includes('spin')) {
            spinnerWickets += stats.wickets;
          } else if (role.includes('allrounder')) {
            if (role.includes('fast')) pacerWickets += stats.wickets;
            else if (role.includes('spin')) spinnerWickets += stats.wickets;
            else spinnerWickets += stats.wickets; // default spinner
          }
        }

        // Defend = team batting first won, Chase = team batting second won
        const teamBattedFirst = matchState.teamABattedFirst ? teamA.teamName : teamB.teamName;
        const defendWin = (winner === teamBattedFirst);
        const chaseWin = !defendWin;

        const stadiumMatchData = {
          firstInningsScore,
          secondInningsScore,
          totalWickets,
          pacerWickets,
          spinnerWickets,
          defendWin,
          chaseWin,
        };

        await updateStadiumStats(stadium.name, stadiumMatchData);

      } catch (err) {
        console.error("Failed to update stadium stats:", err);
      }


      matchManager.deleteMatch(interaction.channelId);
      await channel.send(`✅ Match completed! Use \`/play-match\` again to start a new match.`);

      try {
        await interaction.editReply({ content: `🏏 Match underway! Final results posted above.` });
      } catch (editError) {
        console.log('Interaction token expired before match completion');
      }
    } catch (error) {
      console.error("Match error:", error);
      if (error.code === 50027) {
        try { await channel.send('❌ Match stopped due to timeout. Please start a new match.'); } catch (e) { }
      } else {
        try { await channel.send(`❌ Error: ${error.message}`).catch(async () => await channel.send(`❌ Error: ${error.message}`)); } catch (e) { await channel.send(`❌ Error: ${error.message}`); }
      }
      matchManager.deleteMatch(interaction.channelId);
    }
  }
};