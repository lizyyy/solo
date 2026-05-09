<template>
  <div v-if="loading">
    <el-empty description="加载中..." />
  </div>
  <div v-else-if="order">
    <div class="page-header">
      <div>
        <el-button @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <span class="page-title" style="margin-left: 12px;">转诊单详情</span>
      </div>
      <div>
        <el-button @click="showAppointmentDialog = true" :disabled="order.status === 'cancelled' || order.status === 'closed'">
          <el-icon><Calendar /></el-icon>
          新建预约
        </el-button>
        <el-button @click="showExamDialog = true" :disabled="order.status === 'cancelled' || order.status === 'closed'">
          <el-icon><DocumentAdd /></el-icon>
          上传检查
        </el-button>
        <el-button type="primary" @click="handleClose" v-if="order.status === 'reported'">
          <el-icon><Check /></el-icon>
          闭环
        </el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="16">
        <div class="table-card">
          <div class="detail-section-title">基本信息</div>
          <div class="detail-info">
            <div class="detail-item">
              <div class="detail-label">转诊单号</div>
              <div class="detail-value">{{ order.referral_no }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">当前状态</div>
              <div class="detail-value">
                <span :class="['status-tag', `status-${order.status}`]">{{ getStatusText(order.status) }}</span>
              </div>
            </div>
            <div class="detail-item">
              <div class="detail-label">创建时间</div>
              <div class="detail-value">{{ order.create_time }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">更新时间</div>
              <div class="detail-value">{{ order.update_time }}</div>
            </div>
          </div>
        </div>

        <div class="table-card" style="margin-top: 16px;">
          <div class="detail-section-title">患者信息</div>
          <div class="detail-info">
            <div class="detail-item">
              <div class="detail-label">患者姓名</div>
              <div class="detail-value">{{ order.patient_name }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">性别</div>
              <div class="detail-value">{{ order.patient_gender }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">年龄</div>
              <div class="detail-value">{{ order.patient_age }} 岁</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">联系电话</div>
              <div class="detail-value">{{ order.patient_phone }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">身份证号</div>
              <div class="detail-value">{{ order.patient_id_card || '-' }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">地址</div>
              <div class="detail-value">{{ order.patient_address || '-' }}</div>
            </div>
          </div>
        </div>

        <div class="table-card" style="margin-top: 16px;">
          <div class="detail-section-title">转诊信息</div>
          <div class="detail-info">
            <div class="detail-item">
              <div class="detail-label">来源医院</div>
              <div class="detail-value">{{ order.source_hospital }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">来源科室</div>
              <div class="detail-value">{{ order.source_department || '-' }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">来源医生</div>
              <div class="detail-value">{{ order.source_doctor || '-' }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">转诊时间</div>
              <div class="detail-value">{{ order.referral_time }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">目标医院</div>
              <div class="detail-value">{{ order.target_hospital }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">目标科室</div>
              <div class="detail-value">{{ order.target_department }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">目标医生</div>
              <div class="detail-value">{{ order.target_doctor || '-' }}</div>
            </div>
          </div>
          <div class="detail-info" style="grid-template-columns: repeat(2, 1fr); margin-top: 12px;">
            <div class="detail-item">
              <div class="detail-label">转诊原因</div>
              <div class="detail-value">{{ order.referral_reason }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">初步诊断</div>
              <div class="detail-value">{{ order.initial_diagnosis }}</div>
            </div>
          </div>
        </div>

        <div class="table-card" style="margin-top: 16px;">
          <div class="detail-section-title">时间节点</div>
          <el-timeline>
            <el-timeline-item
              v-for="(node, index) in timelineNodes"
              :key="index"
              :timestamp="node.time"
              placement="top"
              :type="node.type"
            >
              {{ node.content }}
            </el-timeline-item>
          </el-timeline>
        </div>

        <div class="table-card" style="margin-top: 16px;">
          <div class="detail-section-title">预约记录</div>
          <el-table :data="order.appointments" stripe style="width: 100%" empty-text="暂无预约记录">
            <el-table-column prop="check_type" label="检查类型" width="100" />
            <el-table-column prop="check_item" label="检查项目" />
            <el-table-column prop="dept_name" label="科室" width="120" />
            <el-table-column prop="bed_no" label="床位" width="80" />
            <el-table-column prop="appointment_time" label="预约时间" width="180" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getAppointmentStatusType(row.status)" size="small">
                  {{ getAppointmentStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button link @click="updateAppointmentStatus(row, 'ongoing')" v-if="row.status === 'scheduled'">开始</el-button>
                <el-button link @click="updateAppointmentStatus(row, 'completed')" v-if="row.status === 'ongoing'">完成</el-button>
                <el-button link type="danger" @click="updateAppointmentStatus(row, 'cancelled')" v-if="['scheduled', 'ongoing'].includes(row.status)">取消</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="table-card" style="margin-top: 16px;">
          <div class="detail-section-title">检查结果</div>
          <el-table :data="order.examResults" stripe style="width: 100%" empty-text="暂无检查结果">
            <el-table-column prop="exam_type" label="检查类型" width="100" />
            <el-table-column prop="exam_name" label="检查项目" />
            <el-table-column prop="exam_time" label="检查时间" width="180" />
            <el-table-column prop="exam_doctor" label="检查医生" width="100" />
            <el-table-column label="是否异常" width="100">
              <template #default="{ row }">
                <el-tag :type="row.abnormal_flag ? 'danger' : 'success'" size="small">
                  {{ row.abnormal_flag ? '异常' : '正常' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="abnormal_desc" label="异常描述" min-width="150" show-overflow-tooltip />
          </el-table>
        </div>
      </el-col>

      <el-col :span="8">
        <div class="table-card">
          <div class="detail-section-title" style="border-left-color: #F56C6C;">异常提醒</div>
          <div v-if="order.exceptions.length === 0" class="el-table__empty-text">暂无异常</div>
          <div v-else>
            <div v-for="item in order.exceptions" :key="item.id" style="padding: 12px 0; border-bottom: 1px solid #ebeef5;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <el-tag :type="item.exception_level === 'danger' ? 'danger' : 'warning'" size="small">
                  {{ item.exception_level === 'danger' ? '严重' : '警告' }}
                </el-tag>
                <span v-if="item.handled" style="color: #67C23A; font-size: 12px;">已处理</span>
                <span v-else style="color: #F56C6C; font-size: 12px;">待处理</span>
              </div>
              <div style="margin-top: 8px;">{{ item.exception_content }}</div>
              <div style="margin-top: 4px; color: #909399; font-size: 12px;">{{ item.create_time }}</div>
            </div>
          </div>
        </div>

        <div class="table-card" style="margin-top: 16px;">
          <div class="detail-section-title">操作日志</div>
          <div v-if="order.logs.length === 0" class="el-table__empty-text">暂无操作日志</div>
          <div v-else>
            <div v-for="log in order.logs" :key="log.id" class="timeline-item">
              <div class="timeline-time">{{ log.create_time }}</div>
              <div class="timeline-content">
                <strong>{{ log.operator }}</strong> - {{ log.operation_content }}
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="showAppointmentDialog" title="新建预约" width="500px">
      <el-form :model="appointmentForm" label-width="100px">
        <el-form-item label="检查类型">
          <el-select v-model="appointmentForm.check_type" style="width: 100%">
            <el-option label="影像检查" value="影像检查" />
            <el-option label="检验检查" value="检验检查" />
            <el-option label="病理检查" value="病理检查" />
            <el-option label="内镜检查" value="内镜检查" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="检查项目">
          <el-input v-model="appointmentForm.check_item" />
        </el-form-item>
        <el-form-item label="预约科室">
          <el-select v-model="appointmentForm.dept_name" filterable allow-create style="width: 100%">
            <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="床位号">
          <el-input v-model="appointmentForm.bed_no" />
        </el-form-item>
        <el-form-item label="预约时间">
          <el-date-picker
            v-model="appointmentForm.appointment_time"
            type="datetime"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAppointmentDialog = false">取消</el-button>
        <el-button type="primary" @click="submitAppointment">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showExamDialog" title="上传检查结果" width="600px">
      <el-form :model="examForm" label-width="100px">
        <el-form-item label="检查类型">
          <el-select v-model="examForm.exam_type" style="width: 100%">
            <el-option label="影像检查" value="影像检查" />
            <el-option label="检验检查" value="检验检查" />
            <el-option label="病理检查" value="病理检查" />
            <el-option label="内镜检查" value="内镜检查" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="检查项目">
          <el-input v-model="examForm.exam_name" />
        </el-form-item>
        <el-form-item label="检查时间">
          <el-date-picker
            v-model="examForm.exam_time"
            type="datetime"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="检查医生">
          <el-input v-model="examForm.exam_doctor" />
        </el-form-item>
        <el-form-item label="检查结果">
          <el-input v-model="examForm.exam_result" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="是否异常">
          <el-switch v-model="examForm.abnormal_flag" active-value="1" inactive-value="0" />
        </el-form-item>
        <el-form-item label="异常描述" v-if="examForm.abnormal_flag === '1'">
          <el-input v-model="examForm.abnormal_desc" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showExamDialog = false">取消</el-button>
        <el-button type="primary" @click="submitExam">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const order = ref(null)
const showAppointmentDialog = ref(false)
const showExamDialog = ref(false)

const departments = ref(['内科', '外科', '妇产科', '儿科', '骨科', '神经内科', '心血管内科', '消化内科', '呼吸内科', '肿瘤科'])

const appointmentForm = reactive({
  check_type: '影像检查',
  check_item: '',
  dept_name: '',
  bed_no: '',
  appointment_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
})

const examForm = reactive({
  exam_type: '影像检查',
  exam_name: '',
  exam_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
  exam_doctor: '',
  exam_result: '',
  abnormal_flag: '0',
  abnormal_desc: ''
})

const getStatusText = (status) => {
  const map = {
    'pending': '待接诊',
    'accepted': '已接诊',
    'checking': '检查中',
    'reported': '已出报告',
    'closed': '已闭环',
    'cancelled': '已取消'
  }
  return map[status] || status
}

const getAppointmentStatusText = (status) => {
  const map = {
    'scheduled': '已预约',
    'ongoing': '进行中',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return map[status] || status
}

const getAppointmentStatusType = (status) => {
  const map = {
    'scheduled': 'info',
    'ongoing': 'warning',
    'completed': 'success',
    'cancelled': 'danger'
  }
  return map[status] || 'info'
}

const timelineNodes = computed(() => {
  const nodes = []
  if (!order.value) return nodes

  if (order.value.create_time) {
    nodes.push({ time: order.value.create_time, content: '转诊单创建', type: 'primary' })
  }
  if (order.value.referral_time) {
    nodes.push({ time: order.value.referral_time, content: '转诊发起', type: '' })
  }
  if (order.value.visit_time) {
    nodes.push({ time: order.value.visit_time, content: '患者到诊', type: 'success' })
  }
  if (order.value.check_time) {
    nodes.push({ time: order.value.check_time, content: '开始检查', type: 'warning' })
  }
  if (order.value.report_time) {
    nodes.push({ time: order.value.report_time, content: '检查报告完成', type: '' })
  }
  if (order.value.close_time) {
    nodes.push({ time: order.value.close_time, content: '转诊闭环完成', type: 'success' })
  }

  return nodes.sort((a, b) => new Date(a.time) - new Date(b.time))
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await axios.get(`/api/referral-orders/${route.params.id}`)
    if (res.data.success) {
      order.value = res.data.data
    }
  } catch (e) {
    console.error('加载数据失败:', e)
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.back()
}

const handleClose = async () => {
  try {
    await ElMessageBox.confirm('确定将此转诊单闭环？闭环后将无法再进行操作。', '提示', { type: 'warning' })
    const res = await axios.put(`/api/referral-orders/${order.value.id}/status`, {
      status: 'closed',
      close_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
    })
    if (res.data.success) {
      ElMessage.success('闭环成功')
      loadData()
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '操作失败')
  }
}

const submitAppointment = async () => {
  try {
    const res = await axios.post('/api/appointments', {
      referral_order_id: order.value.id,
      ...appointmentForm
    })
    if (res.data.success) {
      ElMessage.success('创建成功')
      showAppointmentDialog.value = false
      loadData()
    }
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

const updateAppointmentStatus = async (row, status) => {
  try {
    const res = await axios.put(`/api/appointments/${row.id}/status`, { status })
    if (res.data.success) {
      ElMessage.success('操作成功')
      loadData()
    }
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

const submitExam = async () => {
  try {
    const res = await axios.post('/api/exam-results', {
      referral_order_id: order.value.id,
      ...examForm
    })
    if (res.data.success) {
      ElMessage.success('上传成功')
      showExamDialog.value = false
      loadData()
    }
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

onMounted(() => {
  loadData()
})
</script>
