<template>
  <div class="materials-page">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="泥料管理" name="clays">
        <div class="tab-header">
          <h3>泥料列表</h3>
          <el-button type="primary" @click="showClayDialog = true">
            <el-icon><Plus /></el-icon>
            新建泥料
          </el-button>
        </div>
        
        <el-table :data="clays" v-loading="loading.clays" style="width: 100%">
          <el-table-column prop="name" label="泥料名称" min-width="150" />
          <el-table-column prop="type" label="类型" width="100" />
          <el-table-column label="烧成温度范围" width="160">
            <template #default="scope">
              <span v-if="scope.row.temp_min && scope.row.temp_max">
                {{ scope.row.temp_min }} - {{ scope.row.temp_max }}°C
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="cone" label="锥号" width="80" />
          <el-table-column prop="color" label="颜色" width="100" />
          <el-table-column prop="notes" label="备注" min-width="150" show-overflow-tooltip />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="scope">
              <el-button type="primary" size="small" link @click="editClay(scope.row)">
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              <el-button type="danger" size="small" link @click="deleteClay(scope.row)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="釉料管理" name="glazes">
        <div class="tab-header">
          <h3>釉料列表</h3>
          <el-button type="primary" @click="showGlazeDialog = true">
            <el-icon><Plus /></el-icon>
            新建釉料
          </el-button>
        </div>
        
        <el-table :data="glazes" v-loading="loading.glazes" style="width: 100%">
          <el-table-column prop="name" label="釉料名称" min-width="150" />
          <el-table-column prop="type" label="类型" width="100" />
          <el-table-column label="烧成温度范围" width="160">
            <template #default="scope">
              <span v-if="scope.row.temp_min && scope.row.temp_max">
                {{ scope.row.temp_min }} - {{ scope.row.temp_max }}°C
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="cone" label="锥号" width="80" />
          <el-table-column prop="color" label="颜色" width="100" />
          <el-table-column label="兼容泥料" width="150">
            <template #default="scope">
              <span v-if="scope.row.compatible_clays">有配置</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="不兼容釉料" width="150">
            <template #default="scope">
              <span v-if="scope.row.incompatible_glazes">有配置</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="notes" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="scope">
              <el-button type="primary" size="small" link @click="editGlaze(scope.row)">
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              <el-button type="danger" size="small" link @click="deleteGlaze(scope.row)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showClayDialog" :title="editingClay ? '编辑泥料' : '新建泥料'" width="600px">
      <el-form :model="clayForm" :rules="clayRules" ref="clayFormRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="clayForm.name" placeholder="请输入泥料名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="clayForm.type" placeholder="选择类型" style="width: 100%" clearable>
            <el-option label="陶土" value="陶土" />
            <el-option label="瓷土" value="瓷土" />
            <el-option label="炻器土" value="炻器土" />
          </el-select>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最低温度(°C)">
              <el-input-number v-model="clayForm.temp_min" :min="0" :max="1500" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最高温度(°C)">
              <el-input-number v-model="clayForm.temp_max" :min="0" :max="1500" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="锥号">
              <el-input v-model="clayForm.cone" placeholder="如：06, 10" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="颜色">
              <el-input v-model="clayForm.color" placeholder="如：白色、紫红色" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="clayForm.notes" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showClayDialog = false">取消</el-button>
        <el-button type="primary" @click="saveClay" :loading="saving.clay">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showGlazeDialog" :title="editingGlaze ? '编辑釉料' : '新建釉料'" width="600px">
      <el-form :model="glazeForm" :rules="glazeRules" ref="glazeFormRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="glazeForm.name" placeholder="请输入釉料名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="glazeForm.type" placeholder="选择类型" style="width: 100%" clearable>
            <el-option label="透明釉" value="透明釉" />
            <el-option label="颜色釉" value="颜色釉" />
            <el-option label="哑光釉" value="哑光釉" />
            <el-option label="窑变釉" value="窑变釉" />
            <el-option label="花釉" value="花釉" />
          </el-select>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最低温度(°C)">
              <el-input-number v-model="glazeForm.temp_min" :min="0" :max="1500" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最高温度(°C)">
              <el-input-number v-model="glazeForm.temp_max" :min="0" :max="1500" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="锥号">
              <el-input v-model="glazeForm.cone" placeholder="如：06, 10" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="颜色">
              <el-input v-model="glazeForm.color" placeholder="如：青色、铁锈色" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="glazeForm.notes" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGlazeDialog = false">取消</el-button>
        <el-button type="primary" @click="saveGlaze" :loading="saving.glaze">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { claysApi, glazesApi } from '../api/materials'

const activeTab = ref('clays')

const loading = reactive({
  clays: false,
  glazes: false
})

