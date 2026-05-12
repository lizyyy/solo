<template>
  <div class="repair-list">
    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable>
            <el-option label="待审核" value="pending" />
            <el-option label="待派工" value="assigned" />
            <el-option label="维修中" value="processing" />
            <el-option label="待回访" value="reviewing" />
            <el-option label="已完成" value="completed" />
            <el-option label="待返工" value="rework" />
            <el-option label="已拦截" value="blocked" />
          </el-select>
        </el-form-item>
        <el-form-item label="楼栋">
          <el-select v-model="filters.building" placeholder="全部楼栋" clearable>
            <el-option v-for="b in buildings" :key="b" :label="b" :value="b" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchOrders">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="success" @click="exportWeekly">
            <el-icon><Download /></el-icon>
            导出本周报表
          </el-button>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建报修
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="orders" stripe style="width: 100%" @row-dblclick="goToDetail">
        <el-table-column prop="order_no" label="报修单号" width="180" />
        <el-table-column prop="building" label="楼栋" width="100" />
        <el-table-column prop="room_number" label="房间" width="100" />
        <el-table-column prop="student_name" label="报修人" width="100" />
        <el-table-column prop="repair_type" label="维修类型" width="120" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="worker" label="维修工人" width="120" />
        <el-table-column label="评分" width="100">
          <template #default="{ row }">
            <el-rate v-model="row.rating" disabled show-score text-color="#ff9900" />
          </template>
        </el-table-column>
        <el-table-column prop="submit_time" label="提交时间" width="180" />
        <el-table-column label="操作" fixed="right" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="goToDetail(row)">查看</el-button>
            <el-dropdown @command="(cmd) => handleAction(cmd, row)">
              <el-button link>
                更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="audit" v-if="row.status === 'pending'">审核</el-dropdown-item>
                  <el-dropdown-item command="assign" v-if="row.status === 'assigned'">派工</el-dropdown-item>
                  <el-dropdown-item command="material" v-if="row.status === 'processing'">记录材料</el-dropdown-item>
                  <el-dropdown-item command="complete" v-if="row.status === 'processing'">完工</el-dropdown-item>
                  <el-dropdown-item command="review" v-if="row.status === 'reviewing'">回访</el-dropdown-item>
                  <el-dropdown-item command="rework" v-if="row.status === 'rework'">返工</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建报修对话框 -->
    <el-dialog v-model="showCreateDialog" title="新建报修" width="500px">
      <el-form :model="newOrder" label-width="100px">
        <el-form-item label="楼栋房间">
          <el-select v-model="newOrder.dorm_id" placeholder="请选择房间">
            <el-option v-for="dorm in dorms" :key="dorm.id" :label="`${dorm.building}-${dorm.room_number}`" :value="dorm.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="报修人">
          <el-input v-model="newOrder.student_name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="newOrder.student_phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item label="维修类型">
          <el-select v-model="newOrder.repair_type" placeholder="请选择类型">
            <el-option label="水管" value="水管" />
            <el-option label="水龙头" value="水龙头" />
            <el-option label="电路" value="电路" />
            <el-option label="门锁" value="门锁" />
            <el-option label="灯具" value="灯具" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="问题描述">
          <el-input v-model="newOrder.description" type="textarea" :rows="3" placeholder="请详细描述问题" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createOrder">提交报修</el-button>
      </template>
    </el-dialog>

    <!-- 审核对话框 -->
    <el-dialog v-model="showAuditDialog" title="审核报修" width="500px">
      <el-form :model="auditForm" label-width="100px">
        <el-form-item label="审核人">
          <el-input v-model="auditForm.auditor" placeholder="请输入审核人姓名" />
        </el-form-item>
        <el-form-item label="审核结果">
          <el-radio-group v-model="auditForm.audit_result">
            <el-radio label="pass">通过</el-radio>
            <el-radio label="reject">拦截</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审核备注">
          <el-input v-model="auditForm.audit_remark" type="textarea" :rows="2" placeholder="请输入审核意见" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAuditDialog = false">取消</el-button>
        <el-button type="primary" @click="submitAudit">提交审核</el-button>
      </template>
    </el-dialog>

    <!-- 派工对话框 -->
    <el-dialog v-model="showAssignDialog" title="派工" width="500px">
      <el-form :model="assignForm" label-width="100px">
        <el-form-item label="维修工人">
          <el-input v-model="assignForm.worker" placeholder="请输入工人姓名" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="assignForm.worker_phone" placeholder="请输入工人电话" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="assignForm.assign_remark" type="textarea" :rows="2" placeholder="派工备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAssignDialog = false">取消</el-button>
        <el-button type="primary" @click="submitAssign">提交派工</el-button>
      </template>
    </el-dialog>

    <!-- 材料记录对话框 -->
    <el-dialog v-model="showMaterialDialog" title="记录维修材料" width="600px">
      <el-table :data="materialList" style="width: 100%" border>
        <el-table-column label="材料名称" width="150">
          <template #default="{ row, $index }">
            <el-select v-model="row.material_name" placeholder="选择材料">
              <el-option label="水管" value="水管" />
              <el-option label="水龙头" value="水龙头" />
              <el-option label="灯泡" value="灯泡" />
              <el-option label="门锁" value="门锁" />
              <el-option label="电线" value="电线" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="数量" width="150">
          <template #default="{ row }">
            <el-input-number v-model="row.quantity" :min="1" />
          </template>
        </el-table-column>
        <el-table-column label="单位" width="150">
          <template #default="{ row }">
            <el-input v-model="row.unit" placeholder="如：个、米" />
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ $index }">
            <el-button link type="danger" @click="materialList.splice($index, 1)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-button class="add-material-btn" type="primary" plain @click="addMaterial">
        <el-icon><Plus /></el-icon>
        添加材料
      </el-button>
      <template #footer>
        <el-button @click="showMaterialDialog = false">取消</el-button>
        <el-button type="primary" @click="submitMaterial">保存材料</el-button>
      </template>
    </el-dialog>

    <!-- 完工对话框 -->
    <el-dialog v-model="showCompleteDialog" title="完工确认" width="500px">
      <el-form :model="completeForm" label-width="100px">
        <el-form-item label="完工备注">
          <el-input v-model="completeForm.complete_remark" type="textarea" :rows="3" placeholder="请描述维修完成情况" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCompleteDialog = false">取消</el-button>
        <el-button type="primary" @click="submitComplete">确认完工</el-button>
      </template>
    </el-dialog>

    <!-- 回访对话框 -->
    <el-dialog v-model="showReviewDialog" title="客户回访" width="500px">
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="满意度评分">
          <el-rate v-model="reviewForm.rating" show-score text-color="#ff9900" />
        </el-form-item>
        <el-form-item label="回访内容">
          <el-input v-model="reviewForm.review_content" type="textarea" :rows="3" placeholder="请记录客户反馈" />
        </el-form-item>
        <el-alert v-if="reviewForm.rating <= 2" type="error" show-icon title="评分低于等于2星，系统将自动触发返工流程" />
      </el-form>
      <template #footer>
        <el-button @click="showReviewDialog = false">取消</el-button>
        <el-button type="primary" @click="submitReview">提交回访</el-button>
      </template>
    </el-dialog>

    <!-- 返工对话框 -->
    <el-dialog v-model="showReworkDialog" title="安排返工" width="500px">
      <el-form :model="reworkForm" label-width="100px">
        <el-form-item label="返工原因">
          <el-input v-model="reworkForm.rework_reason" type="textarea" :rows="2" placeholder="请输入返工原因" />
        </el-form-item>
        <el-form-item label="安排工人">
          <el-input v-model="reworkForm.rework_worker" placeholder="请输入返工工人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReworkDialog = false">取消</el-button>
        <el-button type="primary" @click="submitRework">提交返工</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const orders = ref([])
