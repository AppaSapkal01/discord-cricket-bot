// match/selectionHandler.js
const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require("discord.js");
const matchManager = require("../managers/matchManager");

const SELECTION_TIMEOUT = 15000; // 15 seconds

// Helper function to get bowler type emoji
function getBowlerEmoji(player, playersMap) {
  if (!player || !playersMap) return "🎯";

  const playerData = playersMap.get(player.toLowerCase().trim());
  if (!playerData) return "🎯";

  const role = (playerData.role || "").toLowerCase();

  if (role.includes("fast") || role === "fast bowler") {
    return "⚡"; // Fast bowler
  } else if (role.includes("spin") || role === "spin bowler") {
    return "🌀"; // Spin bowler
  } else if (role.includes("allrounder")) {
    // Check allrounder sub-type
    if (role.includes("fast") || role.includes("pace")) {
      return "⚡🌀"; // Fast bowling allrounder
    } else if (role.includes("spin")) {
      return "🌀⚡"; // Spin bowling allrounder
    }
    return "🌀"; // Generic allrounder
  }

  return "🎯"; // Default for unknown types
}

// Helper function to format bowler display with emoji
function formatBowlerName(name, playersMap, matchState = null) {
  const emoji = getBowlerEmoji(name, playersMap);
  let display = `${emoji} ${name}`;

  // Add overs bowled info if matchState provided
  if (matchState && matchState.bowlerOvers) {
    const oversBowled = matchState.bowlerOvers.get(name) || 0;
    display += ` (${oversBowled}/4)`;
  }

  return display;
}

async function selectOpeners(interaction, team, inningNumber = 1) {
  const channelId = interaction.channelId;
  const availablePlayers = [...team.players];

  const currentMatch = matchManager.getMatch(channelId);
  if (!currentMatch || !currentMatch.isActive || currentMatch.stopped) {
    throw new Error("Match has been stopped");
  }

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`openers_${inningNumber}_${Date.now()}`)
      .setPlaceholder("Select 2 openers")
      .setMinValues(2)
      .setMaxValues(2)
      .addOptions(availablePlayers.map(name => ({ label: name, value: name })))
  );

  const promptMessage = await interaction.channel.send({
    content: `**${team.teamName}:** Select your two opening batsmen (15s to respond):`,
    components: [selectMenu]
  });

  try {
    const choice = await interaction.channel.awaitMessageComponent({
      filter: i => i.customId.startsWith(`openers_${inningNumber}_`),
      time: SELECTION_TIMEOUT,
      componentType: ComponentType.StringSelect
    });

    const matchAfterSelection = matchManager.getMatch(channelId);
    if (!matchAfterSelection || !matchAfterSelection.isActive || matchAfterSelection.stopped) {
      await promptMessage.delete().catch(() => { });
      throw new Error("Match stopped");
    }

    const openers = choice.values;
    const selectedBy = choice.user.username;
    await promptMessage.edit({
      content: `✅ **${team.teamName}:** ${openers[0]} and ${openers[1]} are opening the innings (selected by ${selectedBy})`,
      components: []
    });
    return openers;
  } catch (e) {
    const matchAfterTimeout = matchManager.getMatch(channelId);
    if (!matchAfterTimeout || !matchAfterTimeout.isActive || matchAfterTimeout.stopped) {
      return null;
    }

    const openers = availablePlayers.slice(0, 2);
    await promptMessage.edit({
      content: `⏰ Timeout! **${team.teamName}:** Auto-selected openers: ${openers[0]} and ${openers[1]}`,
      components: []
    });
    return openers;
  }
}

