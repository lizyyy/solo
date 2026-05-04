<template>
  <div class="trade-plan">
    <div class="page-header">
      <h2 class="page-title">交易计划</h2>
      <div class="action-bar">
        <el-button type="primary" @click="openImportPlanDialog">
          <el-icon><Upload /></el-icon>
          导入计划
        </el-button>
        <el-button @click="openAddPlanDialog">
          <el-icon><Plus /></el-icon>
          新建计划
        </el-button>
      </div>
    </div>

    <div class="search-bar">
      <el-select v-model="selectedTradingDayId" placeholder="选择交易日" style="width: 200px" @change="loadTradePlans">
        <el-option
          v-for="day in tradingDays"
          :key="day.id"
          :label="day.date"
          :value="day.id"
        />
      </el-select>
      <el-select v-model="filterStatus" placeholder="计划状态" clearable style="width: 150px" @change="loadTradePlans">
        <el-option label="待执行" value="pending" />
        <el-option label="进行中" value="in_progress" />
        <el-option label="已完成" value="completed" />
        <el-option label="已取消" value="cancelled" />
        <el-option label="已过期" value="expired" />
      </el-select>
      <el-select v-model="filterPlanType" placeholder="计划类型" clearable style="width: 150px" @change="loadTradePlans">
        <el-option label="买入计划" value="buy" />
        <el-option label="卖出计划" value="sell" />
        <el-option label="观察计划" value="watch" />
      </el-select>
    </div>

    <el-card>
      <el-table :data="tradePlans" style="width: 100%" v-loading="loading">
        <el-table-column prop="symbol" label="代码" width="100" />
        <el-table-column prop="name" label="名称" width="120" show-overflow-tooltip />
        <el-table-column prop="plan_type" label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.plan_type === 'buy' ? 'success' : row.plan_type === 'sell' ? 'danger' : 'info'" size="small">
              {{ getPlanTypeName(row.plan_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="价格区间" width="180">
          <template #default="{ row }">
            <div v-if="row.entry_price_min || row.entry_price_max">
              {{ formatPrice(row.entry_price_min) }} ~ {{ formatPrice(row.entry_price_max) }}
            </div>
            <span v-else class="pnl-neutral">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="target_price" label="目标价" width="100">
          <template #default="{ row }">
            {{ formatPrice(row.target_price) }}
          </template>
        </el-table-column>
        <el-table-column prop="stop_loss_price" label="止损价" width="100">
          <template #default="{ row }">
            {{ formatPrice(row.stop_loss_price) }}
          </template>
        </el-table-column>
        <el-table-column prop="planned_quantity" label="计划数量" width="100">
          <template #default="{ row }">
            {{ formatNumber(row.planned_quantity) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button text type="primary" size="small" @click="executePlan(row)">执行</el-button>
              <el-button text type="success" size="small" @click="editPlan(row)">编辑</el-button>
              <el-button text type="info" size="small" @click="viewPlanDetail(row)">详情</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="tradePlans.length === 0 && !loading" description="暂无交易计划" />
    </el-card>

    <el-dialog v-model="planDialogVisible" :title="editingPlan ? '编辑交易计划' : '新建交易计划'" width="600px">
      <el-form :model="planForm" :rules="planRules" ref="planFormRef" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="股票代码" prop="symbol">
              <el-input v-model="planForm.symbol" placeholder="如：600519" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="股票名称" prop="name">
              <el-input v-model="planForm.name" placeholder="如：贵州茅台" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="计划类型">
              <el-select v-model="planForm.plan_type" style="width: 100%">
                <el-option label="买入计划" value="buy" />
                <el-option label="卖出计划" value="sell" />
                <el-option label="观察计划" value="watch" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="风险等级">
              <el-select v-model="planForm.risk_level" style="width: 100%">
                <el-option label="低" value="low" />
                <el-option label="中" value="medium" />
                <el-option label="高" value="high" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="买入价下限">
              <el-input-number v-model="planForm.entry_price_min" :precision="2" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="买入价上限">
              <el-input-number v-model="planForm.entry_price_max" :precision="2" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="目标价">
              <el-input-number v-model="planForm.target_price" :precision="2" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="止损价">
              <el-input-number v-model="planForm.stop_loss_price" :precision="2" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="计划数量">
              <el-input-number v-model="planForm.planned_quantity" :min="0" :step="100" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优先级">
              <el-rate v-model="planForm.priority" :max="5" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="买入理由">
          <el-input v-model="planForm.entry_reason" type="textarea" :rows="2" placeholder="描述买入的逻辑和理由" />
        </el-form-item>
        <el-form-item label="卖出理由">
          <el-input v-model="planForm.exit_reason" type="textarea" :rows="2" placeholder="描述卖出的条件和理由" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="planDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePlan">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="交易计划详情" width="500px">
      <el-descriptions :column="2" border v-if="selectedPlan">
        <el-descriptions-item label="股票代码">{{ selectedPlan.symbol }}</el-descriptions-item>
        <el-descriptions-item label="股票名称">{{ selectedPlan.name }}</el-descriptions-item>
        <el-descriptions-item label="计划类型">
          <el-tag :type="selectedPlan.plan_type === 'buy' ? 'success' : selectedPlan.plan_type === 'sell' ? 'danger' : 'info'" size="small">
            {{ getPlanTypeName(selectedPlan.plan_type) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="当前状态">
          <el-tag :type="getStatusTagType(selectedPlan.status)" size="small">
            {{ getStatusName(selectedPlan.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="价格区间">{{ formatPrice(selectedPlan.entry_price_min) }} ~ {{ formatPrice(selectedPlan.entry_price_max) }}</el-descriptions-item>
        <el-descriptions-item label="风险等级">{{ selectedPlan.risk_level === 'low' ? '低' : selectedPlan.risk_level === 'medium' ? '中' : '高' }}</el-descriptions-item>
        <el-descriptions-item label="目标价">{{ formatPrice(selectedPlan.target_price) }}</el-descriptions-item>
        <el-descriptions-item label="止损价">{{ formatPrice(selectedPlan.stop_loss_price) }}</el-descriptions-item>
        <el-descriptions-item label="计划数量" :span="2">{{ formatNumber(selectedPlan.planned_quantity) }} 股</el-descriptions-item>
        <el-descriptions-item label="买入理由" :span="2">{{ selectedPlan.entry_reason || '无' }}</el-descriptions-item>
        <el-descriptions-item label="卖出理由" :span="2">{{ selectedPlan.exit_reason || '无' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="executePlan(selectedPlan)">执行计划</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importPlanDialogVisible" title="导入交易计划" width="500px">
      <el-form :model="importPlanForm" label-width="100px">
        <el-form-item label="交易日期" required>
          <el-select v-model="importPlanForm.trading_day_id" placeholder="选择交易日" style="width: 100%">
            <el-option
              v-for="day in tradingDays"
              :key="day.id"
              :label="day.date"
              :value="day.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="计划文件">
          <el-radio-group v-model="importPlanForm.importType">
            <el-radio value="json">上传 JSON 文件</el-radio>
            <el-radio value="text">直接粘贴 JSON</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="importPlanForm.importType === 'json'" label="选择文件">
          <el-upload
            ref="planUploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".json"
            :on-change="handlePlanFileChange"
          >
            <el-button type="primary">选择 JSON 文件</el-button>
            <template #tip>
              <div class="el-upload__tip">仅支持 JSON 格式</div>
            </template>
          </el-upload>
          <div v-if="importPlanForm.fileName" style="margin-top: 10px">
            <el-tag>{{ importPlanForm.fileName }}</el-tag>
          </div>
        </el-form-item>
        <el-form-item v-if="importPlanForm.importType === 'text'" label="JSON 内容">
          <el-input
            v-model="importPlanForm.jsonContent"
            type="textarea"
            :rows="10"
            placeholder="粘贴 JSON 格式的交易计划列表"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="importPlanDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="uploadTradePlan">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { importApi, tradingDayApi, tradingApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const tradingDays = ref([])
const selectedTradingDayId = ref(null)
const filterStatus = ref('')
const filterPlanType = ref('')
const tradePlans = ref([])

const planDialogVisible = ref(false)
const editingPlan = ref(null)
const planFormRef = ref(null)
const planForm = ref({
  symbol: '',
  name: '',
  plan_type: 'buy',
  entry_price_min: null,
  entry_price_max: null,
  target_price: null,
  stop_loss_price: null,
  planned_quantity: 0,
  entry_reason: '',
  exit_reason: '',
  risk_level: 'medium',
  priority: 3
})

const planRules = {
  symbol: [{ required: true, message: '请输入股票代码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入股票名称', trigger: 'blur' }]
}

const detailDialogVisible = ref(false)
const selectedPlan = ref(null)

const importPlanDialogVisible = ref(false)
const importPlanForm = ref({
  trading_day_id: null,
  importType: 'json',
  fileName: '',
  jsonContent: ''
})
const importing = ref(false)
const planUploadRef = ref(null)

function formatNumber(value) {
  if (value === null || value === undefined) return '0'
  return Number(value).toLocaleString('zh-CN')
}

function formatPrice(value) {
  if (value === null || value === undefined) return '-'
  return Number(value).toFixed(2)
}

function getPlanTypeName(type) {
  const map = { buy: '买入', sell: '卖出', watch: '观察' }
  return map[type] || type
}

function getStatusName(status) {
  const map = {
    pending: '待执行',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    expired: '已过期'
  }
  return map[status] || status
}

function getStatusTagType(status) {
  const map = {
    pending: 'info',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'info',
    expired: 'info'
  }
  return map[status] || 'info'
}

async function loadTradingDays() {
  try {
    const res = await tradingDayApi.list({ pageSize: 50 })
    tradingDays.value = res.data?.list || []
    if (tradingDays.value.length > 0) {
      const active = tradingDays.value.find(d => d.status === 'active')
      selectedTradingDayId.value = active?.id || tradingDays.value[0].id
      importPlanForm.value.trading_day_id = selectedTradingDayId.value
    }
  } catch (error) {
    console.error('加载交易日失败:', error)
  }
}

async function loadTradePlans() {
  if (!selectedTradingDayId.value) return
  try {
    loading.value = true
    const res = await importApi.getTradePlans({
      trading_day_id: selectedTradingDayId.value,
      status: filterStatus.value || undefined,
      plan_type: filterPlanType.value || undefined,
      pageSize: 100
    })
    tradePlans.value = res.data?.list || []
  } catch (error) {
    console.error('加载交易计划失败:', error)
  } finally {
    loading.value = false
  }
}

function openAddPlanDialog() {
  editingPlan.value = null
  planForm.value = {
    symbol: '',
    name: '',
    plan_type: 'buy',
    entry_price_min: null,
    entry_price_max: null,
    target_price: null,
    stop_loss_price: null,
    planned_quantity: 0,
    entry_reason: '',
    exit_reason: '',
    risk_level: 'medium',
    priority: 3
  }
  planDialogVisible.value = true
}

function editPlan(plan) {
  editingPlan.value = plan
  planForm.value = { ...plan }
  planDialogVisible.value = true
}

async function savePlan() {
  if (!planFormRef.value) return
  await planFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (editingPlan.value) {
          await importApi.updateTradePlan(editingPlan.value.id, planForm.value)
          ElMessage.success('更新成功')
        } else {
          await importApi.createTradePlan({
            ...planForm.value,
            trading_day_id: selectedTradingDayId.value
          })
          ElMessage.success('创建成功')
        }
        planDialogVisible.value = false
        await loadTradePlans()
      } catch (error) {
        console.error('保存失败:', error)
      }
    }
  })
}

function viewPlanDetail(plan) {
  selectedPlan.value = plan
  detailDialogVisible.value = true
}

function executePlan(plan) {
  if (!selectedTradingDayId.value) {
    ElMessage.warning('请先选择交易日')
    return
  }
  
  ElMessageBox.confirm(
    `确定要执行 ${plan.symbol}(${plan.name}) 的交易计划吗？`,
    '执行计划',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      const price = plan.entry_price_min || plan.entry_price_max || plan.target_price || 0
      const data = {
        trading_day_id: selectedTradingDayId.value,
        symbol: plan.symbol,
        name: plan.name,
        price: price,
        quantity: plan.planned_quantity || 100,
        order_subtype: 'limit',
        notes: `执行交易计划：${plan.entry_reason || ''}`
      }
      
      if (plan.plan_type === 'buy') {
        await tradingApi.executeBuy(data)
        ElMessage.success('买入订单已提交')
      } else if (plan.plan_type === 'sell') {
        await tradingApi.executeSell(data)
        ElMessage.success('卖出订单已提交')
      }
      
      detailDialogVisible.value = false
    } catch (error) {
      console.error('执行计划失败:', error)
    }
  }).catch(() => {})
}

function openImportPlanDialog() {
  importPlanForm.value = {
    trading_day_id: selectedTradingDayId.value,
    importType: 'json',
    fileName: '',
    jsonContent: ''
  }
  importPlanDialogVisible.value = true
}

function handlePlanFileChange(file) {
  importPlanForm.value.fileName = file.name
}

async function uploadTradePlan() {
  if (!importPlanForm.value.trading_day_id) {
    ElMessage.warning('请选择交易日')
    return
  }

  try {
    importing.value = true
    
    if (importPlanForm.value.importType === 'json') {
      if (!importPlanForm.value.fileName || !planUploadRef.value?.uploadFiles?.length) {
        ElMessage.warning('请选择文件')
        return
      }
      const formData = new FormData()
      formData.append('file', planUploadRef.value.uploadFiles[0].raw)
      formData.append('trading_day_id', importPlanForm.value.trading_day_id)

      await importApi.importTradePlanFile(formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    } else {
      if (!importPlanForm.value.jsonContent) {
        ElMessage.warning('请输入 JSON 内容')
        return
      }
      const plans = JSON.parse(importPlanForm.value.jsonContent)
      await importApi.importTradePlan({
        trading_day_id: importPlanForm.value.trading_day_id,
        plans
      })
    }
    
    ElMessage.success('导入成功')
    importPlanDialogVisible.value = false
    await loadTradePlans()
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败：' + error.message)
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  await loadTradingDays()
  if (selectedTradingDayId.value) {
    await loadTradePlans()
  }
})
</script>

<style scoped>
.trade-plan {
  height: 100%;
}
</style>
