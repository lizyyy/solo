const _ = require('lodash');

class NuclearDensityCalculator {
  constructor(options = {}) {
    this.bandwidth = options.bandwidth || 1.0;
    this.kernel = options.kernel || this.gaussianKernel;
    this.gridSize = options.gridSize || 100;
  }

  gaussianKernel(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  calculateDensity(points, evaluationPoints = null) {
    if (!points || points.length === 0) {
      return [];
    }

    const data = points.map(p => typeof p === 'number' ? p : p.value);
    const evalPoints = evaluationPoints || this.generateGrid(data);

    return evalPoints.map(x => {
      const density = data.reduce((sum, xi) => {
        return sum + this.kernel((x - xi) / this.bandwidth);
      }, 0) / (data.length * this.bandwidth);

      return { x, density };
    });
  }

  generateGrid(data) {
    const min = Math.min(...data) - this.bandwidth * 2;
    const max = Math.max(...data) + this.bandwidth * 2;
    const step = (max - min) / this.gridSize;
    
    return Array.from({ length: this.gridSize + 1 }, (_, i) => min + i * step);
  }

  findPeaks(densityResults, threshold = 0.1) {
    if (!densityResults || densityResults.length < 3) {
      return [];
    }

    const peaks = [];
    const maxDensity = Math.max(...densityResults.map(d => d.density));
    const actualThreshold = maxDensity * threshold;

    for (let i = 1; i < densityResults.length - 1; i++) {
      const prev = densityResults[i - 1].density;
      const curr = densityResults[i].density;
      const next = densityResults[i + 1].density;

      if (curr > prev && curr > next && curr >= actualThreshold) {
        peaks.push({
          position: densityResults[i].x,
          density: curr,
          index: i,
          relativeHeight: curr / maxDensity
        });
      }
    }

    return peaks.sort((a, b) => b.density - a.density);
  }

  findValleys(densityResults) {
    if (!densityResults || densityResults.length < 3) {
      return [];
    }

    const valleys = [];

    for (let i = 1; i < densityResults.length - 1; i++) {
      const prev = densityResults[i - 1].density;
      const curr = densityResults[i].density;
      const next = densityResults[i + 1].density;

      if (curr < prev && curr < next) {
        valleys.push({
          position: densityResults[i].x,
          density: curr,
          index: i
        });
      }
    }

    return valleys;
  }

  analyzeFlow(points) {
    const densityResults = this.calculateDensity(points);
    const peaks = this.findPeaks(densityResults);
    const valleys = this.findValleys(densityResults);

    return {
      densityCurve: densityResults,
      peaks,
      valleys,
      summary: {
        totalPoints: points.length,
        peakCount: peaks.length,
        dominantPeak: peaks[0] || null,
        bandwidth: this.bandwidth
      }
    };
  }
}

module.exports = NuclearDensityCalculator;
