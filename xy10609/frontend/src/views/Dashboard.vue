<template>
  <div>
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center">
            <div style="font-size: 40px; color: #409eff">
              <el-icon><document /></el-icon>
            </div>
            <div style="font-size: 24px; font-weight: bold">{{ statistics?.totalMatters || 0 }}</div>
            <div style="color: #909399">办事事项总数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center">
            <div style="font-size: 40px; color: #e6a23c">
              <el-icon><warning /></el-icon>
            </div>
            <div style="font-size: 24px; font-weight: bold">{{ statistics?.unresolvedGaps || 0 }}</div>
            <div style="color: #909399">未解决材料缺口</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center">
            <div style="font-size: 40px; color: #f56c6c">
              <el-icon><circle-close /></el-icon>
            </div>
            <div style="font-size: 24px; font-weight: bold">{{ statistics?.unresolvedExceptions || 0 }}</div>
            <div style="color: #909399">待修复异常</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center">
            <div style="font-size: 40px; color: #67c23a">
              <el-icon><paperclip /></el-icon>
            </div>
            <div style="font-size: 24px; font-weight: bold">{{ statistics?.expiredAttachments || 0 }}</div>
            <div style="color: #909399">过期附件</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>材料缺口类型分布</span>
          </template>
          <el-table :data="statistics?.gapsByType || []" style="width: 100%">
            <el-table-column prop="type" label="缺口类型" />
            <el-table-column prop="count" label="数量" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>材料缺口严重程度分布</span>
          </template>
          <el-table :data="statistics?.gapsBySeverity || []" style="width: 100%">
            <el-table-column prop="severity" label="严重程度" />
            <el-table-column prop="count" label="数量" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { statisticsApi } from '../api'

const statistics = ref(null)

const loadStatistics = async () => {
  try {
    const res = await statisticsApi.getStatistics()
    if (res.data.success) {
      statistics.value = res.data.data
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

onMounted(() => {
  loadStatistics()
})
</script>
