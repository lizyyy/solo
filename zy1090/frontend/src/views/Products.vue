<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">产品管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon> 新增产品
      </el-button>
    </div>

    <el-card>
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索产品名称"
          clearable
          @keyup.enter="loadData"
        />
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable @change="loadData">
          <el-option label="全部" value="" />
          <el-option label="在售" value="active" />
          <el-option label="下架" value="inactive" />
        </el-select>
        <el-button type="primary" @click="loadData">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="name" label="产品名称" min-width="180" />
        <el-table-column prop="sku" label="SKU" width="120" />
        <el-table-column label="基准价格" width="120">
          <template #default="{ row }">
            ¥{{ row.basePrice?.toFixed(2) || '0.00' }}
          </template>
        </el-table-column>
        <el-table-column label="建议价格" width="120">
          <template #default="{ row }">
            ¥{{ row.suggestedPrice?.toFixed(2) || '0.00' }}
          </template>
        </el-table-column>
        <el-table-column label="单位" width="80">
          <template #default="{ row }">
            {{ row.unit || '个' }}
          </template>
        </el-table-column>
        <el-table-column label="配方" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.hasRecipe" type="success" size="small">已配置</el-tag>
            <span v-else style="color: #909399">未配置</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '在售' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="handleViewRecipes(row)">配方</el-button>
              <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑产品' : '新增产品'"
      width="600px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="产品名称" />
        </el-form-item>
        <el-form-item label="SKU" prop="sku">
          <el-input v-model="form.sku" placeholder="产品编码" />
        </el-form-item>
        <div class="form-row">
          <el-form-item label="基准价格" prop="basePrice">
            <el-input-number v-model="form.basePrice" :min="0" :precision="2" style="width: 180px" />
          </el-form-item>
          <el-form-item label="建议价格" prop="suggestedPrice">
            <el-input-number v-model="form.suggestedPrice" :min="0" :precision="2" style="width: 180px" />
          </el-form-item>
        </div>
        <div class="form-row">
          <el-form-item label="单位" prop="unit">
            <el-select v-model="form.unit" placeholder="选择单位" style="width: 150px">
              <el-option label="个" value="piece" />
              <el-option label="套" value="set" />
              <el-option label="盒" value="box" />
              <el-option label="件" value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select v-model="form.status" style="width: 150px">
              <el-option label="在售" value="active" />
              <el-option label="下架" value="inactive" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="产品描述" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="recipesDialogVisible" title="产品配方" width="700px">
      <div v-if="currentProduct">
        <p style="margin-bottom: 16px; color: #606266">
          产品「{{ currentProduct.name }}」的配方列表：
        </p>
        <el-table :data="productRecipes" stripe v-if="productRecipes.length > 0">
          <el-table-column prop="version" label="版本" width="100" />
          <el-table-column label="成分数量" width="100">
            <template #default="{ row }">
              {{ row.ingredients?.length || 0 }} 种
            </template>
          </el-table-column>
          <el-table-column label="估算成本" width="120">
            <template #default="{ row }">
              ¥{{ row.estimatedCost?.toFixed(2) || '0.00' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
                {{ row.isActive ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" show-overflow-tooltip />
        </el-table>
        <el-empty v-else description="暂无配方，请前往「配方管理」创建" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productsAPI, recipesAPI } from '@/api'

const loading = ref(false)
const submitLoading = ref(false)
const tableData = ref([])

const searchKeyword = ref('')
const filterStatus = ref('')

const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const formRef = ref(null)

const recipesDialogVisible = ref(false)
const currentProduct = ref(null)
const productRecipes = ref([])

const form = reactive({
  name: '',
  sku: '',
  basePrice: 0,
  suggestedPrice: 0,
  unit: 'piece',
  status: 'active',
  description: ''
})

const rules = {
  name: [{ required: true, message: '请输入产品名称', trigger: 'blur' }]
}

const loadData = async () => {
  loading.value = true
  try {
    const params = { limit: 1000 }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    if (filterStatus.value) params.status = filterStatus.value
    const res = await productsAPI.list(params)
    tableData.value = res.data || []
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, {
    name: '',
    sku: '',
    basePrice: 0,
    suggestedPrice: 0,
    unit: 'piece',
    status: 'active',
    description: ''
  })
}

const handleAdd = () => {
  isEdit.value = false
  currentId.value = null
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(form, row)
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitLoading.value = true
    try {
      if (isEdit.value) {
        await productsAPI.update(currentId.value, form)
        ElMessage.success('更新成功')
      } else {
        await productsAPI.create(form)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      loadData()
    } catch (e) {
      console.error('提交失败', e)
    } finally {
      submitLoading.value = false
    }
  })
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除产品 "${row.name}" 吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await productsAPI.delete(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('删除失败', e)
    }
  }
}

const handleViewRecipes = async (row) => {
  currentProduct.value = row
  productRecipes.value = []
  recipesDialogVisible.value = true
  try {
    const res = await recipesAPI.getByProduct(row.id)
    productRecipes.value = res.data || []
  } catch (e) {
    console.error('加载配方失败', e)
  }
}

onMounted(() => {
  loadData()
})
</script>
