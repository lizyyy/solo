<template>
    <div class="report-tab">
        <el-card>
            <template #header>
                <div class="card-header">
                    <span>周报版本列表</span>
                    <el-button type="primary" @click="showCreateDialog = true">创建周报</el-button>
                </div>
            </template>
            <el-table :data="reports" style="width: 100%">
                <el-table-column prop="version" label="版本" width="120">
                    <template #default="{ row }">
                        <el-tag type="primary">{{ row.version }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="周期" width="250">
                    <template #default="{ row }">
                        {{ formatDate(row.week_start) }} - {{ formatDate(row.week_end) }}
                    </template>
                </el-table-column>
                <el-table-column prop="summary" label="摘要" show-overflow-tooltip />
                <el-table-column prop="status" label="状态">
                    <template #default="{ row }">
                        <el-tag :type="getStatusType(row.status)">
                            {{ getStatusText(row.status) }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="created_at" label="创建时间" width="180">
                    <template #default="{ row }">
                        {{ formatDate(row.created_at) }}
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="250">
                    <template #default="{ row }">
                        <el-button type="primary" size="small" @click="goToDetail(row.id)">
                            查看详情
                        </el-button>
                        <el-button type="success" size="small" @click="openReviewDrawer(row)">
                            复核
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <el-dialog v-model="showCreateDialog" title="创建周报" width="700px">
            <el-form :model="newReport" label-width="120px">
                <el-form-item label="周开始">
                    <el-date-picker v-model="newReport.week_start" type="datetime" style="width: 100%" />
                </el-form-item>
                <el-form-item label="周结束">
                    <el-date-picker v-model="newReport.week_end" type="datetime" style="width: 100%" />
                </el-form-item>
                <el-form-item label="摘要">
                    <el-input v-model="newReport.summary" type="textarea" />
                </el-form-item>
                <el-form-item label="选择风险">
                    <el-checkbox-group v-model="selectedRiskIds">
                        <el-checkbox
                            v-for="risk in risks"
                            :key="risk.id"
                            :label="risk.id"
                            style="display: block; margin: 8px 0;"
                        >
                            <span style="font-weight: 500;">{{ risk.title }}</span>
                            <span v-if="risk.owner" style="margin-left: 10px; color: #666; font-size: 12px;">
                                负责人: {{ risk.owner }}
                            </span>
                            <span v-if="risk.status" style="margin-left: 10px; color: #666; font-size: 12px;">
                                状态: {{ getRiskStatusText(risk.status) }}
                            </span>
                        </el-checkbox>
                    </el-checkbox-group>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showCreateDialog = false">取消</el-button>
                <el-button type="primary" @click="createReport" :loading="createLoading">创建</el-button>
            </template>
        </el-dialog>

        <ReviewDrawer v-model="showReviewDrawer" :report="selectedReport" />
    </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { projectApi, weeklyReportApi } from '../api'
import ReviewDrawer from './ReviewDrawer.vue'

const props = defineProps({
    projectId: {
        type: Number,
        required: true
    }
})

const router = useRouter()
const reports = ref([])
const risks = ref([])
const showCreateDialog = ref(false)
const showReviewDrawer = ref(false)
const selectedReport = ref(null)
const selectedRiskIds = ref([])
const createLoading = ref(false)
const newReport = ref({
    week_start: null,
    week_end: null,
    summary: '',
    status: 'draft'
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

const getRiskStatusText = (status) => {
    const statusMap = {
        'identified': '已识别',
        'in_progress': '处理中',
        'resolved': '已解决',
        'mitigated': '已缓解',
        'escalated': '已升级'
    }
    return statusMap[status] || status
}

const loadReports = async () => {
    try {
        const response = await projectApi.getWeeklyReports(props.projectId)
        reports.value = response.data
    } catch (error) {
        ElMessage.error('加载周报列表失败')
    }
}

const loadRisks = async () => {
    try {
        const response = await projectApi.getRisks(props.projectId)
        risks.value = response.data
    } catch (error) {
        ElMessage.error('加载风险列表失败')
    }
}

const createReport = async () => {
    if (!newReport.value.week_start || !newReport.value.week_end) {
        ElMessage.warning('请选择周周期')
        return
    }
    createLoading.value = true
    try {
        const reportResponse = await weeklyReportApi.create({
            ...newReport.value,
            project_id: props.projectId
        })
        const reportId = reportResponse.data.id

        if (selectedRiskIds.value.length > 0) {
            await Promise.all(
                selectedRiskIds.value.map(async (riskId) => {
                    const risk = risks.value.find(r => r.id === riskId)
                    await weeklyReportApi.addRisk({
                        weekly_report_id: reportId,
                        risk_id: riskId,
                        status_at_report: risk?.status || '',
                        owner_feedback_at_report: risk?.owner_feedback || ''
                    })
                })
            )
        }

        ElMessage.success('创建成功')
        showCreateDialog.value = false
        selectedRiskIds.value = []
        newReport.value = {
            week_start: null,
            week_end: null,
            summary: '',
            status: 'draft'
        }
        loadReports()
    } catch (error) {
        ElMessage.error('创建失败')
    } finally {
        createLoading.value = false
    }
}

const goToDetail = (id) => {
    router.push(`/report/${id}`)
}

const openReviewDrawer = (report) => {
    selectedReport.value = report
    showReviewDrawer.value = true
}

watch(() => showCreateDialog, (val) => {
    if (val && props.projectId) {
        loadRisks()
    }
})

watch(() => props.projectId, () => {
    if (props.projectId) {
        loadReports()
    }
})

onMounted(() => {
    loadReports()
})
</script>

<style scoped>
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
</style>
