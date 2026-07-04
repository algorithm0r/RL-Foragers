class Agent {
    constructor() {
        this.puzzleBox = new PuzzleBox(PARAMETERS.actionString);

        this.learner = new QLearner(PARAMETERS.actionString.split(""));
    }
    
    update() {
        const state = this.puzzleBox.puzzle;
        const policy = this.learner.policy(state);
        const actionIndex = policy.action;
        const actionName = this.learner.getActionName(actionIndex);

        const reward = this.puzzleBox.attemptSolve(actionName);
        const nextState = this.puzzleBox.puzzle;

        this.learner.learn(state, actionIndex, reward, nextState);
        
        if (this.puzzleBox.solved) {
            console.log("Puzzle solved! Resetting puzzle.");
            this.puzzleBox = new PuzzleBox(PARAMETERS.actionString);
            if (PARAMETERS.suffleOnComplete) {
                this.puzzleBox.resetAndShuffle();
            } else {
                this.puzzleBox.reset();
            }
        }
    }
  
    draw(ctx) {
        this.puzzleBox.draw(ctx, 50, 50);
    }
}

