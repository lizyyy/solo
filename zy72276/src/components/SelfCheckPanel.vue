<template>
  <el-card class="self-check-panel">
    <template #header>
      <div class="panel-header">
        <span><el-icon><CircleCheck /></el-icon> 自检结果</span>
        <el-button type="primary" size="small" @click="runCheck" :icon="Refresh">
          重新检查
        </el-button>
      </div>
    </template>

    <el-row :gutter="20">
      <el-col :span="6">
        <el-statistic 
          title="重复导入检查" 
          :value="checkResults.duplicateCheck.count"
        >
          <template #suffix>
            <el-tag :type="checkResults.duplicateCheck.passed ? 'success' : 'warning'" size="small">
              {{ checkResults.duplicateCheck.passed ? '通过' : '发现问题' }}
            </el-tag>
          </template>
        </el-statistic>
      </el-col>
      <el-col :span="6">
        <el-statistic 
          title="坐标格式检查" 
          :value="checkResults.coordinateCheck.count"
        >
          <template #suffix>
            <el-tag :type="checkResults.coordinateCheck.passed ? 'success' : 'danger'" size="small">
              {{ checkResults.coordinateCheck.passed ? '通过' : '发现问题' }}
            </el-tag>
          </template>
        </el-statistic>
      </el-col>
      <el-col :span="6">
        <el-statistic 
          title="补录重算检查" 
          :value="checkResults.recalculateCheck.count"
        >
          <template #suffix>
            <el-tag type="info" size="small">
              已处理
            </el-tag>
          </template>
        </el-statistic>
      </el-col>
      <el-col :span="6">
        <el-statistic 
          title="导出一致性检查" 
          :value="checkResults.exportConsistencyCheck.count"
        >
          <template #suffix>
            <el-tag :type="checkResults.exportConsistencyCheck.passed ? 'success' : 'danger'" size="small">
              {{ checkResults.exportConsistencyCheck.passed ? '通过' : '发现问题' }}
            </el-tag>
          </template>
        </el-statistic>
      </el-col>
    </el-row>

    <el-divider>检查详情</el-divider>

    <el-collapse>
      <el-collapse-item title="重复导入检查详情" name="duplicate">
        <el-alert 
          v-if="checkResults.duplicateCheck.details.length === 0" 
          type="success" 
          :closable="false"
          title="未发现重复导入记录"
        />
        <el-table 
          v-else
          :data="checkResults.duplicateCheck.details" 
          border 
          size="small"
        >
          <el-table-column prop="wallPanelCode" label="墙板编号" width="120" />
          <el-table-column prop="originalLineNumber" label="原始行号" width="100" />
          <el-table-column prop="message" label="说明" min-width="200" />
          <el-table-column prop="duplicateWith" label="重复行" width="100" />
        </el-table>
      </el-collapse-item>

      <el-collapse-item title="坐标格式检查详情" name="coordinate">
        <el-alert 
          v-if="checkResults.coordinateCheck.details.length === 0" 
          type="success" 
          :closable="false"
          title="坐标格式检查通过"
        />
        <div v-else>
          <el-alert type="warning" :closable="false">
            <template #default>
              {{ checkResults.coordinateCheck.message }}
              <br>
              <strong>坐标混合记录已标记为"待复核"状态，不会自动归正，需巡检组人工确认。</strong>
            </template>
          </el-alert>
          <el-table :data="checkResults.coordinateCheck.details" border size="small" style="margin-top: 10px;">
            <el-table-column prop="wallPanelCode" label="墙板编号" width="120" />
            <el-table-column prop="originalLineNumber" label="原始行号" width="100" />
            <el-table-column prop="coordinate" label="坐标" min-width="200" />
            <el-table-column label="检测到的类型" width="150">
              <template #default="{ row }">
                <el-tag v-for="type in row.detectedTypes" :key="type" size="small" style="margin-right: 5px;">
                  {{ type }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="说明" min-width="200" />
          </el-table>
        </div>
      </el-collapse-item>

      <el-collapse-item title="补录重算检查详情" name="recalculate">
        <el-alert 
          v-if="checkResults.recalculateCheck.details.length === 0" 
          type="info" 
          :closable="false"
          title="暂无补录重算记录"
        />
        <el-table 
          v-else
          :data="checkResults.recalculateCheck.details" 
          border 
          size="small"
        >
          <el-table-column prop="wallPanelCode" label="墙板编号" width="120" />
          <el-table-column prop="originalLineNumber" label="原始行号" width="100" />
          <el-table-column prop="message" label="说明" min-width="200" />
          <el-table-column prop="operator" label="操作人" width="100" />
          <el-table-column prop="recalculatedAt" label="重算时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.recalculatedAt) }}
            </template>
          </el-table-column>
        </el-table>
      </el-collapse-item>

      <el-collapse-item title="导出一致性检查详情" name="consistency">
        <el-alert 
          v-if="checkResults.exportConsistencyCheck.details.length === 0" 
          type="success" 
          :closable="false"
          title="导出一致性检查通过"
        />
        <el-table 
          v-else
          :data="checkResults.exportConsistencyCheck.details" 
          border 
          size="small"
        >
          <el-table-column prop="message" label="说明" min-width="300" />
          <el-table-column prop="field" label="字段" width="120" />
          <el-table-column prop="originalValue" label="原值" width="150" />
          <el-table-column prop="unifiedValue" label="统一值" width="150" />
        </el-table>
      </el-collapse-item>
    </el-collapse>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { CircleCheck, Refresh } from '@element-plus/icons-vue'
import { useSimulationStore } from '../stores/simulationStore'

const store = useSimulationStore()

const checkResults = computed(() => store.selfCheckResults)

const runCheck = () => {
  store.runSelfCheck()
  store.runExportConsistencyCheck()
}

const formatDateTime = (isoString) => {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString('zh-CN')
}
</script>

<style scoped>
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
