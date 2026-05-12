function ballsToOvers(balls) {
    const overs = Math.floor(balls / 6);
    const remainingBalls = balls % 6;

    return `${overs}.${remainingBalls}`;
}

module.exports = {
    ballsToOvers
};