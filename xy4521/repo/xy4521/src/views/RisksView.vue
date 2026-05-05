<template>
  <div>
    <div class="filter-bar">
      <div style="display: flex; gap: 12px; align-items: center;">
        <el-text style="font-weight: 500; margin-right: 8px;">风险等级:</el-text>
        <el-checkbox-group v-model="riskLevelFilter">
          <el-checkbox label="high" border>高风险 ({{ highRiskCount }})</el-checkbox>
          <el-checkbox label="medium" border>中风险 ({{ mediumRiskCount }})</el-checkbox>
          <el-checkbox label="low" border>低风险 ({{ lowRiskCount }})</el-checkbox>
        </el-checkbox-group>
      </div>
      <el-button type="primary" @click="resetFilters">
        <el-icon style="margin-right: 6px;"><Refresh /></el-icon>
        重置
      </el-button>
    </div>

    <div v-if="risks.length === 0" class="empty-state">
      <el-icon class="empty-icon"><CircleCheck /></el-icon>
      <div class="empty-text">暂无风险检测结果</div>
      <div class="empty-hint">导入数据后系统将自动检测风险项</div>
    </div>

    <div v-else-if="filteredRisks.length === 0" class="empty-state">
      <el-icon class="empty-icon"><Search /></el-icon>
      <div class="empty-text">没有匹配的风险项</div>
      <div class="empty-hint">请尝试调整筛选条件</div>
    </div>

    <div v-else>
      <div v-for="risk in filteredRisks" :key="risk.id" 
           class="blind-sample-card"
           :style="{ borderLeftColor: getRiskColor(risk.level) }">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <el-icon :size="20" :style="{ color: getRiskColor(risk.level) }">
                <component :is="getRiskIcon(risk.level)" />
              </el-icon>
              <h3 style="margin: 0; font-size: 16px; font-weight: 600;">{{ risk.title }}</h3>
              <el-tag :type="getRiskTagType(risk.level)" size="small">
                {{ getRiskLevelText(risk.level) }}
              </el-tag>
            </div>
            <p style="margin: 0; color: #606266; font-size: 14px;">{{ risk.description }}</p>
          </div>
          <el-tag size="small">{{ getRiskTypeText(risk.type) }}</el-tag>
        </div>

        <div style="background: #fafafa; padding: 16px; border-radius: 4px; margin-bottom: 12px;">
          <div style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #303133;">
            <el-icon style="margin-right: 6px; vertical-align: middle;"><DocumentChecked /></el-icon>
            风险证据:
          </div>
          <ul style="margin: 0; padding-left: 20px;">
            <li v-for="(evidence, idx) in risk.evidence" :key="idx"
                style="font-size: 13px; color: #303133; margin: 6px 0; line-height: 1.6;">
              {{ evidence }}
            </li>
          </ul>
        </div>

        <div v-if="risk.sampleIds && risk.sampleIds.length > 0">
          <div style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #303133;">
            <el-icon style="margin-right: 6px; vertical-align: middle;"><User /></el-icon>
            涉及的盲样 ({{ risk.sampleIds.length }} 个):
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <el-tag v-for="sampleId in risk.sampleIds" :key="sampleId" 
                    :type="getRiskTagType(risk.level)" effect="plain"
                    style="cursor: pointer;"
                    @click="locateSample(sampleId)">
              {{ getSampleBlindNumber(sampleId) }}
            </el-tag>
          </div>
        </div>

        <div style="margin-top: 12px; text-align: right;">
          <el-button type="primary" size="small" link 
                     v-if="risk.sampleIds && risk.sampleIds.length > 0"
                     @click="locateSample(risk.sampleIds[0])">
            <el-icon style="margin-right: 4px;"><View /></el-icon>
            查看详情
          </el-button>
        </div>
      </div>
    </div>

    <div v-if="filteredRisks.length > 0" style="margin-top: 24px; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
      <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">
        <el-icon style="margin-right: 6px; vertical-align: middle;"><DataAnalysis /></el-icon>
        风险统计汇总
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
        <div style="padding: 16px; background: #fef0f0; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: 700; color: #f56c6c;">{{ highRiskCount }}</div>
          <div style="font-size: 14px; color: #f56c6c; margin-top: 4px;">高风险项</div>
        </div>
        <div style="padding: 16px; background: #fdf6ec; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: 700; color: #e6a23c;">{{ mediumRiskCount }}</div>
          <div style="font-size: 14px; color: #e6a23c; margin-top: 4px;">中风险项</div>
        </div>
        <div style="padding: 16px; background: #f0f9eb; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: 700; color: #67c23a;">{{ lowRiskCount }}</div>
          <div style="font-size: 14px; color: #67c23a; margin-top: 4px;">低风险项</div>
        </div>
        <div style="padding: 16px; background: #ecf5ff; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: 700; color: #409eff;">{{ risks.length }}</div>
          <div style="font-size: 14px; color: #409eff; margin-top: 4px;">总风险项</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getRiskLevelText, getRiskTypeText, RISK_LEVELS, RISK_TYPES } from '../utils/riskDetector'

const props = defineProps({
  risks: {
    type: Array,
    default: () => []
  },
  samples: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['locateSample'])

const riskLevelFilter = ref(['high', 'medium', 'low'])

const highRiskCount = computed(() => 
  props.risks.filter(r => r.level === RISK_LEVELS.HIGH).length
)

const mediumRiskCount = computed(() => 
  props.risks.filter(r => r.level === RISK_LEVELS.MEDIUM).length
)

const lowRiskCount = computed(() => 
  props.risks.filter(r => r.level === RISK_LEVELS.LOW).length
)

const filteredRisks = computed(() => {
  if (riskLevelFilter.value.length === 0) {
    return props.risks
  }
  return props.risks.filter(r => riskLevelFilter.value.includes(r.level))
})

const getRiskColor = (level) => {
  switch (level) {
    case RISK_LEVELS.HIGH:
      return '#f56c6c'
    case RISK_LEVELS.MEDIUM:
      return '#e6a23c'
    case RISK_LEVELS.LOW:
      return '#67c23a'
    default:
      return '#909399'
  }
}

const getRiskTagType = (level) => {
  switch (level) {
    case RISK_LEVELS.HIGH:
      return 'danger'
    case RISK_LEVELS.MEDIUM:
      return 'warning'
    case RISK_LEVELS.LOW:
      return 'success'
    default:
      return 'info'
  }
}

const getRiskIcon = (level) => {
  switch (level) {
    case RISK_LEVELS.HIGH:
      return 'WarningFilled'
    case RISK_LEVELS.MEDIUM:
      return 'InfoFilled'
    case RISK_LEVELS.LOW:
      return 'CircleCheckFilled'
    default:
      return 'QuestionFilled'
  }
}

const getSampleBlindNumber = (sampleId) => {
  const sample = props.samples.find(s => s.id === sampleId)
  return sample ? (sample.blindNumber || sample.id) : sampleId
}

const locateSample = (sampleId) => {
  emit('locateSample', sampleId)
}

const resetFilters = () => {
  riskLevelFilter.value = ['high', 'medium', 'low']
}
</script>
