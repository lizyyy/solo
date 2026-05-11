<template>
  <div>
    <h2 class="page-title">数据导出</h2>

    <el-card class="card-section">
      <template #header>
        <span>导出选项</span>
      </template>
      <el-form :inline="true" :model="exportFilters" class="mb-20">
        <el-form-item label="开始日期">
          <el-date-picker
            v-model="exportFilters.startDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择开始日期"
          />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker
            v-model="exportFilters.endDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择结束日期"
          />
        </el-form-item>
      </el-form>

      <el-row :gutter="20">
        <el-col :span="8">
          <el-card class="export-card">
            <template #header>
              <div class="flex-between">
                <span><el-icon><Document /></el-icon> 配送批次数据</span>
              </div>
            </template>
            <p>导出配送批次基本信息，包括批次号、配送日期、餐食类型、配送员等字段。</p>
            <el-button type="primary" @click="exportData('batches')" style="width: 100%; margin-top: 16px;">
              导出批次数据
            </el-button>
          </el-card>
        </el-col>

        <el-col :span="8">
          <el-card class="export-card">
            <template #header>
              <div class="flex-between">
                <span><el-icon><TrendCharts /></el-icon> 温度监控数据</span>
              </div>
            </template>
            <p>导出温度监控片段数据，包括片段名称、温度统计、异常状态等信息。</p>
            <el-button type="success" @click="exportData('temperature')" style="width: 100%; margin-top: 16px;">
              导出温度数据
            </el-button>
          </el-card>
        </el-col>

        <el-col :span="8">
          <el-card class="export-card">
            <template #header>
              <div class="flex-between">
                <span><el-icon><Money /></el-icon> 补偿记录数据</span>
              </div>
            </template>
            <p>导出补偿审批记录，包括补偿类型、金额、原因、审批状态等。</p>
            <el-button type="warning" @click="exportData('compensations')" style="width: 100%; margin-top: 16px;">
              导出补偿数据
            </el-button>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px;">
        <el-col :span="8">
          <el-card class="export-card">
            <template #header>
              <div class="flex-between">
                <span><el-icon><Warning /></el-icon> 安全事件数据</span>
              </div>
            </template>
            <p>导出食品安全事件记录，包括事件类型、严重程度、受影响人数等。</p>
            <el-button type="danger" @click="exportData('incidents')" style="width: 100%; margin-top: 16px;">
              导出安全事件
            </el-button>
          </el-card>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
import dayjs from 'dayjs';
import { reportAPI } from '@/api';

const exportFilters = reactive({
  startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
  endDate: dayjs().format('YYYY-MM-DD')
});

const exportData = (type) => {
  let url;
  switch (type) {
    case 'batches':
      url = reportAPI.exportBatches(exportFilters);
      break;
    case 'temperature':
      url = reportAPI.exportTemperature(exportFilters);
      break;
    case 'compensations':
      url = reportAPI.exportCompensations(exportFilters);
      break;
    case 'incidents':
      url = reportAPI.exportIncidents(exportFilters);
      break;
    default:
      return;
  }
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${type}_export_${dayjs().format('YYYYMMDDHHmmss')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>

<style scoped>
.export-card {
  height: 100%;
}
.export-card p {
  color: #909399;
  font-size: 14px;
  line-height: 1.6;
}
</style>
