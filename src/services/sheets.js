const { google } = require("googleapis");

if (!process.env.GOOGLE_CREDENTIALS) {
  throw new Error("GOOGLE_CREDENTIALS is missing in Render environment variables");
}

let credentials;

try {
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
} catch (err) {
  throw new Error("GOOGLE_CREDENTIALS is not valid JSON");
}

credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// TWO DIFFERENT SPREADSHEETS
const PUBLIC_TEAMS_SPREADSHEET_ID = process.env.PUBLIC_TEAMS_SPREADSHEET_ID;
const PRIVATE_PLAYERS_SPREADSHEET_ID = process.env.PRIVATE_PLAYERS_SPREADSHEET_ID;
const PLAYERS_STATS_SPREADSHEET_ID = process.env.PLAYERS_STATS_SPREADSHEET_ID;

async function withRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

// ========== OVERS HELPERS ==========
function oversToBalls(overs) {
  if (!overs) return 0;
  const oversStr = overs.toString();
  if (!oversStr.includes(".")) {
    return Number(oversStr) * 6;
  }
  const [overPart, ballPart] = oversStr.split(".").map(Number);
  return (overPart * 6) + (ballPart || 0);
}

function ballsToOvers(balls) {
  const ov = Math.floor(balls / 6);
  const rem = balls % 6;
  return parseFloat(`${ov}.${rem}`);
}

function calculateNRR(runsFor, oversFaced, runsConceded, oversBowled) {
  // Avoid division by zero
  if (oversFaced === 0) return 0;
  if (oversBowled === 0) return 0;

  const runRateFor = runsFor / oversFaced;
  const runRateAgainst = runsConceded / oversBowled;

  return runRateFor - runRateAgainst;
}

// ========== PRIVATE SHEETS (Database, Results, etc.) ==========
async function getAllPlayers() {
  return withRetry(async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
      range: "Player Database!A2:R",
    });
    const rows = res.data.values || [];
    return rows.map(row => ({
      name: row[0] ? row[0].toString().trim() : "",
      country: row[1] ? row[1].toString().trim() : "",
      role: row[2] ? row[2].toString().trim() : "",
      technique: parseInt(row[3]) || 0,
      power: parseInt(row[4]) || 0,
      timing: parseInt(row[5]) || 0,
      againstPace: parseInt(row[6]) || 0,
      againstSpin: parseInt(row[7]) || 0,
      aggression: parseInt(row[8]) || 0,
      consistency: parseInt(row[9]) || 0,
      paceSkill: parseInt(row[10]) || 0,
      spinSkill: parseInt(row[11]) || 0,
      movement: parseInt(row[12]) || 0,
      control: parseInt(row[13]) || 0,
      economy: parseInt(row[14]) || 0,
      deathBowling: parseInt(row[15]) || 0,
      battingForm: parseInt(row[16]) || 50,
      bowlingForm: parseInt(row[17]) || 50,
    }));
  });
}

// ============================================
// EXACT MATCH ONLY (For Team Validation)
// ============================================
function findPlayerExact(players, searchName) {
  const searchLower = searchName.toLowerCase().trim();

  const player = players.find(
    p => p.name.toLowerCase().trim() === searchLower
  );

  if (!player) return null;

  return {
    player,
    matchType: "exact"
  };
}


// Case-insensitive player matching
function findPlayerByName(players, searchName) {
  const searchLower = searchName.toLowerCase().trim();

  // 1. Exact match (case insensitive)
  let player = players.find(p => p.name.toLowerCase() === searchLower);
  if (player) return { player, matchType: "exact" };

  // 2. Partial match (searchName is inside player name)
  player = players.find(p => p.name.toLowerCase().includes(searchLower));
  if (player) return { player, matchType: "partial" };

  // 3. Player name is inside searchName
  player = players.find(p => searchLower.includes(p.name.toLowerCase()));
  if (player) return { player, matchType: "partial" };

  return null;
}

// Batch match multiple players
function matchPlayers(playersList, teamPlayerNames) {
  const results = {
    matched: [],
    notFound: [],
    partialMatches: []
  };

  for (const teamName of teamPlayerNames) {
    const trimmedName = teamName.toString().trim();
    const match = findPlayerByName(playersList, trimmedName);

    if (match) {
      results.matched.push({
        teamInput: trimmedName,
        dbName: match.player.name,
        role: match.player.role,
        matchType: match.matchType
      });
      if (match.matchType === "partial") {
        results.partialMatches.push({
          teamInput: trimmedName,
          dbName: match.player.name
        });
      }
    } else {
      results.notFound.push(trimmedName);
    }
  }

  return results;
}

