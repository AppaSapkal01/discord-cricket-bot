const { SlashCommandBuilder } = require("discord.js");
const { getPointsTable } = require("../services/sheets");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("points-table")
        .setDescription("Show the current points table with rankings"),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const teams = await getPointsTable();
            
            if (teams.length === 0) {
                return interaction.editReply("❌ No data found in points table");
            }
            
            let message = "**🏏 POINTS TABLE**\n\n";
            message += "```\n";
            message += " #  Team                      M   W   L   Pts    NRR\n";
            message += "===================================================\n";
            
            teams.forEach((team, index) => {
                const rank = (index + 1).toString().padStart(2);
                const name = team.name.length > 20 ? team.name.substring(0, 17) + "..." : team.name.padEnd(22);
                const matches = team.matches.toString().padStart(2);
                const wins = team.wins.toString().padStart(2);
                const losses = team.losses.toString().padStart(2);
                const points = team.points.toString().padStart(3);
                const nrr = team.nrr.toFixed(3).padStart(7);
                
                message += `${rank}. ${name} ${matches}  ${wins}  ${losses}  ${points}   ${nrr}\n`;
            });
            
            message += "```";
            
            await interaction.editReply(message);
            
        } catch (error) {
            console.error("Error fetching points table:", error);
            await interaction.editReply("❌ Failed to fetch points table. Please try again later.");
        }
    }
};