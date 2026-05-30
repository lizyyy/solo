<template>
  <div class="app-container">
    <div class="left-panel">
      <ControlPanel
        @paramsChange="handleParamsChange"
        @submit="handleSubmit"
        @reset="handleReset"
      />
    </div>

    <div class="center-panel">
      <div class="scene-wrapper">
        <BallisticScene
          :trajectoryPoints="trajectoryResult.points"
          :impactPoint="trajectoryResult.impact"
          :windSpeed="currentParams.windSpeed"
          :windAngle="currentParams.windAngle"
          :distance="currentParams.distance"
        />
      </div>
      <RecordHistory />
    </div>

    <div class="right-panel">
      <ResultPanel
        :trajectoryResult="trajectoryResult"
        :params="currentParams"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import BallisticScene from './components/BallisticScene.vue';
import ControlPanel from './components/ControlPanel.vue';
import ResultPanel from './components/ResultPanel.vue';
import RecordHistory from './components/RecordHistory.vue';
import { calculateTrajectory } from './utils/physics.js';
import { recordStore } from './store/recordStore.js';

const currentParams = ref({
  initialVelocity: 800,
  bulletMass: 0.01,
  bulletDiameter: 0.00762,
  windSpeed: 5,
  windAngle: 90,
  distance: 500,
  elevationAngle: 0,
  units: 'metric'
});

const trajectoryResult = computed(() => {
  return calculateTrajectory(currentParams.value);
});

function handleParamsChange(params) {
  currentParams.value = { ...params };
}

function handleSubmit(params) {
  const result = calculateTrajectory(params);
  recordStore.addRecord(params, result);
}

function handleReset() {
}

function addSampleData() {
  const samples = [
    { params: { initialVelocity: 800, bulletMass: 0.01, bulletDiameter: 0.00762, windSpeed: 5, windAngle: 90, distance: 500, elevationAngle: 0 }, options: { notes: '标准训练样例' } },
    { params: { initialVelocity: 850, bulletMass: 0.012, bulletDiameter: 0.00782, windSpeed: 8, windAngle: 75, distance: 600, elevationAngle: 0 }, options: { notes: '长距离测试' } },
    { params: { initialVelocity: 750, bulletMass: 0.008, bulletDiameter: 0.00556, windSpeed: 3, windAngle: -90, distance: 300, elevationAngle: 0 }, options: { notes: '左侧风测试' } },
    { params: { initialVelocity: 820, bulletMass: 0.01, bulletDiameter: 0.00762, windSpeed: 10, windAngle: 120, distance: 550, elevationAngle: 0 }, options: { notes: '右逆风 - 训练后补录', source: 'supplement' } },
    { params: { initialVelocity: 900, bulletMass: 0.015, bulletDiameter: 0.00859, windSpeed: 6, windAngle: 45, distance: 400, elevationAngle: 0 }, options: { notes: '备注已修改：风向确认无误' } },
  ];

  samples.forEach(sample => {
    const result = calculateTrajectory(sample.params);
    recordStore.addRecord(sample.params, result, sample.options);
  });

  const anomalySamples = [
    { params: { initialVelocity: 800, bulletMass: 0.01, bulletDiameter: 0.00762, windSpeed: 5, windAngle: 200, distance: 500, elevationAngle: 0 }, options: { notes: '风向异常，待确认' } },
    { params: { initialVelocity: 2000, bulletMass: 0.01, bulletDiameter: 0.00762, windSpeed: 5, windAngle: 90, distance: 500, elevationAngle: 0 }, options: { notes: '初速超界' } },
    { params: { initialVelocity: 800, bulletMass: 0.01, bulletDiameter: 0.00762, windSpeed: 5, windAngle: 90, distance: 6000, elevationAngle: 0 }, options: { notes: '距离超界异常' } },
  ];

  anomalySamples.forEach(sample => {
    const result = calculateTrajectory(sample.params);
    recordStore.addRecord(sample.params, result, sample.options);
  });
}

onMounted(() => {
  if (recordStore.records.length === 0 && recordStore.pendingRecords.length === 0 && recordStore.anomalyRecords.length === 0) {
    addSampleData();
  }
});
</script>

<style scoped>
.app-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.left-panel {
  width: 320px;
  flex-shrink: 0;
}

.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.scene-wrapper {
  flex: 1;
  min-height: 0;
}

.right-panel {
  width: 320px;
  flex-shrink: 0;
}
</style>
