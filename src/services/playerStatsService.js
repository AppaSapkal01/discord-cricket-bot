const { google } = require("googleapis");

const { PLAYERS_STATS_SPREADSHEET_ID } = process.env;

const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// ========== HELPERS ==========
function oversToBalls(overs) {
    if (!overs) return 0;
    const oversStr = overs.toString();
    if (!oversStr.includes(".")) return Number(oversStr) * 6;
    const [ov, balls] = oversStr.split(".").map(Number);
    return ov * 6 + balls;
}

function ballsToOvers(balls) {
    const ov = Math.floor(balls / 6);
    const rem = balls % 6;
    return `${ov}.${rem}`;
}

async function loadSheetRange(sheetName, range) {
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: PLAYERS_STATS_SPREADSHEET_ID,
            range: `${sheetName}!${range}`,
        });
        return res.data.values || [];
    } catch (err) {
        console.error(`Error loading ${sheetName} ${range}:`, err.message);
        return [];
    }
}

async function saveSheetRange(sheetName, range, rows) {
    if (!rows || rows.length === 0) {
        console.log(`No rows to save to ${sheetName} ${range}`);
        return;
    }
    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: PLAYERS_STATS_SPREADSHEET_ID,
            range: `${sheetName}!${range}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: rows },
        });
    } catch (err) {
        console.error(`Error saving to ${sheetName} ${range}:`, err.message);
    }
}

// ========== BATTING SHEET (A:R) ==========
async function updateBattingSheet(sheetName, players) {
    if (players.length === 0) {
        console.warn(`⚠️ No players to update for ${sheetName}`);
        return;
    }

    // Load existing rows from A2:R – but the API may return rows of variable length.
    let rows = await loadSheetRange(sheetName, "A2:R");
    // Normalize: ensure each row has exactly 18 columns (A to R)
    rows = rows.map(row => {
        const newRow = [...row];
        while (newRow.length < 18) newRow.push(""); // fill missing with empty string
        return newRow;
    });

    // Create map with lowercase name as key
    const map = new Map();
    rows.forEach((row, idx) => {
        if (row[0]) map.set(row[0].toLowerCase().trim(), { rowIndex: idx, row });
    });

    for (const p of players) {
        if (!p.name || !p.name.trim()) {
            console.warn(`⚠️ Skipping player without name:`, p);
            continue;
        }
        const key = p.name.toLowerCase().trim();
        const isFirstInnings = p.innings === 1;

        let row;
        if (map.has(key)) {
            const entry = map.get(key);
            row = entry.row;
        } else {
            // New player: create a row with 18 empty strings
            row = new Array(18).fill("");
            row[0] = p.name;
            row[1] = ""; // format
            rows.push(row);
            map.set(key, { rowIndex: rows.length - 1, row });
        }

        // Safely convert existing values to numbers (empty string = 0)
        const toNum = (val) => (val && val !== "") ? Number(val) : 0;

        // C: Matches (index 2)
        row[2] = toNum(row[2]) + 1;
        // D: Runs (index 3)
        row[3] = toNum(row[3]) + (p.runs || 0);
        // E: Balls (index 4)
        row[4] = toNum(row[4]) + (p.balls || 0);
        // F: Not Outs (index 5)
        row[5] = toNum(row[5]) + (p.out ? 0 : 1);
        // I: 30+ (index 8)
        if (p.runs >= 30) row[8] = toNum(row[8]) + 1;
        // J: Fours (index 9)
        row[9] = toNum(row[9]) + (p.fours || 0);
        // K: Sixes (index 10)
        row[10] = toNum(row[10]) + (p.sixes || 0);
        // L: Highest Score (index 11)
        const currentHighest = toNum(row[11]);
        if (p.runs > currentHighest) row[11] = p.runs;
        // M: 50s (index 12)
        if (p.runs >= 50 && p.runs < 100) row[12] = toNum(row[12]) + 1;
        // N: 100s (index 13)
        if (p.runs >= 100) row[13] = toNum(row[13]) + 1;
        // O: Runs Batting First (index 14)
        if (isFirstInnings) row[14] = toNum(row[14]) + (p.runs || 0);
        // P: Balls Batting First (index 15)
        if (isFirstInnings) row[15] = toNum(row[15]) + (p.balls || 0);
        // Q: Runs Chasing (index 16)
        if (!isFirstInnings) row[16] = toNum(row[16]) + (p.runs || 0);
        // R: Balls Chasing (index 17)
        if (!isFirstInnings) row[17] = toNum(row[17]) + (p.balls || 0);

    }

    // Ensure every row has exactly 18 columns before writing (redundant safety)
    const finalRows = rows.map(row => {
        const r = [...row];
        while (r.length < 18) r.push("");
        return r;
    });
    await saveSheetRange(sheetName, "A2:R", finalRows);
}

// ========== BOWLING SHEET (A:L) ==========
// Similar logic, ensure rows have 12 columns
async function updateBowlingSheet(sheetName, bowlers, squadPlayers, bowlingPhases = {}) {
    let rows = await loadSheetRange(sheetName, "A2:L");
    rows = rows.map(row => {
        const newRow = [...row];
        while (newRow.length < 12) newRow.push("");
        return newRow;
    });
    const map = new Map();
    rows.forEach((row, idx) => {
        if (row[0]) map.set(row[0].toLowerCase().trim(), { rowIndex: idx, row });
    });
    const processed = new Set();
    const toNum = (val) => (val && val !== "") ? Number(val) : 0;

    for (const b of bowlers) {
        if (!b.name) continue;
        const key = b.name.toLowerCase().trim();
        processed.add(key);
        const currentBalls = oversToBalls(b.overs);
        let row;
        if (map.has(key)) {
            row = map.get(key).row;
        } else {
            row = new Array(12).fill("");
            row[0] = b.name;
            rows.push(row);
            map.set(key, { rowIndex: rows.length - 1, row });
        }
        row[2] = toNum(row[2]) + 1; // Matches
        const prevBalls = oversToBalls(row[3] || "0.0");
        row[3] = ballsToOvers(prevBalls + currentBalls);
        row[4] = toNum(row[4]) + (b.runs || 0);
        row[5] = toNum(row[5]) + (b.wickets || 0);
        const currentBest = row[8] ? row[8].toString() : "0/0";
        const [bestW, bestR] = currentBest.split("/").map(Number);
        if (b.wickets > bestW || (b.wickets === bestW && b.runs < bestR)) row[8] = `${b.wickets}/${b.runs}`;
        row[9] = toNum(row[9]) + (bowlingPhases[key]?.pp || 0);
        row[10] = toNum(row[10]) + (bowlingPhases[key]?.middle || 0);
        row[11] = toNum(row[11]) + (bowlingPhases[key]?.death || 0);
    }
    for (const squadPlayer of squadPlayers) {
        if (!squadPlayer) continue;
        const key = squadPlayer.toLowerCase().trim();
        if (processed.has(key)) continue;
        let row;
        if (map.has(key)) {
            row = map.get(key).row;
            row[2] = toNum(row[2]) + 1;
        } else {
            row = new Array(12).fill("");
            row[0] = squadPlayer;
            rows.push(row);
        }
    }
    const finalRows = rows.map(row => {
        const r = [...row];
        while (r.length < 12) r.push("");
        return r;
    });
    await saveSheetRange(sheetName, "A2:L", finalRows);
}// ========== POSITION SHEET ==========
async function updatePositionSheet(playersWithPosition) {
    let rows = await loadSheetRange("Stats_position", "A2:G");
    rows = rows.map(row => {
        const newRow = [...row];
        while (newRow.length < 7) newRow.push("");
        return newRow;
    });
    const map = new Map();
    rows.forEach((row, idx) => {
        if (row[0] && row[1]) map.set(`${row[0].toLowerCase().trim()}|${row[1]}`, { rowIndex: idx, row });
    });
    const toNum = (val) => (val && val !== "") ? Number(val) : 0;
    for (const p of playersWithPosition) {
        if (!p.name || !p.position) continue;
        const key = `${p.name.toLowerCase().trim()}|${p.position}`;
        let row;
        if (map.has(key)) {
            row = map.get(key).row;
        } else {
            row = new Array(7).fill("");
            row[0] = p.name;
            row[1] = p.position;
            rows.push(row);
            map.set(key, { rowIndex: rows.length - 1, row });
        }
        row[3] = toNum(row[3]) + 1;
        row[4] = toNum(row[4]) + (p.runs || 0);
        row[5] = toNum(row[5]) + (p.balls || 0);
        row[6] = toNum(row[6]) + (p.out ? 0 : 1);
    }
    const finalRows = rows.map(row => {
        const r = [...row];
        while (r.length < 7) r.push("");
        return r;
    });
    await saveSheetRange("Stats_position", "A2:G", finalRows);
}

// ========== MAIN EXPORT FUNCTIONS ==========
async function updateBattingStats(players, inningsInfo = {}) {
    await updateBattingSheet("Batting_alltime", players);
    await updateBattingSheet("Batting_Current", players);
}

async function updateBowlingStats(players, squadPlayers = [], bowlingPhases = {}) {
    await updateBowlingSheet("Bowling_alltime", players, squadPlayers, bowlingPhases);
    await updateBowlingSheet("Bowling_Current", players, squadPlayers, bowlingPhases);
}

async function updatePositionStats(playersWithPosition) {
    await updatePositionSheet(playersWithPosition);
}

// ========== OTHER FUNCTIONS (unchanged) ==========
async function getPlayerStats(playerName, type = "alltime") {
    const battingSheet = type === "current" ? "Batting_Current" : "Batting_alltime";
    const bowlingSheet = type === "current" ? "Bowling_Current" : "Bowling_alltime";
    const [battingRes, bowlingRes] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId: PLAYERS_STATS_SPREADSHEET_ID, range: `${battingSheet}!A2:F` }),
        sheets.spreadsheets.values.get({ spreadsheetId: PLAYERS_STATS_SPREADSHEET_ID, range: `${bowlingSheet}!A2:F` }),
    ]);
    const battingRows = battingRes.data.values || [];
    const bowlingRows = bowlingRes.data.values || [];
    const searchTerm = playerName.toLowerCase().trim();
    const matchingBatting = battingRows.filter(row => row[0]?.toLowerCase().includes(searchTerm));
    const matchingBowling = bowlingRows.filter(row => row[0]?.toLowerCase().includes(searchTerm));
    if (matchingBatting.length === 0 && matchingBowling.length === 0) {
        return { batting: null, bowling: null, matches: [], battingData: [], bowlingData: [] };
    }
    const playerNames = new Set();
    matchingBatting.forEach(row => playerNames.add(row[0]));
    matchingBowling.forEach(row => playerNames.add(row[0]));
    return {
        matches: Array.from(playerNames),
        battingData: matchingBatting,
        bowlingData: matchingBowling,
        batting: matchingBatting.length === 1 ? matchingBatting[0] : null,
        bowling: matchingBowling.length === 1 ? matchingBowling[0] : null,
    };
}

function calculatePlayerStats(battingRow, bowlingRow) {
    const battingMatches = Number(battingRow?.[2] || 0);
    const battingRuns = Number(battingRow?.[3] || 0);
    const battingBalls = Number(battingRow?.[4] || 0);
    const battingNotOuts = Number(battingRow?.[5] || 0);
    const battingOuts = Math.max(battingMatches - battingNotOuts, 1);
    const strikeRate = battingBalls > 0 ? ((battingRuns / battingBalls) * 100).toFixed(2) : "0.00";
    const battingAvg = (battingRuns / battingOuts).toFixed(2);
    const bowlingMatches = Number(bowlingRow?.[2] || 0);
    const bowlingOvers = bowlingRow?.[3] || "0.0";
    const bowlingRuns = Number(bowlingRow?.[4] || 0);
    const bowlingWickets = Number(bowlingRow?.[5] || 0);
    const economy = parseFloat(bowlingOvers) > 0 ? (bowlingRuns / parseFloat(bowlingOvers)).toFixed(2) : "0.00";
    const bowlingAvg = bowlingWickets > 0 ? (bowlingRuns / bowlingWickets).toFixed(2) : "0.00";
    return {
        batting: { matches: battingMatches, runs: battingRuns, balls: battingBalls, notOuts: battingNotOuts, strikeRate, average: battingAvg },
        bowling: { matches: bowlingMatches, wickets: bowlingWickets, overs: bowlingOvers, runs: bowlingRuns, economy, average: bowlingAvg },
    };
}

module.exports = {
    updateBattingStats,
    updateBowlingStats,
    updatePositionStats,
    getPlayerStats,
    calculatePlayerStats,
};