async function selectNextBatsman(interaction, remainingBatsmen, overNumber, inningNumber, matchState) {
  const channelId = interaction.channelId;
  const battingTeam = matchState.battingTeam;

  // console.log(`[SELECT NEXT] Called with remainingBatsmen: ${remainingBatsmen.join(', ')}`);
  // console.log(`[SELECT NEXT] Current striker: ${matchState.battingOrder[matchState.strikerIdx]}`);
  // console.log(`[SELECT NEXT] Current nonStriker: ${matchState.battingOrder[matchState.nonStrikerIdx]}`);
  // console.log(`[SELECT NEXT] nextBatsmanIdx: ${matchState.nextBatsmanIdx}`);
  // console.log(`[SELECT NEXT] Full battingOrder: ${matchState.battingOrder.join(', ')}`);
  // console.log(`[SELECT NEXT] dismissedBatsmen: ${Array.from(matchState.dismissedBatsmen).join(', ')}`);

  const currentMatch = matchManager.getMatch(channelId);
  if (!currentMatch || !currentMatch.isActive || currentMatch.stopped) {
    return null;
  }

  // Filter out batsmen who are currently batting or dismissed
  const availableBatsmen = remainingBatsmen.filter(name => {
    const trimmedName = name.trim();
    // Don't show batsmen who are currently batting
    const isCurrentlyBatting = trimmedName === matchState.battingOrder[matchState.strikerIdx] ||
      trimmedName === matchState.battingOrder[matchState.nonStrikerIdx];

    // Don't show dismissed batsmen
    const isDismissed = matchState.dismissedBatsmen.has(trimmedName);

    // console.log(`[FILTER] ${trimmedName}: currentlyBatting=${isCurrentlyBatting}, dismissed=${isDismissed}`);

    return !isCurrentlyBatting && !isDismissed;
  });
  // console.log(`[FILTER] Available batsmen after filter: ${availableBatsmen.join(', ')}`);


  if (availableBatsmen.length === 0) return null;

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`batsman_${inningNumber}_${overNumber}_${Date.now()}`)
      .setPlaceholder("Select next batsman")
      .addOptions(availableBatsmen.map(name => ({ label: name, value: name })))
  );

  const promptMessage = await interaction.channel.send({
    content: `**${battingTeam.teamName}:** Select your next batsman (30 seconds to respond):`,
    components: [selectMenu]
  });

  try {
    const choice = await interaction.channel.awaitMessageComponent({
      filter: i => i.customId.startsWith(`batsman_${inningNumber}_${overNumber}_`),
      time: 30000,
      componentType: ComponentType.StringSelect
    });

    const matchAfterSelection = matchManager.getMatch(channelId);
    if (!matchAfterSelection || !matchAfterSelection.isActive || matchAfterSelection.stopped) {
      await promptMessage.delete().catch(() => { });
      return null;
    }

    const batsman = choice.values[0];
    const selectedBy = choice.user.username;
    await promptMessage.edit({
      content: `✅ **${battingTeam.teamName}:** ${batsman} is coming to the crease (selected by ${selectedBy})`,
      components: []
    });
    return batsman;
  } catch (e) {
    const matchAfterTimeout = matchManager.getMatch(channelId);
    if (!matchAfterTimeout || !matchAfterTimeout.isActive || matchAfterTimeout.stopped) {
      return null;
    }

    // CRITICAL FIX: Don't auto-select during wicket! This was causing the same batsman issue
    // Instead, wait for user input - but since timeout happened, use first available
    const batsman = availableBatsmen[0];
    await promptMessage.edit({
      content: `⚠️ **${battingTeam.teamName}:** No selection made. Defaulting to ${batsman} (Auto-selected)`,
      components: []
    });
    return batsman;
  }
}

function getAvailableBowlers(team, playersMap) {
  return team.players.filter(name => {
    const player = playersMap.get(name.toLowerCase().trim());
    const role = (player?.role || "").toLowerCase();
    return role.includes("bowler") || role.includes("allrounder");
  });
}

