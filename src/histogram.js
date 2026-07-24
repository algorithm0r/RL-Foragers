'use strict';
// Distribution heat-strip over time — ported from the redistribution-dynamics `histogram.js` pattern.
// `data` is a list of snapshots, each an array of BUCKET COUNTS; time runs along x, buckets stack up y,
// and colour encodes the (log-scaled) share of that snapshot in each bucket. Optional `means` (one value
// per snapshot, normalised to [0,1], high = top) draws a white centroid line — so a SELECTED gene shows a
// tight bright band that holds, while a NEUTRAL gene shows a broad, wandering smear. DOM-free (takes a ctx
// in draw); `var X = class X` so it's a global in the browser AND the headless realm.
var Histogram = class Histogram {
  constructor(x, y, width, height, opts) {
    this.x = x; this.y = y; this.width = width; this.height = height;
    this.label = ''; this.labelColor = '#cdd2da'; this.data = []; this.means = null;
    if (opts) Object.assign(this, opts);
  }

  draw(ctx) {
    const len = this.data.length > this.width ? Math.floor(this.width) : this.data.length;
    const start = this.data.length > this.width ? this.data.length - this.width : 0;
    for (let i = 0; i < len; i++) {
      const snap = this.data[i + start], nb = snap.length;
      let total = 0; for (let k = 0; k < nb; k++) total += snap[k];
      if (total === 0) continue;                          // empty snapshot — leave the column blank
      for (let j = 0; j < nb; j++) this.fill(ctx, snap[j] / total, i, nb - 1 - j, nb);
    }
    if (this.means && this.means.length > 1) {            // white line tracing the population mean
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const px = this.x + i, py = this.y + (1 - this.means[i + start]) * this.height;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.font = '10px monospace'; ctx.fillStyle = this.labelColor; ctx.textAlign = 'left';
    ctx.fillText(this.label, this.x + 2, this.y - 3);   // label ABOVE the strip (needs a few px of clearance above)
    ctx.strokeStyle = '#2b3240'; ctx.lineWidth = 1; ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.width, this.height);
  }

  // log-scaled blue→white for share (same mapping as the source): rare = deep blue, dominant = white
  fill(ctx, share, xi, yIndex, nBuckets) {
    let c = 511 - Math.floor(Math.log(share * 99 + 1) / Math.log(100) * 512);
    ctx.fillStyle = c > 255 ? 'rgb(' + (c - 256) + ',' + (c - 256) + ',255)' : 'rgb(0,0,' + c + ')';
    const top = Math.floor(yIndex * this.height / nBuckets), bot = Math.floor((yIndex + 1) * this.height / nBuckets);
    ctx.fillRect(this.x + xi, this.y + top, 1, bot - top);
  }
};
