<template>
  <div v-loading="loading">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>{{ experiment?.name }}</h2>
      <div>
        <el-button @click="goBack">返回列表</el-button>
        <el-button type="success" @click="showExportDialog = true">导出</el-button>
        <el-button type="primary" @click="saveExperiment">保存修改</el-button>
      </div>
    </div>

    <el-alert
      v-if="experiment?.need_recalculation"
      title="流量比例需要修正"
      type="error"
      style="margin-bottom: 20px;"
    >
      <template #default>
        <p>当前流量比例总和: {{ trafficTotal }}% (应为100%)</p>
        <el-button type="primary" size="small" @click="showCorrectionDialog = true">
          立即修正
        </el-button>
      </template>
    </el-alert>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="基本信息" name="basic">
        <el-form :model="experiment" label-width="120px">
          <el-form-item label="实验ID">
            <el-input v-model="experiment.id" disabled />
          </el-form-item>
          <el-form-item label="实验名称">
            <el-input v-model="experiment.name" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="experiment.description" type="textarea" />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="experiment.status">
              <el-option label="草稿" value="draft" />
              <el-option label="运行中" value="running" />
              <el-option label="已暂停" value="paused" />
              <el-option label="已完成" value="completed" />
            </el-select>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="实验分组" name="groups">
        <el-button type="primary" size="small" @click="addGroup" style="margin-bottom: 15px;">
          添加分组
        </el-button>
        <el-table :data="experiment?.groups" style="width: 100%">
          <el-table-column prop="id" label="分组ID" width="100" />
          <el-table-column prop="name" label="分组名称" width="150">
            <template #default="{ row }">
              <el-input v-model="row.name" size="small" />
            </template>
          </el-table-column>
          <el-table-column prop="traffic_ratio" label="流量比例(%)" width="180">
            <template #default="{ row }">
              <el-input-number v-model="row.traffic_ratio" :min="0" :max="100" size="small" />
            </template>
          </el-table-column>
          <el-table-column prop="is_control" label="是否对照组" width="130">
            <template #default="{ row }">
              <el-checkbox v-model="row.is_control" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row, $index }">
              <el-button type="danger" link size="small" @click="removeGroup($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div style="margin-top: 15px; color: #666;">
          当前流量总和: <strong :style="{ color: trafficTotal === 100 ? '#67C23A' : '#F56C6C' }">{{ trafficTotal }}%</strong>
        </div>
      </el-tab-pane>

      <el-tab-pane label="互斥规则" name="mutex">
        <el-button type="primary" size="small" @click="addMutexRule" style="margin-bottom: 15px;">
          添加规则
        </el-button>
        <el-table :data="experiment?.mutex_rules" style="width: 100%">
          <el-table-column prop="name" label="规则名称" width="150">
            <template #default="{ row }">
              <el-input v-model="row.name" size="small" />
            </template>
          </el-table-column>
          <el-table-column prop="rule_type" label="规则类型" width="150">
            <template #default="{ row }">
              <el-select v-model="row.rule_type" size="small">
                <el-option label="用户分群" value="user_segment" />
                <el-option label="用户标签" value="user_tag" />
                <el-option label="功能" value="feature" />
                <el-option label="设备" value="device" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column prop="conditions" label="条件" min-width="250">
            <template #default="{ row }">
              <el-input
                v-model="row.conditionsText"
                type="textarea"
                :rows="2"
                size="small"
                placeholder="条件表达式，如: user_segment = 'new'"
              />
            </template>
          </el-table-column>
          <el-table-column prop="is_valid" label="验证状态" width="120">
            <template #default="{ row }">
              <el-tag :type="row.is_valid ? 'success' : 'danger'">
                {{ row.is_valid ? '有效' : '无效' }}
              </el-tag>
              <div v-if="!row.is_valid" style="color: #F56C6C; font-size: 12px; margin-top: 5px;">
                {{ row.error_message }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row, $index }">
              <el-button type="danger" link size="small" @click="removeMutexRule($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="效果报表" name="report">
        <div v-if="!experiment?.report" style="text-align: center; padding: 50px; color: #999;">
          暂无报表数据，请确保流量比例正确后重新计算
        </div>
        <div v-else>
          <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
            <span>报表生成时间: {{ formatDate(experiment.report.generated_at) }}</span>
            <el-button type="primary" size="small" @click="recalculateReport" :disabled="experiment.need_recalculation">
              重新计算
            </el-button>
          </div>
          <el-table :data="reportData" style="width: 100%" border>
            <el-table-column prop="group_id" label="分组ID" width="120" />
            <el-table-column prop="metric_id" label="指标ID" width="120" />
            <el-table-column prop="value" label="数值" width="150">
              <template #default="{ row }">
                <strong>{{ row.value }}</strong>
              </template>
            </el-table-column>
            <el-table-column prop="sample_size" label="样本量" width="120" />
            <el-table-column v-if="hasConfidenceInterval" label="置信区间" width="200">
              <template #default="{ row }">
                {{ row.confidence_interval ? row.confidence_interval.join(' ~ ') : '-' }}
              </template>
            </el-table-column>
            <el-table-column v-if="hasPValue" label="P值" width="120">
              <template #default="{ row }">
                {{ row.p_value ?? '-' }}
              </template>
            </el-table-column>
            <el-table-column v-if="hasSignificance" label="显著性" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.is_significant" type="success">显著</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showCorrectionDialog" title="修正流量比例" width="500px">
      <div style="margin-bottom: 20px;">
        <h4>修正前:</h4>
        <div v-for="group in experiment?.groups" :key="group.id" style="margin: 5px 0;">
          {{ group.name }}: {{ group.traffic_ratio }}%
        </div>
        <div style="margin-top: 10px; color: #F56C6C;">
          总和: {{ trafficTotal }}%
        </div>
      </div>
      <div style="margin-bottom: 20px;">
        <h4>建议修正值:</h4>
        <div v-for="(group, idx) in suggestedGroups" :key="group.id" style="margin: 5px 0;">
          {{ group.name }}: 
          <el-input-number v-model="suggestedGroups[idx].traffic_ratio" :min="0" :max="100" size="small" />
        </div>
        <div style="margin-top: 10px; color: #67C23A;">
          总和: {{ suggestedTotal }}%
        </div>
      </div>
      <el-form label-width="100px">
        <el-form-item label="修正原因">
          <el-input v-model="correctionReason" type="textarea" :rows="2" placeholder="请说明修正原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCorrectionDialog = false">取消</el-button>
        <el-button type="primary" @click="applyCorrection">应用修正</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showExportDialog" title="导出实验" width="400px">
      <el-form label-width="100px">
        <el-form-item label="导出格式">
          <el-radio-group v-model="exportFormat">
            <el-radio label="json">JSON</el-radio>
            <el-radio label="excel">Excel</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="包含报表">
          <el-switch v-model="exportIncludeReport" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showExportDialog = false">取消</el-button>
        <el-button type="primary" @click="doExport">导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const experiment = ref(null)
