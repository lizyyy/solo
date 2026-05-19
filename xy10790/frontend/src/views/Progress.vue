<template>
  <div class="progress-page">
    <h2 class="page-title">学员进度管理</h2>
    
    <el-card class="filter-card">
      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="学员ID">
          <el-input v-model="filters.student_id" placeholder="请输入学员ID" clearable />
        </el-form-item>
        <el-form-item label="课程ID">
          <el-input v-model="filters.course_id" placeholder="请输入课程ID" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable>
            <el-option label="进行中" value="in_progress" />
            <el-option label="已完成" value="completed" />
            <el-option label="已暂停" value="paused" />
            <el-option label="已发布" value="published" />
          </el-select>
        </el-form-item>
        <el-form-item label="有异常任务">
          <el-select v-model="filters.has_abnormal_tasks" placeholder="请选择" clearable>
            <el-option label="是" :value="true" />
            <el-option label="否" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetFilters">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
          <el-button type="success" @click="showCreateDialog">
            <el-icon><Plus /></el-icon>
            新增
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table
        :data="tableData"
        v-loading="loading"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column prop="student_id" label="学员ID" width="120" />
        <el-table-column prop="student_name" label="学员姓名" width="120" />
        <el-table-column prop="course_id" label="课程ID" width="120" />
        <el-table-column prop="course_name" label="课程名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="overall_progress" label="总体进度" width="120">
          <template #default="{ row }">
            <el-progress
              :percentage="row.overall_progress"
              :stroke-width="8"
              :color="getProgressColor(row.overall_progress)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="completed_chapters" label="章节/总数" width="120">
          <template #default="{ row }">
            {{ row.completed_chapters }}/{{ row.total_chapters }}
          </template>
        </el-table-column>
        <el-table-column prop="passed_quizzes" label="测验/总数" width="120">
          <template #default="{ row }">
            {{ row.passed_quizzes }}/{{ row.total_quizzes }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">
              <el-icon><View /></el-icon>
              详情
            </el-button>
            <el-button link type="warning" @click="handlePublish(row)" v-if="row.status !== 'published'">
              <el-icon><Upload /></el-icon>
              发布
            </el-button>
            <el-button link type="success" @click="generateCertificate(row)">
              <el-icon><Medal /></el-icon>
              生成证书
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
        class="pagination"
      />
    </el-card>

    <el-drawer
      v-model="detailDrawerVisible"
      title="学员进度详情"
      size="60%"
    >
      <div v-if="currentProgress" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="学员ID">{{ currentProgress.student_id }}</el-descriptions-item>
          <el-descriptions-item label="学员姓名">{{ currentProgress.student_name }}</el-descriptions-item>
          <el-descriptions-item label="课程ID">{{ currentProgress.course_id }}</el-descriptions-item>
          <el-descriptions-item label="课程名称">{{ currentProgress.course_name }}</el-descriptions-item>
          <el-descriptions-item label="总体进度">
            <el-progress
              :percentage="currentProgress.overall_progress"
              :stroke-width="8"
            />
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentProgress.status)">
              {{ getStatusText(currentProgress.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="开始日期">
            {{ formatDate(currentProgress.start_date) }}
          </el-descriptions-item>
          <el-descriptions-item label="最后活动日期">
            {{ formatDate(currentProgress.last_activity_date) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">章节解锁情况</el-divider>
        <el-table :data="currentProgress.chapters || []" border size="small">
          <el-table-column prop="chapter_id" label="章节ID" width="100" />
          <el-table-column prop="chapter_name" label="章节名称" min-width="150" />
          <el-table-column prop="is_unlocked" label="是否解锁" width="100">
            <template #default="{ row }">
              <el-tag :type="row.is_unlocked ? 'success' : 'info'">
                {{ row.is_unlocked ? '已解锁' : '未解锁' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="is_completed" label="是否完成" width="100">
            <template #default="{ row }">
              <el-tag :type="row.is_completed ? 'success' : 'warning'">
                {{ row.is_completed ? '已完成' : '未完成' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="completion_percentage" label="完成进度" width="120">
            <template #default="{ row }">
              <el-progress
                :percentage="row.completion_percentage"
                :stroke-width="6"
                size="small"
              />
            </template>
          </el-table-column>
        </el-table>

        <el-divider content-position="left">测验成绩</el-divider>
        <el-table :data="currentProgress.quizzes || []" border size="small">
          <el-table-column prop="quiz_id" label="测验ID" width="100" />
          <el-table-column prop="quiz_name" label="测验名称" min-width="150" />
          <el-table-column prop="attempt_count" label="尝试次数" width="100" />
          <el-table-column prop="highest_score" label="最高分" width="100" />
          <el-table-column prop="latest_score" label="最新分数" width="100" />
          <el-table-column prop="is_passed" label="是否通过" width="100">
            <template #default="{ row }">
              <el-tag :type="row.is_passed ? 'success' : 'danger'">
                {{ row.is_passed ? '通过' : '未通过' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <el-divider content-position="left">补学任务</el-divider>
        <el-table :data="currentProgress.remedial_tasks || []" border size="small">
          <el-table-column prop="task_id" label="任务ID" width="100" />
          <el-table-column prop="task_name" label="任务名称" min-width="150" />
          <el-table-column prop="task_type" label="任务类型" width="100" />
          <el-table-column prop="is_abnormal" label="是否异常" width="100">
            <template #default="{ row }">
              <el-tag :type="row.is_abnormal ? 'danger' : 'success'">
                {{ row.is_abnormal ? '异常' : '正常' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="abnormal_reason" label="异常原因" min-width="150" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">
                {{ row.status === 'completed' ? '已完成' : '待处理' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>

    <el-dialog
      v-model="createDialogVisible"
      title="新增学员进度"
      width="800px"
    >
      <el-form :model="createForm" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="学员ID" required>
              <el-input v-model="createForm.student_id" placeholder="请输入学员ID" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="学员姓名" required>
              <el-input v-model="createForm.student_name" placeholder="请输入学员姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="课程ID" required>
              <el-input v-model="createForm.course_id" placeholder="请输入课程ID" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="课程名称" required>
              <el-input v-model="createForm.course_name" placeholder="请输入课程名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="总体进度">
              <el-slider v-model="createForm.overall_progress" :marks="{0: '0%', 50: '50%', 100: '100%'}" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="createForm.status" placeholder="请选择状态" style="width: 100%">
                <el-option label="进行中" value="in_progress" />
                <el-option label="已完成" value="completed" />
                <el-option label="已暂停" value="paused" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">章节信息</el-divider>
        <div class="sub-form-section">
          <div v-for="(chapter, index) in createForm.chapters" :key="index" class="sub-form-item">
            <el-row :gutter="15">
              <el-col :span="6">
                <el-input v-model="chapter.chapter_id" placeholder="章节ID" size="small" />
              </el-col>
              <el-col :span="8">
                <el-input v-model="chapter.chapter_name" placeholder="章节名称" size="small" />
              </el-col>
              <el-col :span="3">
                <el-input-number v-model="chapter.chapter_order" :min="1" size="small" placeholder="序号" />
              </el-col>
              <el-col :span="3">
                <el-switch v-model="chapter.is_unlocked" active-text="已解锁" inactive-text="未解锁" size="small" />
              </el-col>
              <el-col :span="3">
                <el-switch v-model="chapter.is_completed" active-text="已完成" inactive-text="未完成" size="small" />
              </el-col>
              <el-col :span="1">
                <el-button type="danger" link size="small" @click="removeChapter(index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </el-col>
            </el-row>
            <el-row :gutter="15" style="margin-top: 10px">
              <el-col :span="24">
                <el-slider v-model="chapter.completion_percentage" :max="100" size="small" />
              </el-col>
            </el-row>
          </div>
          <el-button type="primary" link @click="addChapter">
            <el-icon><Plus /></el-icon>
            添加章节
          </el-button>
        </div>

        <el-divider content-position="left">测验信息</el-divider>
        <div class="sub-form-section">
          <div v-for="(quiz, index) in createForm.quizzes" :key="index" class="sub-form-item">
            <el-row :gutter="15">
              <el-col :span="6">
                <el-input v-model="quiz.quiz_id" placeholder="测验ID" size="small" />
              </el-col>
              <el-col :span="8">
                <el-input v-model="quiz.quiz_name" placeholder="测验名称" size="small" />
              </el-col>
              <el-col :span="3">
                <el-input-number v-model="quiz.attempt_count" :min="0" size="small" placeholder="尝试次数" />
              </el-col>
              <el-col :span="3">
                <el-input-number v-model="quiz.highest_score" :min="0" :max="100" size="small" placeholder="最高分" />
              </el-col>
              <el-col :span="3">
                <el-input-number v-model="quiz.latest_score" :min="0" :max="100" size="small" placeholder="最新分" />
              </el-col>
              <el-col :span="1">
                <el-button type="danger" link size="small" @click="removeQuiz(index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </el-col>
            </el-row>
          </div>
          <el-button type="primary" link @click="addQuiz">
            <el-icon><Plus /></el-icon>
            添加测验
          </el-button>
        </div>

        <el-divider content-position="left">补学任务</el-divider>
        <div class="sub-form-section">
          <div v-for="(task, index) in createForm.remedial_tasks" :key="index" class="sub-form-item">
            <el-row :gutter="15">
              <el-col :span="5">
                <el-input v-model="task.task_id" placeholder="任务ID" size="small" />
              </el-col>
              <el-col :span="7">
                <el-input v-model="task.task_name" placeholder="任务名称" size="small" />
              </el-col>
              <el-col :span="4">
                <el-input v-model="task.task_type" placeholder="任务类型" size="small" />
              </el-col>
              <el-col :span="4">
                <el-select v-model="task.status" placeholder="状态" size="small" style="width: 100%">
                  <el-option label="待处理" value="pending" />
                  <el-option label="处理中" value="processing" />
                  <el-option label="已完成" value="completed" />
                </el-select>
              </el-col>
              <el-col :span="3">
                <el-switch v-model="task.is_abnormal" active-text="异常" inactive-text="正常" size="small" />
              </el-col>
              <el-col :span="1">
                <el-button type="danger" link size="small" @click="removeTask(index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </el-col>
            </el-row>
            <el-row :gutter="15" style="margin-top: 10px">
              <el-col :span="12">
                <el-input v-model="task.reason" placeholder="任务原因" size="small" />
              </el-col>
              <el-col :span="12" v-if="task.is_abnormal">
                <el-input v-model="task.abnormal_reason" placeholder="异常原因" size="small" />
              </el-col>
            </el-row>
          </div>
          <el-button type="primary" link @click="addTask">
            <el-icon><Plus /></el-icon>
            添加补学任务
          </el-button>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { progressApi, certificateApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const tableData = ref([])
const detailDrawerVisible = ref(false)
const createDialogVisible = ref(false)
const currentProgress = ref(null)

const filters = reactive({
  student_id: '',
  course_id: '',
  status: '',
  has_abnormal_tasks: ''
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const createForm = reactive({
  student_id: '',
  student_name: '',
  course_id: '',
  course_name: '',
  overall_progress: 0,
  status: 'in_progress',
  chapters: [],
  quizzes: [],
  remedial_tasks: []
})

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      ...filters,
      page: pagination.page,
      page_size: pagination.page_size
    }
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null) {
        delete params[key]
      }
    })

    const response = await progressApi.getList(params)
    if (response.data.success) {
      tableData.value = response.data.data.items
      pagination.total = response.data.data.total
    }
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  Object.assign(filters, {
    student_id: '',
    course_id: '',
    status: '',
    has_abnormal_tasks: ''
  })
  pagination.page = 1
  loadData()
}

const viewDetail = async (row) => {
  try {
    const response = await progressApi.getDetail(row.id)
    if (response.data.success) {
      currentProgress.value = response.data.data
      detailDrawerVisible.value = true
    }
  } catch (error) {
    ElMessage.error('加载详情失败')
  }
}

const handlePublish = async (row) => {
  try {
    await ElMessageBox.confirm('确认发布该学员进度？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await progressApi.publish({
      progress_id: row.id,
      published_by: 'admin'
    })
    
    if (response.data.success) {
      ElMessage.success('发布成功')
      loadData()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('发布失败')
    }
  }
}

const generateCertificate = async (row) => {
  try {
    await ElMessageBox.confirm('确认根据该学员进度生成证书资格？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    })
    
    const response = await certificateApi.createFromProgress({
      progress_id: row.id,
      confirmed_by: 'admin'
    })
    
    if (response.data.success) {
      ElMessage.success(`证书资格生成成功，符合资格: ${response.data.data.is_eligible ? '是' : '否'}`)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('生成失败')
    }
  }
}

const showCreateDialog = () => {
  Object.assign(createForm, {
    student_id: '',
    student_name: '',
    course_id: '',
    course_name: '',
    overall_progress: 0,
    status: 'in_progress',
    chapters: [],
    quizzes: [],
    remedial_tasks: []
  })
  createDialogVisible.value = true
}

const addChapter = () => {
  createForm.chapters.push({
    chapter_id: '',
    chapter_name: '',
    chapter_order: createForm.chapters.length + 1,
    is_unlocked: true,
    is_completed: false,
    completion_percentage: 0
  })
}

const removeChapter = (index) => {
  createForm.chapters.splice(index, 1)
}

const addQuiz = () => {
  createForm.quizzes.push({
    quiz_id: '',
    quiz_name: '',
    attempt_count: 0,
    highest_score: 0,
    latest_score: 0,
    passing_score: 60,
    is_passed: false
  })
}

const removeQuiz = (index) => {
  createForm.quizzes.splice(index, 1)
}

const addTask = () => {
  createForm.remedial_tasks.push({
    task_id: '',
    task_name: '',
    task_type: '',
    reason: '',
    is_abnormal: false,
    abnormal_reason: '',
    status: 'pending'
  })
}

const removeTask = (index) => {
  createForm.remedial_tasks.splice(index, 1)
}

const submitCreate = async () => {
  if (!createForm.student_id || !createForm.student_name || !createForm.course_id || !createForm.course_name) {
    ElMessage.warning('请填写必填项')
    return
  }

  createForm.total_chapters = createForm.chapters.length
  createForm.completed_chapters = createForm.chapters.filter(c => c.is_completed).length
  createForm.total_quizzes = createForm.quizzes.length
  createForm.passed_quizzes = createForm.quizzes.filter(q => q.is_passed).length

  try {
    const response = await progressApi.create(createForm)
    if (response.data.success) {
      ElMessage.success('创建成功')
      createDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const getProgressColor = (percentage) => {
  if (percentage >= 80) return '#67c23a'
  if (percentage >= 50) return '#e6a23c'
  return '#f56c6c'
}

const getStatusType = (status) => {
  const map = {
    in_progress: 'primary',
    completed: 'success',
    paused: 'warning',
    published: 'success'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    in_progress: '进行中',
    completed: '已完成',
    paused: '已暂停',
    published: '已发布'
  }
  return map[status] || status
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

loadData()
</script>

<style scoped>
.progress-page {
  padding: 0;
}

.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
}

.table-card {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.detail-content {
  padding: 0 20px;
}

.sub-form-section {
  padding: 10px 0;
}

.sub-form-item {
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 15px;
}
</style>
