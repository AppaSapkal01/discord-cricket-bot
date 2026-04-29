const { SlashCommandBuilder } = require("discord.js");
const { getTeamByName } = require("../services/sheets");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("team")
    .setDescription("Get a cricket team by name")
    .addStringOption(option =>
      option.setName("name")
        .setDescription("Enter team name (e.g., MI, RCB)")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const teamName = interaction.options.getString("name");

      const team = await getTeamByName(teamName);

      if (!team) {
        return interaction.editReply("❌ Team not found!");
      }

      let msg = `🏏 **${team.teamName}**\n`;
      msg += `👤 Owner: ${team.owner}\n\n`;

      team.players.forEach((player, index) => {
        msg += `${index + 1}. ${player}\n`;
      });

      await interaction.editReply(msg);

    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Error fetching team");
    }
  }
};