const loading = ref(false)
const activeTab = ref('basic')
const showCorrectionDialog = ref(false)
const showExportDialog = ref(false)
const suggestedGroups = ref([])
const correctionReason = ref('')
const exportFormat = ref('json')
const exportIncludeReport = ref(true)

const trafficTotal = computed(() => {
  if (!experiment.value?.groups) return 0
  return experiment.value.groups.reduce((sum, g) => sum + (g.traffic_ratio || 0), 0)
})

const suggestedTotal = computed(() => {
  return suggestedGroups.value.reduce((sum, g) => sum + (g.traffic_ratio || 0), 0)
})

const reportData = computed(() => {
  return experiment.value?.report?.data || []
})

const hasConfidenceInterval = computed(() => {
  return reportData.value.some(d => d.confidence_interval)
})

const hasPValue = computed(() => {
  return reportData.value.some(d => d.p_value !== undefined)
})

const hasSignificance = computed(() => {
  return reportData.value.some(d => d.is_significant !== undefined)
})

const fetchExperiment = async () => {
  loading.value = true
  try {
    const res = await axios.get(`/api/experiments/${route.params.id}`)
    experiment.value = res.data
    if (experiment.value.mutex_rules) {
      experiment.value.mutex_rules.forEach(rule => {
        rule.conditionsText = rule.conditions?.join('\n') || ''
      })
    }
  } catch (err) {
    ElMessage.error('获取实验详情失败')
  } finally {
    loading.value = false
  }
}