// ============================================
// STRICT TEAM PLAYER MATCHING
// ============================================
function matchPlayersExact(playersList, teamPlayerNames) {
  const results = {
    matched: [],
    notFound: [],
    partialMatches: []
  };

  for (const teamName of teamPlayerNames) {
    const trimmedName = teamName.toString().trim();

    const match = findPlayerExact(playersList, trimmedName);

    if (match) {
      results.matched.push({
        teamInput: trimmedName,
        dbName: match.player.name,
        role: match.player.role,
        matchType: "exact"
      });
    } else {
      results.notFound.push(trimmedName);
    }
  }

  return results;
}


// ========== PUBLIC SHEET (Teams only) ==========
async function getAllTeams() {
  return withRetry(async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PUBLIC_TEAMS_SPREADSHEET_ID,
      range: "Teams!A2:Z",
    });
    return (res.data.values || []).filter(row => row.length > 0);
  });
}

async function getTeamByName(teamName) {
  const rows = await getAllTeams();
  for (const row of rows) {
    if (row.length < 3) continue;
    const name = row[0] ? row[0].toString().trim() : "";
    const owner = row[1] ? row[1].toString().trim() : "";
    const players = row.slice(2).filter(p => p && p.toString().trim() !== "");
    if (name.toLowerCase() === teamName.toLowerCase()) {
      return { teamName: name, owner, players };
    }
  }
  return null;
}

async function createTeam(teamName, ownerId) {
  return withRetry(async () => {
    const existing = await getTeamByName(teamName);
    if (existing) throw new Error("Team name already exists");

    await sheets.spreadsheets.values.append({
      spreadsheetId: PUBLIC_TEAMS_SPREADSHEET_ID,
      range: "Teams!A:C",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[teamName, ownerId]] },
    });
    return { success: true };
  });
}

