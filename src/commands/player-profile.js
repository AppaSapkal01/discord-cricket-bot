const { SlashCommandBuilder } = require("discord.js");
const { getPlayerStats, calculatePlayerStats } = require("../services/playerStatsService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("player-profile")
        .setDescription("Get detailed player profile with fancy stats")
        .addStringOption(option =>
            option.setName("player")
                .setDescription("Player name (partial works, but picks first match)")
                .setRequired(true)
        ),

    async execute(interaction) {
        const playerName = interaction.options.getString("player");
        await interaction.deferReply();

        const result = await getPlayerStats(playerName, "alltime");

        if (result.matches.length === 0) {
            return interaction.editReply(`❌ No stats found for "${playerName}"`);
        }

        // Take the first matching player (most relevant)
        const player = result.matches[0];
        const battingRow = result.battingData.find(b => b[0] === player);
        const bowlingRow = result.bowlingData.find(b => b[0] === player);
        const stats = calculatePlayerStats(battingRow, bowlingRow);

        // Helper to format numbers
        const format = (value, decimals = 2) => {
            if (value === undefined || value === null) return "0";
            const num = parseFloat(value);
            if (isNaN(num)) return "0";
            return decimals === 0 ? num.toString() : num.toFixed(decimals);
        };

        // Extract values with fallbacks
        const runs = stats.batting.runs || 0;
        const battingMatches = stats.batting.matches || 0;
        const ballsFaced = stats.batting.balls || 0;
        const strikeRate = format(stats.batting.strikeRate);
        const battingAvg = format(stats.batting.average);
        const highestScore = stats.batting.highestScore || 0;
        const centuries = stats.batting.centuries || 0;
        const fifties = stats.batting.fifties || 0;

        const wickets = stats.bowling.wickets || 0;
        const overs = stats.bowling.overs || "0.0";
        const bowlingMatches = stats.bowling.matches || 0;
        const economy = format(stats.bowling.economy);
        const bowlingAvg = format(stats.bowling.average);
        const bestFigures = stats.bowling.bestFigures || "0/0";

        // Phase wickets – not available in current stats, using placeholder
        // In a real implementation you would fetch or compute these from ball-by-ball data
        const phaseWickets = `${stats.bowling.ppWicket}/${stats.bowling.moWicket}/${stats.bowling.doWicket}`;

        const fours = stats.batting.fours || 0;
        const sixes = stats.batting.sixes || 0;
        const boundaryRate = format(stats.batting.boundaryRate, 1);

        // Build the plain-text output exactly as requested
        const output = `📊 **${player} (T20)** 📊 
─────────────────────────

**🏏 BATTING**
┣ Runs: ${runs}
┣ Matches: ${battingMatches}
┣ Balls Faced: ${ballsFaced}
┣ Strike Rate: ${strikeRate}
┣ Average: ${battingAvg}
┣ Highest Score: ${highestScore}*
┣ 50s / 100s :  ${fifties} / ${centuries}

**🥎 BOWLING**
┣ Wickets: ${wickets}
┣ Overs: ${overs}
┣ Matches: ${bowlingMatches}
┣ Economy: ${economy}
┣ Average: ${bowlingAvg}
┣ Best Figures: ${bestFigures}
┣ Wickets (PP/Mid/Death): ${phaseWickets}

**💥 BOUNDARIES **
┣ Fours: ${fours}
┣ Sixes: ${sixes}
┣ Boundary Rate: ${boundaryRate}%`;

        // Send as a code block to preserve formatting (monospace)
        await interaction.editReply(`\`\`\`\n${output}\n\`\`\``);
    }
};