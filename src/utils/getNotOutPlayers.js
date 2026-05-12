function getNotOutPlayers(matchState) {
    const striker =
        matchState.battingOrder[matchState.strikerIdx];

    const nonStriker =
        matchState.battingOrder[matchState.nonStrikerIdx];

    return [striker, nonStriker];
}

module.exports = { getNotOutPlayers };