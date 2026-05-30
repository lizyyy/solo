<template>
  <div class="result-panel">
    <div class="panel-header">
      <h2>实时弹道数据</h2>
    </div>

    <div class="result-grid">
      <div class="result-card">
        <div class="card-label">飞行时间</div>
        <div class="card-value">{{ flightTime.toFixed(3) }} <span class="unit">s</span></div>
      </div>
      <div class="result-card">
        <div class="card-label">风偏量</div>
        <div class="card-value highlight">{{ windDeflection.toFixed(2) }} <span class="unit">m</span></div>
      </div>
      <div class="result-card">
        <div class="card-label">弹道高度</div>
        <div class="card-value">{{ maxHeight.toFixed(2) }} <span class="unit">m</span></div>
      </div>
      <div class="result-card">
        <div class="card-label">落点偏移</div>
        <div class="card-value warn">{{ totalDrop.toFixed(2) }} <span class="unit">m</span></div>
      </div>
    </div>

    <div class="data-section">
      <h3>弹道详情</h3>
      <div class="detail-table">
        <div class="detail-row">
          <span>终点速度</span>
          <span>{{ finalVelocity.toFixed(1) }} m/s</span>
        </div>
        <div class="detail-row">
          <span>动能衰减</span>
          <span>{{ energyLoss.toFixed(1) }} %</span>
        </div>
        <div class="detail-row">
          <span>风偏角度</span>
          <span>{{ windDriftAngle.toFixed(2) }}°</span>
        </div>
        <div class="detail-row">
          <span>弹着点坐标</span>
          <span class="coord">X:{{ impact.x.toFixed(1) }} Y:{{ impact.y.toFixed(2) }} Z:{{ impact.z.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <div class="chart-section">
      <h3>弹道高度变化</h3>
      <div class="simple-chart">
        <div v-for="(point, idx) in chartPoints" :key="idx"
             class="chart-bar"
             :style="{ height: `${point.height}%`, left: `${point.x}%` }">
        </div>
      </div>
      <div class="chart-labels">
        <span>0</span>
        <span>{{ Math.floor(params.distance / 2) }}m</span>
        <span>{{ params.distance }}m</span>
      </div>
    </div>

    <div class="data-section">
      <h3>统计概览</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value normal">{{ stats.totalNormal }}</div>
          <div class="stat-label">正常记录</div>
        </div>
        <div class="stat-item">
          <div class="stat-value supplemented">{{ stats.totalSupplemented }}</div>
          <div class="stat-label">补录记录</div>
        </div>
        <div class="stat-item">
          <div class="stat-value pending">{{ stats.totalPending }}</div>
          <div class="stat-label">待确认</div>
        </div>
        <div class="stat-item">
          <div class="stat-value anomaly">{{ stats.totalAnomaly }}</div>
          <div class="stat-label">异常</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { recordStore } from '../store/recordStore.js';

const props = defineProps({
  trajectoryResult: { type: Object, default: () => ({ points: [], impact: { x: 0, y: 0, z: 0, time: 0 } }) },
  params: { type: Object, default: () => ({}) }
});

const flightTime = computed(() => props.trajectoryResult.impact?.time || 0);
const windDeflection = computed(() => Math.abs(props.trajectoryResult.impact?.z || 0));
const impact = computed(() => props.trajectoryResult.impact || { x: 0, y: 0, z: 0 });
const totalDrop = computed(() => Math.abs(props.trajectoryResult.impact?.y || 0));

const maxHeight = computed(() => {
  const points = props.trajectoryResult.points || [];
  return points.reduce((max, p) => Math.max(max, p.y), 0);
});

const finalVelocity = computed(() => {
  const points = props.trajectoryResult.points || [];
  if (points.length < 2) return props.params.initialVelocity || 0;
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const dt = last.t - prev.t;
  if (dt === 0) return props.params.initialVelocity || 0;
  const vx = (last.x - prev.x) / dt;
  const vy = (last.y - prev.y) / dt;
  const vz = (last.z - prev.z) / dt;
  return Math.sqrt(vx * vx + vy * vy + vz * vz);
});

const energyLoss = computed(() => {
  const initV = props.params.initialVelocity || 0;
  const finalV = finalVelocity.value;
  if (initV === 0) return 0;
  return (1 - (finalV * finalV) / (initV * initV)) * 100;
});

const windDriftAngle = computed(() => {
  const dist = props.trajectoryResult.impact?.x || 1;
  const drift = props.trajectoryResult.impact?.z || 0;
  return Math.atan2(drift, dist) * 180 / Math.PI;
});

const chartPoints = computed(() => {
  const points = props.trajectoryResult.points || [];
  if (points.length === 0) return [];
  const maxY = Math.max(...points.map(p => p.y), 1);
  const sample = Math.ceil(points.length / 30);
  return points.filter((_, i) => i % sample === 0).map((p, i, arr) => ({
    height: (p.y / maxY) * 100,
    x: (i / (arr.length - 1 || 1)) * 100
  }));
});

const stats = computed(() => recordStore.getRecordStats());
</script>

<style scoped>
.result-panel {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-left: 1px solid #2a2a4e;
  padding: 20px;
  overflow-y: auto;
  height: 100%;
}

.panel-header h2 {
  font-size: 18px;
  color: #e0e0e0;
  font-weight: 600;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #2a2a4e;
}

.result-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.result-card {
  background: #0a0a15;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #2a2a4e;
}

.card-label {
  font-size: 12px;
  color: #8888aa;
  margin-bottom: 6px;
}

.card-value {
  font-size: 22px;
  font-weight: 700;
  color: #e0e0e0;
}

.card-value .unit {
  font-size: 12px;
  font-weight: 400;
  color: #8888aa;
}

.card-value.highlight { color: #00aaff; }
.card-value.warn { color: #f59e0b; }

.data-section {
  margin-bottom: 24px;
}

.data-section h3 {
  font-size: 14px;
  color: #8888aa;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.detail-table {
  background: #0a0a15;
  border-radius: 8px;
  border: 1px solid #2a2a4e;
  overflow: hidden;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #2a2a4e;
  font-size: 13px;
}

.detail-row:last-child { border-bottom: none; }

.detail-row span:first-child { color: #8888aa; }
.detail-row span:last-child { color: #e0e0e0; font-weight: 500; }

.detail-row .coord {
  font-family: monospace;
  font-size: 12px;
  color: #3b82f6;
}

.chart-section {
  margin-bottom: 24px;
}

.chart-section h3 {
  font-size: 14px;
  color: #8888aa;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.simple-chart {
  position: relative;
  height: 100px;
  background: #0a0a15;
  border-radius: 8px;
  border: 1px solid #2a2a4e;
  overflow: hidden;
}

.chart-bar {
  position: absolute;
  bottom: 0;
  width: 6px;
  background: linear-gradient(to top, #3b82f6, #00ff88);
  border-radius: 3px 3px 0 0;
  transform: translateX(-50%);
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: #666688;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-item {
  background: #0a0a15;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  border: 1px solid #2a2a4e;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-value.normal { color: #10b981; }
.stat-value.supplemented { color: #3b82f6; }
.stat-value.pending { color: #f59e0b; }
.stat-value.anomaly { color: #ef4444; }

.stat-label {
  font-size: 11px;
  color: #8888aa;
}
</style>
