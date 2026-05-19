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

            <div v-if="report && report.status !== 'sent'" class="mb-20">
                <el-alert
                    :title="report.status === 'approved' ? '周报已批准，可以发送' : '编辑中，可添加风险条目'"
                    :type="report.status === 'approved' ? 'success' : 'info'"
                    show-icon
                    class="mb-20"
                />
                <el-button type="primary" @click="showAddRiskDialog = true">
                    添加风险条目
                </el-button>
                <el-button
                    v-if="report.status === 'approved'"
                    type="success"
                    @click="showSendDialog = true"
                    style="margin-left: 10px;"
                >
                    发送周报
                </el-button>
            </div>

            <el-divider content-position="left">风险快照列表</el-divider>
            <el-table :data="report.report_risks || []" style="width: 100%">
                <el-table-column prop="risk_id" label="风险ID" width="100" />
                <el-table-column prop="status_at_report" label="报告时状态" width="120" />
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
                <el-button type="primary" @click="sendReport" :loading="sendLoading">发送</el-button>
            </template>
        </el-dialog>

        <el-dialog v-model="showAddRiskDialog" title="添加风险条目" width="600px">
            <el-form :model="addRiskForm" label-width="120px">
                <el-form-item label="选择风险">
                    <el-select v-model="addRiskForm.risk_id" placeholder="请选择风险" style="width: 100%">
                        <el-option
                            v-for="risk in availableRisks"
                            :key="risk.id"
                            :label="risk.title"
                            :value="risk.id"
                        >
                            <span style="float: left">{{ risk.title }}</span>
                            <span style="float: right; color: #8492a6; font-size: 13px">
                                {{ risk.owner || '未分配' }}
                            </span>
                        </el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="状态快照">
                    <el-input v-model="addRiskForm.status_at_report" placeholder="记录当前风险状态" />
                </el-form-item>
                <el-form-item label="负责人反馈">
                    <el-input v-model="addRiskForm.owner_feedback_at_report" type="textarea" :rows="3" />
                </el-form-item>
                <el-form-item label="备注">
                    <el-input v-model="addRiskForm.notes" type="textarea" :rows="2" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showAddRiskDialog = false">取消</el-button>
                <el-button type="primary" @click="addRiskToReport" :loading="addRiskLoading">添加</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { weeklyReportApi, projectApi } from '../api'
import { v4 as uuidv4 } from 'uuid'

const route = useRoute()
const router = useRouter()
const reportId = computed(() => parseInt(route.params.id))
const report = ref(null)
const availableRisks = ref([])
const showSendDialog = ref(false)
const showAddRiskDialog = ref(false)
const sendLoading = ref(false)
const addRiskLoading = ref(false)
const currentSendOperationId = ref(null)
const sendForm = ref({
    sent_to: '',
    sent_by: '',
    subject: '',
    content: ''
})
const addRiskForm = ref({
    risk_id: null,
    status_at_report: '',
    owner_feedback_at_report: '',
    notes: ''
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
    if (sendLoading.value) {
        ElMessage.info('正在发送中，请稍候...')
        return
    }
    sendLoading.value = true
    try {
        if (!currentSendOperationId.value) {
            currentSendOperationId.value = uuidv4()
        }
        await weeklyReportApi.send({
            ...sendForm.value,
            weekly_report_id: reportId.value,
            operation_id: currentSendOperationId.value
        })
        ElMessage.success('发送成功')
        showSendDialog.value = false
        currentSendOperationId.value = null
        sendForm.value = {
            sent_to: '',
            sent_by: '',
            subject: '',
            content: ''
        }
        loadReport()
    } catch (error) {
        ElMessage.error('发送失败')
    } finally {
        sendLoading.value = false
    }
}

const addRiskToReport = async () => {
    if (!addRiskForm.value.risk_id) {
        ElMessage.warning('请选择风险')
        return
    }
    addRiskLoading.value = true
    try {
        await weeklyReportApi.addRisk({
            weekly_report_id: reportId.value,
            risk_id: addRiskForm.value.risk_id,
            status_at_report: addRiskForm.value.status_at_report,
            owner_feedback_at_report: addRiskForm.value.owner_feedback_at_report,
            notes: addRiskForm.value.notes
        })
        ElMessage.success('添加成功')
        showAddRiskDialog.value = false
        addRiskForm.value = {
            risk_id: null,
            status_at_report: '',
            owner_feedback_at_report: '',
            notes: ''
        }
        loadReport()
    } catch (error) {
        ElMessage.error('添加失败')
    } finally {
        addRiskLoading.value = false
    }
}

const loadAvailableRisks = async () => {
    try {
        const response = await weeklyReportApi.get(reportId.value)
        const projectId = response.data.project.id
        const risksResponse = await projectApi.getRisks(projectId)
        availableRisks.value = risksResponse.data
    } catch (error) {
        ElMessage.error('加载风险列表失败')
    }
}

watch(() => showSendDialog, (val) => {
    if (val) {
        currentSendOperationId.value = null
    }
})

watch(() => showAddRiskDialog, (val) => {
    if (val) {
        loadAvailableRisks()
    }
})

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
