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
  target = null,
  battingOrder = null   // new parameter
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

  // -------------------- BATTING TABLE --------------------
  const nameWidth = 24;
  const runsWidth = 3;
  const ballsWidth = 2;
  const srWidth = 7;
  const foursWidth = 2;
  const sixesWidth = 2;

  // Correct total width
  const totalWidth =
    nameWidth +
    runsWidth +
    ballsWidth +
    srWidth +
    foursWidth +
    sixesWidth +
    22;

  let battingText = "┌" + "─".repeat(totalWidth - 2) + "┐\n";

  battingText +=
    `│ ${"Batter".padEnd(nameWidth - 1)}` +
    `│ ${"R".padStart(runsWidth)} ` +
    `│ ${"B".padStart(ballsWidth)} ` +
    `│ ${"SR".padStart(srWidth)} ` +
    `│ ${"4s".padStart(foursWidth)} ` +
    `│ ${"6s".padStart(sixesWidth)} │\n`;

  battingText += "├" + "─".repeat(totalWidth - 2) + "┤\n";

  // Determine batting order
  let order = battingOrder;
  if (!order || order.length === 0) {
    order = Object.values(batsmanStats)
      .sort((a, b) => b.runs - a.runs)
      .map(s => s.name);
  }

  const orderedBatsmen = [];

  for (const name of order) {
    const key = name.toLowerCase().trim();
    if (batsmanStats[key]) {
      orderedBatsmen.push(batsmanStats[key]);
    }
  }

  for (const [key, stats] of Object.entries(batsmanStats)) {
    if (!orderedBatsmen.includes(stats)) {
      orderedBatsmen.push(stats);
    }
  }

  for (const batsman of orderedBatsmen) {
    let name = batsman.name;

    if (name.length > nameWidth - 3) {
      name = name.substring(0, nameWidth - 4) + "...";
    }

    const notOutMark =
      batsman.out === false && batsman.balls > 0 ? "*" : "";

    if (batsman.balls === 0 && batsman.runs === 0) {
      battingText +=
        `│ ${(name).padEnd(nameWidth - 1)}` +
        `│ ${"DNB".padStart(runsWidth)} ` +
        `│ ${"-".padStart(ballsWidth)} ` +
        `│ ${"-".padStart(srWidth)} ` +
        `│ ${"-".padStart(foursWidth)} ` +
        `│ ${"-".padStart(sixesWidth)} │\n`;
    } else {
      const sr =
        batsman.balls > 0
          ? ((batsman.runs / batsman.balls) * 100).toFixed(2)
          : "0.00";

      battingText +=
        `│ ${(name + notOutMark).padEnd(nameWidth - 1)}` +
        `│ ${batsman.runs.toString().padStart(runsWidth)} ` +
        `│ ${batsman.balls.toString().padStart(ballsWidth)} ` +
        `│ ${sr.padStart(srWidth)} ` +
        `│ ${batsman.fours.toString().padStart(foursWidth)} ` +
        `│ ${batsman.sixes.toString().padStart(sixesWidth)} │\n`;
    }
  }

  battingText += "└" + "─".repeat(totalWidth - 2) + "┘";

  const battingChunks = splitText(battingText);
  battingChunks.forEach((chunk, index) => {
    embed.addFields({
      name: index === 0 ? "📊 BATTING" : "📊 BATTING (cont.)",
      value: "```" + chunk + "```",
      inline: false,
    });
  });

  // -------------------- BOWLING TABLE --------------------
  const bowlerNameWidth = 24;
  const oversWidth = 2;
  const runsWidthBowl = 2;
  const wicketsWidth = 2;
  const econWidth = 5;

  const totalWidthBowl =
    bowlerNameWidth +
    oversWidth +
    runsWidthBowl +
    wicketsWidth +
    econWidth +
    18;

  let bowlingText =
    "┌" + "─".repeat(totalWidthBowl - 2) + "┐\n";

  bowlingText +=
    `│ ${"Bowler".padEnd(bowlerNameWidth - 1)}` +
    `│ ${"O".padStart(oversWidth)} ` +
    `│ ${"R".padStart(runsWidthBowl)} ` +
    `│ ${"W".padStart(wicketsWidth)} ` +
    `│ ${"Econ".padStart(econWidth)} │\n`;

  bowlingText +=
    "├" + "─".repeat(totalWidthBowl - 2) + "┤\n";

  const bowlersWhoBowled = Array.from(bowlerStats.values())
    .filter((b) => b.overs > 0)
    .sort((a, b) => b.wickets - a.wickets);

  for (const bowler of bowlersWhoBowled) {
    let name = bowler.name;

    if (name.length > bowlerNameWidth - 3) {
      name = name.substring(0, bowlerNameWidth - 4) + "...";
    }

    const econ =
      bowler.overs > 0
        ? (bowler.runs / bowler.overs).toFixed(2)
        : "0.00";

    bowlingText +=
      `│ ${name.padEnd(bowlerNameWidth - 1)}` +
      `│ ${bowler.overs.toString().padStart(oversWidth)} ` +
      `│ ${bowler.runs.toString().padStart(runsWidthBowl)} ` +
      `│ ${bowler.wickets.toString().padStart(wicketsWidth)} ` +
      `│ ${econ.padStart(econWidth)} │\n`;
  }

  bowlingText +=
    "└" + "─".repeat(totalWidthBowl - 2) + "┘";

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

// -------------------- MATCH SUMMARY (unchanged) --------------------
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
    .setTimestamp();

  // Handle tie vs normal result
  let description;
  if (winner === "TIE") {
    description = "🤝 **MATCH TIED** 🤝\nBoth teams finished with the same score.";
  } else {
    description = `**${winner}** won by **${wonBy}**`;
  }
  embed.setDescription(description);

  const innings1Text = `**${teamA.teamName}** - ${innings1Stats.runs}/${innings1Stats.wickets} (${innings1Stats.overs} overs)`;
  const innings2Text = `**${teamB.teamName}** - ${innings2Stats.runs}/${innings2Stats.wickets} (${innings2Stats.overs} overs)`;

  embed.addFields(
    { name: "📊 FIRST INNINGS", value: innings1Text, inline: true },
    { name: "📊 SECOND INNINGS", value: innings2Text, inline: true }
  );

  let matchStats = `🏟️ Venue: ${stadium.name}\n`;
  if (winner === "TIE") {
    matchStats += `🏆 Result: Match Tied\n`;
    matchStats += `📈 Margin: Scores level`;
  } else {
    matchStats += `🏆 Winner: ${winner}\n`;
    matchStats += `📈 Margin: ${wonBy}`;
  }

  embed.addFields({ name: "📈 MATCH STATS", value: matchStats });

  return embed;
}

// -------------------- PARTNERSHIP (unchanged) --------------------
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