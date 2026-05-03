<template>
  <div class="artworks-page">
    <div class="page-header">
      <h2>作品管理</h2>
      <div class="header-actions">
        <el-button type="primary" @click="showCreate = true">
          <el-icon><Plus /></el-icon>
          新建作品
        </el-button>
      </div>
    </div>

    <el-card class="card-container">
      <div class="filter-section">
        <el-form :inline="true" :model="filters">
          <el-form-item label="状态">
            <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 120px">
              <el-option label="待排" value="pending" />
              <el-option label="已入窑" value="in_kiln" />
              <el-option label="烧成中" value="firing" />
              <el-option label="已出窑" value="out_kiln" />
              <el-option label="已交付" value="delivered" />
              <el-option label="烧制失败" value="failed" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
          </el-form-item>
          <el-form-item label="客户">
            <el-select v-model="filters.customer_id" placeholder="全部客户" clearable style="width: 150px" filterable>
              <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="泥料">
            <el-select v-model="filters.clay_id" placeholder="全部泥料" clearable style="width: 150px" filterable>
              <el-option v-for="c in clays" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="搜索">
            <el-input v-model="filters.keyword" placeholder="搜索作品名称" clearable style="width: 180px">
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadArtworks">
              <el-icon><Search /></el-icon>
              搜索
            </el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table :data="artworks" v-loading="loading" style="width: 100%">
        <el-table-column prop="name" label="作品名称" min-width="150">
          <template #default="scope">
            <div class="artwork-name-cell">
              <strong>{{ scope.row.name }}</strong>
              <div v-if="scope.row.notes" class="notes-text">{{ scope.row.notes }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" width="100" />
        <el-table-column label="泥料/釉料" width="180">
          <template #default="scope">
            <div class="materials-cell">
              <el-tag size="small" type="info">{{ scope.row.clay_name || '-' }}</el-tag>
              <el-tag size="small">{{ scope.row.glaze_name || '-' }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="尺寸" width="140">
          <template #default="scope">
            <span v-if="scope.row.width && scope.row.height && scope.row.depth">
              {{ scope.row.width }}×{{ scope.row.height }}×{{ scope.row.depth }} cm
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="weight" label="重量(kg)" width="100">
          <template #default="scope">
            {{ scope.row.weight || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="delivery_date" label="交付日期" width="120">
          <template #default="scope">
            <span :class="getDeliveryClass(scope.row.delivery_date, scope.row.status)">
              {{ scope.row.delivery_date || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small">
              {{ scope.row.status_info?.label || scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" link @click="viewDetail(scope.row)">
              <el-icon><View /></el-icon>
              详情
            </el-button>
            <el-button type="primary" size="small" link @click="editArtwork(scope.row)">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button 
              type="danger" 
              size="small" 
              link 
              @click="deleteArtwork(scope.row)"
              :disabled="scope.row.status !== 'pending'"
            >
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-section">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadArtworks"
          @current-change="loadArtworks"
        />
      </div>
    </el-card>

    <el-dialog v-model="showCreate" :title="editingArtwork ? '编辑作品' : '新建作品'" width="600px">
      <el-form :model="artworkForm" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="作品名称" prop="name">
          <el-input v-model="artworkForm.name" placeholder="请输入作品名称" />
        </el-form-item>
        <el-form-item label="客户">
          <el-select v-model="artworkForm.customer_id" placeholder="选择客户" style="width: 100%" filterable clearable>
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="泥料">
              <el-select v-model="artworkForm.clay_id" placeholder="选择泥料" style="width: 100%" filterable>
                <el-option v-for="c in clays" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="釉料">
              <el-select v-model="artworkForm.glaze_id" placeholder="选择釉料" style="width: 100%" filterable>
                <el-option v-for="g in glazes" :key="g.id" :label="g.name" :value="g.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="宽度(cm)">
              <el-input-number v-model="artworkForm.width" :min="0" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="高度(cm)">
              <el-input-number v-model="artworkForm.height" :min="0" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="深度(cm)">
              <el-input-number v-model="artworkForm.depth" :min="0" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="重量(kg)">
              <el-input-number v-model="artworkForm.weight" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="交付日期">
              <el-date-picker
                v-model="artworkForm.delivery_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="artworkForm.notes" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="saveArtwork" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showDetail" title="作品详情" width="700px">
      <div v-if="currentArtwork" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="作品名称">{{ currentArtwork.name }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentArtwork.status)">
              {{ currentArtwork.status_info?.label || currentArtwork.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentArtwork.customer_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="交付日期">
            <span :class="getDeliveryClass(currentArtwork.delivery_date, currentArtwork.status)">
              {{ currentArtwork.delivery_date || '-' }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="泥料">{{ currentArtwork.clay_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="釉料">{{ currentArtwork.glaze_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="尺寸">
            <span v-if="currentArtwork.width && currentArtwork.height && currentArtwork.depth">
              {{ currentArtwork.width }}×{{ currentArtwork.height }}×{{ currentArtwork.depth }} cm
            </span>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="重量">{{ currentArtwork.weight ? currentArtwork.weight + ' kg' : '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentArtwork.notes || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div class="status-section">
          <h4>状态转换</h4>
          <div class="status-actions">
            <el-button 
              v-for="nextStatus in availableNextStatuses" 
              :key="nextStatus"
              :type="nextStatus === 'out_kiln' ? 'success' : nextStatus === 'failed' ? 'danger' : 'primary'"
              size="small"
              @click="changeStatus(nextStatus)"
            >
              标记为 {{ getStatusLabel(nextStatus) }}
            </el-button>
          </div>
        </div>

        <div class="history-section">
          <h4>状态历史</h4>
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in statusHistory"
              :key="index"
              :type="getTimelineType(item.to_status)"
              :timestamp="formatTimestamp(item.timestamp)"
              placement="top"
            >
              <div class="timeline-item-content">
                <span v-if="item.from_status_label">
                  {{ item.from_status_label }} → 
                </span>
                <strong>{{ item.to_status_label }}</strong>
                <span v-if="item.notes" class="history-note">（{{ item.notes }}）</span>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Plus, Search, View, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { artworksApi } from '../api/artworks'
import { customersApi } from '../api/customers'
import { claysApi, glazesApi } from '../api/materials'

const loading = ref(false)
const saving = ref(false)
const artworks = ref([])
const customers = ref([])
const clays = ref([])
const glazes = ref([])

const showCreate = ref(false)
const editingArtwork = ref(null)
const artworkForm = reactive({
  name: '',
  customer_id: null,
  clay_id: null,
  glaze_id: null,
  width: null,
  height: null,
  depth: null,
  weight: null,
  delivery_date: '',
  notes: ''
})

const filters = reactive({
  status: '',
  customer_id: null,
  clay_id: null,
  keyword: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const showDetail = ref(false)
const currentArtwork = ref(null)
const statusHistory = ref([])

const formRef = ref(null)

const rules = {
  name: [{ required: true, message: '请输入作品名称', trigger: 'blur' }]
}

const STATUS_FLOW = {
  pending: { label: '待排', next: ['in_kiln', 'cancelled'] },
  in_kiln: { label: '已入窑', next: ['firing', 'pending'] },
  firing: { label: '烧成中', next: ['out_kiln'] },
  out_kiln: { label: '已出窑', next: ['delivered', 'failed'] },
  delivered: { label: '已交付', next: [] },
  failed: { label: '烧制失败', next: [] },
  cancelled: { label: '已取消', next: [] }
}

const availableNextStatuses = computed(() => {
  if (!currentArtwork.value) return []
  const flow = STATUS_FLOW[currentArtwork.value.status]
  return flow ? flow.next : []
})

const getStatusType = (status) => {
  const types = {
    pending: 'info',
    in_kiln: 'primary',
    firing: 'warning',
    out_kiln: 'success',
    delivered: '',
    failed: 'danger',
    cancelled: 'info'
  }
  return types[status] || ''
}

const getStatusLabel = (status) => {
  return STATUS_FLOW[status]?.label || status
}

const getTimelineType = (status) => {
  return getStatusType(status)
}

const getDeliveryClass = (date, status) => {
  if (!date || status === 'delivered' || status === 'failed' || status === 'cancelled') return ''
  const today = new Date()
  const deliveryDate = new Date(date)
  const diff = Math.ceil((deliveryDate - today) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'delivery-expired'
  if (diff <= 3) return 'delivery-urgent'
  if (diff <= 7) return 'delivery-soon'
  return ''
}

const formatTimestamp = (ts) => {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-CN')
}

const loadArtworks = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.customer_id) params.customer_id = filters.customer_id
    if (filters.clay_id) params.clay_id = filters.clay_id
    
    const res = await artworksApi.getAll(params)
    let data = res.data
    
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase()
      data = data.filter(a => 
        a.name?.toLowerCase().includes(keyword)
      )
    }
    
    artworks.value = data
    pagination.total = data.length
  } catch (error) {
    ElMessage.error('加载作品列表失败')
  } finally {
    loading.value = false
  }
}

const loadCustomers = async () => {
  try {
    const res = await customersApi.getAll()
    customers.value = res.data
  } catch (error) {
    console.error('加载客户失败:', error)
  }
}

const loadMaterials = async () => {
  try {
    const [claysRes, glazesRes] = await Promise.all([
      claysApi.getAll(),
      glazesApi.getAll()
    ])
    clays.value = claysRes.data
    glazes.value = glazesRes.data
  } catch (error) {
    console.error('加载材料失败:', error)
  }
}

const resetFilters = () => {
  filters.status = ''
  filters.customer_id = null
  filters.clay_id = null
  filters.keyword = ''
  loadArtworks()
}

const editArtwork = (artwork) => {
  editingArtwork.value = artwork
  artworkForm.name = artwork.name
  artworkForm.customer_id = artwork.customer_id
  artworkForm.clay_id = artwork.clay_id
  artworkForm.glaze_id = artwork.glaze_id
  artworkForm.width = artwork.width
  artworkForm.height = artwork.height
  artworkForm.depth = artwork.depth
  artworkForm.weight = artwork.weight
  artworkForm.delivery_date = artwork.delivery_date
  artworkForm.notes = artwork.notes
  showCreate.value = true
}

const saveArtwork = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    saving.value = true
    try {
      if (editingArtwork.value) {
        await artworksApi.update(editingArtwork.value.id, artworkForm)
        ElMessage.success('更新成功')
      } else {
        await artworksApi.create(artworkForm)
        ElMessage.success('创建成功')
      }
      showCreate.value = false
      resetForm()
      loadArtworks()
    } catch (error) {
      ElMessage.error('保存失败')
    } finally {
      saving.value = false
    }
  })
}

const resetForm = () => {
  editingArtwork.value = null
  artworkForm.name = ''
  artworkForm.customer_id = null
  artworkForm.clay_id = null
  artworkForm.glaze_id = null
  artworkForm.width = null
  artworkForm.height = null
  artworkForm.depth = null
  artworkForm.weight = null
  artworkForm.delivery_date = ''
  artworkForm.notes = ''
}

const deleteArtwork = async (artwork) => {
  try {
    await ElMessageBox.confirm(`确定要删除作品"${artwork.name}"吗？`, '确认删除', {
      type: 'warning'
    })
    await artworksApi.delete(artwork.id)
    ElMessage.success('删除成功')
    loadArtworks()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败')
    }
  }
}

const viewDetail = async (artwork) => {
  currentArtwork.value = artwork
  showDetail.value = true
  
  try {
    const [detailRes, historyRes] = await Promise.all([
      artworksApi.getById(artwork.id),
      artworksApi.getHistory(artwork.id)
    ])
    currentArtwork.value = detailRes.data
    statusHistory.value = historyRes.data
  } catch (error) {
    console.error('加载详情失败:', error)
  }
}

const changeStatus = async (toStatus) => {
  try {
    await artworksApi.updateStatus(currentArtwork.value.id, toStatus)
    ElMessage.success(`状态已更新为"${getStatusLabel(toStatus)}"`)
    
    const [detailRes, historyRes] = await Promise.all([
      artworksApi.getById(currentArtwork.value.id),
      artworksApi.getHistory(currentArtwork.value.id)
    ])
    currentArtwork.value = detailRes.data
    statusHistory.value = historyRes.data
    loadArtworks()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '状态更新失败')
  }
}

onMounted(() => {
  loadArtworks()
  loadCustomers()
  loadMaterials()
})
</script>

<style scoped>
.artworks-page {
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.filter-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 6px;
}

.artwork-name-cell {
  line-height: 1.5;
}

.notes-text {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.materials-cell {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.detail-content {
  padding: 10px 0;
}

.status-section, .history-section {
  margin-top: 24px;
}

.status-section h4, .history-section h4 {
  margin: 0 0 12px 0;
  font-size: 15px;
  color: #303133;
}

.status-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.timeline-item-content {
  font-size: 14px;
}

.history-note {
  color: #909399;
  font-size: 12px;
}

.delivery-expired { color: #F56C6C; font-weight: 600; }
.delivery-urgent { color: #E6A23C; font-weight: 600; }
.delivery-soon { color: #E6A23C; }
</style>
