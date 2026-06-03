<template>
  <div class="step-site-instruction">
    <h3>第三步：更新现场班组说明</h3>
    <p class="step-desc">
      生成给现场班组看的吊装说明，自动包含受影响的记录清单，便于巡检组当天复核。
      所有数据来源于统一结果，确保明细、页面、导出数据一致。
    </p>

    <el-alert 
      v-if="store.affectedRecords.length > 0" 
      title="本次需重点复核" 
      type="warning" 
      :closable="false"
      class="affected-alert"
    >
      <template #default>
        <p>共 {{ store.affectedRecords.length }} 条记录因楼层剖面备注更新而受影响，请现场班组注意并由巡检组复核。</p>
      </template>
    </el-alert>

    <el-divider>生成现场说明</el-divider>

    <el-form :model="instructionForm" label-width="120px" class="instruction-form">
      <el-form-item label="说明标题">
        <el-input v-model="instructionForm.title" placeholder="如：3层墙板吊装注意事项" />
      </el-form-item>
      <el-form-item label="说明内容">
        <el-input 
          v-model="instructionForm.content" 
          type="textarea" 
          :rows="4"
          placeholder="输入给现场班组的详细说明"
        />
      </el-form-item>
      <el-form-item label="负责人">
        <el-input v-model="instructionForm.owner" placeholder="如：张工" />
      </el-form-item>
      <el-form-item label="复核期限">
        <el-date-picker 
          v-model="instructionForm.reviewDeadline" 
          type="date" 
          placeholder="选择复核截止日期"
          style="width: 100%;"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="generateInstruction" :icon="DocumentAdd">
          生成说明
        </el-button>
      </el-form-item>
    </el-form>

    <el-divider>已生成的现场说明</el-divider>

    <el-table :data="store.siteInstructions" border stripe class="instruction-table">
      <el-table-column prop="title" label="标题" min-width="150" />
      <el-table-column prop="content" label="内容" min-width="250" show-overflow-tooltip />
      <el-table-column prop="owner" label="负责人" width="100" />
      <el-table-column label="受影响记录数" width="120">
        <template #default="{ row }">
          <el-badge :value="row.affectedRecords?.length || 0" class="item">
            <span>条</span>
          </el-badge>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="生成时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button 
            type="primary" 
            link 
            size="small"
            @click="viewInstruction(row)"
          >
            查看详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="detailDialogVisible" title="现场说明详情" width="700px">
      <div v-if="currentInstruction" class="instruction-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="标题" :span="2">
            {{ currentInstruction.title }}
          </el-descriptions-item>
          <el-descriptions-item label="负责人">
            {{ currentInstruction.owner }}
          </el-descriptions-item>
          <el-descriptions-item label="生成时间">
            {{ formatDateTime(currentInstruction.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="说明内容" :span="2">
            {{ currentInstruction.content }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>受影响的记录（需复核）</el-divider>
        <el-table 
          v-if="currentInstruction.affectedRecords && currentInstruction.affectedRecords.length > 0"
          :data="currentInstruction.affectedRecords" 
          border 
          size="small"
        >
          <el-table-column prop="wallPanelCode" label="墙板编号" width="120" />
          <el-table-column prop="obstacleNote" label="障碍物备注" min-width="200" />
          <el-table-column prop="affectedReason" label="受影响原因" min-width="200" />
        </el-table>
        <el-empty v-else description="无受影响记录" />

        <el-divider>统一数据来源验证</el-divider>
        <el-alert type="success" :closable="false">
          本说明数据与页面展示、导出明细、API接口返回的是同一份统一结果数据，确保数据一致性。
        </el-alert>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentAdd } from '@element-plus/icons-vue'
import { useSimulationStore } from '../stores/simulationStore'

const store = useSimulationStore()

const detailDialogVisible = ref(false)
const currentInstruction = ref(null)

const instructionForm = reactive({
  title: '',
  content: '',
  owner: '小魏',
  reviewDeadline: null
})

const generateInstruction = () => {
  if (!instructionForm.title) {
    ElMessage.warning('请输入说明标题')
    return
  }
  if (!instructionForm.content) {
    ElMessage.warning('请输入说明内容')
    return
  }
  
  store.updateSiteInstruction({
    title: instructionForm.title,
    content: instructionForm.content,
    owner: instructionForm.owner,
    reviewDeadline: instructionForm.reviewDeadline
  })
  
  instructionForm.title = ''
  instructionForm.content = ''
  instructionForm.reviewDeadline = null
  
  ElMessage.success('现场说明生成成功')
}

const viewInstruction = (row) => {
  currentInstruction.value = row
  detailDialogVisible.value = true
}

const formatDateTime = (isoString) => {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString('zh-CN')
}
</script>

<style scoped>
.step-site-instruction h3 {
  margin-bottom: 10px;
  color: #303133;
}

.step-desc {
  color: #909399;
  margin-bottom: 20px;
}

.affected-alert {
  margin-bottom: 20px;
}

.instruction-form {
  max-width: 800px;
  margin-bottom: 20px;
}

.instruction-table {
  margin-top: 20px;
}

.instruction-detail {
  padding: 10px;
}
</style>
