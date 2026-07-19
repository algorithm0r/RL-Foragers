'use strict';
// Samples the world's metric every reportingPeriod ticks, feeds the live graph, and ships a
// self-describing packet (full PARAMETERS + samples) to the DB at epoch. The packet() helper
// (db.js) embeds PARAMETERS verbatim so every run reconstructs from its own record.
//
// Metric: mean steps-to-clear (EMA over completed episodes) plus the episode count — the
// learning curve. Lower steps-to-clear = a better forager.
//
// NOTE: in the browser this auto-flushes at epoch (fire-and-forget, errors logged). The
// headless runner (runner.mjs) drives ticks and flushes explicitly so it can await the write.
var DataManager = class DataManager {
  constructor(world, db, graph) {
    this.world = world;
    this.db = db;
    this.graph = graph;
    this.samples = [];
    this.run = (PARAMETERS.db && PARAMETERS.db.run) || 'run';
    this.flushed = false;
  }

  update(engine) {
    if (engine.tick % PARAMETERS.reportingPeriod === 0) {
      const m = this.world.meanReward();
      this.samples.push({ tick: engine.tick, meanReward: m, deathRate: this.world.deathRate(), episodes: this.world.episodes });
      if (this.graph && this.world.episodes > 0) this.graph.push(m);
    }
    if (!this.flushed && engine.tick >= PARAMETERS.epoch) {
      this.flushed = true;
      this.flush();
    }
  }

  async flush() {
    if (!this.db) return { ok: false };
    const pkt = this.db.packet(PARAMETERS, {
      run: this.run,
      samples: this.samples,
      finalMeanReward: this.world.meanReward(),
      finalDeathRate: this.world.deathRate(),
      episodes: this.world.episodes,
      rested: this.world.rested,
      died: this.world.died,
    });
    try {
      const res = await this.db.insert(this.run, pkt);
      if (typeof console !== 'undefined') console.log('[data] saved', JSON.stringify(res));
      return res;
    } catch (e) {
      if (typeof console !== 'undefined') console.error('[data] save failed:', e.message);
      return { ok: false, error: e.message };
    }
  }

  draw() {}
};
