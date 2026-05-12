const { google } = require("googleapis");

const { PLAYERS_STATS_SPREADSHEET_ID } = process.env;

const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({
    version: "v4",
    auth
});


// ============================================
// OVERS HELPERS
// ============================================

function oversToBalls(overs) {

    if (overs === undefined || overs === null) {
        return 0;
    }

    const oversStr = overs.toString();

    if (!oversStr.includes(".")) {
        return Number(oversStr) * 6;
    }

    const [ov, balls] = oversStr.split(".").map(Number);

    return (ov * 6) + balls;
}

function ballsToOvers(balls) {

    const ov = Math.floor(balls / 6);
    const rem = balls % 6;

    return `${ov}.${rem}`;
}


// ============================================
// LOAD SHEET
// ============================================

async function loadSheet(sheetName) {

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: PLAYERS_STATS_SPREADSHEET_ID,
        range: `${sheetName}!A2:F`
    });

    return res.data.values || [];
}


// ============================================
// SAVE SHEET
// ============================================

async function saveSheet(sheetName, rows) {

    await sheets.spreadsheets.values.update({
        spreadsheetId: PLAYERS_STATS_SPREADSHEET_ID,
        range: `${sheetName}!A2:F`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
            values: rows
        }
    });
}


// ============================================
// UPDATE BATTING SHEET
// ============================================

async function updateBattingSheet(sheetName, players) {

    const rows = await loadSheet(sheetName);

    const map = new Map();

    rows.forEach((row, idx) => {

        if (!row || !row[0]) return;

        map.set(
            row[0].toLowerCase().trim(),
            {
                rowIndex: idx,
                row
            }
        );
    });

    for (const p of players) {

        if (!p.name) continue;

        const key = p.name.toLowerCase().trim();

        // =========================================
        // PLAYER EXISTS
        // =========================================

        if (map.has(key)) {

            const existing = map.get(key);

            const row = existing.row;

            // A = Name
            // B = Format (DON'T TOUCH)
            // C = Matches
            // D = Runs
            // E = Balls
            // F = Not Outs

            row[2] = Number(row[2] || 0) + 1;
            row[3] = Number(row[3] || 0) + Number(p.runs || 0);
            row[4] = Number(row[4] || 0) + Number(p.balls || 0);
            row[5] = Number(row[5] || 0) + (p.out ? 0 : 1);

        } 
        
        // =========================================
        // NEW PLAYER
        // =========================================
        
        else {

            rows.push([
                p.name,
                "", // format already maintained manually
                1,
                Number(p.runs || 0),
                Number(p.balls || 0),
                p.out ? 0 : 1
            ]);
        }
    }

    await saveSheet(sheetName, rows);
}


// ============================================
// UPDATE BOWLING SHEET
// ============================================

async function updateBowlingSheet(sheetName, players) {

    const rows = await loadSheet(sheetName);

    const map = new Map();

    rows.forEach((row, idx) => {

        if (!row || !row[0]) return;

        map.set(
            row[0].toLowerCase().trim(),
            {
                rowIndex: idx,
                row
            }
        );
    });

    for (const p of players) {

        if (!p.name) continue;

        const key = p.name.toLowerCase().trim();

        const currentBalls =
            oversToBalls(p.overs);

        // =========================================
        // PLAYER EXISTS
        // =========================================

        if (map.has(key)) {

            const existing = map.get(key);

            const row = existing.row;

            const previousBalls =
                oversToBalls(row[3] || "0.0");

            const totalBalls =
                previousBalls + currentBalls;

            // A = Name
            // B = Format (DON'T TOUCH)
            // C = Matches
            // D = Overs
            // E = Runs
            // F = Wickets

            row[2] = Number(row[2] || 0) + 1;
            row[3] = ballsToOvers(totalBalls);
            row[4] = Number(row[4] || 0) + Number(p.runs || 0);
            row[5] = Number(row[5] || 0) + Number(p.wickets || 0);

        } 
        
        // =========================================
        // NEW PLAYER
        // =========================================
        
        else {

            rows.push([
                p.name,
                "", // format already maintained manually
                1,
                ballsToOvers(currentBalls),
                Number(p.runs || 0),
                Number(p.wickets || 0)
            ]);
        }
    }

    await saveSheet(sheetName, rows);
}


// ============================================
// MAIN FUNCTIONS
// ============================================

