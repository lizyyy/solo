<template>
    <div class="project-list">
        <el-card>
            <template #header>
                <div class="card-header">
                    <span>项目列表</span>
                    <el-button type="primary" @click="showCreateDialog = true">新建项目</el-button>
                </div>
            </template>
            <el-table :data="projects" style="width: 100%">
                <el-table-column prop="name" label="项目名称" />
                <el-table-column prop="description" label="项目描述" />
                <el-table-column prop="created_at" label="创建时间">
                    <template #default="{ row }">
                        {{ formatDate(row.created_at) }}
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="200">
                    <template #default="{ row }">
                        <el-button type="primary" size="small" @click="goToDetail(row.id)">
                            查看详情
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <el-dialog v-model="showCreateDialog" title="新建项目" width="500px">
            <el-form :model="newProject" label-width="100px">
                <el-form-item label="项目名称">
                    <el-input v-model="newProject.name" />
                </el-form-item>
                <el-form-item label="项目描述">
                    <el-input v-model="newProject.description" type="textarea" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showCreateDialog = false">取消</el-button>
                <el-button type="primary" @click="createProject">创建</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { projectApi } from '../api'

const router = useRouter()
const projects = ref([])
const showCreateDialog = ref(false)
const newProject = ref({
    name: '',
    description: ''
})

const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('zh-CN')
}

const loadProjects = async () => {
    try {
        const response = await projectApi.getProjects()
        projects.value = response.data
    } catch (error) {
        ElMessage.error('加载项目列表失败')
    }
}

const createProject = async () => {
    if (!newProject.value.name) {
        ElMessage.warning('请输入项目名称')
        return
    }
    try {
        await projectApi.createProject(newProject.value)
        ElMessage.success('创建成功')
        showCreateDialog.value = false
        newProject.value = { name: '', description: '' }
        loadProjects()
    } catch (error) {
        ElMessage.error('创建失败')
    }
}

const goToDetail = (id) => {
    router.push(`/project/${id}`)
}

onMounted(() => {
    loadProjects()
})
</script>

<style scoped>
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
</style>