const saving = reactive({
  clay: false,
  glaze: false
})

const clays = ref([])
const glazes = ref([])

const showClayDialog = ref(false)
const editingClay = ref(null)
const clayForm = reactive({
  name: '',
  type: '',
  temp_min: null,
  temp_max: null,
  cone: '',
  color: '',
  notes: ''
})

const showGlazeDialog = ref(false)
const editingGlaze = ref(null)
const glazeForm = reactive({
  name: '',
  type: '',
  temp_min: null,
  temp_max: null,
  cone: '',
  color: '',
  notes: ''
})

const clayFormRef = ref(null)
const glazeFormRef = ref(null)

const clayRules = {
  name: [{ required: true, message: '请输入泥料名称', trigger: 'blur' }]
}

const glazeRules = {
  name: [{ required: true, message: '请输入釉料名称', trigger: 'blur' }]
}

const loadClays = async () => {
  loading.clays = true
  try {
    const res = await claysApi.getAll()
    clays.value = res.data
  } catch (error) {
    ElMessage.error('加载泥料列表失败')
  } finally {
    loading.clays = false
  }
}

const loadGlazes = async () => {
  loading.glazes = true
  try {
    const res = await glazesApi.getAll()
    glazes.value = res.data
  } catch (error) {
    ElMessage.error('加载釉料列表失败')
  } finally {
    loading.glazes = false
  }
}

const editClay = (clay) => {
  editingClay.value = clay
  clayForm.name = clay.name
  clayForm.type = clay.type
  clayForm.temp_min = clay.temp_min
  clayForm.temp_max = clay.temp_max
  clayForm.cone = clay.cone
  clayForm.color = clay.color
  clayForm.notes = clay.notes
  showClayDialog.value = true
}

const saveClay = async () => {
  if (!clayFormRef.value) return
  
  await clayFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    saving.clay = true
    try {
      if (editingClay.value) {
        await claysApi.update(editingClay.value.id, clayForm)
        ElMessage.success('更新成功')
      } else {
        await claysApi.create(clayForm)
        ElMessage.success('创建成功')
      }
      showClayDialog.value = false
      resetClayForm()
      loadClays()
    } catch (error) {
      ElMessage.error('保存失败')
    } finally {
      saving.clay = false
    }
  })
}

const resetClayForm = () => {
  editingClay.value = null
  clayForm.name = ''
  clayForm.type = ''
  clayForm.temp_min = null
  clayForm.temp_max = null
  clayForm.cone = ''
  clayForm.color = ''
  clayForm.notes = ''
}

const deleteClay = async (clay) => {
  try {
    await ElMessageBox.confirm(`确定要删除泥料"${clay.name}"吗？`, '确认删除', {
      type: 'warning'
    })
    await claysApi.delete(clay.id)
    ElMessage.success('删除成功')
    loadClays()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败')
    }
  }
}

const editGlaze = (glaze) => {
  editingGlaze.value = glaze
  glazeForm.name = glaze.name
  glazeForm.type = glaze.type
  glazeForm.temp_min = glaze.temp_min
  glazeForm.temp_max = glaze.temp_max
  glazeForm.cone = glaze.cone
  glazeForm.color = glaze.color
  glazeForm.notes = glaze.notes
  showGlazeDialog.value = true
}

const saveGlaze = async () => {
  if (!glazeFormRef.value) return
  
  await glazeFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    saving.glaze = true
    try {
      if (editingGlaze.value) {
        await glazesApi.update(editingGlaze.value.id, glazeForm)
        ElMessage.success('更新成功')
      } else {
        await glazesApi.create(glazeForm)
        ElMessage.success('创建成功')
      }
      showGlazeDialog.value = false
      resetGlazeForm()
      loadGlazes()
    } catch (error) {
      ElMessage.error('保存失败')
    } finally {
      saving.glaze = false
    }
  })
}

const resetGlazeForm = () => {
  editingGlaze.value = null
  glazeForm.name = ''
  glazeForm.type = ''
  glazeForm.temp_min = null
  glazeForm.temp_max = null
  glazeForm.cone = ''
  glazeForm.color = ''
  glazeForm.notes = ''
}

const deleteGlaze = async (glaze) => {
  try {
    await ElMessageBox.confirm(`确定要删除釉料"${glaze.name}"吗？`, '确认删除', {
      type: 'warning'
    })
    await glazesApi.delete(glaze.id)
    ElMessage.success('删除成功')
    loadGlazes()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败')
    }
  }
}

onMounted(() => {
  loadClays()
  loadGlazes()
})
</script>

<style scoped>
.materials-page {
  min-height: 100%;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.tab-header h3 {
  margin: 0;
  font-size: 16px;
}
</style>
