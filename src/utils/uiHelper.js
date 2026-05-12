const { EmbedBuilder } = require("discord.js");

// -------------------- HELPERS --------------------
function splitText(text, maxLength = 1000) {
  const chunks = [];
  let current = "";

  for (const line of text.split("\n")) {
    if ((current + line + "\n").length > maxLength) {
      chunks.push(current);
      current = "";
    }
    current += line + "\n";
  }

  if (current) chunks.push(current);
  return chunks;
}

// -------------------- INNINGS SCORECARD --------------------
function createInningsScorecardEmbed(
  inningNumber,
  teamName,
  runs,
  wickets,
  overs,
  batsmanStats,
  bowlerStats,
  target = null
) {
  const embed = new EmbedBuilder()
    .setTitle(`🏏 ${inningNumber === 1 ? "FIRST" : "SECOND"} INNINGS - ${teamName}`)
    .setColor(inningNumber === 1 ? 0x00AE86 : 0xff6b6b)
    .setTimestamp();

  // Score header
  let scoreText = `**${runs}/${wickets}** (${overs} overs)`;
  if (target && inningNumber === 2) {
    const required = target - runs;
    if (required <= 0) {
      scoreText += `\n✅ **Target achieved!**`;
    } else {
      scoreText += `\n🎯 Need **${required}** runs to win`;
    }
  }
  embed.setDescription(scoreText);

  // -------------------- BATTING --------------------
  let battingText = "";
  battingText += "┌────────────────────────────────────────────────────────────┐\n";
  battingText += "│ Batsman                      │ Runs│ Bls│ 4s│ 6s│ SR      │\n";
  battingText += "├────────────────────────────────────────────────────────────┤\n";

  const battedPlayers = Object.values(batsmanStats)
    .filter((b) => b.balls > 0 || b.runs > 0)
    .sort((a, b) => b.runs - a.runs);

  for (const batsman of battedPlayers) {
    const sr =
      batsman.balls > 0
        ? ((batsman.runs / batsman.balls) * 100).toFixed(1)
        : "0.0";

    const name =
      batsman.name.length > 25
        ? batsman.name.substring(0, 22) + "..."
        : batsman.name;

    const dismissal = batsman.dismissed ? "†" : "*";

    battingText += `│ ${(name + dismissal).padEnd(25)} │ ${batsman.runs
      .toString()
      .padStart(3)} │ ${batsman.balls
      .toString()
      .padStart(3)} │ ${batsman.fours
      .toString()
      .padStart(2)} │ ${batsman.sixes
      .toString()
      .padStart(2)} │ ${sr.padStart(6)} │\n`;
  }

  const didNotBat = Object.values(batsmanStats)
    .filter((b) => b.balls === 0 && b.runs === 0)
    .map((b) => b.name);

  if (didNotBat.length > 0 && battedPlayers.length < 11) {
    battingText += "├────────────────────────────────────────────────────────────┤\n";
    battingText += "│ 📋 DID NOT BAT                                              │\n";

    const dnbs = didNotBat.join(", ");
    const chunks = dnbs.match(/.{1,46}/g) || [];

    for (const chunk of chunks) {
      battingText += `│ ${chunk.padEnd(46)} │\n`;
    }
  }

  battingText += "└────────────────────────────────────────────────────────────┘";

  // 🔥 SPLIT + ADD
  const battingChunks = splitText(battingText);

  battingChunks.forEach((chunk, index) => {
    embed.addFields({
      name: index === 0 ? "📊 BATTING" : "📊 BATTING (cont.)",
      value: "```" + chunk + "```",
      inline: false,
    });
  });

  // -------------------- BOWLING --------------------
  let bowlingText = "";
  bowlingText += "┌────────────────────────────────────────────────────────────┐\n";
  bowlingText += "│ Bowler                       │ Overs│ Runs│ Wkts│ Econ    │\n";
  bowlingText += "├────────────────────────────────────────────────────────────┤\n";

  const bowlersWhoBowled = Array.from(bowlerStats.values())
    .filter((b) => b.overs > 0)
    .sort((a, b) => b.wickets - a.wickets);

  for (const bowler of bowlersWhoBowled) {
    const econ =
      bowler.overs > 0
        ? (bowler.runs / bowler.overs).toFixed(2)
        : "0.00";

    const name =
      bowler.name.length > 25
        ? bowler.name.substring(0, 22) + "..."
        : bowler.name;

    bowlingText += `│ ${name.padEnd(25)} │ ${bowler.overs
      .toString()
      .padStart(4)} │ ${bowler.runs
      .toString()
      .padStart(4)} │ ${bowler.wickets
      .toString()
      .padStart(4)} │ ${econ.padStart(7)} │\n`;
  }

  const bowlersWhoDidNotBowl = Array.from(bowlerStats.values())
    .filter((b) => b.overs === 0)
    .map((b) => b.name);

  if (bowlersWhoDidNotBowl.length > 0 && bowlersWhoBowled.length < 11) {
    bowlingText += "├────────────────────────────────────────────────────────────┤\n";
    bowlingText += "│ 🎯 DID NOT BOWL                                             │\n";

    const dnbs = bowlersWhoDidNotBowl.join(", ");
    const chunks = dnbs.match(/.{1,46}/g) || [];

    for (const chunk of chunks) {
      bowlingText += `│ ${chunk.padEnd(46)} │\n`;
    }
  }

  bowlingText += "└────────────────────────────────────────────────────────────┘";

  // 🔥 SPLIT + ADD
  const bowlingChunks = splitText(bowlingText);

  bowlingChunks.forEach((chunk, index) => {
    embed.addFields({
      name: index === 0 ? "🎯 BOWLING" : "🎯 BOWLING (cont.)",
      value: "```" + chunk + "```",
      inline: false,
    });
  });

  return embed;
}

