<template>
  <div class="translation-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>翻译管理</span>
          <div class="header-actions">
            <el-button type="primary" @click="openKeyDialog">新增文案 Key</el-button>
            <el-button type="success" @click="openPackDialog">新增语言包</el-button>
            <el-button @click="recalculateTranslations">重新计算占位符</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20" class="filter-row">
        <el-col :span="8">
          <el-select
            v-model="filters.language_pack_id"
            placeholder="选择语言包"
            clearable
            style="width: 100%"
            @change="loadTranslations"
          >
            <el-option
              v-for="pack in languagePacks"
              :key="pack.id"
              :label="`${pack.language_name} (${pack.language_code})`"
              :value="pack.id"
            />
          </el-select>
        </el-col>
        <el-col :span="8">
          <el-select
            v-model="filters.status"
            placeholder="选择状态"
            clearable
            style="width: 100%"
            @change="loadTranslations"
          >
            <el-option label="待处理" value="pending" />
            <el-option label="已匹配" value="matched" />
            <el-option label="审核中" value="reviewing" />
            <el-option label="已通过" value="approved" />
            <el-option label="已拒绝" value="rejected" />
            <el-option label="已修改" value="modified" />
          </el-select>
        </el-col>
        <el-col :span="8">
          <el-input
            v-model="filters.search"
            placeholder="搜索文案 Key"
            clearable
            @clear="loadTranslations"
            @keyup.enter="loadTranslations"
          />
        </el-col>
      </el-row>

      <el-table :data="filteredTranslations" v-loading="loading" border>
        <el-table-column prop="language_key.key" label="文案 Key" width="200" />
        <el-table-column prop="language_key.description" label="描述" width="200" show-overflow-tooltip />
        <el-table-column prop="language_pack.language_name" label="语言" width="120" />
        <el-table-column prop="translated_text" label="翻译内容" min-width="200" show-overflow-tooltip />
        <el-table-column label="占位符校验" width="120">
          <template #default="{ row }">
            <el-tag :type="row.placeholder_valid ? 'success' : 'danger'" size="small">
              {{ row.placeholder_valid ? '通过' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="缺失翻译" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_missing ? 'warning' : 'info'" size="small">
              {{ row.is_missing ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="editTranslation(row)">编辑</el-button>
            <el-button size="small" type="primary" @click="startReview(row)" :disabled="row.status === 'reviewing'">
              开始审核
            </el-button>
            <el-button size="small" type="success" @click="compareDialogVisible = true; compareRow = row">
              比对
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="keyDialogVisible" title="新增文案 Key" width="500px">
      <el-form :model="keyForm" label-width="100px">
        <el-form-item label="文案 Key">
          <el-input v-model="keyForm.key" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="keyForm.description" type="textarea" />
        </el-form-item>
        <el-form-item label="默认值(英文)">
          <el-input v-model="keyForm.default_value" type="textarea" />
        </el-form-item>
        <el-form-item label="占位符模式">
          <el-input v-model="keyForm.placeholder_pattern" placeholder="例如: \{[\w]+\}" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="keyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createLanguageKey">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="packDialogVisible" title="新增语言包" width="500px">
      <el-form :model="packForm" label-width="100px">
        <el-form-item label="语言代码">
          <el-input v-model="packForm.language_code" placeholder="例如: zh-CN" />
        </el-form-item>
        <el-form-item label="语言名称">
          <el-input v-model="packForm.language_name" placeholder="例如: 中文" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="packDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createLanguagePack">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑翻译" width="600px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="文案 Key">
          <el-input :value="editForm.language_key?.key" disabled />
        </el-form-item>
        <el-form-item label="原文(英文)">
          <el-input :value="editForm.language_key?.default_value" type="textarea" disabled />
        </el-form-item>
        <el-form-item label="翻译内容">
          <el-input v-model="editForm.translated_text" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="审核备注">
          <el-input v-model="editForm.review_comment" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="success" @click="reviewTranslation(true)">审核通过</el-button>
        <el-button type="danger" @click="reviewTranslation(false)">审核拒绝</el-button>
        <el-button type="primary" @click="saveTranslation">保存修改</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="compareDialogVisible" title="翻译比对" width="600px">
      <el-form label-width="100px">
        <el-form-item label="现有翻译">
          <el-input :value="compareRow?.translated_text || '无'" type="textarea" :rows="3" disabled />
        </el-form-item>
        <el-form-item label="候选翻译">
          <el-input v-model="candidateTranslation" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="比对结果">
          <div v-if="compareResult">
            <el-tag :type="compareResult.is_new ? 'warning' : 'info'" size="small" style="margin-right: 10px;">
              {{ compareResult.is_new ? '新翻译' : '已有翻译' }}
            </el-tag>
            <span>相似度: {{ (compareResult.similarity_score * 100).toFixed(1) }}%</span>
            <p style="margin-top: 10px; color: #606266;">{{ compareResult.suggestion }}</p>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="compareDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="doCompare">执行比对</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { translationApi } from '@/api'

const loading = ref(false)
const translations = ref([])
const languagePacks = ref([])
const languageKeys = ref([])

const filters = reactive({
  language_pack_id: null,
  status: null,
  search: ''
})

const keyDialogVisible = ref(false)
const packDialogVisible = ref(false)
const editDialogVisible = ref(false)
const compareDialogVisible = ref(false)

const keyForm = reactive({
  key: '',
  description: '',
  default_value: '',
  placeholder_pattern: ''
})

const packForm = reactive({
  language_code: '',
  language_name: ''
})

const editForm = reactive({})
const compareRow = ref(null)
const candidateTranslation = ref('')
const compareResult = ref(null)

const filteredTranslations = computed(() => {
  let result = [...translations.value]
  if (filters.search) {
    result = result.filter(t => 
      t.language_key?.key?.toLowerCase().includes(filters.search.toLowerCase())
    )
  }
  return result
})

const getStatusType = (status) => {
  const typeMap = {
    pending: 'info',
    matched: 'success',
    reviewing: 'warning',
    approved: 'success',
    rejected: 'danger',
    modified: 'primary'
  }
  return typeMap[status] || 'info'
}

const getStatusText = (status) => {
  const textMap = {
    pending: '待处理',
    matched: '已匹配',
    reviewing: '审核中',
    approved: '已通过',
    rejected: '已拒绝',
    modified: '已修改'
  }
  return textMap[status] || status
}

const loadTranslations = async () => {
  loading.value = true
  try {
    const params = {
      skip: 0,
      limit: 100
    }
    if (filters.language_pack_id) {
      params.language_pack_id = filters.language_pack_id
    }
    if (filters.status) {
      params.status = filters.status
    }
    translations.value = await translationApi.getTranslations(params)
  } catch (error) {
    ElMessage.error('加载翻译列表失败')
  } finally {
    loading.value = false
  }
}

const loadLanguagePacks = async () => {
  try {
    languagePacks.value = await translationApi.getLanguagePacks()
  } catch (error) {
    ElMessage.error('加载语言包失败')
  }
}

const openKeyDialog = () => {
  Object.assign(keyForm, {
    key: '',
    description: '',
    default_value: '',
    placeholder_pattern: ''
  })
  keyDialogVisible.value = true
}

const openPackDialog = () => {
  Object.assign(packForm, {
    language_code: '',
    language_name: ''
  })
  packDialogVisible.value = true
}

const createLanguageKey = async () => {
  try {
    await translationApi.createLanguageKey(keyForm)
    ElMessage.success('创建成功')
    keyDialogVisible.value = false
    loadTranslations()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const createLanguagePack = async () => {
  try {
    await translationApi.createLanguagePack(packForm)
    ElMessage.success('创建成功')
    packDialogVisible.value = false
    loadLanguagePacks()
    loadTranslations()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const editTranslation = (row) => {
  Object.assign(editForm, { ...row })
  editDialogVisible.value = true
}

const saveTranslation = async () => {
  try {
    await translationApi.updateTranslation(editForm.id, {
      translated_text: editForm.translated_text,
      review_comment: editForm.review_comment
    })
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    loadTranslations()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const startReview = async (row) => {
  try {
    await translationApi.startReview(row.id)
    ElMessage.success('已进入审核状态')
    loadTranslations()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const reviewTranslation = async (approved) => {
  try {
    await translationApi.reviewTranslation(editForm.id, {
      approved,
      comment: editForm.review_comment,
      idempotency_key: `review-${editForm.id}-${Date.now()}`
    })
    ElMessage.success(approved ? '审核通过' : '审核拒绝')
    editDialogVisible.value = false
    loadTranslations()
  } catch (error) {
    ElMessage.error('审核失败')
  }
}

const doCompare = async () => {
  try {
    compareResult.value = await translationApi.compareTranslation({
      language_key_id: compareRow.value.language_key_id,
      language_pack_id: compareRow.value.language_pack_id,
      candidate_translation: candidateTranslation.value
    })
  } catch (error) {
    ElMessage.error('比对失败')
  }
}

const recalculateTranslations = async () => {
  try {
    await translationApi.recalculateTranslations(filters.language_pack_id)
    ElMessage.success('重新计算完成')
    loadTranslations()
  } catch (error) {
    ElMessage.error('重新计算失败')
  }
}

onMounted(() => {
  loadLanguagePacks()
  loadTranslations()
})
</script>

<style scoped>
.translation-page {
  height: 100%;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-row {
  margin-bottom: 20px;
}
</style>
