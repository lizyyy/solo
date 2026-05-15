<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>材料预审补正计算</span>
          <el-button type="primary" @click="calculateGaps" :loading="calculating">
            开始计算
          </el-button>
        </div>
      </template>

      <el-alert
        title="计算说明"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <p>系统将根据以下条件自动计算材料缺口：</p>
        <ul>
          <li><strong>附件效期检查：</strong>有效期不足30天标记为即将过期，已过期标记为已过期</li>
          <li><strong>补正意见检查：</strong>状态为"pending"的补正意见将被标记</li>
          <li><strong>窗口受理检查：</strong>状态为"rejected"或"incomplete"的受理记录将被标记</li>
        </ul>
      </el-alert>

      <div v-if="result">
        <el-row :gutter="20" style="margin-bottom: 20px;">
          <el-col :span="6">
            <el-statistic title="总缺口数" :value="result.total_gaps">
              <template #suffix>个</template>
            </el-statistic>
          </el-col>
          <el-col :span="6">
            <el-statistic title="附件已过期" :value="result.summary.expired" value-color="#f56c6c">
              <template #suffix>个</template>
            </el-statistic>
          </el-col>
          <el-col :span="6">
            <el-statistic title="附件即将过期" :value="result.summary.expiring_soon" value-color="#e6a23c">
              <template #suffix>个</template>
            </el-statistic>
          </el-col>
          <el-col :span="6">
            <el-statistic title="待处理补正意见" :value="result.summary.correction_pending" value-color="#409eff">
              <template #suffix>个</template>
            </el-statistic>
          </el-col>
        </el-row>

        <el-alert
          title="计算完成时间"
          :description="result.calculated_at"
          type="success"
          :closable="false"
          style="margin-bottom: 20px;"
        />

        <h3 style="margin-bottom: 15px;">材料缺口详情</h3>
        <el-table :data="result.gaps" style="width: 100%;">
          <el-table-column prop="gap_type" label="缺口类型" width="180">
            <template #default="{ row }">
              <el-tag :type="getGapTypeColor(row.gap_type)">
                {{ getGapTypeText(row.gap_type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="gap_description" label="缺口描述" min-width="300" />
          <el-table-column prop="severity" label="严重程度" width="120">
            <template #default="{ row }">
              <el-tag :type="row.severity === 'high' ? 'danger' : row.severity === 'medium' ? 'warning' : 'success'">
                {{ row.severity === 'high' ? '高' : row.severity === 'medium' ? '中' : '低' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="处理">
            <template #default>
              <el-button size="small" type="primary">查看详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { preReviewApi } from '../api'
import { ElMessage } from 'element-plus'

const calculating = ref(false)
const result = ref(null)

const calculateGaps = async () => {
  calculating.value = true
  try {
    const res = await preReviewApi.calculate({ auto_create: true, handler: 'admin' })
    if (res.data.success) {
      result.value = res.data.data
      ElMessage.success(`计算完成，共发现 ${res.data.data.total_gaps} 个材料缺口`)
    }
  } catch (error) {
    ElMessage.error('计算失败')
    console.error(error)
  } finally {
    calculating.value = false
  }
}

const getGapTypeText = (type) => {
  const map = {
    'attachment_expired': '附件已过期',
    'attachment_expiring_soon': '附件即将过期',
    'correction_pending': '补正意见待处理',
    'window_rejected': '窗口受理驳回/不全',
    'material_missing': '材料缺失'
  }
  return map[type] || type
}

const getGapTypeColor = (type) => {
  const map = {
    'attachment_expired': 'danger',
    'attachment_expiring_soon': 'warning',
    'correction_pending': 'info',
    'window_rejected': 'danger',
    'material_missing': 'warning'
  }
  return map[type] || 'info'
}
</script>
