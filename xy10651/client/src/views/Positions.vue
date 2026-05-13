<template>
  <div>
    <h2 style="margin-bottom: 20px">岗位技能管理</h2>

    <el-alert
      title="岗位技能匹配机制"
      type="info"
      :closable="false"
      style="margin-bottom: 20px"
    >
      <p>1. 分配清洁任务时会校验员工技能是否匹配岗位要求</p>
      <p>2. 技能不匹配时无法分配任务</p>
      <p>3. 所有修改都会留痕记录</p>
    </el-alert>

    <el-button type="primary" @click="showCreateDialog" style="margin-bottom: 20px">
      新增岗位
    </el-button>

    <el-table :data="positions" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="岗位名称" width="200" />
      <el-table-column prop="description" label="描述" width="300" />
      <el-table-column prop="required_skills" label="所需技能" width="300" />
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="createDialogVisible" title="新增岗位" width="500px">
      <el-form :model="newPosition" label-width="100px">
        <el-form-item label="岗位名称">
          <el-input v-model="newPosition.name" placeholder="请输入岗位名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newPosition.description" type="textarea" />
        </el-form-item>
        <el-form-item label="所需技能">
          <el-input v-model="newPosition.required_skills" placeholder="多个技能用逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createPosition">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { positionsAPI } from '../api'

const positions = ref([])
const createDialogVisible = ref(false)
const newPosition = ref({
  name: '',
  description: '',
  required_skills: ''
})

const loadPositions = async () => {
  try {
    const res = await positionsAPI.list()
    positions.value = res.data
  } catch (err) {
    ElMessage.error('加载失败')
  }
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const showCreateDialog = () => {
  createDialogVisible.value = true
}

const createPosition = async () => {
  if (!newPosition.value.name) {
    ElMessage.warning('请输入岗位名称')
    return
  }
  try {
    await positionsAPI.create(newPosition.value)
    ElMessage.success('岗位创建成功')
    createDialogVisible.value = false
    loadPositions()
  } catch (err) {
    ElMessage.error('创建失败')
  }
}

onMounted(() => {
  loadPositions()
})
</script>
