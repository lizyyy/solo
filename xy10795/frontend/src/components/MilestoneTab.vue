<template>
    <div class="milestone-tab">
        <el-card>
            <template #header>
                <div class="card-header">
                    <span>里程碑列表</span>
                    <el-button type="primary" @click="showCreateDialog = true">添加里程碑</el-button>
                </div>
            </template>
            <el-table :data="milestones" style="width: 100%">
                <el-table-column prop="name" label="里程碑名称" />
                <el-table-column prop="description" label="描述" />
                <el-table-column prop="planned_date" label="计划日期">
                    <template #default="{ row }">
                        {{ formatDate(row.planned_date) }}
                    </template>
                </el-table-column>
                <el-table-column prop="status" label="状态">
                    <template #default="{ row }">
                        <el-tag :type="getStatusType(row.status)">
                            {{ row.status }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="200">
                    <template #default="{ row }">
                        <el-button type="primary" size="small" @click="viewDelayReasons(row)">
                            延期原因
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <el-dialog v-model="showCreateDialog" title="添加里程碑" width="600px">
            <el-form :model="newMilestone" label-width="100px">
                <el-form-item label="名称">
                    <el-input v-model="newMilestone.name" />
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="newMilestone.description" type="textarea" />
                </el-form-item>
                <el-form-item label="计划日期">
                    <el-date-picker v-model="newMilestone.planned_date" type="datetime" style="width: 100%" />
                </el-form-item>
                <el-form-item label="原始输入">
                    <el-input v-model="newMilestone.original_input" type="textarea" />
                </el-form-item>
                <el-form-item label="处理结果">
                    <el-input v-model="newMilestone.processed_result" type="textarea" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showCreateDialog = false">取消</el-button>
                <el-button type="primary" @click="createMilestone">创建</el-button>
            </template>
        </el-dialog>

        <DelayReasonDrawer v-model="showDelayDrawer" :milestone="selectedMilestone" />
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { projectApi, milestoneApi } from '../api'
import DelayReasonDrawer from './DelayReasonDrawer.vue'

const props = defineProps({
    projectId: {
        type: Number,
        required: true
    }
})

const milestones = ref([])
const showCreateDialog = ref(false)
const showDelayDrawer = ref(false)
const selectedMilestone = ref(null)
const newMilestone = ref({
    name: '',
    description: '',
    planned_date: null,
    original_input: '',
    processed_result: '',
    status: 'planned'
})

const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
    const statusMap = {
        'planned': 'info',
        'in_progress': 'primary',
        'completed': 'success',
        'delayed': 'danger'
    }
    return statusMap[status] || 'info'
}

const loadMilestones = async () => {
    try {
        const response = await projectApi.getMilestones(props.projectId)
        milestones.value = response.data
    } catch (error) {
        ElMessage.error('加载里程碑失败')
    }
}

const createMilestone = async () => {
    if (!newMilestone.value.name) {
        ElMessage.warning('请输入里程碑名称')
        return
    }
    try {
        await milestoneApi.create({
            ...newMilestone.value,
            project_id: props.projectId
        })
        ElMessage.success('创建成功')
        showCreateDialog.value = false
        newMilestone.value = {
            name: '',
            description: '',
            planned_date: null,
            original_input: '',
            processed_result: '',
            status: 'planned'
        }
        loadMilestones()
    } catch (error) {
        ElMessage.error('创建失败')
    }
}

const viewDelayReasons = (milestone) => {
    selectedMilestone.value = milestone
    showDelayDrawer.value = true
}

watch(() => props.projectId, () => {
    if (props.projectId) {
        loadMilestones()
    }
})

onMounted(() => {
    loadMilestones()
})
</script>

<style scoped>
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
</style>
