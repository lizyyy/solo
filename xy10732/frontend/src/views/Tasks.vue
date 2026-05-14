<template>
  <div class="tasks-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>任务管理</span>
          <el-button type="primary" @click="showCreateDialog">
            <el-icon><Plus /></el-icon> 新建任务
          </el-button>
        </div>
      </template>
      
      <el-table :data="tasks" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="任务名称" />
        <el-table-column prop="cron_expression" label="Cron表达式" width="150" />
        <el-table-column prop="description" label="描述" />
        <el-table-column label="依赖资源" width="200">
          <template #default="{ row }">
            <el-tag v-for="dep in row.dependencies" :key="dep" size="small" style="margin-right: 5px">
              {{ dep }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button type="text" @click="viewTask(row)">查看</el-button>
            <el-button type="text" @click="regenerateExecutions(row)">重新生成</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createVisible" title="新建任务" width="600px">
      <el-form :model="taskForm" :rules="taskRules" ref="taskFormRef" label-width="100px">
        <el-form-item label="任务名称" prop="name">
          <el-input v-model="taskForm.name" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="Cron表达式" prop="cron_expression">
          <el-input v-model="taskForm.cron_expression" placeholder="例如: 0 0 * * *" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="taskForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="依赖资源" prop="dependencies">
          <el-select v-model="taskForm.dependencies" multiple placeholder="请选择依赖资源">
            <el-option label="数据库" value="database" />
            <el-option label="Redis" value="redis" />
            <el-option label="API服务" value="api" />
            <el-option label="文件系统" value="filesystem" />
            <el-option label="消息队列" value="mq" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="createTask">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { taskApi } from '../api'
import dayjs from 'dayjs'

const tasks = ref([])
const createVisible = ref(false)
const taskFormRef = ref(null)

const taskForm = ref({
  name: '',
  cron_expression: '',
  description: '',
  dependencies: []
})

const taskRules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  cron_expression: [{ required: true, message: '请输入Cron表达式', trigger: 'blur' }]
}

const loadTasks = async () => {
  try {
    const res = await taskApi.list()
    tasks.value = res.data
  } catch (e) {
    ElMessage.error('加载任务失败')
  }
}

const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const showCreateDialog = () => {
  taskForm.value = {
    name: '',
    cron_expression: '',
    description: '',
    dependencies: []
  }
  createVisible.value = true
}

const createTask = async () => {
  if (!taskFormRef.value) return
  await taskFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await taskApi.create(taskForm.value)
        ElMessage.success('任务创建成功')
        createVisible.value = false
        loadTasks()
      } catch (e) {
        ElMessage.error(e.response?.data?.detail || '创建失败')
      }
    }
  })
}

const viewTask = (task) => {
  console.log('View task:', task)
}

const regenerateExecutions = (task) => {
  ElMessage.info('重新生成执行记录功能待实现')
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
