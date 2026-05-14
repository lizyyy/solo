<template>
    <el-drawer
        v-model="visible"
        title="周报复核"
        direction="rtl"
        size="600px"
    >
        <div v-if="report" class="review-drawer">
            <el-descriptions :column="1" border class="mb-20">
                <el-descriptions-item label="版本">
                    <el-tag type="primary">{{ report.version }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="周期">
                    {{ formatDate(report.week_start) }} - {{ formatDate(report.week_end) }}
                </el-descriptions-item>
                <el-descriptions-item label="状态">
                    <el-tag :type="getStatusType(report.status)">
                        {{ getStatusText(report.status) }}
                    </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="摘要">
                    {{ report.summary }}
                </el-descriptions-item>
                <el-descriptions-item v-if="report.review_comment" label="审核意见">
                    {{ report.review_comment }}
                </el-descriptions-item>
                <el-descriptions-item v-if="report.reviewed_by" label="审核人">
                    {{ report.reviewed_by }}
                </el-descriptions-item>
            </el-descriptions>

            <el-form v-if="report.status !== 'sent'" :model="reviewForm" label-width="100px">
                <el-form-item label="审核意见">
                    <el-input v-model="reviewForm.review_comment" type="textarea" />
                </el-form-item>
                <el-form-item label="审核人">
                    <el-input v-model="reviewForm.reviewed_by" />
                </el-form-item>
                <el-form-item>
                    <el-button type="warning" @click="submitForReview" :disabled="report.status === 'reviewing'">
                        提交审核
                    </el-button>
                    <el-button type="success" @click="approveReport" :disabled="report.status === 'approved'">
                        批准
                    </el-button>
                </el-form-item>
            </el-form>

            <el-divider content-position="left">发送记录</el-divider>
            <el-timeline>
                <el-timeline-item
                    v-for="record in sendRecords"
                    :key="record.id"
                    :timestamp="formatDate(record.sent_at)"
                >
                    <el-card shadow="hover" class="record-card">
                        <p><strong>发送给：</strong>{{ record.sent_to }}</p>
                        <p v-if="record.sent_by"><strong>发送人：</strong>{{ record.sent_by }}</p>
                        <p v-if="record.subject"><strong>主题：</strong>{{ record.subject }}</p>
                        <p v-if="record.content"><strong>内容：</strong>{{ record.content }}</p>
                    </el-card>
                </el-timeline-item>
            </el-timeline>
        </div>
    </el-drawer>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { weeklyReportApi } from '../api'

const props = defineProps({
    modelValue: Boolean,
    report: Object
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
})

const sendRecords = ref([])
const reviewForm = ref({
    review_comment: '',
    reviewed_by: ''
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

const loadSendRecords = async () => {
    if (props.report) {
        try {
            const response = await weeklyReportApi.getSendRecords(props.report.id)
            sendRecords.value = response.data
        } catch (error) {
            ElMessage.error('加载发送记录失败')
        }
    }
}

const submitForReview = async () => {
    try {
        await weeklyReportApi.update(props.report.id, {
            status: 'reviewing',
            operation_id: props.report.operation_id
        })
        ElMessage.success('已提交审核')
        emit('update:modelValue', false)
    } catch (error) {
        if (error.response?.status === 409) {
            ElMessage.error('操作冲突，请刷新后重试')
        } else {
            ElMessage.error('操作失败')
        }
    }
}

const approveReport = async () => {
    try {
        await weeklyReportApi.update(props.report.id, {
            status: 'approved',
            review_comment: reviewForm.value.review_comment,
            reviewed_by: reviewForm.value.reviewed_by,
            operation_id: props.report.operation_id
        })
        ElMessage.success('已批准')
        emit('update:modelValue', false)
    } catch (error) {
        if (error.response?.status === 409) {
            ElMessage.error('操作冲突，请刷新后重试')
        } else {
            ElMessage.error('操作失败')
        }
    }
}

watch(() => props.report, () => {
    if (props.report) {
        reviewForm.value = {
            review_comment: props.report.review_comment || '',
            reviewed_by: props.report.reviewed_by || ''
        }
        loadSendRecords()
    }
})

watch(visible, (val) => {
    if (val && props.report) {
        loadSendRecords()
    }
})
</script>

<style scoped>
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
