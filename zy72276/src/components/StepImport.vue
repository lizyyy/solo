<template>
  <div class="step-import">
    <h3>第一步：导入障碍物备注</h3>
    <p class="step-desc">导入航测障碍物数据，系统将自动进行重复导入检查和坐标格式检测</p>

    <el-upload
      class="upload-area"
      drag
      :auto-upload="false"
      :on-change="handleFileChange"
      accept=".csv,.xlsx,.xls"
    >
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      <div class="el-upload__text">
        将文件拖到此处，或<em>点击上传</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">
          支持 CSV、Excel 格式，包含：墙板编号、坐标、障碍物备注等字段
        </div>
      </template>
    </el-upload>

    <el-divider>或手动添加</el-divider>

    <el-form :model="manualForm" label-width="100px" class="manual-form">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="墙板编号">
            <el-input v-model="manualForm.wallPanelCode" placeholder="如：WP-001" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="坐标">
            <el-input v-model="manualForm.coordinate" placeholder="经纬度如：116.4,39.9 或米制如：X:100" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="关联剖面ID">
            <el-input v-model="manualForm.floorSectionId" placeholder="可选" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="24">
          <el-form-item label="障碍物备注">
            <el-input 
              v-model="manualForm.obstacleNote" 
              type="textarea" 
              :rows="2"
              placeholder="输入障碍物说明"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item>
        <el-button type="primary" @click="addManualRecord" :icon="Plus">
          添加记录
        </el-button>
      </el-form-item>
    </el-form>

    <el-divider>已导入记录</el-divider>

    <el-table :data="store.obstacleRecords" border stripe class="records-table">
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="originalLineNumber" label="原始行号" width="100" />
      <el-table-column prop="wallPanelCode" label="墙板编号" width="120" />
      <el-table-column prop="coordinate" label="坐标" min-width="150">
        <template #default="{ row }">
          <span :class="{ 'mixed-coord': row.isMixedCoordinate }">
            {{ row.coordinate }}
            <el-tag 
              v-if="row.isMixedCoordinate" 
              type="danger" 
              size="small"
              class="coord-tag"
            >
              坐标混合待复核
            </el-tag>
            <el-tag v-else :type="getCoordTagType(row.coordinateType)" size="small" class="coord-tag">
              {{ getCoordTypeText(row.coordinateType) }}
            </el-tag>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="obstacleNote" label="障碍物备注" min-width="200" />
      <el-table-column prop="processingStatus" label="处理状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.processingStatus)" size="small">
            {{ getStatusText(row.processingStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button 
            type="primary" 
            link 
            size="small"
            @click="editRecord(row)"
          >
            编辑备注
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="editDialogVisible" title="编辑障碍物备注" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="墙板编号">
          <el-input v-model="editForm.wallPanelCode" disabled />
        </el-form-item>
        <el-form-item label="障碍物备注">
          <el-input 
            v-model="editForm.obstacleNote" 
            type="textarea" 
            :rows="4"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Plus } from '@element-plus/icons-vue'
import { useSimulationStore } from '../stores/simulationStore'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const store = useSimulationStore()

const manualForm = reactive({
  wallPanelCode: '',
  coordinate: '',
  obstacleNote: '',
  floorSectionId: ''
})

const editDialogVisible = ref(false)
const editForm = reactive({
  id: null,
  wallPanelCode: '',
  obstacleNote: ''
})

const handleFileChange = (file) => {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.csv')) {
    parseCSV(file.raw)
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    parseExcel(file.raw)
  } else {
    ElMessage.error('不支持的文件格式')
  }
}

const parseCSV = (file) => {
  Papa.parse(file, {
    header: true,
    complete: (results) => {
      const records = results.data.map(row => ({
        wallPanelCode: row['墙板编号'] || row['wallPanelCode'] || row['code'],
        coordinate: row['坐标'] || row['coordinate'],
        obstacleNote: row['障碍物备注'] || row['obstacleNote'] || row['note'],
        floorSectionId: row['剖面ID'] || row['floorSectionId']
      })).filter(r => r.wallPanelCode || r.coordinate)
      
      store.batchImportObstacles(records)
      ElMessage.success(`成功导入 ${records.length} 条记录`)
    },
    error: (error) => {
      ElMessage.error('CSV解析失败：' + error.message)
    }
  })
}

const parseExcel = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result)
    const workbook = XLSX.read(data, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(firstSheet)
    
    const records = jsonData.map(row => ({
      wallPanelCode: row['墙板编号'] || row['wallPanelCode'] || row['code'],
      coordinate: row['坐标'] || row['coordinate'],
      obstacleNote: row['障碍物备注'] || row['obstacleNote'] || row['note'],
      floorSectionId: row['剖面ID'] || row['floorSectionId']
    })).filter(r => r.wallPanelCode || r.coordinate)
    
    store.batchImportObstacles(records)
    ElMessage.success(`成功导入 ${records.length} 条记录`)
  }
  reader.readAsArrayBuffer(file)
}

const addManualRecord = () => {
  if (!manualForm.wallPanelCode && !manualForm.coordinate) {
    ElMessage.warning('请至少填写墙板编号或坐标')
    return
  }
  store.addObstacleRecord({ ...manualForm })
  ElMessage.success('记录添加成功')
  Object.assign(manualForm, {
    wallPanelCode: '',
    coordinate: '',
    obstacleNote: '',
    floorSectionId: ''
  })
}

const editRecord = (row) => {
  editForm.id = row.id
  editForm.wallPanelCode = row.wallPanelCode
  editForm.obstacleNote = row.obstacleNote
  editDialogVisible.value = true
}

const saveEdit = () => {
  store.updateObstacleNote(editForm.id, editForm.obstacleNote)
  editDialogVisible.value = false
  ElMessage.success('备注更新成功')
}

const getCoordTypeText = (type) => {
  const map = { 'latlng': '经纬度', 'metric': '米制', 'mixed': '经纬度+米制混合', 'unknown': '未知' }
  return map[type] || type
}

const getCoordTagType = (type) => {
  const map = { 'latlng': 'success', 'metric': 'primary', 'mixed': 'danger', 'unknown': 'info' }
  return map[type] || 'info'
}

const getStatusText = (status) => {
  const map = {
    'pending': '待处理',
    'pending_review': '待复核',
    'manual_updated': '已更新',
    'reviewed': '已复核'
  }
  return map[status] || status
}

const getStatusTagType = (status) => {
  const map = {
    'pending': 'info',
    'pending_review': 'danger',
    'manual_updated': 'success',
    'reviewed': 'success'
  }
  return map[status] || 'info'
}
</script>

<style scoped>
.step-import h3 {
  margin-bottom: 10px;
  color: #303133;
}

.step-desc {
  color: #909399;
  margin-bottom: 20px;
}

.upload-area {
  margin-bottom: 20px;
}

.manual-form {
  max-width: 800px;
}

.records-table {
  margin-top: 20px;
}

.mixed-coord {
  color: #f56c6c;
}

.coord-tag {
  margin-left: 8px;
}
</style>
