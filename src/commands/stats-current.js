const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

const {
    getPlayerStats,
    calculatePlayerStats
} = require("../services/playerStatsService");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("stats-current")
        .setDescription("Get current player stats")
        .addStringOption(option =>
            option
                .setName("player")
                .setDescription("Player name (partial names work too)")
                .setRequired(true)
        ),

    async execute(interaction) {

        const playerName = interaction.options.getString("player");
        await interaction.deferReply();

        const result = await getPlayerStats(playerName, "current");

        // No matches found
        if (result.matches.length === 0) {
            return interaction.editReply(`❌ No stats found for "${playerName}"`);
        }

        // Filter out players with zero matches
        const activePlayers = result.matches.filter(player => {
            const battingRow = result.battingData.find(b => b[0] === player);
            const bowlingRow = result.bowlingData.find(b => b[0] === player);
            const stats = calculatePlayerStats(battingRow, bowlingRow);
            return stats.batting.matches > 0 || stats.bowling.matches > 0;
        });

        const playersToShow = activePlayers.length > 0 ? activePlayers : result.matches;
        
        const ITEMS_PER_PAGE = 3; // Show 3 players per page to stay under 2000 chars
        const totalPages = Math.ceil(playersToShow.length / ITEMS_PER_PAGE);

        // Generate message in your exact format
        const generatePage = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const pagePlayers = playersToShow.slice(start, end);
            
            let reply = `🔍 **Found ${playersToShow.length} players matching "${playerName}"** (Page ${page+1}/${totalPages})\n\n`;
            
            for (const player of pagePlayers) {
                const battingRow = result.battingData.find(b => b[0] === player);
                const bowlingRow = result.bowlingData.find(b => b[0] === player);
                const stats = calculatePlayerStats(battingRow, bowlingRow);
                
                // Your exact format
                reply += `--- ${player} ---\n\n`;
                reply += `🏏 T20 Stats:\n`;
                reply += `• Batting: Matches: ${stats.batting.matches}, Runs: ${stats.batting.runs}, Balls: ${stats.batting.balls}, SR: ${stats.batting.strikeRate}, Avg: ${stats.batting.average}\n`;
                reply += `• Bowling: Matches: ${stats.bowling.matches}, Wickets: ${stats.bowling.wickets}, Overs: ${stats.bowling.overs}, Econ: ${stats.bowling.economy}, Avg: ${stats.bowling.average}\n\n`;
                reply += `─────────────────────────────────\n`;
            }
            
            return reply;
        };

        // If only one player, show without pagination controls
        if (playersToShow.length === 1) {
            const player = playersToShow[0];
            const battingRow = result.battingData.find(b => b[0] === player);
            const bowlingRow = result.bowlingData.find(b => b[0] === player);
            const stats = calculatePlayerStats(battingRow, bowlingRow);

            const msg = `
--- ${player} ---

🏏 T20 Stats:
• Batting: Matches: ${stats.batting.matches}, Runs: ${stats.batting.runs}, Balls: ${stats.batting.balls}, SR: ${stats.batting.strikeRate}, Avg: ${stats.batting.average}
• Bowling: Matches: ${stats.bowling.matches}, Wickets: ${stats.bowling.wickets}, Overs: ${stats.bowling.overs}, Econ: ${stats.bowling.economy}, Avg: ${stats.bowling.average}
`;
            return interaction.editReply(msg);
        }

        // Create buttons for pagination
        const getRow = (currentPage) => {
            const row = new ActionRowBuilder();
            
            if (totalPages > 1) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === totalPages - 1)
                );
            }
            
            return row;
        };

        let currentPage = 0;
        const message = await interaction.editReply({
            content: generatePage(currentPage),
            components: totalPages > 1 ? [getRow(currentPage)] : []
        });

        if (totalPages <= 1) return;

        // Button collector
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.user.id !== interaction.user.id) {
                return buttonInteraction.reply({
                    content: "❌ Only you can use these buttons!",
                    ephemeral: true
                });
            }

            if (buttonInteraction.customId === 'prev' && currentPage > 0) {
                currentPage--;
            } else if (buttonInteraction.customId === 'next' && currentPage < totalPages - 1) {
                currentPage++;
            }

            await buttonInteraction.update({
                content: generatePage(currentPage),
                components: [getRow(currentPage)]
            });
        });

        collector.on('end', () => {
            if (message.editable && !message.deleted) {
                message.edit({ components: [] }).catch(() => {});
            }
        });
    }
};