const dorms = ref([])
const buildings = ref([])
const filters = ref({
  status: '',
  building: ''
})

const showCreateDialog = ref(false)
const showAuditDialog = ref(false)
const showAssignDialog = ref(false)
const showMaterialDialog = ref(false)
const showCompleteDialog = ref(false)
const showReviewDialog = ref(false)
const showReworkDialog = ref(false)

const currentOrder = ref(null)

const newOrder = ref({
  dorm_id: '',
  student_name: '',
  student_phone: '',
  repair_type: '',
  description: ''
})

const auditForm = ref({ auditor: '', audit_result: 'pass', audit_remark: '' })
const assignForm = ref({ worker: '', worker_phone: '', assign_remark: '' })
const materialList = ref([])
const completeForm = ref({ complete_remark: '' })
const reviewForm = ref({ rating: 5, review_content: '' })
const reworkForm = ref({ rework_reason: '', rework_worker: '' })

const fetchOrders = async () => {
  try {
    const params = { ...filters.value }
    Object.keys(params).forEach(key => {
      if (!params[key]) delete params[key]
    })
    const res = await axios.get('/api/repair-orders', { params })
    orders.value = res.data
  } catch (err) {
    ElMessage.error('获取报修列表失败')
  }
}

const fetchDorms = async () => {
  try {
    const res = await axios.get('/api/dorms')
    dorms.value = res.data
    const buildingRes = await axios.get('/api/dorms/buildings')
    buildings.value = buildingRes.data
  } catch (err) {
    console.error(err)
  }
}

const resetFilters = () => {
  filters.value = { status: '', building: '' }
  fetchOrders()
}

