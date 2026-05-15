const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require("discord.js");
const matchManager = require("../managers/matchManager");

const SELECTION_TIMEOUT = 15000;

function getBowlerEmoji(player, playersMap) {
  if (!player || !playersMap) return "🎯";
  const playerData = playersMap.get(player.toLowerCase().trim());
  if (!playerData) return "🎯";
  const role = (playerData.role || "").toLowerCase();
  if (role.includes("fast") || role === "fast bowler") return "⚡";
  if (role.includes("spin") || role === "spin bowler") return "🌀";
  if (role.includes("allrounder")) {
    if (role.includes("fast") || role.includes("pace")) return "⚡🌀";
    if (role.includes("spin")) return "🌀⚡";
    return "🌀";
  }
  return "🎯";
}

function formatBowlerName(name, playersMap, matchState = null) {
  const emoji = getBowlerEmoji(name, playersMap);
  let display = `${emoji} ${name}`;
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
    return null;  // ← not throw
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

  return new Promise(resolve => {
    const collector = promptMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: SELECTION_TIMEOUT
    });

    let resolved = false;

    collector.on("collect", async i => {
      await i.deferUpdate().catch(() => { });

      const matchAfter = matchManager.getMatch(channelId);
      if (!matchAfter || !matchAfter.isActive || matchAfter.stopped) {
        if (!resolved) { resolved = true; collector.stop("match_stopped"); resolve(null); }
        return;
      }

      const openers = i.values;
      await promptMessage.edit({
        content: `✅ **${team.teamName}:** ${openers[0]} and ${openers[1]} are opening the innings (selected by ${i.user.username})`,
        components: []
      }).catch(() => { });

      if (!resolved) { resolved = true; collector.stop("selected"); resolve(openers); }
    });

    collector.on("end", async (collected, reason) => {
      if (resolved) return;
      resolved = true;
      if (reason === "match_stopped") return;

      const matchAfter = matchManager.getMatch(channelId);
      if (!matchAfter || !matchAfter.isActive || matchAfter.stopped) { resolve(null); return; }

      const openers = availablePlayers.slice(0, 2);
      await promptMessage.edit({
        content: `⏰ Timeout! **${team.teamName}:** Auto-selected openers: ${openers[0]} and ${openers[1]}`,
        components: []
      }).catch(() => { });
      resolve(openers);
    });
  });
}

