<template>
  <div class="reagent-list">
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="试剂名称/编码"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="searchForm.category" placeholder="请选择" clearable>
            <el-option
              v-for="cat in categories"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button type="success" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新增试剂
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px;">
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="code" label="试剂编码" width="140" />
        <el-table-column prop="name" label="试剂名称" min-width="180" />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="specification" label="规格" width="120" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="minStock" label="安全库存" width="100" />
        <el-table-column prop="shelfLifeDays" label="保质期(天)" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'active' ? 'success' : 'info'">
              {{ scope.row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="viewDetail(scope.row.id)">
              详情
            </el-button>
            <el-button link type="primary" @click="openEditDialog(scope.row)">
              编辑
            </el-button>
            <el-popconfirm title="确认删除该试剂吗？" @confirm="handleDelete(scope.row)">
              <template #reference>
                <el-button link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑试剂' : '新增试剂'"
      width="600px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item label="试剂编码" prop="code">
          <el-input v-model="formData.code" placeholder="请输入试剂编码" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="试剂名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入试剂名称" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-input v-model="formData.category" placeholder="请输入分类" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="formData.specification" placeholder="如：500g" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formData.unit" placeholder="如：瓶" />
        </el-form-item>
        <el-form-item label="安全库存">
          <el-input-number v-model="formData.minStock" :min="0" />
        </el-form-item>
        <el-form-item label="最大库存">
          <el-input-number v-model="formData.maxStock" :min="1" />
        </el-form-item>
        <el-form-item label="保质期(天)">
          <el-input-number v-model="formData.shelfLifeDays" :min="1" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="formData.status">
            <el-radio label="active">启用</el-radio>
            <el-radio label="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="formData.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getReagentList, createReagent, updateReagent, deleteReagent, getCategories } from '../api/reagent'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const tableData = ref([])
const categories = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const searchForm = reactive({
  keyword: '',
  category: '',
  status: ''
})

const formData = reactive({
  id: '',
  code: '',
  name: '',
  category: '',
  specification: '',
  unit: '瓶',
  minStock: 0,
  maxStock: 100,
  shelfLifeDays: 365,
  status: 'active',
  description: ''
})

const formRules = {
  code: [{ required: true, message: '请输入试剂编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入试剂名称', trigger: 'blur' }],
  category: [{ required: true, message: '请输入分类', trigger: 'blur' }]
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getReagentList({
      keyword: searchForm.keyword || undefined,
      category: searchForm.category || undefined,
      status: searchForm.status || undefined
    })
    tableData.value = res.data || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function fetchCategories() {
  try {
    const res = await getCategories()
    categories.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}

function handleSearch() {
  fetchList()
}

function resetSearch() {
  searchForm.keyword = ''
  searchForm.category = ''
  searchForm.status = ''
  fetchList()
}

function viewDetail(id) {
  router.push(`/reagents/${id}`)
}

function openCreateDialog() {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  Object.assign(formData, row)
  dialogVisible.value = true
}

function resetForm() {
  formData.id = ''
  formData.code = ''
  formData.name = ''
  formData.category = ''
  formData.specification = ''
  formData.unit = '瓶'
  formData.minStock = 0
  formData.maxStock = 100
  formData.shelfLifeDays = 365
  formData.status = 'active'
  formData.description = ''
  formRef.value?.resetFields()
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()
  
  submitting.value = true
  try {
    if (isEdit.value) {
      await updateReagent(formData.id, {
        name: formData.name,
        category: formData.category,
        specification: formData.specification,
        unit: formData.unit,
        minStock: formData.minStock,
        maxStock: formData.maxStock,
        shelfLifeDays: formData.shelfLifeDays,
        status: formData.status,
        description: formData.description
      })
      ElMessage.success('更新成功')
    } else {
      await createReagent({ ...formData })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchList()
    fetchCategories()
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row) {
  try {
    await deleteReagent(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  fetchList()
  fetchCategories()
})
</script>

<style scoped>
.search-card {
  margin-bottom: 16px;
}
</style>
