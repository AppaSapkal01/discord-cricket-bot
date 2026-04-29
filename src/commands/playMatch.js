const { SlashCommandBuilder } = require("discord.js");
const {
  getTeamByName,
  getAllPlayers,
  updatePlayerForms,
  saveMatchResult
} = require("../services/sheets");

const { simulateInnings } = require("../engine/matchEngine");
const { validateTeam } = require("../utils/validator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play-match")
    .setDescription("Simulate a full cricket match")
    .addStringOption(option =>
      option
        .setName("team_a")
        .setDescription("Enter Team A name (e.g., MI)")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("team_b")
        .setDescription("Enter Team B name (e.g., RCB)")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const teamAName = interaction.options.getString("team_a");
      const teamBName = interaction.options.getString("team_b");

      // ✅ FETCH TEAMS
      const teamA = await getTeamByName(teamAName);
      const teamB = await getTeamByName(teamBName);

      if (!teamA) return interaction.editReply(`❌ Team ${teamAName} not found`);
      if (!teamB) return interaction.editReply(`❌ Team ${teamBName} not found`);

      // ✅ FETCH PLAYERS DB
      const players = await getAllPlayers();

      // 🔑 Normalize player names (IMPORTANT FIX)
      const map = new Map(
        players.map(p => [
          p.name.toLowerCase().trim(),
          { ...p, name: p.name.trim() }
        ])
      );

      // ✅ VALIDATE TEAMS
      const valA = validateTeam(teamA, map);
      const valB = validateTeam(teamB, map);

      if (!valA.ok) return interaction.editReply(`❌ ${teamA.teamName}: ${valA.reason}`);
      if (!valB.ok) return interaction.editReply(`❌ ${teamB.teamName}: ${valB.reason}`);

      // 🎬 MATCH START
      await interaction.editReply(`🏏 ${teamA.teamName} vs ${teamB.teamName} started!`);

      // =========================
      // 🥇 FIRST INNINGS
      // =========================
      await interaction.followUp(`🏏 ${teamA.teamName} batting first`);

      const inningsA = simulateInnings(teamA.players, map);

      // SEND COMMENTARY (IN CHUNKS)
      for (let i = 0; i < inningsA.commentary.length; i += 6) {
        await interaction.followUp(
          inningsA.commentary.slice(i, i + 6).join("\n")
        );
      }

      await interaction.followUp(
        `📊 ${teamA.teamName}: ${inningsA.runs}/${inningsA.wickets}`
      );

      // =========================
      // 🥈 SECOND INNINGS (CHASE)
      // =========================
      const target = inningsA.runs + 1;

      await interaction.followUp(
        `🏏 ${teamB.teamName} chasing ${target}`
      );

      const inningsB = simulateInnings(teamB.players, map, target);

      for (let i = 0; i < inningsB.commentary.length; i += 6) {
        await interaction.followUp(
          inningsB.commentary.slice(i, i + 6).join("\n")
        );
      }

      await interaction.followUp(
        `📊 ${teamB.teamName}: ${inningsB.runs}/${inningsB.wickets}`
      );

      // =========================
      // 🏆 RESULT
      // =========================
      let winner;

      if (inningsB.runs >= target) {
        winner = teamB.teamName;
      } else {
        winner = teamA.teamName;
      }

      await interaction.followUp(`🏆 Winner: ${winner}`);

      // =========================
      // 💾 SAVE RESULT TO SHEET
      // =========================
      await saveMatchResult({
        teamA: teamA.teamName,
        teamB: teamB.teamName,
        scoreA: inningsA.runs,
        scoreB: inningsB.runs,
        winner,
      });

      // =========================
      // 🔄 UPDATE PLAYER FORM
      // =========================
      players.forEach(p => {
        p.form = Math.max(
          0,
          Math.min(100, p.form + (Math.random() * 6 - 3))
        );
      });

      await updatePlayerForms(players);

    } catch (err) {
      console.error("MATCH ERROR:", err);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ Match crashed. Check logs.");
      } else {
        await interaction.reply("❌ Match crashed.");
      }
    }
  },
};