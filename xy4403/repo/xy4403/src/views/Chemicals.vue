<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">药液管理</h2>
      <div>
        <el-button type="success" @click="exportChemicals">
          <el-icon><Download /></el-icon>
          导出JSON
        </el-button>
        <el-button type="primary" @click="showCreateDialog = true" style="margin-left: 10px;">
          <el-icon><Plus /></el-icon>
          新增药液
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="expiredChemicals.length > 0"
      :title="`检测到 ${expiredChemicals.length} 个药液可能已过期或超寿命`"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom: 20px;"
    >
      <template #default>
        <ul>
          <li v-for="(c, idx) in expiredChemicals" :key="idx" style="padding: 4px 0;">
            {{ c.batch_number }} ({{ c.chemical_type === 'developer' ? '显影液' : c.chemical_type === 'fixer' ? '定影液' : '其他' }})
            - 已使用{{ c.used_count }}/{{ c.max_uses }}次
          </li>
        </ul>
      </template>
    </el-alert>

    <el-card class="card-container">
      <template #header>
        <div class="card-header">
          <span>药液列表</span>
          <el-radio-group v-model="filterStatus" size="small">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="active">活跃</el-radio-button>
            <el-radio-button label="inactive">已停用</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <el-table :data="filteredChemicals" style="width: 100%" v-loading="loading">
        <el-table-column prop="chemical_type" label="类型" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.chemical_type === 'developer' ? 'primary' : 'success'">
              {{ scope.row.chemical_type === 'developer' ? '显影液' : 
                 scope.row.chemical_type === 'fixer' ? '定影液' : '其他' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="batch_number" label="批次编号" width="150" />
        <el-table-column prop="concentration" label="浓度" width="100">
          <template #default="scope">
            {{ scope.row.concentration }}%
          </template>
        </el-table-column>
        <el-table-column prop="total_volume" label="总量(L)" width="100" />
        <el-table-column prop="used_count" label="使用次数" width="120">
          <template #default="scope">
            <el-progress 
              :percentage="Math.round(scope.row.used_count / scope.row.max_uses * 100)"
              :status="scope.row.used_count >= scope.row.max_uses ? 'exception' : ''"
            />
            <span style="font-size: 12px; color: #909399;">
              {{ scope.row.used_count }}/{{ scope.row.max_uses }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="last_used_at" label="最后使用" width="180">
          <template #default="scope">
            {{ scope.row.last_used_at ? formatDate(scope.row.last_used_at) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'active' ? 'success' : 'info'">
              {{ scope.row.status === 'active' ? '活跃' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button 
              v-if="scope.row.status === 'active'"
              type="primary" 
              link 
              size="small"
              @click="updateUsage(scope.row)"
            >
              记录使用
            </el-button>
            <el-button 
              v-if="scope.row.status === 'active'"
              type="danger" 
              link 
              size="small"
              @click="deactivateChemical(scope.row)"
            >
              停用
            </el-button>
            <el-button 
              type="info" 
              link 
              size="small"
              @click="checkRules(scope.row)"
            >
              检查规则
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新增药液" width="500px">
      <el-form :model="chemicalForm" label-width="100px">
        <el-form-item label="药液类型" required>
          <el-select v-model="chemicalForm.chemical_type" placeholder="请选择类型" style="width: 100%">
            <el-option label="显影液" value="developer" />
            <el-option label="定影液" value="fixer" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="批次编号" required>
          <el-input v-model="chemicalForm.batch_number" placeholder="请输入批次编号" />
        </el-form-item>
        <el-form-item label="浓度(%)" required>
          <el-input-number v-model="chemicalForm.concentration" :min="1" :max="100" :precision="1" />
        </el-form-item>
        <el-form-item label="总量(L)" required>
          <el-input-number v-model="chemicalForm.total_volume" :min="0.1" :max="100" :precision="2" />
        </el-form-item>
        <el-form-item label="最大使用次数" required>
          <el-input-number v-model="chemicalForm.max_uses" :min="1" :max="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createChemical">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showUsageDialog" title="记录使用" width="400px">
      <el-form :model="usageForm" label-width="120px">
        <el-form-item label="当前使用次数">
          <el-input :value="selectedChemical?.used_count" disabled />
        </el-form-item>
        <el-form-item label="最大使用次数">
          <el-input :value="selectedChemical?.max_uses" disabled />
        </el-form-item>
        <el-form-item label="新增使用次数">
          <el-input-number v-model="usageForm.increment" :min="1" :max="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUsageDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmUsage">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Download } from '@element-plus/icons-vue'

const loading = ref(false)
const chemicals = ref([])
const selectedChemical = ref(null)
const filterStatus = ref('all')
const showCreateDialog = ref(false)
const showUsageDialog = ref(false)

const chemicalForm = reactive({
  chemical_type: '',
  batch_number: '',
  concentration: 100,
  total_volume: 5,
  max_uses: 20
})

const usageForm = reactive({
  increment: 1
})

const filteredChemicals = computed(() => {
  if (filterStatus.value === 'all') return chemicals.value
  return chemicals.value.filter(c => c.status === filterStatus.value)
})

const expiredChemicals = computed(() => {
  return chemicals.value.filter(c => {
    if (c.status !== 'active') return false
    if (c.used_count >= c.max_uses) return true
    
    const createdDate = new Date(c.created_at)
    const now = new Date()
    const daysDiff = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24))
    
    return c.chemical_type === 'developer' && daysDiff > 30
  })
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const loadChemicals = async () => {
  loading.value = true
  try {
    chemicals.value = await window.electronAPI.getAllChemicals()
  } catch (error) {
    ElMessage.error('加载药液失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const createChemical = async () => {
  if (!chemicalForm.chemical_type || !chemicalForm.batch_number) {
    ElMessage.warning('请填写必填项')
    return
  }

  try {
    const result = await window.electronAPI.createChemical(chemicalForm)
    if (result.success) {
      ElMessage.success('新增药液成功')
      showCreateDialog.value = false
      Object.assign(chemicalForm, {
        chemical_type: '',
        batch_number: '',
        concentration: 100,
        total_volume: 5,
        max_uses: 20
      })
      loadChemicals()
    }
  } catch (error) {
    ElMessage.error('新增药液失败: ' + error.message)
  }
}

const updateUsage = (chemical) => {
  selectedChemical.value = chemical
  usageForm.increment = 1
  showUsageDialog.value = true
}

const confirmUsage = async () => {
  const newCount = selectedChemical.value.used_count + usageForm.increment
  
  if (newCount > selectedChemical.value.max_uses) {
    try {
      await ElMessageBox.confirm(
        `使用次数(${newCount})将超过最大限制(${selectedChemical.value.max_uses})，是否继续？`,
        '警告',
        { confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  }

  try {
    const result = await window.electronAPI.updateChemicalUsage({
      id: selectedChemical.value.id,
      used_count: newCount
    })
    if (result.success) {
      ElMessage.success('记录使用成功')
      showUsageDialog.value = false
      loadChemicals()
    }
  } catch (error) {
    ElMessage.error('记录失败: ' + error.message)
  }
}

const deactivateChemical = async (chemical) => {
  try {
    await ElMessageBox.confirm(
      `确定要停用药液 ${chemical.batch_number} 吗？`,
      '确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    
    const result = await window.electronAPI.deactivateChemical(chemical.id)
    if (result.success) {
      ElMessage.success('已停用')
      loadChemicals()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败: ' + error.message)
    }
  }
}

const checkRules = async (chemical) => {
  try {
    const violations = await window.electronAPI.checkChemicalRules(chemical.id)
    if (violations.length === 0) {
      ElMessage.success('该药液无规则违规')
    } else {
      ElMessage.warning(`检测到 ${violations.length} 条规则违规: ${violations.map(v => v.message).join(', ')}`)
    }
  } catch (error) {
    ElMessage.error('检查规则失败: ' + error.message)
  }
}

const exportChemicals = async () => {
  try {
    const result = await window.electronAPI.exportJSON('batches')
    if (result.success) {
      ElMessage.success(`已导出到: ${result.filePath}`)
    } else if (!result.canceled) {
      ElMessage.error('导出失败')
    }
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}

onMounted(() => {
  loadChemicals()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