// selectNextBatsman: uses hasBatted (single source of truth)
async function selectNextBatsman(interaction, overNumber, inningNumber, matchState) {
  const channelId = interaction.channelId;
  const battingTeam = matchState.battingTeam;
  const battingOrder = matchState.battingOrder;
  const hasBatted = matchState.hasBatted;

  // Available = anyone who hasn't batted yet (striker & nonStriker are already in hasBatted)
  const availableBatsmen = battingOrder.filter(name => {
    const trimmed = name.trim();
    return !hasBatted.has(trimmed);
  });

  if (availableBatsmen.length === 0) return null;

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`batsman_${inningNumber}_${overNumber}_${Date.now()}`)
      .setPlaceholder("Select next batsman")
      .addOptions(availableBatsmen.map(name => ({ label: name, value: name })))
  );

  const promptMessage = await interaction.channel.send({
    content: `**${battingTeam.teamName}:** Select your next batsman (15 seconds to respond):`,
    components: [selectMenu]
  });

  return new Promise(resolve => {
    const collector = promptMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: SELECTION_TIMEOUT
    });

    let resolved = false;

    collector.on("collect", async i => {
      await i.deferUpdate().catch(() => { });

      const matchAfter = matchManager.getMatch(channelId);
      if (!matchAfter?.isActive || matchAfter.stopped) {
        if (!resolved) { resolved = true; collector.stop("match_stopped"); resolve(null); }
        return;
      }

      const selectedBatsman = i.values[0];
      matchState.hasBatted.add(selectedBatsman.trim());

      await promptMessage.edit({
        content: `✅ **${battingTeam.teamName}:** ${selectedBatsman} is coming to the crease (selected by ${i.user.username})`,
        components: []
      }).catch(() => { });

      if (!resolved) { resolved = true; collector.stop("selected"); resolve(selectedBatsman); }
    });

    collector.on("end", async (collected, reason) => {
      if (resolved) return;
      resolved = true;
      if (reason === "match_stopped") return;

      const matchAfter = matchManager.getMatch(channelId);
      if (!matchAfter?.isActive || matchAfter.stopped) { resolve(null); return; }

      const autoBatsman = availableBatsmen[0];
      matchState.hasBatted.add(autoBatsman.trim());
      await promptMessage.edit({
        content: `⚠️ **${battingTeam.teamName}:** No selection made. Defaulting to ${autoBatsman} (Auto-selected)`,
        components: []
      }).catch(() => { });
      resolve(autoBatsman);
    });
  });
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
  if (!currentMatch || !currentMatch.isActive || currentMatch.stopped) return null;

  const bowlerOptions = availableBowlers.map(name => {
    const oversBowled = matchState.bowlerOvers?.get(name) || 0;
    const remaining = 4 - oversBowled;
    const bowlerStats = matchState.bowlerStats?.get(name);
    const emoji = getBowlerEmoji(name, playersMap);
    let description = `${oversBowled}/4 overs left: ${remaining}`;
    if (bowlerStats && bowlerStats.runs > 0) description += ` | ${bowlerStats.runs}/${bowlerStats.wickets}`;
    return {
      label: name,
      value: name,
      description,
      emoji: { name: emoji === "⚡" ? "⚡" : emoji === "🌀" ? "🌀" : "🎯" }
    };
  });

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`bowler_${inningNumber}_${overNumber}_${Date.now()}`)
      .setPlaceholder("⚡ Select bowler (Fast:⚡ | Spin:🌀)")
      .addOptions(bowlerOptions.slice(0, 25))
  );

  const fastBowlers = availableBowlers.filter(name => getBowlerEmoji(name, playersMap) === "⚡");
  const spinBowlers = availableBowlers.filter(name => getBowlerEmoji(name, playersMap) === "🌀");
  let typeInfo = "";
  if (fastBowlers.length > 0) typeInfo += `⚡ Fast Bowlers: ${fastBowlers.join(", ")}\n`;
  if (spinBowlers.length > 0) typeInfo += `🌀 Spin Bowlers: ${spinBowlers.join(", ")}`;

  const promptMessage = await interaction.channel.send({
    content: `**${bowlingTeam.teamName}:** Select your bowler for over ${overNumber + 1} (15s to respond)\n${typeInfo ? `\n${typeInfo}` : ""}`,
    components: [selectMenu]
  });

  return new Promise(resolve => {
    const collector = promptMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: SELECTION_TIMEOUT
    });

    let resolved = false;

    collector.on("collect", async i => {
      // Acknowledge EVERY interaction immediately — prevents "Unknown interaction"
      await i.deferUpdate().catch(() => { });

      const matchAfter = matchManager.getMatch(channelId);
      if (!matchAfter || !matchAfter.isActive || matchAfter.stopped) {
        if (!resolved) {
          resolved = true;
          collector.stop("match_stopped");
          resolve(null);
        }
        return;
      }

      const bowler = i.values[0];
      const oversBowled = (matchState.bowlerOvers?.get(bowler) || 0) + 1;
      const bowlerEmoji = getBowlerEmoji(bowler, playersMap);

      await promptMessage.edit({
        content: `✅ **${bowlingTeam.teamName}:** ${bowlerEmoji} ${bowler} is the new bowler (selected by ${i.user.username}) | Overs: ${oversBowled}/4`,
        components: []
      }).catch(() => { });

      if (!resolved) {
        resolved = true;
        collector.stop("selected");
        resolve(bowler);
      }
    });

    collector.on("end", async (collected, reason) => {
      if (resolved) return;
      resolved = true;

      if (reason === "match_stopped") return; // already resolved null above

      const matchAfter = matchManager.getMatch(channelId);
      if (!matchAfter || !matchAfter.isActive || matchAfter.stopped) {
        resolve(null);
        return;
      }

      // Timeout — auto-select
      const randomBowler = availableBowlers[Math.floor(Math.random() * availableBowlers.length)];
      const randomEmoji = getBowlerEmoji(randomBowler, playersMap);
      await promptMessage.edit({
        content: `⏰ Timeout! **${bowlingTeam.teamName}:** Auto-selected bowler: ${randomEmoji} ${randomBowler}`,
        components: []
      }).catch(() => { });
      resolve(randomBowler);
    });
  });
}

module.exports = {
  selectOpeners,
  selectNextBatsman,
  selectBowlerForOver,
  getAvailableBowlers,
  SELECTION_TIMEOUT,
  getBowlerEmoji,
  formatBowlerName
};