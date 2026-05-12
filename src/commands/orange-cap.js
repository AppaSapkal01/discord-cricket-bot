const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { google } = require("googleapis");

const { PLAYERS_STATS_SPREADSHEET_ID } = process.env;

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

function getRankEmoji(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  if (rank === 10) return "🔟";
  return `${rank}️⃣`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("orange-cap")
    .setDescription("Show top 10 run‑scorers (Orange Cap leaderboard)"),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: PLAYERS_STATS_SPREADSHEET_ID,
        range: "Orange!A2:F",
      });

      const rows = res.data.values || [];
      if (rows.length === 0) {
        return interaction.editReply("❌ No data found in Orange sheet.");
      }

      const players = rows.map(row => {
        const name = row[0]?.trim() || "Unknown";
        const matches = parseInt(row[2]) || 0;
        const runs = parseInt(row[3]) || 0;
        const balls = parseInt(row[4]) || 0;
        const notOuts = parseInt(row[5]) || 0;
        const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(2) : "0.00";
        const dismissals = Math.max(matches - notOuts, 1);
        const average = (runs / dismissals).toFixed(2);
        return { name, matches, runs, strikeRate, average };
      });

      players.sort((a, b) => b.runs - a.runs);
      const top10 = players.slice(0, 10);

      let description = "";
      for (let i = 0; i < top10.length; i++) {
        const p = top10[i];
        const rank = i + 1;
        const emoji = getRankEmoji(rank);
        description += `${emoji} **${p.name}** — ${p.runs} Runs | ${p.matches}M | SR ${p.strikeRate} | AVG ${p.average}\n\n`;
      }
      description += "🔥 The Orange Cap battle is ON!";

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle("🟠 ORANGE CAP LEADERBOARD 🟠")
        .setDescription(description)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Orange Cap error:", error);
      await interaction.editReply("❌ Failed to fetch Orange Cap data. Please try again later.");
    }
  },
};