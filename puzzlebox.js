class PuzzleBox {
    constructor(puzzle) {
        this.puzzle = puzzle;
        this.solved = false;
    }

    reset() {
        // Reset the puzzle to capital letters
        this.puzzle = this.puzzle.toUpperCase();
        this.solved = false;
    }

    shufflePuzzle() {
        let arr = this.puzzle.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        this.puzzle = arr.join('');
    }

    resetAndShuffle() {
        this.reset();
        this.shufflePuzzle();
    }

    attemptSolve(action) {
        // find first uppercase letter in puzzle and see if it matches action
        for (let i = 0; i < this.puzzle.length; i++) {
            let char = this.puzzle.charAt(i);
            if (char >= 'A' && char <= 'Z') {
                if (char === action) {
                    // correct action, demote letter to lowercase
                    this.puzzle = this.puzzle.substring(0, i) + char.toLowerCase() + this.puzzle.substring(i + 1);
                    if (i === this.puzzle.length - 1) {
                        // puzzle solved
                        this.solved = true;
                        return PARAMETERS.puzzleBoxReward;
                    }
                    return 0;
                } else {
                    // incorrect action
                    if (PARAMETERS.resetOnFailure) {
                        this.reset();
                    }
                    if (PARAMETERS.shuffleOnFailure) {
                        this.shufflePuzzle();
                    }
                    return PARAMETERS.puzzleBoxPenalty;
                }
            }
        }
    }

    draw(ctx, x = 0, y = 0) {
        ctx.fillStyle = "black";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.fillText(this.puzzle, x, y);
        ctx.strokeRect(x - 4, y - 17, this.puzzle.length * 12 + 1, 22);
    }
}

