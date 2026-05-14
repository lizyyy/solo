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
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">
              <el-icon><View /></el-icon>
              详情
            </el-button>
            <el-button link type="warning" @click="editProgress(row)">
              <el-icon><Edit /></el-icon>
              编辑
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
      width="600px"
    >
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="学员ID" required>
          <el-input v-model="createForm.student_id" placeholder="请输入学员ID" />
        </el-form-item>
        <el-form-item label="学员姓名" required>
          <el-input v-model="createForm.student_name" placeholder="请输入学员姓名" />
        </el-form-item>
        <el-form-item label="课程ID" required>
          <el-input v-model="createForm.course_id" placeholder="请输入课程ID" />
        </el-form-item>
        <el-form-item label="课程名称" required>
          <el-input v-model="createForm.course_name" placeholder="请输入课程名称" />
        </el-form-item>
        <el-form-item label="总体进度">
          <el-slider v-model="createForm.overall_progress" :marks="{0: '0%', 50: '50%', 100: '100%'}" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="createForm.status" placeholder="请选择状态">
            <el-option label="进行中" value="in_progress" />
            <el-option label="已完成" value="completed" />
            <el-option label="已暂停" value="paused" />
          </el-select>
        </el-form-item>
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
import { progressApi } from '@/api'
import { ElMessage } from 'element-plus'

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

const editProgress = (row) => {
  ElMessage.info('编辑功能开发中')
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

const submitCreate = async () => {
  if (!createForm.student_id || !createForm.student_name || !createForm.course_id || !createForm.course_name) {
    ElMessage.warning('请填写必填项')
    return
  }

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
    paused: 'warning'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    in_progress: '进行中',
    completed: '已完成',
    paused: '已暂停'
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
</style>