async function updateTeamPlayers(teamName, players) {
  return withRetry(async () => {
    const rows = await getAllTeams();
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0]?.toString().trim().toLowerCase() === teamName.toLowerCase()) {
        rowIndex = i + 2;
        break;
      }
    }
    if (rowIndex === -1) throw new Error("Team not found");

    const team = rows[rowIndex - 2];
    const values = [[team[0], team[1], ...players.slice(0, 11)]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: PUBLIC_TEAMS_SPREADSHEET_ID,
      range: `Teams!A${rowIndex}:M${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return { success: true };
  });
}

// ========== FIXED MATCH RESULT FUNCTION ==========
async function saveMatchResult(match) {
  return withRetry(async () => {
    const SHEET_NAME = "Result";

    // GET EXISTING TABLE
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:J`,
    });

    const rows = res.data.values || [];

    // CREATE TEAM MAP
    const tableMap = new Map();
    rows.forEach((row, idx) => {
      if (!row || !row[0]) return;
      const teamName = row[0]?.toString().trim();
      if (!teamName) return;
      tableMap.set(teamName.toLowerCase(), {
        rowIndex: idx + 2,
        data: row
      });
    });

    async function updateTeam({
      teamName,
      runsScored,
      oversFaced,
      runsConceded,
      oversBowled,
      won
    }) {
      const key = teamName.toLowerCase();
      let existing = tableMap.get(key);

      // DEFAULT VALUES
      let matches = 0;
      let wins = 0;
      let losses = 0;
      let points = 0;
      let totalRunsScored = 0;      // When batting
      let totalOversFaced = 0;       // When batting (in balls)
      let totalRunsConceded = 0;     // When bowling
      let totalOversBowled = 0;      // When bowling (in balls)

      // EXISTING TEAM DATA
      if (existing) {
        const row = existing.data;
        matches = Number(row[1] || 0);
        wins = Number(row[2] || 0);
        losses = Number(row[3] || 0);
        points = Number(row[4] || 0);
        totalRunsScored = Number(row[6] || 0);
        totalOversFaced = oversToBalls(row[7] || "0.0");
        totalRunsConceded = Number(row[8] || 0);
        totalOversBowled = oversToBalls(row[9] || "0.0");
      }

      // UPDATE MATCH COUNTS
      matches += 1;
      if (won) {
        wins += 1;
        points += 2;
      } else {
        losses += 1;
      }

      // ADD THIS MATCH'S STATS
      totalRunsScored += runsScored;
      totalOversFaced += oversToBalls(oversFaced);
      totalRunsConceded += runsConceded;
      totalOversBowled += oversToBalls(oversBowled);

      // CALCULATE NRR
      const oversFacedFloat = totalOversFaced / 6;
      const oversBowledFloat = totalOversBowled / 6;

      let runRateFor = 0;
      let runRateAgainst = 0;

      if (oversFacedFloat > 0) {
        runRateFor = totalRunsScored / oversFacedFloat;
      }
      if (oversBowledFloat > 0) {
        runRateAgainst = totalRunsConceded / oversBowledFloat;
      }

      const nrr = runRateFor - runRateAgainst;

      // DEBUG LOGGING
      // console.log(`\n📊 ${teamName} - ${won ? 'WIN ✅' : 'LOSS ❌'}`);
      // console.log(`   Batting: ${totalRunsScored} runs in ${(totalOversFaced / 6).toFixed(1)} overs (RR: ${runRateFor.toFixed(2)})`);
      // console.log(`   Bowling: ${totalRunsConceded} runs in ${(totalOversBowled / 6).toFixed(1)} overs (RR: ${runRateAgainst.toFixed(2)})`);
      // console.log(`   NRR: ${runRateFor.toFixed(3)} - ${runRateAgainst.toFixed(3)} = ${nrr.toFixed(3)}`);

      // FINAL ROW - CORRECT COLUMN MAPPING
      const finalRow = [[
        teamName,                              // A: Team Name
        matches,                               // B: Matches
        wins,                                  // C: Wins
        losses,                                // D: Losses
        points,                                // E: Points
        nrr.toFixed(3),                        // F: NRR
        totalRunsScored,                       // G: Total Runs Scored (batting)
        (totalOversFaced / 6).toFixed(1),      // H: Total Overs Faced (batting)
        totalRunsConceded,                     // I: Total Runs Conceded (bowling)
        (totalOversBowled / 6).toFixed(1),     // J: Total Overs Bowled (bowling)
      ]];

      // UPDATE OR APPEND
      if (existing) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
          range: `${SHEET_NAME}!A${existing.rowIndex}:J${existing.rowIndex}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: finalRow }
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
          range: `${SHEET_NAME}!A:J`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: finalRow }
        });
      }
    }

    // UPDATE BOTH TEAMS
    // For Team A: They scored X runs in Y overs, and conceded Z runs in W overs
    await updateTeam({
      teamName: match.teamA,
      runsScored: match.scoreA,
      oversFaced: match.oversA,
      runsConceded: match.scoreB,
      oversBowled: match.oversB,
      won: match.winner === match.teamA
    });

    // For Team B: They scored X runs in Y overs, and conceded Z runs in W overs
    await updateTeam({
      teamName: match.teamB,
      runsScored: match.scoreB,
      oversFaced: match.oversB,
      runsConceded: match.scoreA,
      oversBowled: match.oversA,
      won: match.winner === match.teamB
    });

    // console.log("\n✅ Points table updated successfully");
  });
}

// ========== GET POINTS TABLE (SORTED) ==========
async function getPointsTable() {
  return withRetry(async () => {
    const SHEET_NAME = "Result";

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:J`,
    });

    const rows = res.data.values || [];

    // Parse and sort by Points (desc), then NRR (desc)
    const teams = rows
      .filter(row => row[0] && row[0].trim() !== "")
      .map(row => ({
        name: row[0].trim(),
        matches: parseInt(row[1]) || 0,
        wins: parseInt(row[2]) || 0,
        losses: parseInt(row[3]) || 0,
        points: parseInt(row[4]) || 0,
        nrr: parseFloat(row[5]) || 0,
        runsFor: parseInt(row[6]) || 0,
        oversFor: parseFloat(row[7]) || 0,
        runsConceded: parseInt(row[8]) || 0,
        oversBowled: parseFloat(row[9]) || 0
      }))
      .sort((a, b) => {
        // First sort by points (descending)
        if (a.points !== b.points) {
          return b.points - a.points;
        }
        // Then by NRR (descending)
        return b.nrr - a.nrr;
      });

    return teams;
  });
}

