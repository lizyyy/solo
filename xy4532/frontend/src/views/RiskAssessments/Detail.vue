<template>
  <div class="assessment-detail-container">
    <el-page-header @back="goBack" content="风险评估详情">
      <template #extra>
        <el-button type="primary" @click="handleReassess" :loading="reassessing">
          <el-icon><Refresh /></el-icon>
          重新评估
        </el-button>
      </template>
    </el-page-header>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <span class="card-title">基本信息</span>
          </template>
          
          <el-descriptions :column="2" border>
            <el-descriptions-item label="评估ID">{{ assessmentData?.assessment?.id }}</el-descriptions-item>
            <el-descriptions-item label="最终风险等级">
              <el-tag :type="getRiskTagType(assessmentData?.assessment?.final_risk_level)" size="large">
                {{ assessmentData?.assessment?.final_risk_level }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="最终风险评分">
              <span :style="{ color: getRiskLevelColor(assessmentData?.assessment?.final_risk_level), fontWeight: 'bold', fontSize: '18px' }">
                {{ (assessmentData?.assessment?.final_risk_score * 100).toFixed(1) }}%
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="检测类型">
              {{ assessmentData?.assessment?.ai_detection_type || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="风机编号">
              {{ assessmentData?.turbine?.turbine_id || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="风机名称">
              {{ assessmentData?.turbine?.name || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="叶片编号">
              {{ assessmentData?.blade?.blade_number ? assessmentData.blade.blade_number + '号叶片' : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="照片位置">
              <template v-if="assessmentData?.photo">
                {{ getSegmentName(assessmentData.photo.segment) }}
                <span v-if="assessmentData.photo.distance_from_root">
                  (距叶根 {{ assessmentData.photo.distance_from_root }} 米)
                </span>
              </template>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="评估时间" :span="2">
              {{ formatDate(assessmentData?.assessment?.created_at) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="hover" style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <span class="card-title">AI 评估结果</span>
              <el-tag v-if="assessmentData?.assessment?.manual_override" type="warning">
                已人工改判
              </el-tag>
            </div>
          </template>
          
          <el-descriptions :column="2" border>
            <el-descriptions-item label="AI风险等级">
              <el-tag :type="getRiskTagType(assessmentData?.assessment?.ai_risk_level)">
                {{ assessmentData?.assessment?.ai_risk_level }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="AI风险评分">
              {{ (assessmentData?.assessment?.ai_risk_score * 100).toFixed(1) }}%
            </el-descriptions-item>
            <el-descriptions-item label="AI置信度">
              {{ assessmentData?.assessment?.ai_confidence ? (assessmentData.assessment.ai_confidence * 100).toFixed(1) + '%' : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="AI描述" :span="2">
              {{ assessmentData?.assessment?.ai_description || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card 
          v-if="assessmentData?.assessment?.manual_override" 
          shadow="hover" 
          style="margin-top: 20px"
        >
          <template #header>
            <span class="card-title" style="color: #e6a23c">人工改判记录</span>
          </template>
          
          <el-descriptions :column="2" border>
            <el-descriptions-item label="改判后风险等级">
              <el-tag :type="getRiskTagType(assessmentData?.assessment?.manual_risk_level)" size="large">
                {{ assessmentData?.assessment?.manual_risk_level }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="判定人">
              {{ assessmentData?.assessment?.manual_judge || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="改判时间">
              {{ formatDate(assessmentData?.assessment?.manual_time) }}
            </el-descriptions-item>
            <el-descriptions-item label="改判原因" :span="2">
              {{ assessmentData?.assessment?.manual_reason || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="hover" style="margin-top: 20px">
          <template #header>
            <span class="card-title">相关图片</span>
          </template>
          
          <div class="photo-preview" v-if="assessmentData?.photo">
            <el-image
              :src="getPhotoUrl(assessmentData.photo.file_path)"
              :preview-src-list="[getPhotoUrl(assessmentData.photo.file_path)]"
              fit="contain"
              style="width: 100%; max-height: 400px"
            />
            <div class="photo-info">
              <span>文件名: {{ assessmentData.photo.file_name }}</span>
            </div>
          </div>
          <el-empty v-else description="暂无图片" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <span class="card-title">人工改判</span>
          </template>
          
          <el-form :model="judgmentForm" :rules="judgmentRules" ref="judgmentFormRef" label-width="100px">
            <el-form-item label="风险等级" prop="manual_risk_level">
              <el-select v-model="judgmentForm.manual_risk_level" placeholder="请选择风险等级" style="width: 100%">
                <el-option label="严重" value="严重">
                  <span style="color: #f56c6c; font-weight: bold">严重</span>
                </el-option>
                <el-option label="高" value="高">
                  <span style="color: #e6a23c; font-weight: bold">高</span>
                </el-option>
                <el-option label="中" value="中">
                  <span style="color: #409eff; font-weight: bold">中</span>
                </el-option>
                <el-option label="低" value="低">
                  <span style="color: #67c23a; font-weight: bold">低</span>
                </el-option>
              </el-select>
            </el-form-item>
            
            <el-form-item label="改判原因" prop="manual_reason">
              <el-input
                v-model="judgmentForm.manual_reason"
                type="textarea"
                :rows="4"
                placeholder="请输入改判原因"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>
            
            <el-form-item label="判定人">
              <el-input v-model="judgmentForm.judge_name" placeholder="请输入判定人姓名（可选）" />
            </el-form-item>
            
            <el-form-item>
              <el-button 
                type="primary" 
                @click="handleSubmitJudgment" 
                :loading="submitting"
                style="width: 100%"
              >
                <el-icon><Check /></el-icon>
                提交改判
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="hover" style="margin-top: 20px">
          <template #header>
            <span class="card-title">关联告警</span>
          </template>
          
          <div v-if="assessmentData?.related_alarm" class="related-item">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="告警代码">
                {{ assessmentData.related_alarm.alarm_code }}
              </el-descriptions-item>
              <el-descriptions-item label="告警名称">
                {{ assessmentData.related_alarm.alarm_name }}
              </el-descriptions-item>
              <el-descriptions-item label="严重程度">
                <el-tag :type="getSeverityTagType(assessmentData.related_alarm.severity)" size="small">
                  {{ assessmentData.related_alarm.severity }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="assessmentData.related_alarm.is_active ? 'danger' : 'success'" size="small">
                  {{ assessmentData.related_alarm.is_active ? '活跃' : '已解决' }}
                </el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
          <el-empty v-else description="暂无关联告警" :image-size="60" />
        </el-card>

        <el-card shadow="hover" style="margin-top: 20px">
          <template #header>
            <span class="card-title">关联工单</span>
          </template>
          
          <div v-if="assessmentData?.related_work_order" class="related-item">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="工单编号">
                {{ assessmentData.related_work_order.work_order_id }}
              </el-descriptions-item>
              <el-descriptions-item label="问题类型">
                {{ assessmentData.related_work_order.issue_type }}
              </el-descriptions-item>
              <el-descriptions-item label="优先级">
                <el-tag :type="getPriorityTagType(assessmentData.related_work_order.priority)" size="small">
                  {{ assessmentData.related_work_order.priority }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="getStatusTagType(assessmentData.related_work_order.status)" size="small">
                  {{ assessmentData.related_work_order.status }}
                </el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
          <el-empty v-else description="暂无关联工单" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { getRiskAssessment, submitManualJudgment, reassessRisk } from '@/api/risk_assessments'
import { getRiskLevelColor, type RiskLevel } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const submitting = ref(false)
const reassessing = ref(false)
const judgmentFormRef = ref<FormInstance>()

const assessmentData = ref<any>(null)

const judgmentForm = reactive({
  manual_risk_level: undefined as RiskLevel | undefined,
  manual_reason: '',
  judge_name: '',
})

const judgmentRules: FormRules = {
  manual_risk_level: [{ required: true, message: '请选择风险等级', trigger: 'change' }],
  manual_reason: [{ required: true, message: '请输入改判原因', trigger: 'blur' }],
}

const getRiskTagType = (level?: string) => {
  const typeMap: Record<string, string> = {
    '严重': 'danger',
    '高': 'warning',
    '中': 'primary',
    '低': 'success',
  }
  return typeMap[level || ''] || 'info'
}

const getSeverityTagType = (severity?: string) => {
  const typeMap: Record<string, string> = {
    '严重': 'danger',
    '高': 'warning',
    '中': 'primary',
    '低': 'success',
  }
  return typeMap[severity || ''] || 'info'
}

const getPriorityTagType = (priority?: string) => {
  const typeMap: Record<string, string> = {
    '紧急': 'danger',
    '高': 'warning',
    '中': 'primary',
    '低': 'success',
  }
  return typeMap[priority || ''] || 'info'
}

const getStatusTagType = (status?: string) => {
  const typeMap: Record<string, string> = {
    '待处理': 'warning',
    '处理中': 'primary',
    '已完成': 'success',
  }
  return typeMap[status || ''] || 'info'
}

const getSegmentName = (segment?: string) => {
  const nameMap: Record<string, string> = {
    'LE': '前缘',
    'TE': '后缘',
    'PS': '压力面',
    'SS': '吸力面',
    'tip': '叶尖',
    'root': '叶根',
    'mid': '中段',
  }
  return nameMap[segment || ''] || segment || '未知'
}

const formatDate = (date?: string) => {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const getPhotoUrl = (filePath?: string) => {
  if (!filePath) return ''
  return filePath.replace(/^.*uploads\//, '/uploads/')
}

const goBack = () => {
  router.back()
}

const fetchAssessmentDetail = async () => {
  const id = route.params.id
  if (!id) return
  
  loading.value = true
  try {
    const result = await getRiskAssessment(Number(id))
    assessmentData.value = result
  } catch (error: any) {
    ElMessage.error(error.message || '获取评估详情失败')
  } finally {
    loading.value = false
  }
}

const handleSubmitJudgment = async () => {
  if (!judgmentFormRef.value) return
  
  await judgmentFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        await submitManualJudgment({
          assessment_id: Number(route.params.id),
          manual_risk_level: judgmentForm.manual_risk_level!,
          manual_reason: judgmentForm.manual_reason,
          judge_name: judgmentForm.judge_name || undefined,
        })
        ElMessage.success('改判成功')
        fetchAssessmentDetail()
      } catch (error: any) {
        ElMessage.error(error.message || '提交改判失败')
      } finally {
        submitting.value = false
      }
    }
  })
}

const handleReassess = async () => {
  reassessing.value = true
  try {
    const result = await reassessRisk(Number(route.params.id), {
      include_alarms: true,
      include_work_orders: true,
    })
    
    if (result.was_manually_overridden) {
      ElMessage.warning('该评估已被人工改判，跳过重新评估')
    } else {
      ElMessage.success('重新评估完成')
      fetchAssessmentDetail()
    }
  } catch (error: any) {
    ElMessage.error(error.message || '重新评估失败')
  } finally {
    reassessing.value = false
  }
}

onMounted(() => {
  fetchAssessmentDetail()
})
</script>

<style scoped>
.assessment-detail-container {
  min-height: 100%;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.photo-preview {
  text-align: center;
}

.photo-info {
  margin-top: 12px;
  padding: 8px 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-size: 14px;
  color: #606266;
}

.related-item {
  padding: 8px 0;
}
</style>
