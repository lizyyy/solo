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
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { weeklyReportApi } from '../api'

const route = useRoute()
const router = useRouter()
const reportId = computed(() => parseInt(route.params.id))
const report = ref(null)

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

onMounted(() => {
    loadReport()
})
</script>

<style scoped>
.mt-20 {
    margin-top: 20px;
}

.record-card {
    margin-bottom: 10px;
}

.record-card p {
    margin: 5px 0;
}
</style>
