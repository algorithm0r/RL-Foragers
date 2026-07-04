var PARAMETERS = {
    // Framework parameters
    updatesPerDraw: 1,
    reportingPeriod: 100,
    db: "RL_test",
    collection: "test",
    ip: 'https://73.19.38.112:8888',
    
    // Canvas parameters
    pixelDimension: 800,     // Canvas size (square)
    
    // Grid parameters
    numCols: 20,             // Number of columns
    numRows: 20,             // Number of rows

    actionString: "ABCDEGHIJK", // Actions available to the agent

    // Puzzle box parameters
    puzzleBoxReward: 10,    // Reward for solving the puzzle box
    puzzleBoxPenalty: -1,   // Penalty for incorrect action
    resetOnFailure: true, // Whether to reset puzzle on incorrect action
    shuffleOnFailure: false, // Whether to shuffle puzzle on incorrect action

    // agent parameters
    suffleOnComplete: false,   // Whether to shuffle puzzle when completed

    // Q-learning parameters
    qLearningRate: 0.1,        // Alpha
    qLearningDiscount: 0.9,    // Gamma
    defaultQValue: 0.0,        // Default Q-value for unseen state-action pairs
    
    // Graph parameters
    graphWidth: 600,
    graphHeight: 120,
};

function loadParameters() {
    // Load parameters from UI if available


    // Could calculate dependent parameters here if needed
    

    console.log("Parameters loaded:", PARAMETERS);
}
