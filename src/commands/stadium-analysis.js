const { SlashCommandBuilder } = require("discord.js");
const { google } = require("googleapis");

const { PRIVATE_PLAYERS_SPREADSHEET_ID } = process.env;

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

/**
 * Generate a descriptive stadium tagline based on match statistics
 */
function getStadiumDescriptor(avgFirstInnings, pacerPercent, spinnerPercent, defendPercent, chasePercent, matches) {
  if (matches === 0) return "Neutral • No Data Available";

  if (avgFirstInnings >= 180) return "Batting Paradise • High-Scoring";
  if (avgFirstInnings <= 140) return "Bowling Friendly • Low-Scoring";

  if (spinnerPercent > 60) return "Spin Haven • Slow Pitch";
  if (pacerPercent > 60) return "Pacer's Paradise • Quick Pitch";

  if (defendPercent >= 70) return "Defend Fortress";
  if (chasePercent >= 70) return "Chase Master • Dew Factor";

  return "Balanced Contest • Neutral";
}

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

      const descriptor = getStadiumDescriptor(avgFirstInnings, pacerPercent, spinnerPercent, defendPercent, chasePercent, matches);

      // Build the exact plain-text format
      const output = `🏟️ ${name}
(${descriptor})
─────────────────────────

📊 MATCH STATS
┣ Total Matches: ${matches}
┣ Avg 1st Inns: ${avgFirstInnings}
┣ Avg 2nd Inns: ${avgSecondInnings}
┣ Highest Total: ${highestTotal}
┣ Lowest Total: ${lowestTotal}
┣ Highest Chase: ${highestChase}

🏆 RESULTS
┣ Defend Wins: ${defendWins} (${defendPercent}%)
┣ Chase Wins: ${chaseWins} (${chasePercent}%)

🎯 BOWLING 
┣ Pace Wkts: ${pacerWickets} (${pacerPercent}%)
┗ Spin Wkts: ${spinnerWickets} (${spinnerPercent}%)`;

      await interaction.editReply(`\`\`\`\n${output}\n\`\`\``);
    } catch (error) {
      console.error("Stadium analysis error:", error);
      await interaction.editReply("❌ Failed to fetch stadium analysis. Please try again later.");
    }
  },
};