const saveExperiment = async () => {
  try {
    const data = { ...experiment.value }
    if (data.mutex_rules) {
      data.mutex_rules = data.mutex_rules.map(r => ({
        ...r,
        conditions: r.conditionsText?.split('\n').filter(c => c.trim()) || []
      }))
    }
    await axios.put(`/api/experiments/${experiment.value.id}`, data)
    ElMessage.success('保存成功')
    fetchExperiment()
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

const addGroup = () => {
  const newId = `g${experiment.value.groups.length + 1}`
  experiment.value.groups.push({
    id: newId,
    name: `新分组${experiment.value.groups.length + 1}`,
    traffic_ratio: 0,
    is_control: false
  })
}

const removeGroup = (index) => {
  experiment.value.groups.splice(index, 1)
}

const addMutexRule = () => {
  experiment.value.mutex_rules.push({
    id: `mr${Date.now()}`,
    name: '新规则',
    rule_type: 'user_segment',
    conditions: [],
    conditionsText: '',
    is_valid: true
  })
}

const removeMutexRule = (index) => {
  experiment.value.mutex_rules.splice(index, 1)
}

const recalculateReport = async () => {
  try {
    await axios.post(`/api/recalculate/${experiment.value.id}`)
    ElMessage.success('重新计算成功')
    fetchExperiment()
  } catch (err) {
    ElMessage.error('重新计算失败，请先修正流量比例')
  }
}

const applyCorrection = async () => {
  try {
    const corrections = {
      groups: suggestedGroups.value.map(g => ({
        id: g.id,
        name: g.name,
        traffic_ratio: g.traffic_ratio,
        is_control: g.is_control
      }))
    }
    await axios.post('/api/corrections', {
      experiment_id: experiment.value.id,
      corrections,
      reason: correctionReason.value
    })
    showCorrectionDialog.value = false
    ElMessage.success('修正已应用')
    fetchExperiment()
  } catch (err) {
    ElMessage.error('修正失败')
  }
}

const doExport = async () => {
  try {
    const res = await axios.post('/api/export', 
      { 
        experiment_id: experiment.value.id, 
        format: exportFormat.value, 
        include_report: exportIncludeReport.value 
      },
      { responseType: 'blob' }
    )
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${experiment.value.id}.${exportFormat.value === 'excel' ? 'xlsx' : exportFormat.value}`
    a.click()
    window.URL.revokeObjectURL(url)
    showExportDialog.value = false
    ElMessage.success('导出成功')
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

const goBack = () => {
  router.push('/experiments')
}

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchExperiment()
})

watch(
  () => showCorrectionDialog.value,
  (val) => {
    if (val && experiment.value) {
      suggestedGroups.value = experiment.value.groups.map(g => ({ ...g }))
      const total = trafficTotal.value
      if (total !== 100) {
        const diff = 100 - total
        const perGroup = diff / suggestedGroups.value.length
        suggestedGroups.value.forEach(g => {
          g.traffic_ratio = Math.round((g.traffic_ratio + perGroup) * 10) / 10
        })
      }
      correctionReason.value = ''
    }
  }
)
</script>
