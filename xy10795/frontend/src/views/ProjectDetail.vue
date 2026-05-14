<template>
    <div class="project-detail">
        <el-page-header @back="goBack" :content="project?.name" />
        
        <el-tabs v-model="activeTab" class="mt-20">
            <el-tab-pane label="里程碑" name="milestones">
                <MilestoneTab :project-id="projectId" />
            </el-tab-pane>
            <el-tab-pane label="风险管理" name="risks">
                <RiskTab :project-id="projectId" />
            </el-tab-pane>
            <el-tab-pane label="周报版本" name="reports">
                <ReportTab :project-id="projectId" />
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { projectApi } from '../api'
import MilestoneTab from '../components/MilestoneTab.vue'
import RiskTab from '../components/RiskTab.vue'
import ReportTab from '../components/ReportTab.vue'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => parseInt(route.params.id))
const project = ref(null)
const activeTab = ref('milestones')

const loadProject = async () => {
    try {
        const response = await projectApi.getProject(projectId.value)
        project.value = response.data
    } catch (error) {
        ElMessage.error('加载项目信息失败')
    }
}

const goBack = () => {
    router.push('/')
}

onMounted(() => {
    loadProject()
})
</script>

<style scoped>
.mt-20 {
    margin-top: 20px;
}
</style>
