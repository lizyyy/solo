<script setup lang="ts">
import type { TestRound } from '@/types'

const props = defineProps<{
  testRound: TestRound
}>()

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}
</script>

<template>
  <div class="grid grid-2">
    <div class="card">
      <h3>基本信息</h3>
      <table class="data-table">
        <tr><td><strong>测试编号</strong></td><td>{{ testRound.testNumber }}</td></tr>
        <tr><td><strong>测试名称</strong></td><td>{{ testRound.testName }}</td></tr>
        <tr><td><strong>模型名称</strong></td><td>{{ testRound.modelName }}</td></tr>
        <tr><td><strong>测试日期</strong></td><td>{{ formatDate(testRound.testDate) }}</td></tr>
        <tr><td><strong>开始时间</strong></td><td>{{ testRound.startTime }}</td></tr>
        <tr><td><strong>结束时间</strong></td><td>{{ testRound.endTime }}</td></tr>
      </table>
    </div>
    
    <div class="card">
      <h3>测试参数</h3>
      <table class="data-table">
        <tr><td><strong>参考面积</strong></td><td>{{ testRound.referenceArea }} m²</td></tr>
        <tr><td><strong>空气密度</strong></td><td>{{ testRound.airDensity }} kg/m³</td></tr>
        <tr><td><strong>风速数据点数</strong></td><td>{{ testRound.windSpeedProfile.length }}</td></tr>
        <tr><td><strong>六分力数据点数</strong></td><td>{{ testRound.forceData.length }}</td></tr>
        <tr><td><strong>传感器校准数</strong></td><td>{{ testRound.sensorCalibrations.length }}</td></tr>
        <tr><td><strong>人工备注数</strong></td><td>{{ testRound.manualNotes.length }}</td></tr>
      </table>
    </div>
  </div>
  
  <div v-if="testRound.sensorCalibrations.length > 0" class="card" style="margin-top: 1.5rem;">
    <h3>传感器校准信息</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th>传感器ID</th>
          <th>传感器名称</th>
          <th>校准日期</th>
          <th>有效期至</th>
          <th>校准因子</th>
          <th>校准人</th>
          <th>证书编号</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cal in testRound.sensorCalibrations" :key="cal.sensorId">
          <td>{{ cal.sensorId }}</td>
          <td>{{ cal.sensorName }}</td>
          <td>{{ cal.calibrationDate }}</td>
          <td>{{ cal.expirationDate }}</td>
          <td>{{ cal.calibrationFactor }}</td>
          <td>{{ cal.calibratedBy }}</td>
          <td>{{ cal.certificateNumber }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  
  <div v-if="testRound.manualNotes.length > 0" class="card" style="margin-top: 1.5rem;">
    <h3>人工备注</h3>
    <div v-for="note in testRound.manualNotes" :key="note.id" class="card" style="margin-top: 1rem;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span class="badge" :class="{
          'badge-success': note.category === 'observation',
          'badge-warning': note.category === 'warning',
          'badge-error': note.category === 'issue',
          'badge-info': note.category === 'other'
        }">
          {{ note.category === 'observation' ? '观察' : 
             note.category === 'warning' ? '警告' : 
             note.category === 'issue' ? '问题' : '其他' }}
        </span>
        <span style="color: var(--text-secondary); font-size: 0.875rem;">
          {{ note.author }} - {{ formatDate(note.timestamp.toString()) }}
        </span>
      </div>
      <p>{{ note.content }}</p>
    </div>
  </div>
</template>
