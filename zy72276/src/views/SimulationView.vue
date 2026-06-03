<template>
  <div class="simulation-container">
    <el-page-header @back="handleBack" content="装配式墙板吊装预演系统">
      <template #extra>
        <el-button type="primary" @click="loadSampleData" :icon="Download">
          加载样例数据
        </el-button>
        <el-button @click="clearAllData" :icon="Delete">
          清空数据
        </el-button>
      </template>
    </el-page-header>

    <div class="content-wrapper">
      <el-steps :active="store.currentStep - 1" finish-status="success" class="main-steps">
        <el-step title="第一步" description="导入障碍物备注" />
        <el-step title="第二步" description="补看楼层剖面草图" />
        <el-step title="第三步" description="更新现场班组说明" />
      </el-steps>

      <div class="steps-content">
        <step-import v-if="store.currentStep === 1" />
        <step-floor-section v-if="store.currentStep === 2" />
        <step-site-instruction v-if="store.currentStep === 3" />
      </div>

      <div class="steps-action">
        <el-button v-if="store.currentStep > 1" @click="store.prevStep()">
          上一步
        </el-button>
        <el-button 
          v-if="store.currentStep < 3" 
          type="primary" 
          @click="store.nextStep()"
        >
          下一步
        </el-button>
      </div>

      <self-check-panel class="self-check-panel" />

      <data-export-panel class="export-panel" />

      <audit-trail-panel class="audit-panel" />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Delete } from '@element-plus/icons-vue'
import { useSimulationStore } from '../stores/simulationStore'
import StepImport from '../components/StepImport.vue'
import StepFloorSection from '../components/StepFloorSection.vue'
import StepSiteInstruction from '../components/StepSiteInstruction.vue'
import SelfCheckPanel from '../components/SelfCheckPanel.vue'
import DataExportPanel from '../components/DataExportPanel.vue'
import AuditTrailPanel from '../components/AuditTrailPanel.vue'
import { sampleObstacleData, sampleFloorSectionData } from '../data/sampleData'

const store = useSimulationStore()

const handleBack = () => {
  ElMessage.info('返回首页')
}

const loadSampleData = () => {
  store.batchImportObstacles(sampleObstacleData)
  sampleFloorSectionData.forEach(section => {
    store.addFloorSectionRecord(section)
  })
  ElMessage.success('样例数据加载完成')
}

const clearAllData = () => {
  store.clearAll()
  ElMessage.success('数据已清空')
}

onMounted(() => {
  store.updateUnifiedResult()
})
</script>

<style scoped>
.simulation-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.main-steps {
  margin-bottom: 30px;
  background: white;
  padding: 20px;
  border-radius: 8px;
}

.steps-content {
  background: white;
  padding: 30px;
  border-radius: 8px;
  margin-bottom: 20px;
  min-height: 400px;
}

.steps-action {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
}

.self-check-panel,
.export-panel,
.audit-panel {
  margin-bottom: 20px;
}
</style>
