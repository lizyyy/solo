<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">运营看板</h2>
      <div class="quick-actions">
        <el-button type="primary" @click="exportReport('markdown')">
          <el-icon><Download /></el-icon> 导出 Markdown 报告
        </el-button>
        <el-button type="success" @click="exportReport('html')">
          <el-icon><Download /></el-icon> 导出 HTML 报告
        </el-button>
      </div>
    </div>

    <div class="dashboard-grid">
      <el-card class="stats-card">
        <el-statistic title="总材料批次">
          <template #default>
            <span class="info-text">{{ stats.totalBatches || 0 }}</span>
          </template>
        </el-statistic>
      </el-card>
      <el-card class="stats-card">
        <el-statistic title="临期材料">
          <template #default>
            <span class="warning-text">{{ stats.expiringBatches || 0 }}</span>
          </template>
        </el-statistic>
      </el-card>
      <el-card class="stats-card">
        <el-statistic title="低库存材料">
          <template #default>
            <span class="danger-text">{{ stats.lowStockBatches || 0 }}</span>
          </template>
        </el-statistic>
      </el-card>
      <el-card class="stats-card">
        <el-statistic title="订单总数">
          <template #default>
            <span class="success-text">{{ stats.totalOrders || 0 }}</span>
          </template>
        </el-statistic>
      </el-card>
      <el-card class="stats-card">
        <el-statistic title="亏损订单">
          <template #default>
            <span class="danger-text">{{ stats.negativeMarginOrders || 0 }}</span>
          </template>
        </el-statistic>
      </el-card>
      <el-card class="stats-card">
        <el-statistic title="生产批次">
          <template #default>
            <span class="info-text">{{ stats.totalProductions || 0 }}</span>
          </template>
        </el-statistic>
      </el-card>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <div class="dashboard-section">
          <h3 class="dashboard-section-title">
            <el-icon><Warning /></el-icon> 临期材料预警
          </h3>
          <el-card v-if="expiringMaterials.length > 0">
            <el-table :data="expiringMaterials" size="small">
              <el-table-column prop="materialName" label="材料名称" />
              <el-table-column prop="batchNo" label="批次号" width="120" />
              <el-table-column label="有效期" width="120">
                <template #default="{ row }">
                  <span class="danger-text">{{ row.expiryDate }}</span>
                </template>
              </el-table-column>
              <el-table-column label="剩余库存" width="100">
                <template #default="{ row }">
                  {{ row.currentQuantity }} {{ row.unit }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.isExpired" type="danger">已过期</el-tag>
                  <el-tag v-else type="warning">临期</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
          <el-empty v-else description="暂无临期材料" />
        </div>
      </el-col>

      <el-col :span="12">
        <div class="dashboard-section">
          <h3 class="dashboard-section-title">
            <el-icon><Box /></el-icon> 低库存预警
          </h3>
          <el-card v-if="lowStockMaterials.length > 0">
            <el-table :data="lowStockMaterials" size="small">
              <el-table-column prop="materialName" label="材料名称" />
              <el-table-column prop="batchNo" label="批次号" width="120" />
              <el-table-column label="当前库存" width="120">
                <template #default="{ row }">
                  <span class="danger-text">{{ row.currentQuantity }}</span>
                  {{ row.unit }}
                </template>
              </el-table-column>
              <el-table-column label="安全库存" width="100">
                <template #default="{ row }">
                  {{ row.safetyStock || '-' }} {{ row.unit }}
                </template>
              </el-table-column>
            </el-table>
          </el-card>
          <el-empty v-else description="暂无低库存材料" />
        </div>
      </el-col>
    </el-row>

    <div class="dashboard-section">
      <h3 class="dashboard-section-title">
        <el-icon><Warning /></el-icon> 亏损订单（负毛利）
      </h3>
      <el-card v-if="negativeMarginOrders.length > 0">
        <el-table :data="negativeMarginOrders" size="small">
          <el-table-column prop="orderNo" label="订单号" width="140" />
          <el-table-column prop="customerName" label="客户" width="120" />
          <el-table-column label="订单金额" width="120">
            <template #default="{ row }">
              ¥{{ row.totalAmount?.toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="成本金额" width="120">
            <template #default="{ row }">
              ¥{{ row.totalCost?.toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="利润">
            <template #default="{ row }">
              <span class="danger-text">
                ¥{{ (row.totalAmount - row.totalCost)?.toFixed(2) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="利润率" width="100">
            <template #default="{ row }">
              <span class="danger-text">
                {{ (((row.totalAmount - row.totalCost) / row.totalAmount) * 100).toFixed(1) }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-empty v-else description="暂无亏损订单" />
    </div>

    <div class="dashboard-section">
      <h3 class="dashboard-section-title">
        <el-icon><Search /></el-icon> 材料批次追溯查询
      </h3>
      <el-card>
        <div class="search-bar">
          <el-select
            v-model="traceBatchId"
            placeholder="选择材料批次"
            filterable
            clearable
            style="width: 400px"
            @change="loadTraceData"
          >
            <el-option
              v-for="batch in materialBatches"
              :key="batch.id"
              :label="`${batch.materialName} - ${batch.batchNo} (${batch.currentQuantity} ${batch.unit})`"
              :value="batch.id"
            />
          </el-select>
        </div>

        <div v-if="traceData">
          <el-divider />
          <h4 style="margin-bottom: 16px">追溯结果：{{ traceData.batch.materialName }} - {{ traceData.batch.batchNo }}</h4>
          
          <el-row :gutter="20">
            <el-col :span="8">
              <el-card shadow="hover" class="risk-card warning">
                <div class="form-section-title">材料批次信息</div>
                <div class="form-row">
                  <div>
                    <span style="color: #909399">材料名称：</span>
                    <span>{{ traceData.batch.materialName }}</span>
                  </div>
                  <div>
                    <span style="color: #909399">批次号：</span>
                    <span>{{ traceData.batch.batchNo }}</span>
                  </div>
                  <div>
                    <span style="color: #909399">供应商：</span>
                    <span>{{ traceData.batch.supplierName || '-' }}</span>
                  </div>
                  <div>
                    <span style="color: #909399">库存：</span>
                    <span>{{ traceData.batch.currentQuantity }}/{{ traceData.batch.originalQuantity }} {{ traceData.batch.unit }}</span>
                  </div>
                </div>
              </el-card>
            </el-col>

            <el-col :span="8">
              <el-card shadow="hover" class="risk-card success">
                <div class="form-section-title">影响的生产批次 ({{ traceData.affectedProductions.length }})</div>
                <div v-if="traceData.affectedProductions.length > 0">
                  <div
                    v-for="p in traceData.affectedProductions"
                    :key="p.id"
                    class="timeline-item"
                  >
                    <div><strong>{{ p.productionNo }}</strong> - {{ p.productName }}</div>
                    <div style="color: #909399; font-size: 12px">
                      生产数量: {{ p.quantity }} | 状态: {{ p.status }}
                    </div>
                  </div>
                </div>
                <el-empty v-else :image-size="40" description="无" />
              </el-card>
            </el-col>

            <el-col :span="8">
              <el-card shadow="hover" class="risk-card danger">
                <div class="form-section-title">影响的订单 ({{ traceData.affectedOrders.length }})</div>
                <div v-if="traceData.affectedOrders.length > 0">
                  <div
                    v-for="o in traceData.affectedOrders"
                    :key="o.id"
                    class="timeline-item"
                  >
                    <div><strong>{{ o.orderNo }}</strong></div>
                    <div style="color: #909399; font-size: 12px">
                      客户: {{ o.customerName || '-' }} | 金额: ¥{{ o.totalAmount?.toFixed(2) }}
                    </div>
                  </div>
                </div>
                <el-empty v-else :image-size="40" description="无" />
              </el-card>
            </el-col>
          </el-row>

          <div class="dialog-footer" style="margin-top: 20px">
            <el-button type="primary" @click="exportTraceReport('markdown')">
              导出追溯报告 (Markdown)
            </el-button>
            <el-button type="success" @click="exportTraceReport('html')">
              导出追溯报告 (HTML)
            </el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { dashboardAPI, materialBatchesAPI, exportAPI } from '@/api'
import { ElMessage } from 'element-plus'

const stats = ref({})
const expiringMaterials = ref([])
const lowStockMaterials = ref([])
const negativeMarginOrders = ref([])
const materialBatches = ref([])
const traceBatchId = ref(null)
const traceData = ref(null)

const loadStats = async () => {
  try {
    const [overviewRes, expiringRes, lowStockRes, negativeRes] = await Promise.all([
      dashboardAPI.overview(),
      dashboardAPI.expiring(30),
      dashboardAPI.lowStock(),
      dashboardAPI.negativeMargin()
    ])
    stats.value = overviewRes.data
    expiringMaterials.value = expiringRes.data || []
    lowStockMaterials.value = lowStockRes.data || []
    negativeMarginOrders.value = negativeRes.data || []
  } catch (e) {
    console.error('加载看板数据失败', e)
  }
}

const loadMaterialBatches = async () => {
  try {
    const res = await materialBatchesAPI.list({ limit: 1000 })
    materialBatches.value = res.data || []
  } catch (e) {
    console.error('加载材料批次失败', e)
  }
}

const loadTraceData = async () => {
  if (!traceBatchId.value) {
    traceData.value = null
    return
  }
  try {
    const res = await dashboardAPI.traceMaterialBatch(traceBatchId.value)
    traceData.value = res.data
  } catch (e) {
    console.error('加载追溯数据失败', e)
    traceData.value = null
  }
}

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    confirmed: 'primary',
    completed: 'success',
    cancelled: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const exportReport = async (format) => {
  try {
    const res = await exportAPI.dashboardReport(format)
    const date = new Date().toISOString().split('T')[0]
    const ext = format === 'html' ? 'html' : 'md'
    const mimeType = format === 'html' ? 'text/html' : 'text/markdown'
    downloadFile(res.data, `运营看板报告_${date}.${ext}`, mimeType)
    ElMessage.success(`导出${format === 'html' ? 'HTML' : 'Markdown'}报告成功`)
  } catch (e) {
    ElMessage.error('导出报告失败')
  }
}

const exportTraceReport = async (format) => {
  if (!traceBatchId.value) {
    ElMessage.warning('请先选择材料批次')
    return
  }
  try {
    const res = await exportAPI.traceReport(traceBatchId.value, format)
    const date = new Date().toISOString().split('T')[0]
    const ext = format === 'html' ? 'html' : 'md'
    const mimeType = format === 'html' ? 'text/html' : 'text/markdown'
    const batch = materialBatches.value.find(b => b.id === traceBatchId.value)
    const suffix = batch ? `_${batch.materialName}_${batch.batchNo}` : ''
    downloadFile(res.data, `批次追溯报告${suffix}_${date}.${ext}`, mimeType)
    ElMessage.success(`导出追溯报告成功`)
  } catch (e) {
    ElMessage.error('导出报告失败')
  }
}

onMounted(() => {
  loadStats()
  loadMaterialBatches()
})
</script>
