const { SlashCommandBuilder } = require("discord.js");
const { getPositionStats } = require("../services/playerStatsService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats-position")
    .setDescription("Show batting stats of a player at a specific batting position")
    .addStringOption(option =>
      option.setName("player")
        .setDescription("Exact player name")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("position")
        .setDescription("Batting position (1-11)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(11)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const playerName = interaction.options.getString("player");
    const position = interaction.options.getInteger("position");

    const stats = await getPositionStats(playerName, position);

    if (!stats) {
      return interaction.editReply(`❌ No data found for player **${playerName}** at position **${position}**.`);
    }

    // Format the stats line exactly like the example
    const statsLine = `Matches: ${stats.matches}, Runs: ${stats.runs}, Avg: ${stats.average}, SR: ${stats.strikeRate}`;

    const message = `📊 **Batting Stats for ${stats.playerName} at Position #${position}**\n\`\`\`yaml\n--- T20 Stats ---\n${statsLine}\n\`\`\``;

    await interaction.editReply(message);
  }
};