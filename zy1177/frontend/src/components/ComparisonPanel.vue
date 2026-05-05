<template>
  <div class="panel-container">
    <div class="section">
      <h3>📊 选择对比方案</h3>
      
      <el-form label-position="top" size="small">
        <el-form-item label="方案A (基准)">
          <el-select 
            v-model="batchId1" 
            placeholder="选择第一个调度批次"
            style="width: 100%;"
            clearable
          >
            <el-option
              v-for="batch in availableBatches"
              :key="batch.id"
              :label="`${batch.name} (${batch.algorithm})`"
              :value="batch.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="方案B (对比)">
          <el-select 
            v-model="batchId2" 
            placeholder="选择第二个调度批次"
            style="width: 100%;"
            clearable
          >
            <el-option
              v-for="batch in availableBatches"
              :key="batch.id"
              :label="`${batch.name} (${batch.algorithm})`"
              :value="batch.id"
              :disabled="batch.id === batchId1"
            />
          </el-select>
        </el-form-item>
      </el-form>
      
      <el-button 
        type="primary" 
        @click="runComparison"
        :loading="isComparing"
        :disabled="!batchId1 || !batchId2"
        style="width: 100%; margin-top: 10px;"
      >
        执行对比分析
      </el-button>
    </div>
    
    <el-divider v-if="comparisonResult" />
    
    <div v-if="comparisonResult" class="section">
      <h3>📈 对比结果</h3>
      
      <el-table :data="comparisonTableData" size="small" border>
        <el-table-column label="指标" prop="metric" width="120" />
        <el-table-column 
          label="方案A" 
          prop="value1" 
          :cell-class-name="getBetterCellClass('value1')"
        />
        <el-table-column 
          label="方案B" 
          prop="value2" 
          :cell-class-name="getBetterCellClass('value2')"
        />
        <el-table-column label="差异" prop="difference" />
      </el-table>
      
      <el-divider content-position="left">详细分析</el-divider>
      
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="推荐方案">
          <el-tag :type="recommendation.type" size="large">
            {{ recommendation.text }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="分析结论">
          {{ conclusion }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
    
    <el-divider v-if="comparisonResult" />
    
    <div v-if="comparisonResult" class="section">
      <h3>📄 导出报告</h3>
      
      <el-radio-group v-model="reportFormat" size="small" style="margin-bottom: 10px;">
        <el-radio-button value="markdown">Markdown</el-radio-button>
        <el-radio-button value="json">JSON</el-radio-button>
      </el-radio-group>
      
      <el-button 
        type="success" 
        @click="exportReport"
        :loading="isExporting"
        style="width: 100%;"
      >
        导出 {{ reportFormat.toUpperCase() }} 报告
      </el-button>
      
      <el-button 
        type="info" 
        @click="viewReport"
        style="width: 100%; margin-top: 10px;"
      >
        查看报告预览
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../services/api'

const emit = defineEmits(['comparison-result'])

const batchId1 = ref(null)
const batchId2 = ref(null)
const availableBatches = ref([])
const isComparing = ref(false)
const isExporting = ref(false)
const comparisonResult = ref(null)
const reportFormat = ref('markdown')

const comparisonTableData = computed(() => {
  if (!comparisonResult.value) return []
  
  const b1 = comparisonResult.value.batch1
  const b2 = comparisonResult.value.batch2
  const comp = comparisonResult.value.comparison
  
  return [
    {
      metric: '总帧数',
      value1: b1.total_frames,
      value2: b2.total_frames,
      difference: comp.frames_difference,
      lowerIsBetter: true
    },
    {
      metric: '机器人数量',
      value1: b1.total_robots,
      value2: b2.total_robots,
      difference: b2.total_robots - b1.total_robots,
      lowerIsBetter: true
    },
    {
      metric: '订单数量',
      value1: b1.total_orders,
      value2: b2.total_orders,
      difference: b2.total_orders - b1.total_orders,
      lowerIsBetter: false
    },
    {
      metric: '碰撞风险',
      value1: b1.collision_risks,
      value2: b2.collision_risks,
      difference: comp.risks_difference,
      lowerIsBetter: true
    }
  ]
})

const recommendation = computed(() => {
  if (!comparisonResult.value) return { type: 'info', text: '无数据' }
  
  const b1 = comparisonResult.value.batch1
  const b2 = comparisonResult.value.batch2
  const better = comparisonResult.value.comparison.better_batch
  
  if (b1.collision_risks < b2.collision_risks) {
    return { type: 'success', text: `方案A (${b1.id}) - 更安全` }
  } else if (b2.collision_risks < b1.collision_risks) {
    return { type: 'success', text: `方案B (${b2.id}) - 更安全` }
  } else {
    return { type: 'warning', text: '两个方案表现相近' }
  }
})

const conclusion = computed(() => {
  if (!comparisonResult.value) return ''
  
  const b1 = comparisonResult.value.batch1
  const b2 = comparisonResult.value.batch2
  const comp = comparisonResult.value.comparison
  
  const parts = []
  
  if (comp.risks_difference < 0) {
    parts.push(`方案B的碰撞风险比方案A少 ${Math.abs(comp.risks_difference)} 处，更安全。`)
  } else if (comp.risks_difference > 0) {
    parts.push(`方案A的碰撞风险比方案B少 ${comp.risks_difference} 处，更安全。`)
  } else {
    parts.push('两个方案的碰撞风险相同。')
  }
  
  if (comp.frames_difference < 0) {
    parts.push(`方案B的执行时间更短，少 ${Math.abs(comp.frames_difference)} 帧。`)
  } else if (comp.frames_difference > 0) {
    parts.push(`方案A的执行时间更短，少 ${comp.frames_difference} 帧。`)
  }
  
  return parts.join(' ')
})

const getBetterCellClass = (col) => {
  return (row) => {
    if (row.lowerIsBetter === undefined) return ''
    
    if (row.lowerIsBetter) {
      if (col === 'value1' && row.value1 < row.value2) {
        return 'better-cell'
      }
      if (col === 'value2' && row.value2 < row.value1) {
        return 'better-cell'
      }
    } else {
      if (col === 'value1' && row.value1 > row.value2) {
        return 'better-cell'
      }
      if (col === 'value2' && row.value2 > row.value1) {
        return 'better-cell'
      }
    }
    
    return ''
  }
}

const loadBatches = async () => {
  try {
    const result = await api.getBatches()
    availableBatches.value = (result.batches || []).filter(
      b => b.status === 'completed'
    )
  } catch (e) {
    console.error('Failed to load batches:', e)
  }
}

const runComparison = async () => {
  if (!batchId1.value || !batchId2.value) {
    ElMessage.warning('请选择两个批次进行对比')
    return
  }
  
  if (batchId1.value === batchId2.value) {
    ElMessage.warning('请选择两个不同的批次')
    return
  }
  
  isComparing.value = true
  
  try {
    const result = await api.compareBatches(batchId1.value, batchId2.value)
    comparisonResult.value = result.comparison
    emit('comparison-result', comparisonResult.value)
    ElMessage.success('对比分析完成')
  } catch (e) {
    ElMessage.error('对比失败: ' + e.message)
  } finally {
    isComparing.value = false
  }
}

const exportReport = async () => {
  if (!batchId1.value || !batchId2.value) return
  
  isExporting.value = true
  
  try {
    const report = await api.getComparisonReport(
      batchId1.value, 
      batchId2.value, 
      reportFormat.value
    )
    
    const blob = new Blob(
      [report], 
      { type: reportFormat.value === 'json' ? 'application/json' : 'text/markdown' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comparison_report_${Date.now()}.${reportFormat.value === 'json' ? 'json' : 'md'}`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('报告导出成功')
  } catch (e) {
    ElMessage.error('导出失败: ' + e.message)
  } finally {
    isExporting.value = false
  }
}

const viewReport = async () => {
  if (!batchId1.value || !batchId2.value) return
  
  try {
    const report = await api.getComparisonReport(
      batchId1.value, 
      batchId2.value, 
      'markdown'
    )
    
    await ElMessageBox.alert(
      '<pre style="white-space: pre-wrap; font-size: 12px; max-height: 500px; overflow-y: auto;">' + report + '</pre>',
      '对比报告',
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: '关闭',
        customClass: 'report-dialog'
      }
    )
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('获取报告失败: ' + e.message)
    }
  }
}

onMounted(() => {
  loadBatches()
})
</script>

<style scoped>
.panel-container {
  padding: 5px;
}

.section {
  margin-bottom: 15px;
}

.section h3 {
  font-size: 14px;
  color: #303133;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
}

:deep(.better-cell) {
  background-color: rgba(103, 194, 58, 0.15) !important;
  color: #67c23a;
  font-weight: 600;
}
</style>
