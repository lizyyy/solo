<template>
  <div>
    <h2 style="margin-bottom: 20px">数据概览</h2>
    
    <el-row :gutter="20" style="margin-bottom: 30px">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon" style="background: #409eff">
              <el-icon><TrendCharts /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ statistics.avgUtilization || 0 }}%</div>
              <div class="stat-label">平均利用率</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon" style="background: #67c23a">
              <el-icon><Calendar /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ statistics.totalBookings || 0 }}</div>
              <div class="stat-label">预订总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon" style="background: #e6a23c">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ statistics.faultCount || 0 }}</div>
              <div class="stat-label">待处理故障</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon" style="background: #f56c6c">
              <el-icon><Bell /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ statistics.pendingAnomalyCount || 0 }}</div>
              <div class="stat-label">待处理异常</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>各会议室利用率</span>
            </div>
          </template>
          <el-table :data="utilizationDetails" style="width: 100%">
            <el-table-column prop="room_name" label="会议室" />
            <el-table-column prop="bookingCount" label="预订次数" />
            <el-table-column prop="actualUsedHours" label="使用时长(h)" />
            <el-table-column prop="utilizationRate" label="利用率(%)">
              <template #default="{ row }">
                <el-tag :type="parseFloat(row.utilizationRate) > 60 ? 'success' : 'warning'">
                  {{ row.utilizationRate }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="releaseRate" label="释放率(%)" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>待处理事项</span>
          </template>
          <el-steps direction="vertical" :active="2">
            <el-step title="茶水服务待处理" :description="`${statistics.pendingTeaCount || 0} 项待处理`" />
            <el-step title="故障工单待处理" :description="`${statistics.faultCount || 0} 项待处理`" />
            <el-step title="异常事项待处理" :description="`${statistics.pendingAnomalyCount || 0} 项待处理`" />
          </el-steps>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getStatistics } from '../api'
import { TrendCharts, Calendar, Warning, Bell } from '@element-plus/icons-vue'

const statistics = ref({})
const utilizationDetails = ref([])

const loadData = async () => {
  try {
    const res = await getStatistics()
    statistics.value = res.data
    utilizationDetails.value = res.data.utilizationDetails || []
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 28px;
  margin-right: 15px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}
</style>
