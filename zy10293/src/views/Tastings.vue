<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>试饮与反馈</span>
          <el-button type="primary" @click="openTastingDialog">
            <el-icon><Plus /></el-icon>新增试饮
          </el-button>
        </div>
      </template>
      
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border stripe>
        <el-table-column prop="session_no" label="试饮编号" width="160" />
        <el-table-column prop="scheme_name" label="方案名称" />
        <el-table-column prop="customer_name" label="客户" width="120" />
        <el-table-column prop="tasting_date" label="试饮日期" width="120" />
        <el-table-column prop="location" label="地点" width="120" />
        <el-table-column label="评分" width="100">
          <template #default="{ row }">
            <el-rate v-if="row.rating" :model-value="row.rating" disabled show-score text-color="#ff9900" />
            <el-tag v-else type="info" size="small">待评价</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="是否购买" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.will_buy" type="success" size="small">是</el-tag>
            <el-tag v-else-if="row.will_buy === 0" type="info" size="small">否</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewFeedback(row)" v-if="row.rating">查看反馈</el-button>
            <el-button link type="warning" @click="openFeedbackDialog(row)" v-if="!row.rating">填写反馈</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="tastingDialogVisible" title="新增试饮记录" width="600px">
      <el-form :model="tastingForm" label-width="100px">
        <el-form-item label="拼配方案" required>
          <el-select v-model="tastingForm.scheme_id" placeholder="选择方案" style="width: 100%">
            <el-option
              v-for="s in schemes"
              :key="s.id"
              :label="`${s.name} - ${s.scheme_no}`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="客户名称" required>
          <el-input v-model="tastingForm.customer_name" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="试饮日期" required>
          <el-date-picker v-model="tastingForm.tasting_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="试饮地点">
          <el-input v-model="tastingForm.location" placeholder="例如：门店/品鉴会" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="tastingForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tastingDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTasting">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="feedbackDialogVisible" title="填写试饮反馈" width="700px">
      <el-form :model="feedbackForm" label-width="100px">
        <el-form-item label="总体评分" required>
          <el-rate v-model="feedbackForm.rating" show-score text-color="#ff9900" />
        </el-form-item>
        <el-form-item label="香气评价">
          <el-input v-model="feedbackForm.aroma" type="textarea" :rows="2" placeholder="描述茶的香气特点..." />
        </el-form-item>
        <el-form-item label="滋味评价">
          <el-input v-model="feedbackForm.taste" type="textarea" :rows="2" placeholder="描述茶的滋味特点..." />
        </el-form-item>
        <el-form-item label="回甘评价">
          <el-input v-model="feedbackForm.aftertaste" type="textarea" :rows="2" placeholder="描述回甘和口感..." />
        </el-form-item>
        <el-form-item label="是否愿意购买">
          <el-switch v-model="feedbackForm.will_buy" active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item label="其他建议">
          <el-input v-model="feedbackForm.suggestions" type="textarea" :rows="3" placeholder="对配方的改进建议..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="feedbackDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveFeedback">提交反馈</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="viewDialogVisible" title="试饮反馈详情" width="700px">
      <el-descriptions :column="1" border v-if="currentFeedback">
        <el-descriptions-item label="评分">
          <el-rate :model-value="currentFeedback.rating" disabled show-score text-color="#ff9900" />
        </el-descriptions-item>
        <el-descriptions-item label="香气">{{ currentFeedback.aroma || '-' }}</el-descriptions-item>
        <el-descriptions-item label="滋味">{{ currentFeedback.taste || '-' }}</el-descriptions-item>
        <el-descriptions-item label="回甘">{{ currentFeedback.aftertaste || '-' }}</el-descriptions-item>
        <el-descriptions-item label="购买意愿">
          <el-tag :type="currentFeedback.will_buy ? 'success' : 'info'" size="small">
            {{ currentFeedback.will_buy ? '愿意购买' : '暂不考虑' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="建议">{{ currentFeedback.suggestions || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { tastingApi, feedbackApi, schemeApi } from '../api'

const tableData = ref([])
const schemes = ref([])
const tastingDialogVisible = ref(false)
const feedbackDialogVisible = ref(false)
const viewDialogVisible = ref(false)
const dateRange = ref<string[]>([])
const currentFeedback = ref<any>(null)

const filters = reactive({
  start_date: '',
  end_date: ''
})

const tastingForm = reactive({
  scheme_id: null as number | null,
  customer_name: '',
  tasting_date: '',
  location: '',
  notes: ''
})

const feedbackForm = reactive({
  session_id: 0,
  rating: 0,
  aroma: '',
  taste: '',
  aftertaste: '',
  suggestions: '',
  will_buy: false
})

const resetFilters = () => {
  filters.start_date = ''
  filters.end_date = ''
  dateRange.value = []
  loadData()
}

const loadData = async () => {
  try {
    if (dateRange.value && dateRange.value.length === 2) {
      filters.start_date = dateRange.value[0]
      filters.end_date = dateRange.value[1]
    }
    
    const res = await tastingApi.list(filters)
    tableData.value = res.data
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

const loadSchemes = async () => {
  try {
    const res = await schemeApi.list({ status: 'approved' })
    schemes.value = res.data
  } catch (e) {
    ElMessage.error('加载方案失败')
  }
}

const openTastingDialog = () => {
  Object.assign(tastingForm, {
    scheme_id: null,
    customer_name: '',
    tasting_date: new Date().toISOString().split('T')[0],
    location: '',
    notes: ''
  })
  tastingDialogVisible.value = true
}

const saveTasting = async () => {
  if (!tastingForm.scheme_id || !tastingForm.customer_name || !tastingForm.tasting_date) {
    ElMessage.warning('请填写必填项')
    return
  }
  
  try {
    await tastingApi.create(tastingForm)
    ElMessage.success('试饮记录创建成功')
    tastingDialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '保存失败')
  }
}

const openFeedbackDialog = (row: any) => {
  feedbackForm.session_id = row.id
  feedbackForm.rating = 0
  feedbackForm.aroma = ''
  feedbackForm.taste = ''
  feedbackForm.aftertaste = ''
  feedbackForm.suggestions = ''
  feedbackForm.will_buy = false
  feedbackDialogVisible.value = true
}

const saveFeedback = async () => {
  if (!feedbackForm.rating) {
    ElMessage.warning('请填写评分')
    return
  }
  
  try {
    await feedbackApi.create(feedbackForm)
    ElMessage.success('反馈提交成功')
    feedbackDialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '保存失败')
  }
}

const viewFeedback = (row: any) => {
  currentFeedback.value = {
    rating: row.rating,
    aroma: row.aroma,
    taste: row.taste,
    aftertaste: row.aftertaste,
    suggestions: row.suggestions,
    will_buy: row.will_buy
  }
  viewDialogVisible.value = true
}

onMounted(() => {
  loadData()
  loadSchemes()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;
}
</style>
