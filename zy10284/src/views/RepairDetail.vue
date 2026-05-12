<template>
  <div class="repair-detail">
    <el-page-header @back="goBack" content="报修详情" />
    
    <el-card v-if="order" class="detail-card">
      <template #header>
        <div class="card-header">
          <span>报修单：{{ order.order_no }}</span>
          <el-tag :type="getStatusType(order.status)" size="large">
            {{ getStatusText(order.status) }}
          </el-tag>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="楼栋房间">{{ order.building }}-{{ order.room_number }}</el-descriptions-item>
        <el-descriptions-item label="报修人">{{ order.student_name }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ order.student_phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="维修类型">{{ order.repair_type }}</el-descriptions-item>
        <el-descriptions-item label="提交时间" :span="2">{{ order.submit_time }}</el-descriptions-item>
        <el-descriptions-item label="问题描述" :span="2">{{ order.description }}</el-descriptions-item>
        <el-descriptions-item label="合并至" v-if="order.merged_to_order_no">
          <el-tag type="info">{{ order.merged_to_order_no }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left" v-if="order.merged_orders && order.merged_orders.length">合并工单</el-divider>
      <el-table :data="order.merged_orders || []" stripe style="width: 100%" v-if="order.merged_orders && order.merged_orders.length">
        <el-table-column prop="order_no" label="报修单号" />
        <el-table-column prop="student_name" label="报修人" />
        <el-table-column prop="submit_time" label="提交时间" />
        <el-table-column prop="merge_time" label="合并时间" />
      </el-table>

      <el-divider content-position="left">审核信息</el-divider>
      <el-descriptions :column="2" border v-if="order.audit_result">
        <el-descriptions-item label="审核人">{{ order.auditor || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核结果">
          <el-tag :type="order.audit_result === 'pass' ? 'success' : 'danger'">
            {{ order.audit_result === 'pass' ? '通过' : '拦截' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="审核时间">{{ order.audit_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核备注" :span="2">{{ order.audit_remark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无审核信息" :image-size="80" />

      <el-divider content-position="left">派工信息</el-divider>
      <el-descriptions :column="2" border v-if="order.worker">
        <el-descriptions-item label="维修工人">{{ order.worker }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ order.worker_phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="派工时间">{{ order.assign_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="派工备注" :span="2">{{ order.assign_remark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无派工信息" :image-size="80" />

      <el-divider content-position="left">维修材料</el-divider>
      <el-table :data="order.materials || []" stripe style="width: 100%" v-if="order.materials && order.materials.length">
        <el-table-column prop="material_name" label="材料名称" />
        <el-table-column prop="quantity" label="数量" />
        <el-table-column prop="unit" label="单位" />
        <el-table-column label="是否超量">
          <template #default="{ row }">
            <el-tag :type="row.is_over_limit ? 'danger' : 'success'">
              {{ row.is_over_limit ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="record_time" label="记录时间" />
      </el-table>
      <el-empty v-else description="暂无材料记录" :image-size="80" />

      <el-divider content-position="left">完工信息</el-divider>
      <el-descriptions :column="2" border v-if="order.complete_remark">
        <el-descriptions-item label="完工时间">{{ order.complete_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="完工备注" :span="2">{{ order.complete_remark }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无完工信息" :image-size="80" />

      <el-divider content-position="left">回访信息</el-divider>
      <el-descriptions :column="2" border v-if="order.rating">
        <el-descriptions-item label="评分">
          <el-rate v-model="order.rating" disabled show-score text-color="#ff9900" />
        </el-descriptions-item>
        <el-descriptions-item label="回访时间">{{ order.review_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="回访内容" :span="2">{{ order.review_content || '-' }}</el-descriptions-item>
        <el-descriptions-item label="是否返工">
          <el-tag :type="order.need_rework ? 'danger' : 'success'">
            {{ order.need_rework ? '是' : '否' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无回访信息" :image-size="80" />

      <div class="action-buttons">
        <el-button v-if="order.status === 'pending'" type="primary" @click="handleAction('audit')">审核</el-button>
        <el-button v-if="order.status === 'assigned'" type="primary" @click="handleAction('assign')">派工</el-button>
        <el-button v-if="order.status === 'processing'" type="success" @click="handleAction('material')">记录材料</el-button>
        <el-button v-if="order.status === 'processing'" type="warning" @click="handleAction('complete')">完工确认</el-button>
        <el-button v-if="order.status === 'reviewing'" type="info" @click="handleAction('review')">回访</el-button>
        <el-button v-if="order.status === 'rework'" type="danger" @click="handleAction('rework')">安排返工</el-button>
      </div>
    </el-card>

    <el-skeleton v-else :rows="10" animated />

    <!-- 对话框（复用列表页的逻辑） -->
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

    <el-dialog v-model="showMaterialDialog" title="记录维修材料" width="600px">
      <el-table :data="materialList" style="width: 100%" border>
        <el-table-column label="材料名称" width="150">
          <template #default="{ row }">
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
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const route = useRoute()
const router = useRouter()
const order = ref(null)

const showAuditDialog = ref(false)
const showAssignDialog = ref(false)
const showMaterialDialog = ref(false)
const showCompleteDialog = ref(false)
const showReviewDialog = ref(false)
const showReworkDialog = ref(false)

const auditForm = ref({ auditor: '', audit_result: 'pass', audit_remark: '' })
const assignForm = ref({ worker: '', worker_phone: '', assign_remark: '' })
const materialList = ref([])
const completeForm = ref({ complete_remark: '' })
const reviewForm = ref({ rating: 5, review_content: '' })
const reworkForm = ref({ rework_reason: '', rework_worker: '' })

const fetchOrder = async () => {
  try {
    const res = await axios.get(`/api/repair-orders/${route.params.id}`)
    order.value = res.data
  } catch (err) {
    ElMessage.error('获取报修详情失败')
  }
}

const goBack = () => {
  router.push('/repairs')
}

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    assigned: 'warning',
    processing: 'primary',
    reviewing: 'info',
    completed: 'success',
    rework: 'danger',
    blocked: 'danger',
    merged: 'info'
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
    blocked: '已拦截',
    merged: '已合并'
  }
  return map[status] || status
}

const handleAction = (cmd) => {
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
    await axios.post(`/api/repair-orders/${order.value.id}/audit`, auditForm.value)
    ElMessage.success('审核完成')
    showAuditDialog.value = false
    fetchOrder()
    window.dispatchEvent(new Event('refreshStats'))
  } catch (err) {
    ElMessage.error('审核失败')
  }
}

const submitAssign = async () => {
  try {
    await axios.post(`/api/repair-orders/${order.value.id}/assign`, assignForm.value)
    ElMessage.success('派工完成')
    showAssignDialog.value = false
    fetchOrder()
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
    await axios.post(`/api/repair-orders/${order.value.id}/materials`, { materials: validMaterials })
    ElMessage.success('材料记录完成')
    showMaterialDialog.value = false
    fetchOrder()
  } catch (err) {
    ElMessage.error('材料记录失败')
  }
}

const submitComplete = async () => {
  try {
    await axios.post(`/api/repair-orders/${order.value.id}/complete`, completeForm.value)
    ElMessage.success('完工确认完成')
    showCompleteDialog.value = false
    fetchOrder()
    window.dispatchEvent(new Event('refreshStats'))
  } catch (err) {
    ElMessage.error('完工确认失败')
  }
}

const submitReview = async () => {
  try {
    const res = await axios.post(`/api/repair-orders/${order.value.id}/review`, reviewForm.value)
    if (res.data.need_rework) {
      ElMessage.warning('客户满意度较低，已自动转入返工流程')
    } else {
      ElMessage.success('回访完成')
    }
    showReviewDialog.value = false
    fetchOrder()
    window.dispatchEvent(new Event('refreshStats'))
  } catch (err) {
    ElMessage.error('回访提交失败')
  }
}

const submitRework = async () => {
  try {
    await axios.post(`/api/repair-orders/${order.value.id}/rework`, reworkForm.value)
    ElMessage.success('返工安排完成')
    showReworkDialog.value = false
    fetchOrder()
    window.dispatchEvent(new Event('refreshStats'))
  } catch (err) {
    ElMessage.error('返工安排失败')
  }
}

onMounted(() => {
  fetchOrder()
})
</script>

<style scoped>
.repair-detail {
  max-width: 1200px;
  margin: 0 auto;
}

.detail-card {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-buttons {
  margin-top: 30px;
  display: flex;
  gap: 15px;
  justify-content: center;
}

.add-material-btn {
  margin-top: 15px;
}
</style>
