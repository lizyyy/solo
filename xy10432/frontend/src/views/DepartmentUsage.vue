<template>
  <div class="department-usage-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>当天科室负载报表</span>
          <div>
            <el-date-picker
              v-model="selectedDate"
              type="date"
              placeholder="选择日期"
              value-format="YYYY-MM-DD"
              style="width: 200px; margin-right: 10px;"
              @change="loadUsage"
            />
            <el-button type="primary" @click="loadUsage">查询</el-button>
          </div>
        </div>
      </template>
      
      <el-row :gutter="20" style="margin-bottom: 20px;">
        <el-col :span="6">
          <el-statistic title="当日预约总数" :value="totalAppointments">
            <template #suffix>
              人次
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="总容量" :value="totalCapacity" suffix="人次" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="总使用量" :value="totalUsage" suffix="人次" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="剩余容量" :value="totalRemaining" suffix="人次" />
        </el-col>
      </el-row>
      
      <el-table :data="usageList" style="width: 100%;" v-loading="loading">
        <el-table-column prop="department_name" label="科室名称" width="150" />
        <el-table-column prop="daily_capacity" label="日容量" width="100" />
        <el-table-column prop="usage_count" label="当前使用" width="100" />
        <el-table-column prop="remaining_capacity" label="剩余容量" width="100" />
        <el-table-column label="使用率" width="200">
          <template #default="scope">
            <el-progress 
              :percentage="getUsagePercentage(scope.row)" 
              :status="getProgressStatus(scope.row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getUsageStatusType(scope.row)">
              {{ getUsageStatusText(scope.row) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      
      <div style="margin-top: 40px;">
        <h3 style="margin-bottom: 20px;">容量分布</h3>
        <el-row :gutter="20">
          <el-col :span="12" v-for="item in usageList" :key="item.department_id" style="margin-bottom: 20px;">
            <el-card shadow="hover">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong>{{ item.department_name }}</strong>
                <el-tag :type="getUsageStatusType(item)">
                  {{ getUsageStatusText(item) }}
                </el-tag>
              </div>
              <el-progress 
                :percentage="getUsagePercentage(item)" 
                :status="getProgressStatus(item)"
                :stroke-width="20"
              />
              <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 14px; color: #666;">
                <span>已用：{{ item.usage_count }} 人次</span>
                <span>容量：{{ item.daily_capacity }} 人次</span>
                <span>剩余：{{ item.remaining_capacity }} 人次</span>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { departmentApi } from '../api'

const loading = ref(false)
const selectedDate = ref(new Date().toISOString().split('T')[0])
const usageList = ref([])

const totalAppointments = computed(() => {
  return usageList.value.reduce((sum, item) => sum + item.usage_count, 0)
})

const totalCapacity = computed(() => {
  return usageList.value.reduce((sum, item) => sum + item.daily_capacity, 0)
})

const totalUsage = computed(() => {
  return usageList.value.reduce((sum, item) => sum + item.usage_count, 0)
})

const totalRemaining = computed(() => {
  return usageList.value.reduce((sum, item) => sum + Math.max(0, item.remaining_capacity), 0)
})

const getUsagePercentage = (item) => {
  if (item.daily_capacity === 0) return 0
  return Math.round((item.usage_count / item.daily_capacity) * 100)
}

const getProgressStatus = (item) => {
  const percentage = getUsagePercentage(item)
  if (percentage >= 100) return 'exception'
  if (percentage >= 80) return 'warning'
  return ''
}

const getUsageStatusType = (item) => {
  const percentage = getUsagePercentage(item)
  if (percentage >= 100) return 'danger'
  if (percentage >= 80) return 'warning'
  return 'success'
}

const getUsageStatusText = (item) => {
  const percentage = getUsagePercentage(item)
  if (percentage >= 100) return '已满'
  if (percentage >= 80) return '紧张'
  if (percentage >= 50) return '正常'
  return '宽松'
}

const loadUsage = async () => {
  loading.value = true
  try {
    const res = await departmentApi.getUsage(selectedDate.value)
    usageList.value = res.data
  } catch (error) {
    console.error('加载科室负载失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadUsage()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
