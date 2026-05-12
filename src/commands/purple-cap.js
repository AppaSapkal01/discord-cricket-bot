const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { google } = require("googleapis");

const { PLAYERS_STATS_SPREADSHEET_ID } = process.env;

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

function oversToDecimal(oversStr) {
  if (!oversStr) return 0;
  const str = oversStr.toString();
  if (!str.includes(".")) return parseFloat(str);
  const [ov, balls] = str.split(".").map(Number);
  return ov + (balls / 6);
}

function getRankEmoji(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  if (rank === 10) return "🔟";
  return `${rank}️⃣`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("purple-cap")
    .setDescription("Show top 10 wicket‑takers (Purple Cap leaderboard)"),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: PLAYERS_STATS_SPREADSHEET_ID,
        range: "Purple!A2:F",
      });

      const rows = res.data.values || [];
      if (rows.length === 0) {
        return interaction.editReply("❌ No data found in Purple sheet.");
      }

      const players = rows.map(row => {
        const name = row[0]?.trim() || "Unknown";
        const matches = parseInt(row[2]) || 0;
        const oversRaw = row[3] || "0.0";
        const runs = parseInt(row[4]) || 0;
        const wickets = parseInt(row[5]) || 0;
        const oversDecimal = oversToDecimal(oversRaw);
        const economy = oversDecimal > 0 ? (runs / oversDecimal).toFixed(2) : "0.00";
        const average = wickets > 0 ? (runs / wickets).toFixed(2) : "0.00";
        return { name, matches, wickets, economy, average };
      });

      players.sort((a, b) => b.wickets - a.wickets);
      const top10 = players.slice(0, 10);

      let description = "";
      for (let i = 0; i < top10.length; i++) {
        const p = top10[i];
        const rank = i + 1;
        const emoji = getRankEmoji(rank);
        description += `${emoji} **${p.name}** — ${p.wickets} Wkts | ${p.matches}M | ECO ${p.economy} | AVG ${p.average}\n\n`;
      }
      description += "🔥 Purple Cap battle is ON!";

      const embed = new EmbedBuilder()
        .setColor(0x800080)
        .setTitle("🟣 PURPLE CAP LEADERBOARD 🟣")
        .setDescription(description)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Purple Cap error:", error);
      await interaction.editReply("❌ Failed to fetch Purple Cap data. Please try again later.");
    }
  },
};