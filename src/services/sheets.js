const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function getAllPlayers() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Players!A2:L",
  });

  return (res.data.values || []).map(row => ({
    name: row[0],
    role: row[1],
    country: row[2],
    bat: +row[3],
    bowl: +row[4],
    power: +row[5],
    technique: +row[6],
    pace: +row[7],
    spin: +row[8],
    death: +row[9],
    pp: +row[10],
    form: +row[11],
  }));
}

async function getAllTeams() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Teams!A2:Z",
  });

  return res.data.values || [];
}



async function getTeamByName(teamName) {
  const rows = await getAllTeams();

  for (const row of rows) {

    if (!row || row.length < 3) continue;

    const name = row[0];
    const owner = row[1];
    const players = row.slice(2);

    if (name.toLowerCase() === teamName.toLowerCase()) {

      return {
        teamName: name,
        owner: owner || "Unknown",
        players: players.filter(p => p && p.trim() !== "")
      };
    }
  }

  return null;
}


async function saveMatchResult(match) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Results!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          Date.now(),                // MatchId
          match.teamA,
          match.teamB,
          match.scoreA,
          match.scoreB,
          match.winner,
        ],
      ],
    },
  });
}


async function updatePlayerForms(players) {
  const values = players.map(p => [p.form]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Players!L2:L",
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

module.exports = {
  getAllPlayers,
  getTeamByName,
  saveMatchResult,
  updatePlayerForms
};