<template>
  <div class="kiln-management">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="窑炉管理" name="kilns">
        <div class="tab-header">
          <h3>窑炉列表</h3>
          <el-button type="primary" @click="showKilnDialog = true">
            <el-icon><Plus /></el-icon>
            新建窑炉
          </el-button>
        </div>
        
        <el-row :gutter="20">
          <el-col :span="12" v-for="kiln in kilns" :key="kiln.id">
            <el-card class="kiln-card">
              <template #header>
                <div class="card-header">
                  <span class="kiln-name">{{ kiln.name }}</span>
                  <div class="card-actions">
                    <el-button type="primary" size="small" link @click="editKiln(kiln)">
                      <el-icon><Edit /></el-icon>
                      编辑
                    </el-button>
                    <el-button type="danger" size="small" link @click="deleteKiln(kiln)">
                      <el-icon><Delete /></el-icon>
                      删除
                    </el-button>
                  </div>
                </div>
              </template>
              
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="类型">{{ kiln.type || '-' }}</el-descriptions-item>
                <el-descriptions-item label="最高温度">
                  {{ kiln.max_temperature ? kiln.max_temperature + '°C' : '-' }}
                </el-descriptions-item>
                <el-descriptions-item label="层架数">
                  <el-tag size="small">{{ kiln.shelf_count }} 层</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="层架尺寸">
                  <span v-if="kiln.shelf_width && kiln.shelf_depth">
                    {{ kiln.shelf_width }}×{{ kiln.shelf_depth }} cm
                  </span>
                  <span v-else>-</span>
                </el-descriptions-item>
                <el-descriptions-item label="层间距">
                  {{ kiln.shelf_spacing ? kiln.shelf_spacing + ' cm' : '-' }}
                </el-descriptions-item>
                <el-descriptions-item label="可用容量">
                  {{ kiln.usable_volume ? kiln.usable_volume + ' L' : '-' }}
                </el-descriptions-item>
              </el-descriptions>
              
              <div v-if="kiln.notes" class="kiln-notes">
                <strong>备注:</strong> {{ kiln.notes }}
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="烧成曲线" name="curves">
        <div class="tab-header">
          <h3>烧成曲线列表</h3>
          <el-button type="primary" @click="showCurveDialog = true">
            <el-icon><Plus /></el-icon>
            新建曲线
          </el-button>
        </div>
        
        <el-table :data="firingCurves" v-loading="loading.curves" style="width: 100%">
          <el-table-column prop="name" label="曲线名称" min-width="200" />
          <el-table-column prop="type" label="烧成类型" width="120">
            <template #default="scope">
              <el-tag size="small">{{ scope.row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="cone" label="锥号" width="80" />
          <el-table-column prop="max_temperature" label="最高温度" width="100">
            <template #default="scope">
              {{ scope.row.max_temperature ? scope.row.max_temperature + '°C' : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="total_duration" label="总时长" width="100">
            <template #default="scope">
              {{ scope.row.total_duration ? scope.row.total_duration + 'h' : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="notes" label="备注" min-width="150" show-overflow-tooltip />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="scope">
              <el-button type="primary" size="small" link @click="editCurve(scope.row)">
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              <el-button type="danger" size="small" link @click="deleteCurve(scope.row)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showKilnDialog" :title="editingKiln ? '编辑窑炉' : '新建窑炉'" width="600px">
      <el-form :model="kilnForm" :rules="kilnRules" ref="kilnFormRef" label-width="100px">
        <el-form-item label="窑炉名称" prop="name">
          <el-input v-model="kilnForm.name" placeholder="请输入窑炉名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="kilnForm.type" placeholder="选择类型" style="width: 100%" clearable>
            <el-option label="电窑" value="电窑" />
            <el-option label="气窑" value="气窑" />
            <el-option label="柴窑" value="柴窑" />
            <el-option label="煤气窑" value="煤气窑" />
          </el-select>
        </el-form-item>
        <el-form-item label="最高温度(°C)">
          <el-input-number v-model="kilnForm.max_temperature" :min="0" :max="1500" style="width: 200px" />
        </el-form-item>
        <el-divider content-position="left">层架配置</el-divider>
        <el-form-item label="层架数量">
          <el-input-number v-model="kilnForm.shelf_count" :min="1" style="width: 200px" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="宽度(cm)">
              <el-input-number v-model="kilnForm.shelf_width" :min="0" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="深度(cm)">
              <el-input-number v-model="kilnForm.shelf_depth" :min="0" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="层间距(cm)">
          <el-input-number v-model="kilnForm.shelf_spacing" :min="0" :precision="1" style="width: 200px" />
        </el-form-item>
        <el-form-item label="可用容量(L)">
          <el-input-number v-model="kilnForm.usable_volume" :min="0" :precision="2" style="width: 200px" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="kilnForm.notes" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showKilnDialog = false">取消</el-button>
        <el-button type="primary" @click="saveKiln" :loading="saving.kiln">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCurveDialog" :title="editingCurve ? '编辑烧成曲线' : '新建烧成曲线'" width="600px">
      <el-form :model="curveForm" :rules="curveRules" ref="curveFormRef" label-width="100px">
        <el-form-item label="曲线名称" prop="name">
          <el-input v-model="curveForm.name" placeholder="如：标准釉烧 06号锥" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="烧成类型" prop="type">
              <el-select v-model="curveForm.type" placeholder="选择类型" style="width: 100%">
                <el-option label="素烧" value="素烧" />
                <el-option label="釉烧" value="釉烧" />
                <el-option label="氧化烧" value="氧化烧" />
                <el-option label="还原烧" value="还原烧" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="锥号">
              <el-input v-model="curveForm.cone" placeholder="如：06, 04, 6, 10" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最高温度(°C)">
              <el-input-number v-model="curveForm.max_temperature" :min="0" :max="1500" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="总时长(小时)">
              <el-input-number v-model="curveForm.total_duration" :min="0" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="温度区间">
          <el-input v-model="curveForm.temp_ranges" type="textarea" :rows="4" placeholder="温度区间配置，如：
室温-200°C: 2小时
200-1000°C: 5小时
1000-1280°C: 2小时
1280°C保温: 15分钟
冷却: 自然冷却" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="curveForm.notes" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCurveDialog = false">取消</el-button>
        <el-button type="primary" @click="saveCurve" :loading="saving.curve">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { kilnsApi, firingCurvesApi } from '../api/kilns'

const activeTab = ref('kilns')

const loading = reactive({
  kilns: false,
  curves: false
})

const saving = reactive({
  kiln: false,
  curve: false
})

const kilns = ref([])
const firingCurves = ref([])

const showKilnDialog = ref(false)
const editingKiln = ref(null)
const kilnForm = reactive({
  name: '',
  type: '',
  max_temperature: null,
  shelf_count: 1,
  shelf_width: null,
  shelf_depth: null,
  shelf_spacing: null,
  usable_volume: null,
  notes: ''
})

const showCurveDialog = ref(false)
const editingCurve = ref(null)
const curveForm = reactive({
  name: '',
  type: '',
  cone: '',
  max_temperature: null,
  total_duration: null,
  temp_ranges: '',
  notes: ''
})

const kilnFormRef = ref(null)
const curveFormRef = ref(null)

const kilnRules = {
  name: [{ required: true, message: '请输入窑炉名称', trigger: 'blur' }]
}

const curveRules = {
  name: [{ required: true, message: '请输入曲线名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择烧成类型', trigger: 'change' }]
}

const loadKilns = async () => {
  loading.kilns = true
  try {
    const res = await kilnsApi.getAll()
    kilns.value = res.data
  } catch (error) {
    ElMessage.error('加载窑炉列表失败')
  } finally {
    loading.kilns = false
  }
}

const loadCurves = async () => {
  loading.curves = true
  try {
    const res = await firingCurvesApi.getAll()
    firingCurves.value = res.data
  } catch (error) {
    ElMessage.error('加载烧成曲线失败')
  } finally {
    loading.curves = false
  }
}

const editKiln = (kiln) => {
  editingKiln.value = kiln
  kilnForm.name = kiln.name
  kilnForm.type = kiln.type
  kilnForm.max_temperature = kiln.max_temperature
  kilnForm.shelf_count = kiln.shelf_count
  kilnForm.shelf_width = kiln.shelf_width
  kilnForm.shelf_depth = kiln.shelf_depth
  kilnForm.shelf_spacing = kiln.shelf_spacing
  kilnForm.usable_volume = kiln.usable_volume
  kilnForm.notes = kiln.notes
  showKilnDialog.value = true
}

const saveKiln = async () => {
  if (!kilnFormRef.value) return
  
  await kilnFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    saving.kiln = true
    try {
      if (editingKiln.value) {
        await kilnsApi.update(editingKiln.value.id, kilnForm)
        ElMessage.success('更新成功')
      } else {
        await kilnsApi.create(kilnForm)
        ElMessage.success('创建成功')
      }
      showKilnDialog.value = false
      resetKilnForm()
      loadKilns()
    } catch (error) {
      ElMessage.error('保存失败')
    } finally {
      saving.kiln = false
    }
  })
}

const resetKilnForm = () => {
  editingKiln.value = null
  kilnForm.name = ''
  kilnForm.type = ''
  kilnForm.max_temperature = null
  kilnForm.shelf_count = 1
  kilnForm.shelf_width = null
  kilnForm.shelf_depth = null
  kilnForm.shelf_spacing = null
  kilnForm.usable_volume = null
  kilnForm.notes = ''
}

const deleteKiln = async (kiln) => {
  try {
    await ElMessageBox.confirm(`确定要删除窑炉"${kiln.name}"吗？`, '确认删除', {
      type: 'warning'
    })
    await kilnsApi.delete(kiln.id)
    ElMessage.success('删除成功')
    loadKilns()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败')
    }
  }
}

const editCurve = (curve) => {
  editingCurve.value = curve
  curveForm.name = curve.name
  curveForm.type = curve.type
  curveForm.cone = curve.cone
  curveForm.max_temperature = curve.max_temperature
  curveForm.total_duration = curve.total_duration
  curveForm.temp_ranges = curve.temp_ranges
  curveForm.notes = curve.notes
  showCurveDialog.value = true
}

const saveCurve = async () => {
  if (!curveFormRef.value) return
  
  await curveFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    saving.curve = true
    try {
      if (editingCurve.value) {
        await firingCurvesApi.update(editingCurve.value.id, curveForm)
        ElMessage.success('更新成功')
      } else {
        await firingCurvesApi.create(curveForm)
        ElMessage.success('创建成功')
      }
      showCurveDialog.value = false
      resetCurveForm()
      loadCurves()
    } catch (error) {
      ElMessage.error('保存失败')
    } finally {
      saving.curve = false
    }
  })
}

const resetCurveForm = () => {
  editingCurve.value = null
  curveForm.name = ''
  curveForm.type = ''
  curveForm.cone = ''
  curveForm.max_temperature = null
  curveForm.total_duration = null
  curveForm.temp_ranges = ''
  curveForm.notes = ''
}

const deleteCurve = async (curve) => {
  try {
    await ElMessageBox.confirm(`确定要删除烧成曲线"${curve.name}"吗？`, '确认删除', {
      type: 'warning'
    })
    await firingCurvesApi.delete(curve.id)
    ElMessage.success('删除成功')
    loadCurves()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败')
    }
  }
}

onMounted(() => {
  loadKilns()
  loadCurves()
})
</script>

<style scoped>
.kiln-management {
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

.kiln-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kiln-name {
  font-weight: 600;
  font-size: 16px;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.kiln-notes {
  margin-top: 12px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;
}
</style>
