<template>
  <div class="resume-detail-page" v-loading="loading">
    <div class="header-actions">
      <el-button @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <el-button type="primary" @click="openReviewDialog" :disabled="!resume?.latest_parse">
        <el-icon><Edit /></el-icon>
        人工复核
      </el-button>
      <el-button type="success" @click="showDiff" :disabled="(resume?.parse_history?.length || 0) < 2">
        <el-icon><View /></el-icon>
        版本差异
      </el-button>
      <el-button type="warning" @click="recalculateMatch">
        <el-icon><Refresh /></el-icon>
        重新计算匹配度
      </el-button>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>基本信息</template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="文件名">{{ resume?.filename }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getStatusType(resume?.status)">{{ resume?.status }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="匹配岗位">{{ resume?.matched_job?.name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="匹配度">
              <el-progress
                :percentage="resume?.match_score || 0"
                :color="getScoreColor(resume?.match_score)"
              />
            </el-descriptions-item>
            <el-descriptions-item label="上传时间" :span="2">
              {{ formatDate(resume?.created_at) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>解析信息</template>
          <el-descriptions :column="2" border v-if="resume?.latest_parse">
            <el-descriptions-item label="姓名">{{ resume.latest_parse.name }}</el-descriptions-item>
            <el-descriptions-item label="电话">{{ resume.latest_parse.phone }}</el-descriptions-item>
            <el-descriptions-item label="邮箱" :span="2">{{ resume.latest_parse.email }}</el-descriptions-item>
            <el-descriptions-item label="学历">{{ resume.latest_parse.education }}</el-descriptions-item>
            <el-descriptions-item label="工作年限">{{ resume.latest_parse.work_years }}</el-descriptions-item>
            <el-descriptions-item label="期望薪资">{{ resume.latest_parse.expected_salary }}</el-descriptions-item>
            <el-descriptions-item label="当前薪资">{{ resume.latest_parse.current_salary }}</el-descriptions-item>
            <el-descriptions-item label="技能" :span="2">
              <el-tag v-for="skill in resume.latest_parse.skills || []" :key="skill" style="margin: 2px">
                {{ skill }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="解析来源">{{ resume.latest_parse.parse_source }}</el-descriptions-item>
            <el-descriptions-item label="置信度">{{ (resume.latest_parse.confidence_score * 100).toFixed(1) }}%</el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="暂无解析数据" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>版本历史</template>
          <el-timeline>
            <el-timeline-item
              v-for="version in resume?.parse_history || []"
              :key="version.id"
              :timestamp="formatDate(version.created_at)"
            >
              <div>
                <strong>版本 {{ version.version }}</strong>
                <span style="margin-left: 10px; color: #909399">{{ version.parse_source }}</span>
              </div>
              <div style="margin-top: 5px">{{ version.name }} - {{ version.current_position || '未知职位' }}</div>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>复核记录</template>
          <el-timeline v-if="resume?.review_records?.length">
            <el-timeline-item
              v-for="record in resume.review_records"
              :key="record.id"
              :timestamp="formatDate(record.review_time)"
            >
              <div>
                <strong>复核人：{{ record.reviewer }}</strong>
              </div>
              <div style="margin-top: 5px">{{ record.review_comment || '无备注' }}</div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无复核记录" />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="reviewDialogVisible" title="人工复核" width="800px">
      <el-form :model="reviewForm" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="姓名">
              <el-input v-model="reviewForm.parse_data.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电话">
              <el-input v-model="reviewForm.parse_data.phone" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="reviewForm.parse_data.email" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="学历">
              <el-input v-model="reviewForm.parse_data.education" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="毕业院校">
              <el-input v-model="reviewForm.parse_data.school" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="专业">
              <el-input v-model="reviewForm.parse_data.major" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="工作年限">
              <el-input-number v-model="reviewForm.parse_data.work_years" :step="0.5" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="期望薪资">
              <el-input v-model="reviewForm.parse_data.expected_salary" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="技能">
          <el-select
            v-model="reviewForm.parse_data.skills"
            multiple
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option v-for="skill in commonSkills" :key="skill" :label="skill" :value="skill" />
          </el-select>
        </el-form-item>
        <el-form-item label="复核人">
          <el-input v-model="reviewForm.reviewer" placeholder="请输入您的姓名" />
        </el-form-item>
        <el-form-item label="复核意见">
          <el-input v-model="reviewForm.review_comment" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReview" :loading="submitting">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="diffDialogVisible" title="版本差异对比" width="900px">
      <el-row :gutter="20" style="margin-bottom: 20px">
        <el-col :span="12">
          <el-select v-model="diffVersion1" placeholder="选择旧版本" style="width: 100%">
            <el-option
              v-for="v in resume?.parse_history?.slice().reverse()"
              :key="v.version"
              :label="`版本 ${v.version}`"
              :value="v.version"
            />
          </el-select>
        </el-col>
        <el-col :span="12">
          <el-select v-model="diffVersion2" placeholder="选择新版本" style="width: 100%">
            <el-option
              v-for="v in resume?.parse_history?.slice().reverse()"
              :key="v.version"
              :label="`版本 ${v.version}`"
              :value="v.version"
            />
          </el-select>
        </el-col>
      </el-row>

      <el-table :data="diffData" stripe v-loading="diffLoading">
        <el-table-column prop="field" label="字段" width="150" />
        <el-table-column prop="old_value" label="旧值">
          <template #default="{ row }">
            <span :class="{ 'diff-deleted': row.change_type === '删除' || row.change_type === '修改' }">
              {{ row.old_value || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="new_value" label="新值">
          <template #default="{ row }">
            <span :class="{ 'diff-added': row.change_type === '新增' || row.change_type === '修改' }">
              {{ row.new_value || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="change_type" label="变化类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getChangeType(row.change_type)" size="small">
              {{ row.change_type }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!diffLoading && !diffData.length" description="两个版本之间没有差异" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useResumeStore } from '@/store/resume'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const resumeStore = useResumeStore()

const resume = ref(null)
const loading = ref(false)
const submitting = ref(false)
const reviewDialogVisible = ref(false)
const diffDialogVisible = ref(false)
const diffLoading = ref(false)
const diffVersion1 = ref(null)
const diffVersion2 = ref(null)
const diffData = ref([])

const commonSkills = ['Python', 'Java', 'JavaScript', 'C++', 'Go', 'SQL', 'Docker', 'Kubernetes', 'AWS', 'Linux', 'Git']

const reviewForm = ref({
  reviewer: '',
  review_comment: '',
  parse_data: {}
})

const fetchDetail = async () => {
  loading.value = true
  try {
    resume.value = await resumeStore.fetchResumeDetail(route.params.id)
  } finally {
    loading.value = false
  }
}

const openReviewDialog = () => {
  if (resume.value?.latest_parse) {
    reviewForm.value.parse_data = { ...resume.value.latest_parse }
  }
  reviewDialogVisible.value = true
}

const submitReview = async () => {
  if (!reviewForm.value.reviewer) {
    ElMessage.warning('请输入复核人姓名')
    return
  }

  submitting.value = true
  try {
    await resumeStore.reviewResume(route.params.id, reviewForm.value)
    ElMessage.success('复核提交成功')
    reviewDialogVisible.value = false
    await fetchDetail()
  } catch (error) {
    ElMessage.error('提交失败')
  } finally {
    submitting.value = false
  }
}

const showDiff = async () => {
  const versions = resume.value?.parse_history || []
  if (versions.length >= 2) {
    diffVersion1.value = versions[1].version
    diffVersion2.value = versions[0].version
    await loadDiff()
  }
  diffDialogVisible.value = true
}

const loadDiff = async () => {
  if (!diffVersion1.value || !diffVersion2.value) return
  
  diffLoading.value = true
  try {
    const result = await resumeStore.getParseDiff(route.params.id, diffVersion1.value, diffVersion2.value)
    diffData.value = result.diffs || []
  } finally {
    diffLoading.value = false
  }
}

const recalculateMatch = async () => {
  try {
    await resumeStore.recalculateMatch(route.params.id)
    ElMessage.success('匹配度重新计算完成')
    await fetchDetail()
  } catch (error) {
    ElMessage.error('重新计算失败')
  }
}

const goBack = () => {
  router.push('/resumes')
}

const getStatusType = (status) => {
  const types = {
    '待解析': 'info',
    '解析成功': 'success',
    '解析拦截': 'warning',
    '解析补偿': 'warning',
    '待人工复核': 'info',
    '复核完成': 'success',
    '已导出': 'success'
  }
  return types[status] || 'info'
}

const getScoreColor = (score) => {
  if (score >= 80) return '#67c23a'
  if (score >= 60) return '#e6a23c'
  return '#f56c6c'
}

const getChangeType = (type) => {
  const types = {
    '新增': 'success',
    '删除': 'danger',
    '修改': 'warning'
  }
  return types[type] || 'info'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchDetail()
})
</script>

<style scoped>
.header-actions {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.diff-deleted {
  color: #f56c6c;
  text-decoration: line-through;
}

.diff-added {
  color: #67c23a;
  font-weight: bold;
}
</style>
