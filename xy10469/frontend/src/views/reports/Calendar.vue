<template>
  <div class="calendar-report">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>摊位日历</span>
          <div style="display: flex; gap: 12px">
            <el-select v-model="currentYear" style="width: 120px" @change="loadData">
              <el-option v-for="year in yearOptions" :key="year" :label="year + '年'" :value="year" />
            </el-select>
            <el-select v-model="currentMonth" style="width: 120px" @change="loadData">
              <el-option v-for="month in 12" :key="month" :label="month + '月'" :value="month" />
            </el-select>
            <el-button @click="prevMonth">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-button @click="nextMonth">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
        </div>
      </template>

      <div style="display: flex; gap: 20px; margin-bottom: 16px">
        <div style="display: flex; align-items: center; gap: 6px">
          <span style="display: inline-block; width: 12px; height: 12px; background: #e6f7ff; border: 1px solid #91d5ff; border-radius: 2px"></span>
          <span style="font-size: 12px">可用</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px">
          <span style="display: inline-block; width: 12px; height: 12px; background: #f6ffed; border: 1px solid #b7eb8f; border-radius: 2px"></span>
          <span style="font-size: 12px">已预订</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px">
          <span style="display: inline-block; width: 12px; height: 12px; background: #fff7e6; border: 1px solid #ffd591; border-radius: 2px"></span>
          <span style="font-size: 12px">进行中</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px">
          <span style="display: inline-block; width: 12px; height: 12px; background: #fff1f0; border: 1px solid #ffa39e; border-radius: 2px"></span>
          <span style="font-size: 12px">待撤场</span>
        </div>
      </div>

      <el-table :data="calendarData" v-loading="loading" border stripe>
        <el-table-column prop="boothCode" label="摊位编号" width="100" fixed="left" />
        <el-table-column prop="boothName" label="摊位名称" width="120" fixed="left" />
        <el-table-column prop="boothType" label="类型" width="80" fixed="left">
          <template #default="{ row }">
            <el-tag :type="getBoothTypeTag(row.boothType)" size="small">
              {{ getBoothTypeLabel(row.boothType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column 
          v-for="day in monthDays" 
          :key="day" 
          :label="day + '日'" 
          width="90" 
          align="center"
        >
          <template #default="{ row }">
            <div 
              :style="getCellStyle(row, day)"
              style="padding: 4px; border-radius: 4px; font-size: 11px; min-height: 40px; cursor: pointer"
              @click="showDetail(row, day)"
            >
              <div v-if="getDayStatus(row, day) !== 'available'" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                {{ getMerchantName(row, day) }}
              </div>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailVisible" title="日程详情" width="500px">
      <el-form v-if="currentDetail" label-width="100px">
        <el-form-item label="摊位">
          {{ currentDetail.boothCode }} - {{ currentDetail.boothName }}
        </el-form-item>
        <el-form-item label="日期">
          {{ currentYear }}年{{ currentMonth }}月{{ currentDetail.day }}日
        </el-form-item>
        <el-form-item v-if="currentDetail.application" label="商户">
          {{ currentDetail.application.merchantId?.name || '-' }}
        </el-form-item>
        <el-form-item v-if="currentDetail.application" label="档期">
          {{ formatDate(currentDetail.application.startDate) }} ~ {{ formatDate(currentDetail.application.endDate) }}
        </el-form-item>
        <el-form-item v-if="currentDetail.application" label="状态">
          <el-tag :type="getStatusTagType(currentDetail.application.status)">
            {{ getStatusLabel(currentDetail.application.status) }}
          </el-tag>
        </el-form-item>
        <el-form-item v-else label="状态">
          <el-tag type="info">空闲可用</el-tag>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { reportApi } from '@/api';
import { formatDate, boothTypeMap, applicationStatusMap } from '@/utils/format';

const loading = ref(false);
const calendarData = ref([]);
const detailVisible = ref(false);
const currentDetail = ref(null);

const now = new Date();
const currentYear = ref(now.getFullYear());
const currentMonth = ref(now.getMonth() + 1);

const yearOptions = computed(() => {
  const years = [];
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
    years.push(y);
  }
  return years;
});

const monthDays = computed(() => {
  const daysInMonth = new Date(currentYear.value, currentMonth.value, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }
  return days;
});

const getBoothTypeTag = (type) => {
  const map = { food: 'danger', cultural: 'success', promotion: 'warning' };
  return map[type] || 'info';
};

const getBoothTypeLabel = (type) => {
  return boothTypeMap[type] || type;
};

const getStatusTagType = (status) => {
  const map = {
    pending: 'warning',
    approved: 'success',
    in_progress: 'primary',
    admission: 'primary',
    completed: 'info'
  };
  return map[status] || 'info';
};

const getStatusLabel = (status) => {
  return applicationStatusMap[status] || status;
};

const getDayStatus = (row, day) => {
  const dayDate = new Date(currentYear.value, currentMonth.value - 1, day);
  dayDate.setHours(0, 0, 0, 0);
  
  if (!row.applications || row.applications.length === 0) return 'available';
  
  for (const app of row.applications) {
    const startDate = new Date(app.startDate);
    const endDate = new Date(app.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    if (dayDate >= startDate && dayDate <= endDate) {
      return app.status;
    }
  }
  return 'available';
};

const getMerchantName = (row, day) => {
  const dayDate = new Date(currentYear.value, currentMonth.value - 1, day);
  dayDate.setHours(0, 0, 0, 0);
  
  if (!row.applications) return '';
  
  for (const app of row.applications) {
    const startDate = new Date(app.startDate);
    const endDate = new Date(app.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    if (dayDate >= startDate && dayDate <= endDate) {
      return app.merchantId?.name?.substring(0, 4) || '';
    }
  }
  return '';
};

const getCellStyle = (row, day) => {
  const status = getDayStatus(row, day);
  const styles = {
    available: { background: '#e6f7ff', borderColor: '#91d5ff' },
    pending: { background: '#fff7e6', borderColor: '#ffd591' },
    approved: { background: '#f6ffed', borderColor: '#b7eb8f' },
    in_progress: { background: '#f6ffed', borderColor: '#52c41a' },
    admission: { background: '#f6ffed', borderColor: '#52c41a' },
    completed: { background: '#f5f5f5', borderColor: '#d9d9d9' }
  };
  return styles[status] || styles.available;
};

const showDetail = (row, day) => {
  const dayDate = new Date(currentYear.value, currentMonth.value - 1, day);
  dayDate.setHours(0, 0, 0, 0);
  
  let application = null;
  if (row.applications) {
    for (const app of row.applications) {
      const startDate = new Date(app.startDate);
      const endDate = new Date(app.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      if (dayDate >= startDate && dayDate <= endDate) {
        application = app;
        break;
      }
    }
  }
  
  currentDetail.value = {
    boothCode: row.boothCode,
    boothName: row.boothName,
    day,
    application
  };
  detailVisible.value = true;
};

const prevMonth = () => {
  if (currentMonth.value === 1) {
    currentMonth.value = 12;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
  loadData();
};

const nextMonth = () => {
  if (currentMonth.value === 12) {
    currentMonth.value = 1;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
  loadData();
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await reportApi.getBoothCalendar({
      year: currentYear.value,
      month: currentMonth.value
    });
    calendarData.value = res.data || [];
  } catch (error) {
    console.error('加载日历数据失败:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.calendar-report {
  height: 100%;
}
</style>
