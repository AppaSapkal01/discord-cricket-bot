const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { google } = require("googleapis");

const { PRIVATE_PLAYERS_SPREADSHEET_ID } = process.env;

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stadium-analysis")
    .setDescription("Show detailed statistics for a stadium")
    .addStringOption(opt =>
      opt.setName("name")
        .setDescription("Stadium name")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const stadiumNameInput = interaction.options.getString("name").trim();

    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
        range: "Stadium DB!A2:R",
      });

      const rows = res.data.values || [];
      if (rows.length === 0) {
        return interaction.editReply("❌ No stadium data found.");
      }

      let stadiumRow = null;
      for (const row of rows) {
        if (row[0] && row[0].toString().trim().toLowerCase() === stadiumNameInput.toLowerCase()) {
          stadiumRow = row;
          break;
        }
      }

      if (!stadiumRow) {
        return interaction.editReply(`❌ Stadium "${stadiumNameInput}" not found.`);
      }

      const name = stadiumRow[0]?.trim() || "Unknown";
      const type = stadiumRow[2]?.trim() || "Neutral";
      const matches = parseInt(stadiumRow[4]) || 0;
      const firstInningsCumulative = parseInt(stadiumRow[5]) || 0;
      const secondInningsCumulative = parseInt(stadiumRow[6]) || 0;
      const totalWickets = parseInt(stadiumRow[10]) || 0;
      const pacerWickets = parseInt(stadiumRow[11]) || 0;
      const spinnerWickets = parseInt(stadiumRow[12]) || 0;
      const defendWins = parseInt(stadiumRow[13]) || 0;
      const chaseWins = parseInt(stadiumRow[14]) || 0;
      const highestChase = parseInt(stadiumRow[15]) || 0;
      const highestTotal = parseInt(stadiumRow[16]) || 0;
      const lowestTotal = parseInt(stadiumRow[17]) || 0;

      const avgFirstInnings = matches > 0 ? Math.round(firstInningsCumulative / matches) : 0;
      const avgSecondInnings = matches > 0 ? Math.round(secondInningsCumulative / matches) : 0;

      const totalWins = defendWins + chaseWins;
      const defendPercent = totalWins > 0 ? Math.round((defendWins / totalWins) * 100) : 0;
      const chasePercent = totalWins > 0 ? Math.round((chaseWins / totalWins) * 100) : 0;

      const pacerPercent = totalWickets > 0 ? Math.round((pacerWickets / totalWickets) * 100) : 0;
      const spinnerPercent = totalWickets > 0 ? Math.round((spinnerWickets / totalWickets) * 100) : 0;

      // Build embed description
      const description = 
        `Type: ${type}\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `⚔️ Total Matches: ${matches}\n` +
        `📊 Avg 1st Inns Total : ${avgFirstInnings}\n` +
        `📊 Avg 2nd Inns Total : ${avgSecondInnings}\n\n` +
        `🏆 Highest Total : ${highestTotal}\n` +
        `📉 Lowest Total : ${lowestTotal}\n` +
        `🎯 Highest Chase : ${highestChase}\n\n` +
        `📈 Defend Wins : ${defendWins} (${defendPercent}%)\n` +
        `🏃 Chase Wins : ${chaseWins} (${chasePercent}%)\n\n` +
        `⚔️ Pace Wicket : ${pacerWickets} W (${pacerPercent}%)\n` +
        `🌀 Spin Wicket : ${spinnerWickets} W (${spinnerPercent}%)`;

      const embed = new EmbedBuilder()
        .setColor(0x2E8B57) // Stadium green
        .setTitle(`${name} 🏟️`)
        .setDescription(description)
        .setFooter({ text: "Stadium Analysis" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Stadium analysis error:", error);
      await interaction.editReply("❌ Failed to fetch stadium analysis. Please try again later.");
    }
  },
};