<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">暗袋管理</h2>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        新增暗袋
      </el-button>
    </div>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <el-statistic title="总计" :value="darkBags.length" />
      </el-col>
      <el-col :span="6">
        <el-statistic title="可用" :value="availableCount" value-style="color: #67c23a" />
      </el-col>
      <el-col :span="6">
        <el-statistic title="使用中" :value="inUseCount" value-style="color: #409EFF" />
      </el-col>
      <el-col :span="6">
        <el-statistic title="维护中" :value="maintenanceCount" value-style="color: #e6a23c" />
      </el-col>
    </el-row>

    <el-card class="card-container">
      <el-table :data="darkBags" style="width: 100%" v-loading="loading">
        <el-table-column prop="bag_number" label="暗袋编号" width="150" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="editDarkBag(scope.row)">
              编辑
            </el-button>
            <el-button 
              v-if="scope.row.status !== 'maintenance'"
              type="warning" 
              link 
              size="small"
              @click="checkDuplicate(scope.row)"
            >
              检查重复
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新增暗袋" width="500px">
      <el-form :model="darkBagForm" label-width="100px">
        <el-form-item label="暗袋编号" required>
          <el-input v-model="darkBagForm.bag_number" placeholder="请输入暗袋编号" @blur="checkBagDuplicate" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="darkBagForm.notes" type="textarea" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createDarkBag">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEditDialog" title="编辑暗袋" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="暗袋编号" required>
          <el-input v-model="editForm.bag_number" placeholder="请输入暗袋编号" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status" placeholder="请选择状态" style="width: 100%">
            <el-option label="可用" value="available" />
            <el-option label="使用中" value="in_use" />
            <el-option label="维护中" value="maintenance" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.notes" type="textarea" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="updateDarkBag">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const loading = ref(false)
const darkBags = ref([])
const selectedDarkBag = ref(null)
const showCreateDialog = ref(false)
const showEditDialog = ref(false)

const darkBagForm = reactive({
  bag_number: '',
  notes: ''
})

const editForm = reactive({
  id: null,
  bag_number: '',
  status: 'available',
  notes: ''
})

const availableCount = computed(() => darkBags.value.filter(b => b.status === 'available').length)
const inUseCount = computed(() => darkBags.value.filter(b => b.status === 'in_use').length)
const maintenanceCount = computed(() => darkBags.value.filter(b => b.status === 'maintenance').length)

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const types = {
    'available': 'success',
    'in_use': 'primary',
    'maintenance': 'warning'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    'available': '可用',
    'in_use': '使用中',
    'maintenance': '维护中'
  }
  return texts[status] || status
}

const loadDarkBags = async () => {
  loading.value = true
  try {
    darkBags.value = await window.electronAPI.getAllDarkBags()
  } catch (error) {
    ElMessage.error('加载暗袋失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const checkBagDuplicate = async () => {
  if (!darkBagForm.bag_number.trim()) return
  
  try {
    const isDuplicate = await window.electronAPI.checkDarkBagDuplicate(darkBagForm.bag_number)
    if (isDuplicate) {
      ElMessage.warning('该暗袋编号已存在')
    }
  } catch (error) {
    console.error('检查重复失败:', error)
  }
}

const createDarkBag = async () => {
  if (!darkBagForm.bag_number.trim()) {
    ElMessage.warning('请输入暗袋编号')
    return
  }

  try {
    const result = await window.electronAPI.createDarkBag(darkBagForm)
    if (result.success) {
      ElMessage.success('新增暗袋成功')
      showCreateDialog.value = false
      darkBagForm.bag_number = ''
      darkBagForm.notes = ''
      loadDarkBags()
    } else {
      ElMessage.error(result.error)
    }
  } catch (error) {
    ElMessage.error('新增暗袋失败: ' + error.message)
  }
}

const editDarkBag = (bag) => {
  Object.assign(editForm, {
    id: bag.id,
    bag_number: bag.bag_number,
    status: bag.status,
    notes: bag.notes || ''
  })
  showEditDialog.value = true
}

const updateDarkBag = async () => {
  try {
    const result = await window.electronAPI.updateDarkBag({
      id: editForm.id,
      bag_number: editForm.bag_number,
      status: editForm.status,
      notes: editForm.notes
    })
    if (result.success) {
      ElMessage.success('更新暗袋成功')
      showEditDialog.value = false
      loadDarkBags()
    } else {
      ElMessage.error(result.error)
    }
  } catch (error) {
    ElMessage.error('更新暗袋失败: ' + error.message)
  }
}

const checkDuplicate = async (bag) => {
  try {
    const isDuplicate = await window.electronAPI.checkDarkBagDuplicate(bag.bag_number, bag.id)
    if (isDuplicate) {
      ElMessage.warning('发现重复编号的暗袋')
    } else {
      ElMessage.success('无重复编号')
    }
  } catch (error) {
    ElMessage.error('检查失败: ' + error.message)
  }
}

onMounted(() => {
  loadDarkBags()
})
</script>
