<template>
  <div class="review">
    <div class="page-header">
      <h2 class="page-title">复盘笔记</h2>
      <div class="action-bar">
        <el-select v-model="selectedTradingDayId" placeholder="选择交易日" style="width: 200px" @change="loadNotes">
          <el-option
            v-for="day in tradingDays"
            :key="day.id"
            :label="day.date"
            :value="day.id"
          />
        </el-select>
        <el-button type="primary" @click="openCreateNoteDialog">
          <el-icon><Plus /></el-icon>
          新建笔记
        </el-button>
        <el-button @click="loadNotes">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <el-row :gutter="15">
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>笔记列表</span>
          </template>
          <el-table 
            :data="notes" 
            style="width: 100%" 
            highlight-current-row 
            @current-change="handleNoteSelect"
            v-loading="loading"
          >
            <el-table-column prop="title" label="标题" show-overflow-tooltip>
              <template #default="{ row }">
                <div style="display: flex; align-items: center">
                  <el-tag :type="getCategoryTagType(row.category)" size="small" style="margin-right: 8px">
                    {{ getCategoryName(row.category) }}
                  </el-tag>
                  <span>{{ row.title }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="时间" width="100">
              <template #default="{ row }">
                {{ formatTime(row.created_at) }}
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="notes.length === 0 && !loading" description="暂无复盘笔记" />
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card v-if="selectedNote">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>笔记详情</span>
              <div class="action-bar">
                <el-button text type="primary" size="small" @click="openEditNoteDialog">
                  <el-icon><Edit /></el-icon>
                  编辑
                </el-button>
                <el-button text type="danger" size="small" @click="deleteNote(selectedNote)">
                  <el-icon><Delete /></el-icon>
                  删除
                </el-button>
              </div>
            </div>
          </template>

          <div style="margin-bottom: 15px">
            <el-descriptions :column="3" border size="small">
              <el-descriptions-item label="标题">{{ selectedNote.title }}</el-descriptions-item>
              <el-descriptions-item label="分类">
                <el-tag :type="getCategoryTagType(selectedNote.category)" size="small">
                  {{ getCategoryName(selectedNote.category) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="相关订单">
                {{ selectedNote.related_order_id || '无' }}
              </el-descriptions-item>
              <el-descriptions-item label="情绪评级">
                <el-rate v-model="selectedNote.mood_rating" disabled :max="5" />
              </el-descriptions-item>
              <el-descriptions-item label="执行质量">
                <el-rate v-model="selectedNote.execution_quality" disabled :max="5" />
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                {{ formatTime(selectedNote.created_at) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <el-divider content-position="left">复盘内容</el-divider>

          <div v-if="selectedNote.trade_summary" style="margin-bottom: 15px">
            <h4 style="margin-bottom: 8px">交易总结</h4>
            <el-card shadow="never" style="background-color: #f5f7fa">
              <p style="white-space: pre-wrap">{{ selectedNote.trade_summary }}</p>
            </el-card>
          </div>

          <div v-if="selectedNote.lessons_learned" style="margin-bottom: 15px">
            <h4 style="margin-bottom: 8px">经验教训</h4>
            <el-card shadow="never" style="background-color: #ecf5ff">
              <p style="white-space: pre-wrap">{{ selectedNote.lessons_learned }}</p>
            </el-card>
          </div>

          <div v-if="selectedNote.improvement_plan" style="margin-bottom: 15px">
            <h4 style="margin-bottom: 8px">改进计划</h4>
            <el-card shadow="never" style="background-color: #f0f9eb">
              <p style="white-space: pre-wrap">{{ selectedNote.improvement_plan }}</p>
            </el-card>
          </div>

          <div v-if="selectedNote.content">
            <h4 style="margin-bottom: 8px">详细内容</h4>
            <el-card shadow="never">
              <p style="white-space: pre-wrap">{{ selectedNote.content }}</p>
            </el-card>
          </div>

          <div v-if="selectedNote.tags" style="margin-top: 15px">
            <h4 style="margin-bottom: 8px">标签</h4>
            <div>
              <el-tag 
                v-for="(tag, index) in selectedNote.tags" 
                :key="index" 
                style="margin-right: 5px; margin-bottom: 5px"
              >
                {{ tag }}
              </el-tag>
            </div>
          </div>
        </el-card>
        <el-empty v-else description="请选择或创建一篇复盘笔记" />
      </el-col>
    </el-row>

    <el-dialog v-model="noteDialogVisible" :title="isEdit ? '编辑复盘笔记' : '新建复盘笔记'" width="700px">
      <el-form :model="noteForm" :rules="noteRules" ref="noteFormRef" label-width="100px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="noteForm.title" placeholder="请输入笔记标题" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="noteForm.category" placeholder="请选择分类" style="width: 100%">
            <el-option label="交易复盘" value="trade_review" />
            <el-option label="策略反思" value="strategy_review" />
            <el-option label="情绪管理" value="emotion_management" />
            <el-option label="纪律执行" value="discipline" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-row :gutter="15">
          <el-col :span="12">
            <el-form-item label="情绪评级" prop="mood_rating">
              <el-rate v-model="noteForm.mood_rating" :max="5" show-text :texts="['很差', '差', '一般', '好', '很好']" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="执行质量" prop="execution_quality">
              <el-rate v-model="noteForm.execution_quality" :max="5" show-text :texts="['很差', '差', '一般', '好', '很好']" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="交易总结" prop="trade_summary">
          <el-input 
            v-model="noteForm.trade_summary" 
            type="textarea" 
            :rows="3" 
            placeholder="总结今日交易情况，包括盈亏、胜率、交易次数等..."
          />
        </el-form-item>
        <el-form-item label="经验教训" prop="lessons_learned">
          <el-input 
            v-model="noteForm.lessons_learned" 
            type="textarea" 
            :rows="3" 
            placeholder="从今日交易中学到了什么？有哪些错误需要避免？..."
          />
        </el-form-item>
        <el-form-item label="改进计划" prop="improvement_plan">
          <el-input 
            v-model="noteForm.improvement_plan" 
            type="textarea" 
            :rows="3" 
            placeholder="下次交易需要改进什么？有哪些具体措施？..."
          />
        </el-form-item>
        <el-form-item label="详细内容" prop="content">
          <el-input 
            v-model="noteForm.content" 
            type="textarea" 
            :rows="4" 
            placeholder="详细的复盘笔记内容..."
          />
        </el-form-item>
        <el-form-item label="标签" prop="tags">
          <el-select 
            v-model="noteForm.tags" 
            multiple 
            filterable 
            allow-create 
            default-first-option 
            placeholder="请输入标签，按回车添加" 
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="noteDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitNote">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { reviewNoteApi, tradingDayApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const loading = ref(false)
const tradingDays = ref([])
const selectedTradingDayId = ref(null)
const notes = ref([])
const selectedNote = ref(null)

const noteDialogVisible = ref(false)
const noteFormRef = ref(null)
const isEdit = ref(false)
const noteForm = ref({
  trading_day_id: null,
  title: '',
  category: 'trade_review',
  mood_rating: 3,
  execution_quality: 3,
  trade_summary: '',
  lessons_learned: '',
  improvement_plan: '',
  content: '',
  tags: []
})
const noteRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }]
}

function formatTime(value) {
  if (!value) return '--:--'
  return dayjs(value).format('HH:mm')
}

function getCategoryTagType(category) {
  const map = {
    trade_review: 'primary',
    strategy_review: 'success',
    emotion_management: 'warning',
    discipline: 'danger',
    other: 'info'
  }
  return map[category] || 'info'
}

function getCategoryName(category) {
  const map = {
    trade_review: '交易复盘',
    strategy_review: '策略反思',
    emotion_management: '情绪管理',
    discipline: '纪律执行',
    other: '其他'
  }
  return map[category] || category
}

async function loadTradingDays() {
  try {
    const res = await tradingDayApi.list({ pageSize: 50 })
    tradingDays.value = res.data?.list || []
    if (tradingDays.value.length > 0) {
      const active = tradingDays.value.find(d => d.status === 'active')
      selectedTradingDayId.value = active?.id || tradingDays.value[0].id
    }
  } catch (error) {
    console.error('加载交易日失败:', error)
  }
}

async function loadNotes() {
  if (!selectedTradingDayId.value) return
  
  try {
    loading.value = true
    const res = await reviewNoteApi.list({
      trading_day_id: selectedTradingDayId.value,
      pageSize: 100
    })
    notes.value = res.data?.list || []
    
    if (notes.value.length > 0 && !selectedNote.value) {
      selectedNote.value = notes.value[0]
    }
  } catch (error) {
    console.error('加载笔记失败:', error)
  } finally {
    loading.value = false
  }
}

function handleNoteSelect(row) {
  if (row) {
    selectedNote.value = row
  }
}

function openCreateNoteDialog() {
  isEdit.value = false
  noteForm.value = {
    trading_day_id: selectedTradingDayId.value,
    title: '',
    category: 'trade_review',
    mood_rating: 3,
    execution_quality: 3,
    trade_summary: '',
    lessons_learned: '',
    improvement_plan: '',
    content: '',
    tags: []
  }
  noteDialogVisible.value = true
}

function openEditNoteDialog() {
  if (!selectedNote.value) return
  
  isEdit.value = true
  noteForm.value = {
    ...selectedNote.value,
    trading_day_id: selectedTradingDayId.value
  }
  noteDialogVisible.value = true
}

async function submitNote() {
  if (!noteFormRef.value) return
  
  await noteFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (isEdit.value) {
          await reviewNoteApi.update(selectedNote.value.id, noteForm.value)
          ElMessage.success('更新成功')
        } else {
          await reviewNoteApi.create(noteForm.value)
          ElMessage.success('创建成功')
        }
        noteDialogVisible.value = false
        await loadNotes()
      } catch (error) {
        console.error('保存失败:', error)
      }
    }
  })
}

async function deleteNote(note) {
  ElMessageBox.confirm(
    '确定要删除这篇笔记吗？',
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await reviewNoteApi.delete(note.id)
      ElMessage.success('删除成功')
      selectedNote.value = null
      await loadNotes()
    } catch (error) {
      console.error('删除失败:', error)
    }
  }).catch(() => {})
}

onMounted(async () => {
  await loadTradingDays()
  if (selectedTradingDayId.value) {
    await loadNotes()
  }
})
</script>

<style scoped>
.review {
  height: 100%;
}
</style>
