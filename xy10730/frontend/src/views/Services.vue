<template>
  <div class="services-page">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>服务管理</span>
          <el-button type="primary" @click="openAddDialog">添加服务</el-button>
        </div>
      </template>

      <el-table :data="services" border stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="服务名称" min-width="150" />
        <el-table-column prop="description" label="描述" min-width="200" />
        <el-table-column prop="service_type" label="服务类型" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="health_check_url" label="探活地址" min-width="200" />
        <el-table-column prop="owner" label="负责人" width="120" />
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑服务' : '添加服务'"
      width="600px"
    >
      <el-form :model="form" label-width="100px">
        <el-form-item label="服务名称">
          <el-input v-model="form.name" placeholder="请输入服务名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入服务描述"
          />
        </el-form-item>
        <el-form-item label="服务类型">
          <el-input v-model="form.service_type" placeholder="请输入服务类型" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" placeholder="选择状态">
            <el-option label="在线" value="online" />
            <el-option label="离线" value="offline" />
            <el-option label="降级" value="degraded" />
            <el-option label="维护中" value="maintenance" />
          </el-select>
        </el-form-item>
        <el-form-item label="探活地址">
          <el-input v-model="form.health_check_url" placeholder="请输入探活地址" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.owner" placeholder="请输入负责人" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { serviceAPI } from '@/api'

const services = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)

const form = reactive({
  name: '',
  description: '',
  service_type: '',
  status: 'online',
  health_check_url: '',
  owner: ''
})

const loadServices = async () => {
  try {
    const res = await serviceAPI.getServices()
    services.value = res.data
  } catch (e) {
    ElMessage.error('加载服务列表失败')
  }
}

const openAddDialog = () => {
  isEdit.value = false
  currentId.value = null
  Object.assign(form, {
    name: '',
    description: '',
    service_type: '',
    status: 'online',
    health_check_url: '',
    owner: ''
  })
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(form, {
    name: row.name,
    description: row.description,
    service_type: row.service_type,
    status: row.status,
    health_check_url: row.health_check_url,
    owner: row.owner
  })
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!form.name) {
    ElMessage.warning('请输入服务名称')
    return
  }

  try {
    if (isEdit.value) {
      await serviceAPI.updateService(currentId.value, form)
      ElMessage.success('更新成功')
    } else {
      await serviceAPI.createService(form)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadServices()
  } catch (e) {
    ElMessage.error(isEdit.value ? '更新失败' : '添加失败')
  }
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const map = {
    online: 'success',
    offline: 'danger',
    degraded: 'warning',
    maintenance: 'info'
  }
  return map[status] || 'info'
}

const getStatusLabel = (status) => {
  const map = {
    online: '在线',
    offline: '离线',
    degraded: '降级',
    maintenance: '维护中'
  }
  return map[status] || status
}

onMounted(() => {
  loadServices()
})
</script>

<style scoped>
.services-page {
  height: 100%;
}
</style>
