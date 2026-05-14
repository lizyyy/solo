<template>
  <div>
    <a-button @click="goBack" style="margin-bottom: 16px">
      <template #icon><ArrowLeftOutlined /></template>
      返回列表
    </a-button>

    <a-spin :spinning="loading">
      <a-row :gutter="16">
        <a-col :span="16">
          <a-card title="📝 问题详情">
            <a-descriptions :column="1" bordered>
              <a-descriptions-item label="规则项">
                <a-tag color="blue">{{ issue.rule_id }}</a-tag>
                <span style="margin-left: 8px">{{ issue.rule_name }}</span>
              </a-descriptions-item>
              <a-descriptions-item label="规则类别">
                <a-tag>{{ issue.rule_category }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="当前状态">
                <a-tag :color="getStatusColor(issue.status)">{{ issue.status }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="页面路径（处理后）">
                <code style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px">{{ issue.page_path }}</code>
              </a-descriptions-item>
              <a-descriptions-item label="页面路径（原始）">
                <code style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px">{{ issue.page_path_original }}</code>
              </a-descriptions-item>
              <a-descriptions-item label="元素定位">
                <code v-if="issue.element_selector" style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px">{{ issue.element_selector }}</code>
                <span v-else>-</span>
              </a-descriptions-item>
              <a-descriptions-item label="问题描述">
                <p style="margin: 0; line-height: 1.6">{{ issue.description }}</p>
              </a-descriptions-item>
              <a-descriptions-item label="修复建议">
                <p style="margin: 0; line-height: 1.6; color: #1890ff">{{ issue.repair_suggestion }}</p>
              </a-descriptions-item>
            </a-descriptions>

            <a-divider />

            <template v-if="issue.screenshot">
              <p style="font-weight: 500; margin-bottom: 12px">📷 截图定位</p>
              <img :src="getScreenshotUrl(issue.screenshot)" style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1)" />
              <a-divider />
            </template>

            <template v-if="issue.handler">
              <p style="font-weight: 500; margin-bottom: 12px">👤 处理信息</p>
              <a-descriptions :column="2" bordered size="small">
                <a-descriptions-item label="处理人">{{ issue.handler }}</a-descriptions-item>
                <a-descriptions-item label="处理时间">{{ formatTime(issue.handle_time) }}</a-descriptions-item>
                <a-descriptions-item label="处理理由" :span="2">
                  <p style="margin: 0; line-height: 1.6">{{ issue.handle_reason }}</p>
                </a-descriptions-item>
              </a-descriptions>
              <a-divider />
            </template>

            <template v-if="issue.review_logs && issue.review_logs.length > 0">
              <p style="font-weight: 500; margin-bottom: 12px">📋 复核留痕记录</p>
              <a-timeline>
                <a-timeline-item v-for="log in issue.review_logs" :key="log.id">
                  <template #dot>
                    <CheckCircleOutlined style="color: #52c41a; font-size: 16px" />
                  </template>
                  <p style="margin: 0; font-weight: 500">
                    {{ log.reviewer }} 于 {{ formatTime(log.review_time) }} 复核
                  </p>
                  <p style="margin: 4px 0 0 0; color: #666">
                    状态变更: <a-tag :color="getStatusColor(log.from_status)" size="small">{{ log.from_status }}</a-tag>
                    →
                    <a-tag :color="getStatusColor(log.to_status)" size="small">{{ log.to_status }}</a-tag>
                  </p>
                  <p style="margin: 8px 0 0 0; background: #f6ffed; padding: 8px 12px; border-radius: 4px">
                    <strong>复核意见:</strong> {{ log.reason }}
                  </p>
                </a-timeline-item>
              </a-timeline>
            </template>
          </a-card>
        </a-col>

        <a-col :span="8">
          <a-card title="⚡ 快捷操作" style="margin-bottom: 16px">
            <a-space direction="vertical" style="width: 100%">
              <a-button type="primary" block @click="openReportLink">
                查看该页面无障碍报告
              </a-button>
              <a-button block @click="copyPagePath">
                复制页面路径
              </a-button>
              <a-button block @click="openReview">
                进行复核操作
              </a-button>
            </a-space>
          </a-card>

          <a-card title="🔄 修正路径（修复失败时）" v-if="issue.status === '修复失败'">
            <a-alert
              message="当前处于修复失败状态"
              description="请重新指派处理人进行修复，并记录修正方案"
              type="warning"
              show-icon
              style="margin-bottom: 16px"
            />
            <a-form :model="correctionForm" layout="vertical">
              <a-form-item label="重新指派处理人">
                <a-input v-model:value="correctionForm.assignee" placeholder="输入处理人姓名" />
              </a-form-item>
              <a-form-item label="修正方案说明">
                <a-textarea v-model:value="correctionForm.handle_reason" :rows="4" placeholder="请详细说明如何修正之前的修复方案，便于后续复盘" />
              </a-form-item>
              <a-form-item>
                <a-button type="primary" block @click="submitCorrection" :loading="submitting">
                  提交修正方案并重新处理
                </a-button>
              </a-form-item>
            </a-form>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>

    <a-modal v-model:open="reviewModalVisible" title="复核操作" width="500">
      <a-form :model="reviewForm" layout="vertical">
        <a-form-item label="复核人">
          <a-input v-model:value="reviewForm.reviewer" placeholder="输入您的姓名" />
        </a-form-item>
        <a-form-item label="复核意见">
          <a-textarea v-model:value="reviewForm.review_reason" :rows="4" placeholder="请详细说明复核意见，便于复盘" />
        </a-form-item>
        <a-form-item label="复核结果">
          <a-radio-group v-model:value="reviewForm.status">
            <a-radio value="已复核">复核通过</a-radio>
            <a-radio value="修复失败">修复失败，需返工</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
      <template #footer>
        <a-space style="float: right">
          <a-button @click="reviewModalVisible = false">取消</a-button>
          <a-button type="primary" @click="submitReview" :loading="submitting">提交</a-button>
        </a-space>
      </template>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons-vue'
import axios from 'axios'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const submitting = ref(false)
const issue = ref({})
const reviewModalVisible = ref(false)

const reviewForm = ref({
  reviewer: '',
  review_reason: '',
  status: '',
})

const correctionForm = ref({
  assignee: '',
  handle_reason: '',
})

const getStatusColor = (status) => {
  const colors = {
    '待处理': 'default',
    '处理中': 'blue',
    '已修复': 'green',
    '已复核': 'purple',
    '修复失败': 'red',
  }
  return colors[status] || 'default'
}

const getScreenshotUrl = (screenshot) => {
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(screenshot)}&image_size=square_hd`
}

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const fetchIssue = async () => {
  loading.value = true
  try {
    const res = await axios.get(`/api/issues/${route.params.id}`)
    issue.value = res.data
  } catch (e) {
    message.error('获取详情失败')
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/')
}

const openReportLink = () => {
  message.info(`正在生成 ${issue.value.page_path} 的无障碍报告...`)
  window.open(`/api/report/${encodeURIComponent(issue.value.page_path)}`, '_blank')
}

const copyPagePath = () => {
  navigator.clipboard.writeText(issue.value.page_path_original)
  message.success('页面路径已复制')
}

const openReview = () => {
  reviewForm.value = {
    reviewer: '',
    review_reason: '',
    status: '',
  }
  reviewModalVisible.value = true
}

const submitReview = async () => {
  if (!reviewForm.value.status || !reviewForm.value.reviewer) {
    message.error('请填写完整信息')
    return
  }
  submitting.value = true
  try {
    await axios.put(`/api/issues/${issue.value.id}`, reviewForm.value)
    message.success('复核提交成功')
    reviewModalVisible.value = false
    fetchIssue()
  } catch (e) {
    message.error('提交失败')
  } finally {
    submitting.value = false
  }
}

const submitCorrection = async () => {
  if (!correctionForm.value.assignee || !correctionForm.value.handle_reason) {
    message.error('请填写完整信息')
    return
  }
  submitting.value = true
  try {
    await axios.put(`/api/issues/${issue.value.id}`, {
      ...correctionForm.value,
      status: '处理中',
    })
    message.success('修正方案已提交，状态已更新为处理中')
    fetchIssue()
  } catch (e) {
    message.error('提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchIssue()
})
</script>
