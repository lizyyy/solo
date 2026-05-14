<template>
    <el-drawer
        v-model="visible"
        title="延期原因管理"
        direction="rtl"
        size="600px"
    >
        <div v-if="milestone" class="delay-reason-drawer">
            <el-alert
                :title="`里程碑：${milestone.name}`"
                type="info"
                :description="milestone.description"
                show-icon
                class="mb-20"
            />
            
            <div class="mb-20">
                <el-button type="primary" @click="showCreateDialog = true">
                    添加延期原因
                </el-button>
            </div>

            <el-timeline>
                <el-timeline-item
                    v-for="reason in delayReasons"
                    :key="reason.id"
                    :timestamp="formatDate(reason.created_at)"
                >
                    <el-card shadow="hover" class="reason-card">
                        <template #header>
                            <div class="card-header">
                                <span>版本 v{{ reason.version }}</span>
                                <el-tag :type="getStatusType(reason.status)">
                                    {{ getStatusText(reason.status) }}
                                </el-tag>
                            </div>
                        </template>
                        <div class="reason-content">
                            <p><strong>原因：</strong>{{ reason.reason }}</p>
                            <p v-if="reason.correction_path">
                                <strong>修正路径：</strong>{{ reason.correction_path }}
                            </p>
                            <p v-if="reason.review_comment">
                                <strong>审核意见：</strong>{{ reason.review_comment }}
                            </p>
                        </div>
                        <div class="reason-actions" v-if="reason.status === 'pending'">
                            <el-button size="small" type="success" @click="approveReason(reason)">
                                通过
                            </el-button>
                            <el-button size="small" type="danger" @click="showRejectDialog(reason)">
                                驳回
                            </el-button>
                        </div>
                    </el-card>
                </el-timeline-item>
            </el-timeline>
        </div>

        <el-dialog v-model="showCreateDialog" title="添加延期原因" width="500px">
            <el-form :model="newReason" label-width="100px">
                <el-form-item label="原因">
                    <el-input v-model="newReason.reason" type="textarea" />
                </el-form-item>
                <el-form-item label="修正路径">
                    <el-input v-model="newReason.correction_path" type="textarea" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showCreateDialog = false">取消</el-button>
                <el-button type="primary" @click="createReason">提交</el-button>
            </template>
        </el-dialog>

        <el-dialog v-model="showRejectDialog" title="驳回原因" width="500px">
            <el-form :model="rejectForm" label-width="100px">
                <el-form-item label="审核意见">
                    <el-input v-model="rejectForm.review_comment" type="textarea" />
                </el-form-item>
                <el-form-item label="修正路径">
                    <el-input v-model="rejectForm.correction_path" type="textarea" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showRejectDialog = false">取消</el-button>
                <el-button type="danger" @click="rejectReason">确认驳回</el-button>
            </template>
        </el-dialog>
    </el-drawer>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { milestoneApi, delayReasonApi } from '../api'

const props = defineProps({
    modelValue: Boolean,
    milestone: Object
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
})

const delayReasons = ref([])
const showCreateDialog = ref(false)
const showRejectDialog = ref(false)
const selectedReason = ref(null)
const newReason = ref({
    reason: '',
    correction_path: ''
})
const rejectForm = ref({
    review_comment: '',
    correction_path: ''
})

const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
    const statusMap = {
        'pending': 'warning',
        'approved': 'success',
        'rejected': 'danger'
    }
    return statusMap[status] || 'info'
}

const getStatusText = (status) => {
    const statusMap = {
        'pending': '待审核',
        'approved': '已通过',
        'rejected': '已驳回'
    }
    return statusMap[status] || status
}

const loadDelayReasons = async () => {
    if (props.milestone) {
        try {
            const response = await milestoneApi.getDelayReasons(props.milestone.id)
            delayReasons.value = response.data
        } catch (error) {
            ElMessage.error('加载延期原因失败')
        }
    }
}

const createReason = async () => {
    if (!newReason.value.reason) {
        ElMessage.warning('请输入延期原因')
        return
    }
    try {
        await delayReasonApi.create({
            ...newReason.value,
            milestone_id: props.milestone.id
        })
        ElMessage.success('提交成功')
        showCreateDialog.value = false
        newReason.value = { reason: '', correction_path: '' }
        loadDelayReasons()
    } catch (error) {
        ElMessage.error('提交失败')
    }
}

const approveReason = async (reason) => {
    try {
        await delayReasonApi.update(reason.id, {
            status: 'approved'
        })
        ElMessage.success('审核通过')
        loadDelayReasons()
    } catch (error) {
        ElMessage.error('操作失败')
    }
}

const showRejectDialog = (reason) => {
    selectedReason.value = reason
    rejectForm.value = {
        review_comment: '',
        correction_path: reason.correction_path || ''
    }
    showRejectDialog.value = true
}

const rejectReason = async () => {
    try {
        await delayReasonApi.update(selectedReason.value.id, {
            status: 'rejected',
            review_comment: rejectForm.value.review_comment,
            correction_path: rejectForm.value.correction_path
        })
        ElMessage.success('已驳回并创建新版本')
        showRejectDialog.value = false
        loadDelayReasons()
    } catch (error) {
        ElMessage.error('操作失败')
    }
}

watch(() => props.milestone, () => {
    if (props.milestone) {
        loadDelayReasons()
    }
})

watch(visible, (val) => {
    if (val && props.milestone) {
        loadDelayReasons()
    }
})
</script>

<style scoped>
.mb-20 {
    margin-bottom: 20px;
}

.reason-card {
    margin-bottom: 10px;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.reason-content {
    margin-bottom: 15px;
}

.reason-content p {
    margin: 5px 0;
    line-height: 1.6;
}

.reason-actions {
    display: flex;
    gap: 10px;
}
</style>
