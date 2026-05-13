<template>
  <div class="reports">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>报表导出</span>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="核销记录报表" name="verifications">
          <el-form :inline="true" :model="verificationForm" class="search-form">
            <el-form-item label="开始日期">
              <el-date-picker v-model="verificationForm.start_date" type="date" value-format="YYYY-MM-DD" />
            </el-form-item>
            <el-form-item label="结束日期">
              <el-date-picker v-model="verificationForm.end_date" type="date" value-format="YYYY-MM-DD" />
            </el-form-item>
            <el-form-item label="经办人">
              <el-input v-model="verificationForm.handler" placeholder="经办人" clearable />
            </el-form-item>
            <el-form-item label="仅显示异常">
              <el-checkbox v-model="verificationForm.has_exception" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="exportVerifications">
                <el-icon><Download /></el-icon>
                导出Excel
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="异常记录报表" name="exceptions">
          <el-form :inline="true" :model="exceptionForm" class="search-form">
            <el-form-item label="开始日期">
              <el-date-picker v-model="exceptionForm.start_date" type="date" value-format="YYYY-MM-DD" />
            </el-form-item>
            <el-form-item label="结束日期">
              <el-date-picker v-model="exceptionForm.end_date" type="date" value-format="YYYY-MM-DD" />
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="exceptionForm.status" placeholder="状态" clearable>
                <el-option label="待处理" value="pending" />
                <el-option label="已解决" value="resolved" />
              </el-select>
            </el-form-item>
            <el-form-item label="修正人">
              <el-input v-model="exceptionForm.corrected_by" placeholder="修正人" clearable />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="exportExceptions">
                <el-icon><Download /></el-icon>
                导出Excel
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="车辆里程报表" name="vehicles">
          <el-form :inline="true" :model="vehicleForm" class="search-form">
            <el-form-item label="负责人">
              <el-input v-model="vehicleForm.responsible_person" placeholder="负责人" clearable />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="exportVehicles">
                <el-icon><Download /></el-icon>
                导出Excel
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const activeTab = ref('verifications');

const verificationForm = reactive({
  start_date: '',
  end_date: '',
  handler: '',
  has_exception: false
});

const exceptionForm = reactive({
  start_date: '',
  end_date: '',
  status: '',
  corrected_by: ''
});

const vehicleForm = reactive({
  responsible_person: ''
});

const exportVerifications = async () => {
  try {
    const params = {
      start_date: verificationForm.start_date,
      end_date: verificationForm.end_date,
      handler: verificationForm.handler,
      has_exception: verificationForm.has_exception
    };
    
    const res = await axios.get('/api/reports/verifications', {
      params,
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `verification_report_${new Date().getTime()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    ElMessage.success('导出成功');
  } catch (err) {
    ElMessage.error('导出失败');
  }
};

const exportExceptions = async () => {
  try {
    const params = {
      start_date: exceptionForm.start_date,
      end_date: exceptionForm.end_date,
      status: exceptionForm.status,
      corrected_by: exceptionForm.corrected_by
    };
    
    const res = await axios.get('/api/reports/exceptions', {
      params,
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `exception_report_${new Date().getTime()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    ElMessage.success('导出成功');
  } catch (err) {
    ElMessage.error('导出失败');
  }
};

const exportVehicles = async () => {
  try {
    const params = {
      responsible_person: vehicleForm.responsible_person
    };
    
    const res = await axios.get('/api/reports/vehicles', {
      params,
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vehicle_report_${new Date().getTime()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    ElMessage.success('导出成功');
  } catch (err) {
    ElMessage.error('导出失败');
  }
};
</script>

<style scoped>
.reports {
  padding: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-form {
  margin: 20px 0;
}
</style>
