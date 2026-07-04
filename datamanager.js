class DataManager {
    constructor() {

    }
    
    initializeDataArrays() {

    }
    
    createGraphs() {
        // Create action graph
        this.populationGraph = new Graph(1000, 0, [this.population, this.uniqueOrganisms], "Population", 0, 0);
        gameEngine.addGraph(this.populationGraph);

    }

    updateData() {
        // Update population data
        this.population.push(this.hexGrid.organisms.length);
        this.uniqueOrganisms.push(this.hexGrid.organismGraph.uniqueLivingIDs.size);
    }

    logData() {
        const data = {
            db: PARAMETERS.db,
            collection: PARAMETERS.collection,
            data: {

            }
        };

        if (socket) socket.emit("insert", data);
    }

    update() {
        // Update data every tick (not just on reporting periods)
        if(this.hexGrid.tick % PARAMETERS.reportingPeriod === 0) {
            this.updateData();
        }
    }

    draw(ctx) {
        this.organismGraph.drawTopOrganisms(ctx, 1025, 200, 60);
    }
}