// -------------------- MATCH SUMMARY --------------------
function createMatchSummaryEmbed(
  innings1Stats,
  innings2Stats,
  teamA,
  teamB,
  winner,
  wonBy,
  stadium
) {
  const embed = new EmbedBuilder()
    .setTitle("🏆 MATCH SUMMARY 🏆")
    .setColor(0xffd700)
    .setDescription(`**${winner}** won by **${wonBy}**`)
    .setTimestamp();

  const innings1Text = `**${teamA.teamName}** - ${innings1Stats.runs}/${innings1Stats.wickets} (${innings1Stats.overs} overs)`;
  const innings2Text = `**${teamB.teamName}** - ${innings2Stats.runs}/${innings2Stats.wickets} (${innings2Stats.overs} overs)`;

  embed.addFields(
    { name: "📊 FIRST INNINGS", value: innings1Text, inline: true },
    { name: "📊 SECOND INNINGS", value: innings2Text, inline: true }
  );

  let matchStats = `🏟️ Venue: ${stadium.name}\n`;
  matchStats += `🏆 Winner: ${winner}\n`;
  matchStats += `📈 Margin: ${wonBy}`;

  embed.addFields({ name: "📈 MATCH STATS", value: matchStats });

  return embed;
}

// -------------------- PARTNERSHIP --------------------
function createCurrentPartnershipEmbed(matchState) {
  const striker = matchState.battingOrder[matchState.strikerIdx];
  const nonStriker = matchState.battingOrder[matchState.nonStrikerIdx];

  const strikerStats =
    matchState.batsmanStats[striker.toLowerCase().trim()] || {};
  const nonStrikerStats =
    matchState.batsmanStats[nonStriker.toLowerCase().trim()] || {};

  const displayOverNumber = (matchState.currentOver || 0) + 1;

  return new EmbedBuilder()
    .setTitle("🏏 CURRENT PARTNERSHIP")
    .setColor(0x00ae86)
    .addFields(
      {
        name: `🔥 ${striker}`,
        value: `${strikerStats.runs || 0} (${strikerStats.balls || 0})`,
      },
      {
        name: `🔄 ${nonStriker}`,
        value: `${nonStrikerStats.runs || 0} (${nonStrikerStats.balls || 0})`,
      },
      {
        name: "🤝 Partnership",
        value: `${matchState.partnershipRuns} (${matchState.partnershipBalls})`,
      },
      {
        name: "📊 Score",
        value: `${matchState.runs}/${matchState.wickets}`,
      }
    )
    .setFooter({
      text: `Over ${displayOverNumber} • Innings ${matchState.currentInnings}`,
    });
}

module.exports = {
  createInningsScorecardEmbed,
  createMatchSummaryEmbed,
  createCurrentPartnershipEmbed,
};