async function updateBattingStats(players) {

    console.log("🔥 Updating batting stats");

    await updateBattingSheet(
        "Batting_alltime",
        players
    );

    await updateBattingSheet(
        "Batting_Current",
        players
    );

    console.log("✅ Batting stats updated");
}

async function updateBowlingStats(players) {

    console.log("🔥 Updating bowling stats");

    await updateBowlingSheet(
        "Bowling_alltime",
        players
    );

    await updateBowlingSheet(
        "Bowling_Current",
        players
    );

    console.log("✅ Bowling stats updated");
}


// ============================================
// FETCH PLAYER STATS (UPDATED WITH PARTIAL MATCH)
// ============================================

async function getPlayerStats(playerName, type = "alltime") {

    const battingSheet =
        type === "current"
            ? "Batting_Current"
            : "Batting_alltime";

    const bowlingSheet =
        type === "current"
            ? "Bowling_Current"
            : "Bowling_alltime";

    const [battingRes, bowlingRes] = await Promise.all([

        sheets.spreadsheets.values.get({
            spreadsheetId: PLAYERS_STATS_SPREADSHEET_ID,
            range: `${battingSheet}!A2:F`
        }),

        sheets.spreadsheets.values.get({
            spreadsheetId: PLAYERS_STATS_SPREADSHEET_ID,
            range: `${bowlingSheet}!A2:F`
        })
    ]);

    const battingRows =
        battingRes.data.values || [];

    const bowlingRows =
        bowlingRes.data.values || [];

    const searchTerm = playerName.toLowerCase().trim();

    // Find all matching players (partial match)
    const matchingBatting = battingRows.filter(row =>
        row[0]?.toLowerCase().includes(searchTerm)
    );

    const matchingBowling = bowlingRows.filter(row =>
        row[0]?.toLowerCase().includes(searchTerm)
    );

    // If no matches found
    if (matchingBatting.length === 0 && matchingBowling.length === 0) {
        return {
            batting: null,
            bowling: null,
            matches: [],
            battingData: [],
            bowlingData: []
        };
    }

    // Get unique player names from both lists
    const playerNames = new Set();
    matchingBatting.forEach(row => playerNames.add(row[0]));
    matchingBowling.forEach(row => playerNames.add(row[0]));

    // Return all matches
    return {
        matches: Array.from(playerNames),
        battingData: matchingBatting,
        bowlingData: matchingBowling,
        // Keep original format for backward compatibility
        batting: matchingBatting.length === 1 ? matchingBatting[0] : null,
        bowling: matchingBowling.length === 1 ? matchingBowling[0] : null
    };
}

// Helper function to calculate all stats for a player
function calculatePlayerStats(battingRow, bowlingRow) {
    const battingMatches = Number(battingRow?.[2] || 0);
    const battingRuns = Number(battingRow?.[3] || 0);
    const battingBalls = Number(battingRow?.[4] || 0);
    const battingNotOuts = Number(battingRow?.[5] || 0);
    const battingOuts = Math.max(battingMatches - battingNotOuts, 1);

    const strikeRate = battingBalls > 0
        ? ((battingRuns / battingBalls) * 100).toFixed(2)
        : "0.00";

    const battingAvg = battingOuts > 0
        ? (battingRuns / battingOuts).toFixed(2)
        : battingRuns.toFixed(2);

    const bowlingMatches = Number(bowlingRow?.[2] || 0);
    const bowlingOvers = bowlingRow?.[3] || "0.0";
    const bowlingRuns = Number(bowlingRow?.[4] || 0);
    const bowlingWickets = Number(bowlingRow?.[5] || 0);

    const economy = parseFloat(bowlingOvers) > 0
        ? (bowlingRuns / parseFloat(bowlingOvers)).toFixed(2)
        : "0.00";

    const bowlingAvg = bowlingWickets > 0
        ? (bowlingRuns / bowlingWickets).toFixed(2)
        : "0.00";

    return {
        batting: {
            matches: battingMatches,
            runs: battingRuns,
            balls: battingBalls,
            notOuts: battingNotOuts,
            strikeRate,
            average: battingAvg
        },
        bowling: {
            matches: bowlingMatches,
            wickets: bowlingWickets,
            overs: bowlingOvers,
            runs: bowlingRuns,
            economy,
            average: bowlingAvg
        }
    };
}


module.exports = {
    updateBattingStats,
    updateBowlingStats,
    getPlayerStats,
    calculatePlayerStats
};