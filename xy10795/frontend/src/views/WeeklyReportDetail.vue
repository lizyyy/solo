<template>
    <div class="weekly-report-detail">
        <el-page-header @back="goBack" content="周报详情" />

        <el-card v-if="report" class="mt-20">
            <el-descriptions :column="2" border title="基本信息">
                <el-descriptions-item label="版本">
                    <el-tag type="primary">{{ report.version }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="项目">
                    {{ report.project?.name }}
                </el-descriptions-item>
                <el-descriptions-item label="周期">
                    {{ formatDate(report.week_start) }} - {{ formatDate(report.week_end) }}
                </el-descriptions-item>
                <el-descriptions-item label="状态">
                    <el-tag :type="getStatusType(report.status)">
                        {{ getStatusText(report.status) }}
                    </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="创建时间" :span="2">
                    {{ formatDate(report.created_at) }}
                </el-descriptions-item>
                <el-descriptions-item label="摘要" :span="2">
                    {{ report.summary }}
                </el-descriptions-item>
                <el-descriptions-item v-if="report.review_comment" label="审核意见" :span="2">
                    {{ report.review_comment }}
                </el-descriptions-item>
                <el-descriptions-item v-if="report.reviewed_by" label="审核人">
                    {{ report.reviewed_by }}
                </el-descriptions-item>
            </el-descriptions>

            <el-divider content-position="left">风险列表</el-divider>
            <el-table :data="report.report_risks" style="width: 100%">
                <el-table-column prop="risk_id" label="风险ID" width="100" />
                <el-table-column prop="status_at_report" label="报告时状态" />
                <el-table-column prop="owner_feedback_at_report" label="负责人反馈" show-overflow-tooltip />
                <el-table-column prop="notes" label="备注" show-overflow-tooltip />
            </el-table>

            <div v-if="report.status === 'approved'" class="mb-20">
                <el-alert
                    title="周报已批准，可以发送"
                    type="success"
                    show-icon
                    class="mb-20"
                />
                <el-button type="primary" @click="showSendDialog = true">
                    发送周报
                </el-button>
            </div>

            <el-divider content-position="left">发送记录</el-divider>
            <el-timeline>
                <el-timeline-item
                    v-for="record in report.send_records"
                    :key="record.id"
                    :timestamp="formatDate(record.sent_at)"
                >
                    <el-card shadow="hover" class="record-card">
                        <p><strong>发送给：</strong>{{ record.sent_to }}</p>
                        <p v-if="record.sent_by"><strong>发送人：</strong>{{ record.sent_by }}</p>
                        <p v-if="record.subject"><strong>主题：</strong>{{ record.subject }}</p>
                        <p v-if="record.content"><strong>内容：</strong>{{ record.content }}</p>
                        <p v-if="record.operation_id"><small>操作ID: {{ record.operation_id }}</small></p>
                    </el-card>
                </el-timeline-item>
            </el-timeline>
        </el-card>

        <el-dialog v-model="showSendDialog" title="发送周报" width="500px">
            <el-form :model="sendForm" label-width="100px">
                <el-form-item label="发送给">
                    <el-input v-model="sendForm.sent_to" placeholder="多个邮箱用逗号分隔" />
                </el-form-item>
                <el-form-item label="发送人">
                    <el-input v-model="sendForm.sent_by" />
                </el-form-item>
                <el-form-item label="主题">
                    <el-input v-model="sendForm.subject" />
                </el-form-item>
                <el-form-item label="内容">
                    <el-input v-model="sendForm.content" type="textarea" :rows="4" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showSendDialog = false">取消</el-button>
                <el-button type="primary" @click="sendReport">发送</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { weeklyReportApi } from '../api'
import { v4 as uuidv4 } from 'uuid'

const route = useRoute()
const router = useRouter()
const reportId = computed(() => parseInt(route.params.id))
const report = ref(null)
const showSendDialog = ref(false)
const sendForm = ref({
    sent_to: '',
    sent_by: '',
    subject: '',
    content: ''
})

const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
    const statusMap = {
        'draft': 'info',
        'reviewing': 'warning',
        'approved': 'success',
        'sent': 'success'
    }
    return statusMap[status] || 'info'
}

const getStatusText = (status) => {
    const statusMap = {
        'draft': '草稿',
        'reviewing': '审核中',
        'approved': '已批准',
        'sent': '已发送'
    }
    return statusMap[status] || status
}

const loadReport = async () => {
    try {
        const response = await weeklyReportApi.get(reportId.value)
        report.value = response.data
    } catch (error) {
        ElMessage.error('加载周报详情失败')
    }
}

const goBack = () => {
    if (report.value?.project?.id) {
        router.push(`/project/${report.value.project.id}`)
    } else {
        router.push('/')
    }
}

const sendReport = async () => {
    if (!sendForm.value.sent_to) {
        ElMessage.warning('请填写收件人')
        return
    }
    try {
        const operationId = uuidv4()
        await weeklyReportApi.send({
            ...sendForm.value,
            weekly_report_id: reportId.value,
            operation_id: operationId
        })
        ElMessage.success('发送成功')
        showSendDialog.value = false
        sendForm.value = {
            sent_to: '',
            sent_by: '',
            subject: '',
            content: ''
        }
        loadReport()
    } catch (error) {
        ElMessage.error('发送失败')
    }
}

onMounted(() => {
    loadReport()
})
</script>

<style scoped>
.mt-20 {
    margin-top: 20px;
}

.mb-20 {
    margin-bottom: 20px;
}

.record-card {
    margin-bottom: 10px;
}

.record-card p {
    margin: 5px 0;
}
</style>
