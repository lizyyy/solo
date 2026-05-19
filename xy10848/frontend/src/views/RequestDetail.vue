<template>
  <div>
    <div style="display: flex; align-items: center; margin-bottom: 20px">
      <el-button @click="$router.back()" style="margin-right: 10px">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <h2>请求详情 - {{ requestId }}</h2>
    </div>

    <el-descriptions :column="2" border style="margin-bottom: 20px">
      <el-descriptions-item label="请求ID">{{ detail?.request?.id }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="getStatusType(detail?.request?.status)">{{ getStatusText(detail?.request?.status) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="成员ID">{{ detail?.request?.member_id }}</el-descriptions-item>
      <el-descriptions-item label="项目ID">{{ detail?.request?.project_id }}</el-descriptions-item>
      <el-descriptions-item label="消耗额度">{{ detail?.request?.quota_consumed }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ formatTime(detail?.request?.created_at) }}</el-descriptions-item>
    </el-descriptions>

    <el-divider content-position="left">额度变化记录</el-divider>
    
    <el-timeline style="margin-bottom: 20px">
      <el-timeline-item timestamp="请求创建时" placement="top" type="primary">
        <el-card>
          <h4>扣减额度</h4>
          <p>从额度包 {{ detail?.quota_package?.name }} 中扣减 {{ detail?.request?.quota_consumed }} 额度</p>
          <p>扣减前: {{ detail?.quota_package?.total_quota }} → 扣减后: {{ detail?.quota_package?.total_quota - detail?.request?.quota_consumed }}</p>
        </el-card>
      </el-timeline-item>
      
      <el-timeline-item v-if="detail?.credit" timestamp="失败时" placement="top" type="warning">
        <el-card>
          <h4>创建退费申请</h4>
          <p>原因: {{ detail?.credit?.reason }}</p>
          <p>待返还额度: {{ detail?.credit?.quota_returned }}</p>
          <p>当前审核状态: <el-tag :type="detail?.credit?.status === 'approved' ? 'success' : detail?.credit?.status === 'rejected' ? 'danger' : 'warning'">{{ detail?.credit?.status === 'approved' ? '已通过' : detail?.credit?.status === 'rejected' ? '已拒绝' : '待审核' }}</el-tag></p>
        </el-card>
      </el-timeline-item>

      <el-timeline-item v-if="detail?.credit?.status === 'approved'" timestamp="审核通过时" placement="top" type="success">
        <el-card>
          <h4>返还额度</h4>
          <p>额度已返还到原额度包</p>
          <p>返还额度: {{ detail?.credit?.quota_returned }}</p>
          <p>审核人: {{ detail?.credit?.reviewed_by }}</p>
          <p v-if="detail?.credit?.review_note">备注: {{ detail?.credit?.review_note }}</p>
        </el-card>
      </el-timeline-item>
    </el-timeline>

    <el-divider content-position="left">操作</el-divider>

    <el-space>
      <el-button v-if="detail?.request?.status === 'processing'" type="success" @click="handleComplete">标记为完成</el-button>
      <el-button v-if="detail?.request?.status === 'processing'" type="danger" @click="handleFail">标记为失败</el-button>
    </el-space>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const route = useRoute()
const requestId = ref(route.params.id)
const detail = ref(null)

const getStatusType = (status) => {
  const map = { processing: '', completed: 'success', failed: 'danger', refunded: 'warning' }
  return map[status] || ''
}

const getStatusText = (status) => {
  const map = { processing: '处理中', completed: '已完成', failed: '失败', refunded: '已退费' }
  return map[status] || status
}

const formatTime = (ts) => {
  return ts ? new Date(ts).toLocaleString('zh-CN') : '-'
}

const fetchDetail = async () => {
  const res = await axios.get(`/api/generation-requests/${requestId.value}`)
  detail.value = res.data
}

const handleComplete = async () => {
  await axios.post(`/api/generation-requests/${requestId.value}/complete`)
  ElMessage.success('已标记为完成')
  fetchDetail()
}

const handleFail = async () => {
  await axios.post(`/api/generation-requests/${requestId.value}/fail`, { error_message: '手动标记失败' })
  ElMessage.success('已标记为失败')
  fetchDetail()
}

onMounted(fetchDetail)
</script>
