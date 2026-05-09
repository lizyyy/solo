<template>
  <div class="warehouses">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>仓库管理</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新建仓库
          </el-button>
        </div>
      </template>

      <el-table :data="warehouses" v-loading="loading" style="width: 100%">
        <el-table-column prop="code" label="仓库编码" width="150" />
        <el-table-column prop="name" label="仓库名称" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="address" label="地址" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.isActive ? 'success' : 'info'">
              {{ scope.row.isActive ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" link @click="editWarehouse(scope.row)">
              编辑
            </el-button>
            <el-button type="danger" size="small" link @click="deleteWarehouse(scope.row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑仓库' : '新建仓库'"
      width="600px"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="仓库编码" prop="code">
          <el-input v-model="form.code" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="仓库名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.isActive" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { warehouseApi } from '@/services/api'

export default {
  name: 'Warehouses',
  components: {
    Plus
  },
  setup() {
    const loading = ref(false)
    const warehouses = ref([])
    const dialogVisible = ref(false)
    const isEdit = ref(false)
    const submitting = ref(false)
    const formRef = ref(null)
    
    const form = reactive({
      id: null,
      code: '',
      name: '',
      description: '',
      address: '',
      isActive: true,
      version: 1
    })
    
    const formRules = {
      code: [
        { required: true, message: '请输入仓库编码', trigger: 'blur' }
      ],
      name: [
        { required: true, message: '请输入仓库名称', trigger: 'blur' }
      ]
    }
    
    const loadWarehouses = async () => {
      try {
        loading.value = true
        const response = await warehouseApi.list()
        warehouses.value = response.data
      } catch (error) {
        console.error('加载仓库列表失败:', error)
      } finally {
        loading.value = false
      }
    }
    
    const openCreateDialog = () => {
      form.id = null
      form.code = ''
      form.name = ''
      form.description = ''
      form.address = ''
      form.isActive = true
      form.version = 1
      isEdit.value = false
      dialogVisible.value = true
    }
    
    const editWarehouse = (row) => {
      form.id = row.id
      form.code = row.code
      form.name = row.name
      form.description = row.description
      form.address = row.address
      form.isActive = row.isActive
      form.version = row.version
      isEdit.value = true
      dialogVisible.value = true
    }
    
    const deleteWarehouse = async (row) => {
      try {
        await ElMessageBox.confirm(
          `确定要删除仓库「${row.name}」吗？`,
          '提示',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        await warehouseApi.delete(row.id)
        ElMessage.success('删除成功')
        loadWarehouses()
      } catch {
      }
    }
    
    const submitForm = async () => {
      try {
        await formRef.value.validate()
        submitting.value = true
        
        if (isEdit.value) {
          await warehouseApi.update(form.id, { ...form })
        } else {
          await warehouseApi.create({ ...form })
        }
        
        dialogVisible.value = false
        ElMessage.success('保存成功')
        loadWarehouses()
      } catch (error) {
        console.error('保存失败:', error)
      } finally {
        submitting.value = false
      }
    }
    
    const formatDate = (date) => {
      if (!date) return '-'
      return new Date(date).toLocaleString('zh-CN')
    }
    
    onMounted(() => {
      loadWarehouses()
    })
    
    return {
      loading,
      warehouses,
      dialogVisible,
      isEdit,
      submitting,
      formRef,
      form,
      formRules,
      openCreateDialog,
      editWarehouse,
      deleteWarehouse,
      submitForm,
      formatDate,
      Plus
    }
  }
}
</script>

<style scoped>
.warehouses {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
