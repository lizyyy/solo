<template>
  <div class="right-panel">
    <div class="risk-panel-header">
      <div class="risk-panel-title">
        <el-icon :size="18"><WarningFilled /></el-icon>
        风险检查
        <el-badge 
          :value="projectStore.risks.length" 
          :type="projectStore.risks.length > 0 ? 'danger' : 'success'"
          class="risk-panel-badge"
        />
      </div>
      <el-button type="primary" link size="small" @click="projectStore.updateRisks()">
        重新检查
      </el-button>
    </div>

    <div class="risk-list">
      <template v-if="projectStore.risks.length === 0">
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div class="empty-state-text">检查通过</div>
          <div class="empty-state-hint">所有风险项已处理完毕</div>
        </div>
      </template>

      <template v-else>
        <div 
          v-for="risk in projectStore.risks" 
          :key="risk.id"
          class="risk-item"
          :class="risk.level"
        >
          <div class="risk-title">
            <el-tag :type="getRiskTagType(risk.level)" size="small" class="risk-level-badge">
              {{ getRiskLevelLabel(risk.level) }}
            </el-tag>
            {{ risk.title }}
          </div>
          <div class="risk-description">
            {{ risk.description }}
          </div>
          <div class="risk-suggestion">
            <strong>建议：</strong>{{ risk.suggestion }}
          </div>
          
          <div v-if="risk.affectedEntities" style="margin-top: 8px;">
            <el-link 
              v-if="risk.affectedEntities.boxId" 
              type="primary"
              @click="locateBox(risk.affectedEntities.boxId)"
            >
              定位箱子 #{{ risk.affectedEntities.boxNumber }}
            </el-link>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useProjectStore } from '@/stores/projectStore'
import { WarningFilled } from '@element-plus/icons-vue'
import { RiskLevel, RiskLevelLabels } from '@/models/types'

const projectStore = useProjectStore()

function getRiskLevelLabel(level) {
  return RiskLevelLabels[level] || level
}

function getRiskTagType(level) {
  const mapping = {
    [RiskLevel.LOW]: 'info',
    [RiskLevel.MEDIUM]: 'warning',
    [RiskLevel.HIGH]: 'danger',
    [RiskLevel.CRITICAL]: 'danger'
  }
  return mapping[level] || 'info'
}

function locateBox(boxId) {
  projectStore.setSelectedBox(boxId)
}
</script>
