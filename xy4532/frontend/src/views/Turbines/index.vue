<template>
  <div class="turbines-container">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="风机状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 140px">
            <el-option label="正常" value="正常" />
            <el-option label="告警" value="告警" />
            <el-option label="停机" value="停机" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchTurbines">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetFilter">重置</el-button>
          <el-button type="success" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新增风机
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="hover" style="margin-top: 20px">
      <el-table :data="turbineList" v-loading="loading" style="width: 100%">
        <el-table-column prop="turbine_id" label="风机编号" width="140">
          <template #default="{ row }">
            <el-button type="primary" link @click="goToDetail(row.id)">
              {{ row.turbine_id }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="风机名称" min-width="180" />
        <el-table-column prop="location" label="位置" min-width="150" />
        <el-table-column prop="capacity" label="装机容量" width="120">
          <template #default="{ row }">
            {{ row.capacity ? row.capacity + ' MW' : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goToDetail(row.id)">
              详情
            </el-button>
            <el-button type="danger" link @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </el-card>

    <el-dialog
      v-model="showCreateDialog"
      title="新增风机"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="100px">
        <el-form-item label="风机编号" prop="turbine_id">
          <el-input v-model="createForm.turbine_id" placeholder="请输入风机编号" />
        </el-form-item>
        <el-form-item label="风机名称" prop="name">
          <el-input v-model="createForm.name" placeholder="请输入风机名称" />
        </el-form-item>
        <el-form-item label="位置" prop="location">
          <el-input v-model="createForm.location" placeholder="请输入位置" />
        </el-form-item>
        <el-form-item label="装机容量" prop="capacity">
          <el-input-number
            v-model="createForm.capacity"
            :min="0"
            :precision="2"
            placeholder="MW"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="createForm.status" placeholder="请选择状态" style="width: 100%">
            <el-option label="正常" value="正常" />
            <el-option label="告警" value="告警" />
            <el-option label="停机" value="停机" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { getTurbines, createTurbine, deleteTurbine } from '@/api/turbines'
import type { WindTurbine } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()

const loading = ref(false)
const showCreateDialog = ref(false)
const createFormRef = ref<FormInstance>()

const filterForm = reactive({
  status: undefined as string | undefined,
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

const turbineList = ref<WindTurbine[]>([])

const createForm = reactive({
  turbine_id: '',
  name: '',
  location: '',
  capacity: undefined as number | undefined,
  status: '正常',
})

const createRules: FormRules = {
  turbine_id: [{ required: true, message: '请输入风机编号', trigger: 'blur' }],
}

const getStatusType = (status: string) => {
  const typeMap: Record<string, string> = {
    '正常': 'success',
    '告警': 'warning',
    '停机': 'danger',
  }
  return typeMap[status] || 'info'
}

const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const fetchTurbines = async () => {
  loading.value = true
  try {
    const result = await getTurbines({
      skip: (pagination.page - 1) * pagination.pageSize,
      limit: pagination.pageSize,
      status: filterForm.status,
    })
    turbineList.value = result.items
    pagination.total = result.total
  } catch (error: any) {
    ElMessage.error(error.message || '获取风机列表失败')
  } finally {
    loading.value = false
  }
}

const resetFilter = () => {
  filterForm.status = undefined
  pagination.page = 1
  fetchTurbines()
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  fetchTurbines()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  fetchTurbines()
}

const goToDetail = (id: number) => {
  router.push(`/turbines/${id}`)
}

const handleDelete = async (row: WindTurbine) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除风机 ${row.turbine_id} 吗？此操作不可恢复。`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await deleteTurbine(row.id)
    ElMessage.success('删除成功')
    fetchTurbines()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

const handleCreate = async () => {
  if (!createFormRef.value) return
  
  await createFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await createTurbine(createForm)
        ElMessage.success('创建成功')
        showCreateDialog.value = false
        createFormRef.value.resetFields()
        Object.assign(createForm, {
          turbine_id: '',
          name: '',
          location: '',
          capacity: undefined,
          status: '正常',
        })
        fetchTurbines()
      } catch (error: any) {
        ElMessage.error(error.message || '创建失败')
      }
    }
  })
}

onMounted(() => {
  fetchTurbines()
})
</script>

<style scoped>
.turbines-container {
  min-height: 100%;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
</style>
