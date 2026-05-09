<template>
  <div class="count-tasks">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>盘点任务</span>
          <div>
            <el-button
              v-if="isAdmin"
              type="primary"
              @click="openCreateDialog"
            >
              <el-icon><Plus /></el-icon>
              新建盘点
            </el-button>
          </div>
        </div>
      </template>

      <el-form :inline="true" class="search-form">
        <el-form-item label="任务状态">
          <el-select
            v-model="searchForm.status"
            placeholder="全部状态"
            clearable
            style="width: 150px"
            @change="loadTasks(1)"
          >
            <el-option label="草稿" value="draft" />
            <el-option label="进行中" value="in_progress" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索任务编号或名称"
            style="width: 250px"
            clearable
            @keyup.enter="loadTasks(1)"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadTasks(1)">
            搜索
          </el-button>
          <el-button @click="resetSearch">
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <el-table
        :data="tasks"
        v-loading="loading"
        style="width: 100%"
      >
        <el-table-column prop="taskNo" label="任务编号" width="180" />
        <el-table-column prop="name" label="任务名称" />
        <el-table-column prop="Warehouse.name" label="仓库" width="150" />
        <el-table-column prop="creator.fullName" label="创建人" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="scope">
            <el-button
              type="primary"
              size="small"
              link
              @click="viewTask(scope.row)"
            >
              查看
            </el-button>
            
            <el-button
              v-if="scope.row.status === 'draft'"
              type="success"
              size="small"
              link
              @click="startTask(scope.row)"
            >
              开始盘点
            </el-button>
            
            <el-button
              v-if="scope.row.status === 'in_progress'"
              type="warning"
              size="small"
              link
              @click="performTask(scope.row)"
            >
              执行盘点
            </el-button>
            
            <el-button
              v-if="['draft', 'in_progress'].includes(scope.row.status)"
              type="danger"
              size="small"
              link
              @click="cancelTask(scope.row)"
            >
              取消
            </el-button>
            
            <el-button
              v-if="scope.row.status === 'completed'"
              type="info"
              size="small"
              link
              @click="exportReport(scope.row)"
            >
              导出报告
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadTasks"
          @current-change="loadTasks"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="createDialogVisible"
      title="新建盘点任务"
      width="600px"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="100px"
      >
        <el-form-item label="任务名称" prop="name">
          <el-input
            v-model="createForm.name"
            placeholder="请输入任务名称"
          />
        </el-form-item>
        <el-form-item label="盘点仓库" prop="warehouseId">
          <el-select
            v-model="createForm.warehouseId"
            placeholder="请选择仓库"
            style="width: 100%"
          >
            <el-option
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              :label="warehouse.name"
              :value="warehouse.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="createForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="createTask">
          创建
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { countTaskApi, warehouseApi, reportApi } from '@/services/api'

export default {
  name: 'CountTasks',
  components: {
    Plus
  },
  setup() {
    const router = useRouter()
    const store = useStore()
    
    const loading = ref(false)
    const tasks = ref([])
    const warehouses = ref([])
    
    const isAdmin = computed(() => store.getters.isAdmin)
    
    const searchForm = reactive({
      status: '',
      keyword: ''
    })
    
    const pagination = reactive({
      page: 1,
      pageSize: 20,
      total: 0
    })
    
    const createDialogVisible = ref(false)
    const submitting = ref(false)
    const createFormRef = ref(null)
    
    const createForm = reactive({
      name: '',
      warehouseId: '',
      remark: ''
    })
    
    const createRules = {
      name: [
        { required: true, message: '请输入任务名称', trigger: 'blur' }
      ],
      warehouseId: [
        { required: true, message: '请选择仓库', trigger: 'change' }
      ]
    }
    
    const loadWarehouses = async () => {
      try {
        const response = await warehouseApi.list()
        warehouses.value = response.data
      } catch (error) {
        console.error('加载仓库列表失败:', error)
      }
    }
    
    const loadTasks = async (page = pagination.page) => {
      try {
        loading.value = true
        pagination.page = page
        
        const params = {
          page: pagination.page,
          pageSize: pagination.pageSize
        }
        
        if (searchForm.status) {
          params.status = searchForm.status
        }
        
        if (searchForm.keyword) {
          params.keyword = searchForm.keyword
        }
        
        const response = await countTaskApi.list(params)
        tasks.value = response.data.tasks
        pagination.total = response.data.pagination.total
      } catch (error) {
        console.error('加载任务列表失败:', error)
      } finally {
        loading.value = false
      }
    }
    
    const resetSearch = () => {
      searchForm.status = ''
      searchForm.keyword = ''
      loadTasks(1)
    }
    
    const openCreateDialog = async () => {
      if (warehouses.value.length === 0) {
        await loadWarehouses()
      }
      
      createForm.name = ''
      createForm.warehouseId = ''
      createForm.remark = ''
      createDialogVisible.value = true
    }
    
    const createTask = async () => {
      try {
        await createFormRef.value.validate()
        submitting.value = true
        
        await countTaskApi.create(createForm)
        
        createDialogVisible.value = false
        ElMessage.success('创建成功')
        loadTasks()
      } catch (error) {
        console.error('创建任务失败:', error)
      } finally {
        submitting.value = false
      }
    }
    
    const viewTask = (row) => {
      router.push(`/count-tasks/${row.id}`)
    }
    
    const startTask = async (row) => {
      try {
        await ElMessageBox.confirm(
          `确定要开始盘点任务「${row.name}」吗？`,
          '提示',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        await countTaskApi.start(row.id)
        ElMessage.success('开始盘点')
        loadTasks()
      } catch {
      }
    }
    
    const performTask = (row) => {
      router.push(`/count-tasks/${row.id}/perform`)
    }
    
    const cancelTask = async (row) => {
      try {
        await ElMessageBox.confirm(
          `确定要取消盘点任务「${row.name}」吗？`,
          '提示',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        await countTaskApi.cancel(row.id)
        ElMessage.success('已取消')
        loadTasks()
      } catch {
      }
    }
    
    const exportReport = (row) => {
      const url = reportApi.exportCountTask(row.id)
      window.open(url, '_blank')
    }
    
    const getStatusType = (status) => {
      const map = {
        draft: 'info',
        in_progress: 'warning',
        completed: 'success',
        cancelled: 'danger'
      }
      return map[status] || 'info'
    }
    
    const getStatusText = (status) => {
      const map = {
        draft: '草稿',
        in_progress: '进行中',
        completed: '已完成',
        cancelled: '已取消'
      }
      return map[status] || status
    }
    
    const formatDate = (date) => {
      if (!date) return '-'
      return new Date(date).toLocaleString('zh-CN')
    }
    
    onMounted(async () => {
      await loadTasks()
      if (isAdmin.value) {
        await loadWarehouses()
      }
    })
    
    return {
      loading,
      tasks,
      warehouses,
      isAdmin,
      searchForm,
      pagination,
      createDialogVisible,
      submitting,
      createFormRef,
      createForm,
      createRules,
      loadTasks,
      resetSearch,
      openCreateDialog,
      createTask,
      viewTask,
      startTask,
      performTask,
      cancelTask,
      exportReport,
      getStatusType,
      getStatusText,
      formatDate,
      Plus
    }
  }
}
</script>

<style scoped>
.count-tasks {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 20px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
