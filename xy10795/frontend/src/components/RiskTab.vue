<template>
    <div class="risk-tab">
        <el-card>
            <template #header>
                <div class="card-header">
                    <span>风险列表</span>
                    <el-button type="primary" @click="showCreateDialog = true">添加风险</el-button>
                </div>
            </template>
            <el-table :data="risks" style="width: 100%">
                <el-table-column prop="title" label="风险标题" />
                <el-table-column prop="description" label="描述" show-overflow-tooltip />
                <el-table-column prop="status" label="状态">
                    <template #default="{ row }">
                        <el-tag :type="getStatusType(row.status)">
                            {{ getStatusText(row.status) }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="owner" label="负责人" />
                <el-table-column prop="owner_feedback" label="负责人反馈" show-overflow-tooltip />
                <el-table-column prop="impact_level" label="影响级别">
                    <template #default="{ row }">
                        <el-tag v-if="row.impact_level" :type="getImpactType(row.impact_level)">
                            {{ row.impact_level }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="150">
                    <template #default="{ row }">
                        <el-button type="primary" size="small" @click="editRisk(row)">
                            编辑
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <el-dialog v-model="showCreateDialog" title="添加风险" width="600px">
            <el-form :model="riskForm" label-width="120px">
                <el-form-item label="风险标题">
                    <el-input v-model="riskForm.title" />
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="riskForm.description" type="textarea" />
                </el-form-item>
                <el-form-item label="状态">
                    <el-select v-model="riskForm.status" style="width: 100%">
                        <el-option label="已识别" value="identified" />
                        <el-option label="处理中" value="in_progress" />
                        <el-option label="已解决" value="resolved" />
                        <el-option label="已缓解" value="mitigated" />
                        <el-option label="已升级" value="escalated" />
                    </el-select>
                </el-form-item>
                <el-form-item label="负责人">
                    <el-input v-model="riskForm.owner" />
                </el-form-item>
                <el-form-item label="负责人反馈">
                    <el-input v-model="riskForm.owner_feedback" type="textarea" />
                </el-form-item>
                <el-form-item label="影响级别">
                    <el-select v-model="riskForm.impact_level" style="width: 100%">
                        <el-option label="高" value="high" />
                        <el-option label="中" value="medium" />
                        <el-option label="低" value="low" />
                    </el-select>
                </el-form-item>
                <el-form-item label="概率">
                    <el-select v-model="riskForm.probability" style="width: 100%">
                        <el-option label="高" value="high" />
                        <el-option label="中" value="medium" />
                        <el-option label="低" value="low" />
                    </el-select>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showCreateDialog = false">取消</el-button>
                <el-button type="primary" @click="saveRisk">{{ isEditing ? '更新' : '创建' }}</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { projectApi, riskApi } from '../api'

const props = defineProps({
    projectId: {
        type: Number,
        required: true
    }
})

const risks = ref([])
const showCreateDialog = ref(false)
const isEditing = ref(false)
const editingRisk = ref(null)
const riskForm = ref({
    title: '',
    description: '',
    status: 'identified',
    owner: '',
    owner_feedback: '',
    impact_level: '',
    probability: ''
})

const getStatusType = (status) => {
    const statusMap = {
        'identified': 'info',
        'in_progress': 'primary',
        'resolved': 'success',
        'mitigated': 'success',
        'escalated': 'danger'
    }
    return statusMap[status] || 'info'
}

const getStatusText = (status) => {
    const statusMap = {
        'identified': '已识别',
        'in_progress': '处理中',
        'resolved': '已解决',
        'mitigated': '已缓解',
        'escalated': '已升级'
    }
    return statusMap[status] || status
}

const getImpactType = (level) => {
    const levelMap = {
        'high': 'danger',
        'medium': 'warning',
        'low': 'success'
    }
    return levelMap[level] || 'info'
}

const loadRisks = async () => {
    try {
        const response = await projectApi.getRisks(props.projectId)
        risks.value = response.data
    } catch (error) {
        ElMessage.error('加载风险列表失败')
    }
}

const editRisk = (risk) => {
    isEditing.value = true
    editingRisk.value = risk
    riskForm.value = {
        title: risk.title,
        description: risk.description,
        status: risk.status,
        owner: risk.owner,
        owner_feedback: risk.owner_feedback,
        impact_level: risk.impact_level,
        probability: risk.probability
    }
    showCreateDialog.value = true
}

const saveRisk = async () => {
    if (!riskForm.value.title) {
        ElMessage.warning('请输入风险标题')
        return
    }
    try {
        if (isEditing.value) {
            await riskApi.update(editingRisk.value.id, {
                ...riskForm.value,
                update_token: editingRisk.value.update_token
            })
            ElMessage.success('更新成功')
        } else {
            await riskApi.create({
                ...riskForm.value,
                project_id: props.projectId
            })
            ElMessage.success('创建成功')
        }
        showCreateDialog.value = false
        resetForm()
        loadRisks()
    } catch (error) {
        if (error.response?.status === 409) {
            ElMessage.error('数据已被更新，请刷新后重试')
        } else {
            ElMessage.error('操作失败')
        }
    }
}

const resetForm = () => {
    isEditing.value = false
    editingRisk.value = null
    riskForm.value = {
        title: '',
        description: '',
        status: 'identified',
        owner: '',
        owner_feedback: '',
        impact_level: '',
        probability: ''
    }
}

watch(() => props.projectId, () => {
    if (props.projectId) {
        loadRisks()
    }
})

onMounted(() => {
    loadRisks()
})
</script>

<style scoped>
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
</style>
