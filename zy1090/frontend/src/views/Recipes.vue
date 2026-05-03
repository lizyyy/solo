<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">配方管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon> 新增配方
      </el-button>
    </div>

    <el-card>
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索配方名称/产品"
          clearable
          @keyup.enter="loadData"
        />
        <el-button type="primary" @click="loadData">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="productName" label="产品名称" min-width="150" />
        <el-table-column prop="version" label="版本" width="100" />
        <el-table-column label="成分数量" width="100">
          <template #default="{ row }">
            {{ row.ingredients?.length || 0 }} 种
          </template>
        </el-table-column>
        <el-table-column label="估算成本" width="120">
          <template #default="{ row }">
            ¥{{ row.estimatedCost?.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="primary" @click="handleView(row)">查看</el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑配方' : '新增配方'"
      width="900px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <div class="form-section">
          <h4 class="form-section-title">基本信息</h4>
          <div class="form-row">
            <el-form-item label="产品" prop="productId">
              <el-select v-model="form.productId" placeholder="选择产品" filterable style="width: 250px">
                <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="版本" prop="version">
              <el-input v-model="form.version" placeholder="如：v1.0" style="width: 150px" />
            </el-form-item>
            <el-form-item label="启用">
              <el-switch v-model="form.isActive" />
            </el-form-item>
          </div>
          <el-form-item label="描述" prop="description">
            <el-input v-model="form.description" type="textarea" :rows="2" placeholder="配方描述" />
          </el-form-item>
        </div>

        <div class="form-section">
          <h4 class="form-section-title">
            配方成分
            <el-button type="primary" link size="small" @click="addIngredient">
              <el-icon><Plus /></el-icon> 添加成分
            </el-button>
          </h4>

          <el-table :data="form.ingredients" border size="small">
            <el-table-column label="材料" min-width="180">
              <template #default="{ row, $index }">
                <el-select
                  v-model="row.materialId"
                  placeholder="选择材料"
                  filterable
                  style="width: 100%"
                  @change="(val) => handleMaterialChange(val, $index)"
                >
                  <el-option
                    v-for="m in materials"
                    :key="m.id"
                    :label="m.name"
                    :value="m.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="用量" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.quantity" :min="0" :precision="3" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="单位" width="100">
              <template #default="{ row }">
                <el-select v-model="row.unit" placeholder="单位" style="width: 100%">
                  <el-option label="g" value="g" />
                  <el-option label="kg" value="kg" />
                  <el-option label="ml" value="ml" />
                  <el-option label="l" value="l" />
                  <el-option label="个" value="piece" />
                  <el-option label="套" value="set" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="损耗率" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.wasteRate" :min="0" :max="100" :precision="1" style="width: 100%">
                  <template #suffix>%</template>
                </el-input-number>
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.remarks" placeholder="备注" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ $index }">
                <el-button type="danger" link size="small" @click="removeIngredient($index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="ingredientValidationError" class="danger-text" style="margin-top: 10px">
            ⚠️ {{ ingredientValidationError }}
          </div>
        </div>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="viewDialogVisible" title="配方详情" width="800px">
      <div v-if="currentViewItem" class="card-content">
        <div class="form-section">
          <h4 class="form-section-title">基本信息</h4>
          <div class="form-row">
            <div><span style="color: #909399">产品：</span>{{ currentViewItem.productName }}</div>
            <div><span style="color: #909399">版本：</span>{{ currentViewItem.version }}</div>
            <div><span style="color: #909399">状态：</span>{{ currentViewItem.isActive ? '启用' : '停用' }}</div>
          </div>
          <div v-if="currentViewItem.description">
            <span style="color: #909399">描述：</span>{{ currentViewItem.description }}
          </div>
        </div>

        <el-divider />

        <div class="form-section">
          <h4 class="form-section-title">配方成分</h4>
          <el-table :data="currentViewItem.ingredients" border size="small">
            <el-table-column prop="materialName" label="材料名称" />
            <el-table-column label="用量" width="120">
              <template #default="{ row }">
                {{ row.quantity }} {{ row.unit }}
              </template>
            </el-table-column>
            <el-table-column label="损耗率" width="100">
              <template #default="{ row }">
                {{ row.wasteRate || 0 }}%
              </template>
            </el-table-column>
            <el-table-column prop="remarks" label="备注" />
          </el-table>
        </div>

        <el-divider />

        <div class="form-section">
          <h4 class="form-section-title">成本估算</h4>
          <div class="quote-preview">
            <div class="summary-row">
              <span>预估材料成本</span>
              <span>¥{{ currentViewItem.estimatedCost?.toFixed(2) || '0.00' }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { recipesAPI, productsAPI, materialsAPI } from '@/api'

const loading = ref(false)
const submitLoading = ref(false)
const tableData = ref([])
const products = ref([])
const materials = ref([])

const searchKeyword = ref('')
const ingredientValidationError = ref('')

const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const formRef = ref(null)

const viewDialogVisible = ref(false)
const currentViewItem = ref(null)

const form = reactive({
  productId: null,
  version: 'v1.0',
  isActive: true,
  description: '',
  ingredients: []
})

const rules = {
  productId: [{ required: true, message: '请选择产品', trigger: 'change' }],
  version: [{ required: true, message: '请输入版本号', trigger: 'blur' }]
}

const loadData = async () => {
  loading.value = true
  try {
    const params = { limit: 1000 }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    const res = await recipesAPI.list(params)
    tableData.value = res.data || []
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

const loadProducts = async () => {
  try {
    const res = await productsAPI.list({ limit: 1000 })
    products.value = res.data || []
  } catch (e) {
    console.error('加载产品失败', e)
  }
}

const loadMaterials = async () => {
  try {
    const res = await materialsAPI.list({ limit: 1000 })
    materials.value = res.data || []
  } catch (e) {
    console.error('加载材料失败', e)
  }
}

const resetForm = () => {
  Object.assign(form, {
    productId: null,
    version: 'v1.0',
    isActive: true,
    description: '',
    ingredients: []
  })
  ingredientValidationError.value = ''
}

const addIngredient = () => {
  form.ingredients.push({
    materialId: null,
    quantity: 0,
    unit: 'g',
    wasteRate: 10,
    remarks: ''
  })
}

const removeIngredient = (index) => {
  form.ingredients.splice(index, 1)
}

const handleMaterialChange = async (materialId, index) => {
  if (!materialId) return
  const material = materials.value.find(m => m.id === materialId)
  if (material && form.ingredients[index]) {
    form.ingredients[index].unit = material.unit || 'g'
  }
}

const handleAdd = () => {
  isEdit.value = false
  currentId.value = null
  resetForm()
  addIngredient()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(form, {
    ...row,
    ingredients: row.ingredients?.map(i => ({
      ...i,
      materialId: i.materialId
    })) || []
  })
  ingredientValidationError.value = ''
  dialogVisible.value = true
}

const handleView = (row) => {
  currentViewItem.value = row
  viewDialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  if (form.ingredients.length === 0) {
    ingredientValidationError.value = '请至少添加一种成分'
    return
  }

  const invalidIngredient = form.ingredients.find(i => !i.materialId || i.quantity <= 0)
  if (invalidIngredient) {
    ingredientValidationError.value = '请完善所有成分的材料和用量'
    return
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitLoading.value = true
    try {
      if (isEdit.value) {
        await recipesAPI.update(currentId.value, form)
        ElMessage.success('更新成功')
      } else {
        await recipesAPI.create(form)
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
    await ElMessageBox.confirm(`确定要删除配方 "${row.productName} (${row.version})" 吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await recipesAPI.delete(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('删除失败', e)
    }
  }
}

onMounted(() => {
  loadData()
  loadProducts()
  loadMaterials()
})
</script>