const goToDetail = (row) => {
  router.push(`/repairs/${row.id}`)
}

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    assigned: 'warning',
    processing: 'primary',
    reviewing: 'info',
    completed: 'success',
    rework: 'danger',
    blocked: 'danger'
  }
  return map[status] || ''
}

const getStatusText = (status) => {
  const map = {
    pending: '待审核',
    assigned: '待派工',
    processing: '维修中',
    reviewing: '待回访',
    completed: '已完成',
    rework: '待返工',
    blocked: '已拦截'
  }
  return map[status] || status
}

const createOrder = async () => {
  try {
    await axios.post('/api/repair-orders', newOrder.value)
    ElMessage.success('报修提交成功')
    showCreateDialog.value = false
    newOrder.value = { dorm_id: '', student_name: '', student_phone: '', repair_type: '', description: '' }
    fetchOrders()
    window.dispatchEvent(new Event('refreshStats'))
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '提交失败')
  }
}

const handleAction = (cmd, row) => {
  currentOrder.value = row
  switch (cmd) {
    case 'audit':
      auditForm.value = { auditor: '', audit_result: 'pass', audit_remark: '' }
      showAuditDialog.value = true
      break
    case 'assign':
      assignForm.value = { worker: '', worker_phone: '', assign_remark: '' }
      showAssignDialog.value = true
      break
    case 'material':
      materialList.value = [{ material_name: '', quantity: 1, unit: '个' }]
      showMaterialDialog.value = true
      break
    case 'complete':
      completeForm.value = { complete_remark: '' }
      showCompleteDialog.value = true
      break
    case 'review':
      reviewForm.value = { rating: 5, review_content: '' }
      showReviewDialog.value = true
      break
    case 'rework':
      reworkForm.value = { rework_reason: '', rework_worker: '' }
      showReworkDialog.value = true
      break
  }
}

const submitAudit = async () => {
  try {
    await axios.post(`/api/repair-orders/${currentOrder.value.id}/audit`, auditForm.value)
    ElMessage.success('审核完成')
    showAuditDialog.value = false
    fetchOrders()
    window.dispatchEvent(new Event('refreshStats'))
  } catch (err) {
    ElMessage.error('审核失败')
  }
}

const submitAssign = async () => {
  try {
    await axios.post(`/api/repair-orders/${currentOrder.value.id}/assign`, assignForm.value)
    ElMessage.success('派工完成')
    showAssignDialog.value = false
    fetchOrders()
    window.dispatchEvent(new Event('refreshStats'))
  } catch (err) {
    ElMessage.error('派工失败')
  }
}

const addMaterial = () => {
  materialList.value.push({ material_name: '', quantity: 1, unit: '个' })
}

const submitMaterial = async () => {
  const validMaterials = materialList.value.filter(m => m.material_name)
  if (validMaterials.length === 0) {
    ElMessage.warning('请至少添加一种材料')
    return
  }
  try {
    await axios.post(`/api/repair-orders/${currentOrder.value.id}/materials`, { materials: validMaterials })
    ElMessage.success('材料记录完成')
    showMaterialDialog.value = false
  } catch (err) {
    ElMessage.error('材料记录失败')
  }
}

const submitComplete = async () => {
  try {
    await axios.post(`/api/repair-orders/${currentOrder.value.id}/complete`, completeForm.value)
    ElMessage.success('完工确认完成')
    showCompleteDialog.value = false
    fetchOrders()
    window.dispatchEvent(new Event('refreshStats'))
  } catch (err) {
    ElMessage.error('完工确认失败')
  }
}

const submitReview = async () => {
  try {
    const res = await axios.post(`/api/repair-orders/${currentOrder.value.id}/review`, reviewForm.value)
    if (res.data.need_rework) {
      ElMessage.warning('客户满意度较低，已自动转入返工流程')
    } else {
      ElMessage.success('回访完成')
    }
    showReviewDialog.value = false
    fetchOrders()
    window.dispatchEvent(new Event('refreshStats'))
  } catch (err) {
    ElMessage.error('回访提交失败')
  }
}

const submitRework = async () => {
  try {
    await axios.post(`/api/repair-orders/${currentOrder.value.id}/rework`, reworkForm.value)
    ElMessage.success('返工安排完成')
    showReworkDialog.value = false
    fetchOrders()
    window.dispatchEvent(new Event('refreshStats'))
  } catch (err) {
    ElMessage.error('返工安排失败')
  }
}

const exportWeekly = async () => {
  try {
    const params = {}
    if (filters.value.building) params.building = filters.value.building
    const res = await axios.get('/api/export/weekly', { params, responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `weekly-repair-${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  fetchOrders()
  fetchDorms()
})
</script>

<style scoped>
.repair-list {
  max-width: 1400px;
  margin: 0 auto;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  margin-bottom: 0;
}

.add-material-btn {
  margin-top: 15px;
}
</style>
