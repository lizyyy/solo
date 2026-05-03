<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">材料列表</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon> 新增材料
      </el-button>
    </div>

    <el-card>
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索材料名称"
          clearable
          @keyup.enter="loadData"
        />
        <el-select v-model="filterCategory" placeholder="分类筛选" clearable @change="loadData">
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-button type="primary" @click="loadData">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="name" label="材料名称" min-width="150" />
        <el-table-column prop="categoryName" label="分类" width="100" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column label="批次数量" width="100">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ row.batchCount || 0 }} 批</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="总库存" width="120">
          <template #default="{ row }">
            {{ row.totalStock || 0 }} {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column label="过敏原" min-width="150">
          <template #default="{ row }">
            <div v-if="row.allergens?.length">
              <el-tag
                v-for="allergen in row.allergens"
                :key="allergen"
                type="warning"
                size="small"
                style="margin-right: 4px"
              >
                {{ allergen }}
              </el-tag>
            </div>
            <span v-else style="color: #909399">无</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑材料' : '新增材料'"
      width="600px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="材料名称" />
        </el-form-item>
        <el-form-item label="分类" prop="categoryId">
          <el-select v-model="form.categoryId" placeholder="选择分类" filterable style="width: 100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-select v-model="form.unit" placeholder="选择单位" style="width: 100%">
            <el-option label="克 (g)" value="g" />
            <el-option label="千克 (kg)" value="kg" />
            <el-option label="毫升 (ml)" value="ml" />
            <el-option label="升 (l)" value="l" />
            <el-option label="个" value="piece" />
            <el-option label="套" value="set" />
            <el-option label="盒" value="box" />
          </el-select>
        </el-form-item>
        <el-form-item label="安全库存" prop="safetyStock">
          <el-input-number v-model="form.safetyStock" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="默认过敏原" prop="allergens">
          <el-select v-model="form.allergens" multiple placeholder="可多选" style="width: 100%">
            <el-option label="坚果" value="nuts" />
            <el-option label="花生" value="peanut" />
            <el-option label="大豆" value="soy" />
            <el-option label="乳制品" value="dairy" />
            <el-option label="麸质" value="gluten" />
            <el-option label="香精" value="fragrance" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="材料描述" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { materialsAPI } from '@/api'

const loading = ref(false)
const submitLoading = ref(false)
const tableData = ref([])
const categories = ref([])

const searchKeyword = ref('')
const filterCategory = ref(null)

const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const formRef = ref(null)

const form = reactive({
  name: '',
  categoryId: null,
  unit: 'g',
  safetyStock: 10,
  allergens: [],
  description: ''
})

const rules = {
  name: [{ required: true, message: '请输入材料名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  unit: [{ required: true, message: '请选择单位', trigger: 'change' }]
}

const loadData = async () => {
  loading.value = true
  try {
    const params = { limit: 1000 }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    if (filterCategory.value) params.categoryId = filterCategory.value
    const res = await materialsAPI.list(params)
    tableData.value = res.data || []
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

const loadCategories = async () => {
  try {
    const res = await materialsAPI.categories()
    categories.value = res.data || []
  } catch (e) {
    console.error('加载分类失败', e)
  }
}

const resetForm = () => {
  Object.assign(form, {
    name: '',
    categoryId: null,
    unit: 'g',
    safetyStock: 10,
    allergens: [],
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
  Object.assign(form, {
    ...row,
    allergens: row.allergens || []
  })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitLoading.value = true
    try {
      if (isEdit.value) {
        await materialsAPI.update(currentId.value, form)
        ElMessage.success('更新成功')
      } else {
        await materialsAPI.create(form)
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
    await ElMessageBox.confirm(`确定要删除材料 "${row.name}" 吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await materialsAPI.delete(row.id)
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
  loadCategories()
})
</script>