async function selectBowlerForOver(interaction, availableBowlers, overNumber, inningNumber, matchState, playersMap) {
  const bowlingTeam = matchState.bowlingTeam;
  const channelId = interaction.channelId;

  const currentMatch = matchManager.getMatch(channelId);
  if (!currentMatch || !currentMatch.isActive || currentMatch.stopped) {
    return null;
  }

  // Create options with emojis for bowler types
  const bowlerOptions = availableBowlers.map(name => {
    const oversBowled = matchState.bowlerOvers?.get(name) || 0;
    const remaining = 4 - oversBowled;
    const bowlerStats = matchState.bowlerStats?.get(name);

    // Get emoji for bowler type
    const emoji = getBowlerEmoji(name, playersMap);

    // Build description with stats
    let description = `${oversBowled}/4 overs left: ${remaining}`;
    if (bowlerStats && bowlerStats.runs > 0) {
      description += ` | ${bowlerStats.runs}/${bowlerStats.wickets}`;
    }

    return {
      label: name,
      value: name,
      description: description,
      emoji: {
        name: emoji === "⚡" ? "⚡" : emoji === "🌀" ? "🌀" : "🎯"
      }
    };
  });

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`bowler_${inningNumber}_${overNumber}_${Date.now()}`)
      .setPlaceholder("⚡ Select bowler (Fast:⚡ | Spin:🌀)")
      .addOptions(bowlerOptions.slice(0, 25))
  );

  // Create info message showing available bowler types
  const fastBowlers = availableBowlers.filter(name => {
    const emoji = getBowlerEmoji(name, playersMap);
    return emoji === "⚡";
  });

  const spinBowlers = availableBowlers.filter(name => {
    const emoji = getBowlerEmoji(name, playersMap);
    return emoji === "🌀";
  });

  let typeInfo = "";
  if (fastBowlers.length > 0) {
    typeInfo += `⚡ Fast Bowlers: ${fastBowlers.join(", ")}\n`;
  }
  if (spinBowlers.length > 0) {
    typeInfo += `🌀 Spin Bowlers: ${spinBowlers.join(", ")}`;
  }

  const promptMessage = await interaction.channel.send({
    content: `**${bowlingTeam.teamName}:** Select your bowler for over ${overNumber} (15s to respond)\n${typeInfo ? `\n${typeInfo}` : ""}`,
    components: [selectMenu]
  });

  try {
    const choice = await interaction.channel.awaitMessageComponent({
      filter: i => i.customId.startsWith(`bowler_${inningNumber}_${overNumber}_`),
      time: SELECTION_TIMEOUT,
      componentType: ComponentType.StringSelect
    });

    const matchAfterSelection = matchManager.getMatch(channelId);
    if (!matchAfterSelection || !matchAfterSelection.isActive || matchAfterSelection.stopped) {
      await promptMessage.delete().catch(() => { });
      return null;
    }

    const bowler = choice.values[0];
    const selectedBy = choice.user.username;
    const oversBowled = (matchState.bowlerOvers?.get(bowler) || 0) + 1;
    const bowlerEmoji = getBowlerEmoji(bowler, playersMap);

    await promptMessage.edit({
      content: `✅ **${bowlingTeam.teamName}:** ${bowlerEmoji} ${bowler} is the new bowler (selected by ${selectedBy}) | Overs: ${oversBowled}/4`,
      components: []
    });

    return bowler;
  } catch (e) {
    const matchAfterTimeout = matchManager.getMatch(channelId);
    if (!matchAfterTimeout || !matchAfterTimeout.isActive || matchAfterTimeout.stopped) {
      return null;
    }

    const randomBowler = availableBowlers[Math.floor(Math.random() * availableBowlers.length)];
    const randomEmoji = getBowlerEmoji(randomBowler, playersMap);

    await promptMessage.edit({
      content: `⏰ Timeout! **${bowlingTeam.teamName}:** Auto-selected bowler: ${randomEmoji} ${randomBowler}`,
      components: []
    });
    return randomBowler;
  }
}

module.exports = {
  selectOpeners,
  selectNextBatsman,
  selectBowlerForOver,
  getAvailableBowlers,
  SELECTION_TIMEOUT,
  getBowlerEmoji,  // Export for use in other files
  formatBowlerName  // Export for use in other files
};