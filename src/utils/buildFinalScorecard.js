function buildFinalScorecard(matchState, innings1Stats, innings2Stats) {
    return {
        format: "T20",
        completedAt: Date.now(),

        teams: {
            teamA: matchState.teamA.teamName,
            teamB: matchState.teamB.teamName
        },

        innings: [
            {
                battingTeam: innings1Stats.battingTeam,
                runs: innings1Stats.runs,
                wickets: innings1Stats.wickets,
                overs: innings1Stats.overs,

                batsmen: Object.values(innings1Stats.batsmanStats),

                bowlers: Array.from(
                    innings1Stats.bowlerStats.values()
                )
            },

            {
                battingTeam: innings2Stats.battingTeam,
                runs: innings2Stats.runs,
                wickets: innings2Stats.wickets,
                overs: innings2Stats.overs,

                batsmen: Object.values(innings2Stats.batsmanStats),

                bowlers: Array.from(
                    innings2Stats.bowlerStats.values()
                )
            }
        ]
    };
}

module.exports = { buildFinalScorecard };