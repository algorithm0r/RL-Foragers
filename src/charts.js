'use strict';
// A small line graph. In the browser it paints on its own off-canvas element (see DataView in
// ui.js); headless runs record the same series into packets without drawing. Keeps a rolling
// window of the most recent points and autoscales to what's visible.
var LineGraph = class LineGraph {
  constructor(x, y, w, h, label, maxPoints) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.label = label;
    this.maxPoints = maxPoints || 240;
    this.data = [];
  }

  push(v) {
    this.data.push(v);
    if (this.data.length > this.maxPoints) this.data.shift();
  }

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = '#333'; ctx.strokeRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = '#8a8f98'; ctx.font = '11px sans-serif';
    ctx.fillText(this.label, this.x + 5, this.y + 13);
    if (this.data.length > 1) {
      let min = Infinity, max = -Infinity;
      for (const v of this.data) { if (v < min) min = v; if (v > max) max = v; }
      const range = (max - min) || 1;
      // current value + range labels (top-right)
      ctx.fillStyle = '#7fd1ff'; ctx.textAlign = 'right';
      ctx.fillText(this.data[this.data.length - 1].toFixed(1), this.x + this.w - 5, this.y + 13);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#5a5f68';
      ctx.fillText(max.toFixed(0), this.x + 5, this.y + 25);
      ctx.fillText(min.toFixed(0), this.x + 5, this.y + this.h - 5);
      ctx.strokeStyle = '#7fd1ff'; ctx.beginPath();
      for (let i = 0; i < this.data.length; i++) {
        const px = this.x + (i / (this.data.length - 1)) * this.w;
        const py = this.y + this.h - ((this.data[i] - min) / range) * this.h;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
};