async function getPlayerStatsForAdmin(playerName) {
  const allPlayers = await getAllPlayers();
  const match = findPlayerByName(allPlayers, playerName);
  return match ? match.player : null;
}

async function getPlayerBasicInfo(playerNames) {
  const allPlayers = await getAllPlayers();
  const results = [];
  for (const name of playerNames) {
    const match = findPlayerByName(allPlayers, name);
    if (match) {
      results.push({
        inputName: name,
        actualName: match.player.name,
        role: match.player.role,
        matched: true
      });
    } else {
      results.push({
        inputName: name,
        actualName: null,
        role: null,
        matched: false
      });
    }
  }
  return results;
}

async function getAllStadiums() {
  return withRetry(async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
      range: "Stadium!A2:J",
    });
    const rows = res.data.values || [];
    return rows.map(row => ({
      name: row[0] ? row[0].toString().trim() : "",
      country: row[1] ? row[1].toString().trim() : "",
      pace: parseInt(row[2]) || 0,
      bounce: parseInt(row[3]) || 0,
      swing: parseInt(row[4]) || 0,
      turn: parseInt(row[5]) || 0,
      batting: parseInt(row[6]) || 0,
      boundarySize: parseInt(row[7]) || 0,
      dew: parseInt(row[8]) || 0,
      type: row[9] ? row[9].toString().trim() : "Neutral",
    }));
  });
}

async function getStadiumByName(stadiumName) {
  const stadiums = await getAllStadiums();
  return stadiums.find(s => s.name.toLowerCase() === stadiumName.toLowerCase()) || null;
}

async function getRandomStadium() {
  const stadiums = await getAllStadiums();
  if (stadiums.length === 0) return null;
  return stadiums[Math.floor(Math.random() * stadiums.length)];
}

// ========== RECALCULATE ALL TEAMS NRR (FIX EXISTING DATA) ==========
async function recalculateAllTeamsNRR() {
  // console.log("\n🔄 Starting NRR recalculation...\n");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
    range: `Result!A2:J`,
  });

  const rows = res.data.values || [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;

    const teamName = row[0].trim();
    const matches = parseInt(row[1]) || 0;
    const wins = parseInt(row[2]) || 0;
    const losses = parseInt(row[3]) || 0;
    const points = parseInt(row[4]) || 0;
    const runsScored = parseInt(row[6]) || 0;
    const oversFaced = parseFloat(row[7]) || 0;
    const runsConceded = parseInt(row[8]) || 0;
    const oversBowled = parseFloat(row[9]) || 0;

    // Calculate correct NRR
    let runRateFor = 0;
    let runRateAgainst = 0;

    if (oversFaced > 0) {
      runRateFor = runsScored / oversFaced;
    }
    if (oversBowled > 0) {
      runRateAgainst = runsConceded / oversBowled;
    }

    const correctNRR = runRateFor - runRateAgainst;

    // console.log(`\n📊 ${teamName}:`);
    // console.log(`   Record: ${wins}-${losses} (${points} pts)`);
    // console.log(`   Batting: ${runsScored} runs @ ${runRateFor.toFixed(2)} RR (${oversFaced} overs)`);
    // console.log(`   Bowling: ${runsConceded} runs @ ${runRateAgainst.toFixed(2)} RR (${oversBowled} overs)`);
    // console.log(`   Old NRR: ${row[5]}`);
    // console.log(`   New NRR: ${correctNRR.toFixed(3)}`);

    if (wins > losses && correctNRR < 0) {
      // console.log(`   ⚠️ WARNING: Team has winning record but negative NRR! This might indicate data issue.`);
    }

    // Update the NRR column
    const rowIndex = i + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
      range: `Result!F${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[correctNRR.toFixed(3)]] }
    });
  }

  // console.log("\n✅ All teams NRR recalculated!");
}

module.exports = {
  getAllPlayers,
  findPlayerByName,
  matchPlayers,
  getAllTeams,
  getTeamByName,
  createTeam,
  updateTeamPlayers,
  saveMatchResult,
  getPointsTable,
  getPlayerStatsForAdmin,
  getPlayerBasicInfo,
  getAllStadiums,
  getStadiumByName,
  getRandomStadium,
  recalculateAllTeamsNRR,  // Export for fixing existing data
  findPlayerExact,
  matchPlayersExact,
};