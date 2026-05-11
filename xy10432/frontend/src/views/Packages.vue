<template>
  <div class="packages-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>套餐管理</span>
          <el-button type="primary" @click="showCreateDialog">新建套餐</el-button>
        </div>
      </template>
      
      <el-table :data="packages" style="width: 100%;" v-loading="loading">
        <el-table-column prop="name" label="套餐名称" width="200" />
        <el-table-column prop="type" label="套餐类型" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.type === 'enterprise' ? 'success' : 'primary'">
              {{ scope.row.type === 'enterprise' ? '企业' : '个人' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="base_price" label="基础价格" width="100">
          <template #default="scope">
            ¥{{ scope.row.base_price }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button link type="primary" @click="viewPackage(scope.row.id)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="createDialogVisible" title="新建套餐" width="700px">
      <el-form :model="newPackage" :rules="rules" ref="packageForm" label-width="100px">
        <el-form-item label="套餐名称" prop="name">
          <el-input v-model="newPackage.name" placeholder="请输入套餐名称" />
        </el-form-item>
        <el-form-item label="套餐类型" prop="type">
          <el-select v-model="newPackage.type" placeholder="选择类型">
            <el-option label="个人" value="personal" />
            <el-option label="企业" value="enterprise" />
          </el-select>
        </el-form-item>
        <el-form-item label="基础价格" prop="base_price">
          <el-input-number v-model="newPackage.base_price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newPackage.description" type="textarea" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="包含项目">
          <el-transfer
            v-model="newPackage.item_ids"
            :data="itemsForTransfer"
            :props="{ key: 'id', label: 'name' }"
            filterable
            filter-placeholder="搜索项目"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createPackage">确定</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="viewDialogVisible" title="套餐详情" width="700px">
      <div v-if="selectedPackage">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="套餐名称">{{ selectedPackage.name }}</el-descriptions-item>
          <el-descriptions-item label="套餐类型">
            <el-tag :type="selectedPackage.type === 'enterprise' ? 'success' : 'primary'">
              {{ selectedPackage.type === 'enterprise' ? '企业' : '个人' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="基础价格">¥{{ selectedPackage.base_price }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ selectedPackage.created_at }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ selectedPackage.description }}</el-descriptions-item>
        </el-descriptions>
        
        <h3 style="margin-top: 20px; margin-bottom: 10px;">包含项目</h3>
        <el-table :data="selectedPackage.items" style="width: 100%;">
          <el-table-column prop="name" label="项目名称" width="200" />
          <el-table-column prop="department_name" label="所属科室" width="150" />
          <el-table-column prop="price" label="价格" width="100">
            <template #default="scope">
              ¥{{ scope.row.price }}
            </template>
          </el-table-column>
          <el-table-column label="是否可加" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.is_addable ? 'success' : 'info'">
                {{ scope.row.is_addable ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { packageApi, itemApi } from '../api'

const loading = ref(false)
const packages = ref([])
const allItems = ref([])

const createDialogVisible = ref(false)
const newPackage = reactive({
  name: '',
  type: 'personal',
  base_price: 0,
  description: '',
  item_ids: []
})

const rules = {
  name: [{ required: true, message: '请输入套餐名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择套餐类型', trigger: 'change' }],
  base_price: [{ required: true, message: '请输入基础价格', trigger: 'blur' }]
}

const viewDialogVisible = ref(false)
const selectedPackage = ref(null)

const itemsForTransfer = computed(() => {
  return allItems.value.map(item => ({
    id: item.id,
    name: `${item.name} (¥${item.price})`
  }))
})

const loadPackages = async () => {
  loading.value = true
  try {
    const res = await packageApi.getAll()
    packages.value = res.data
  } catch (error) {
    console.error('加载套餐列表失败:', error)
    ElMessage.error('加载套餐列表失败')
  } finally {
    loading.value = false
  }
}

const loadItems = async () => {
  try {
    const res = await itemApi.getAll()
    allItems.value = res.data
  } catch (error) {
    console.error('加载项目列表失败:', error)
  }
}

const showCreateDialog = () => {
  createDialogVisible.value = true
}

const createPackage = async () => {
  try {
    await packageApi.create(newPackage)
    ElMessage.success('套餐创建成功')
    createDialogVisible.value = false
    Object.assign(newPackage, {
      name: '',
      type: 'personal',
      base_price: 0,
      description: '',
      item_ids: []
    })
    loadPackages()
  } catch (error) {
    console.error('创建套餐失败:', error)
    ElMessage.error('创建套餐失败')
  }
}

const viewPackage = async (id) => {
  try {
    const res = await packageApi.getById(id)
    selectedPackage.value = res.data
    viewDialogVisible.value = true
  } catch (error) {
    console.error('加载套餐详情失败:', error)
    ElMessage.error('加载套餐详情失败')
  }
}

onMounted(() => {
  loadPackages()
  loadItems()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
