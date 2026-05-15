<template>
  <div>
    <h2 style="margin-bottom: 20px">批量导入</h2>
    
    <el-card shadow="hover" style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: bold; font-size: 16px">上传CSV文件</span>
          <el-button type="primary" size="small" @click="downloadTemplate">下载导入模板</el-button>
        </div>
      </template>
      
      <el-upload
        ref="uploadRef"
        :action="uploadUrl"
        :on-success="handleUploadSuccess"
        :on-error="handleUploadError"
        :before-upload="beforeUpload"
        :show-file-list="false"
        accept=".csv"
        name="file"
        :data="{ operator: '当前用户' }"
      >
        <el-button type="primary">选择CSV文件</el-button>
        <template #tip>
          <div class="el-upload__tip">
            只能上传 csv 文件，建议先下载模板填写后再上传
          </div>
        </template>
      </el-upload>

      <el-progress v-if="uploading" :percentage="uploadPercent" status="active" style="margin-top: 20px" />
    </el-card>

    <el-card shadow="hover">
      <template #header>
        <span style="font-weight: bold; font-size: 16px">导入历史记录</span>
      </template>
      
      <el-table :data="importHistory" style="width: 100%" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="file_name" label="文件名" min-width="200" />
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="total_count" label="总数" width="100" />
        <el-table-column prop="success_count" label="成功" width="100">
          <template #default="scope">
            <span style="color: #67c23a; font-weight: bold">{{ scope.row.success_count }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="fail_count" label="失败" width="100">
          <template #default="scope">
            <span style="color: #f56c6c; font-weight: bold">{{ scope.row.fail_count }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'success' ? 'success' : scope.row.status === 'processing' ? 'warning' : 'danger'" size="small">
              {{ scope.row.status === 'success' ? '成功' : scope.row.status === 'processing' ? '处理中' : '部分失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="导入时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="viewErrors(scope.row)" v-if="scope.row.fail_count > 0">查看错误</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end"
        @size-change="loadImportHistory"
        @current-change="loadImportHistory"
      />
    </el-card>

    <el-dialog v-model="errorDialogVisible" title="导入错误详情" width="600px">
      <el-alert
        v-for="(error, index) in currentErrors"
        :key="index"
        :title="error"
        type="error"
        style="margin-bottom: 10px"
        closable
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';

const uploadRef = ref(null);
const uploadUrl = '/api/imports/articles';
const uploading = ref(false);
const uploadPercent = ref(0);
const importHistory = ref([]);
const errorDialogVisible = ref(false);
const currentErrors = ref([]);
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const beforeUpload = (file) => {
  const isCSV = file.name.toLowerCase().endsWith('.csv');
  if (!isCSV) {
    ElMessage.error('只能上传CSV文件!');
    return false;
  }
  uploading.value = true;
  uploadPercent.value = 10;
  return true;
};

const handleUploadSuccess = (response) => {
  uploading.value = false;
  uploadPercent.value = 100;
  
  if (response.success) {
    const { total, success, fail, errors } = response.data;
    if (fail === 0) {
      ElMessage.success(`导入成功！共导入 ${success} 条记录`);
    } else {
      ElMessage.warning(`导入完成：成功 ${success} 条，失败 ${fail} 条`);
    }
    loadImportHistory();
  } else {
    ElMessage.error(response.message || '导入失败');
  }
};

const handleUploadError = (error) => {
  uploading.value = false;
  uploadPercent.value = 0;
  ElMessage.error('上传失败: ' + error.message);
};

const downloadTemplate = () => {
  window.open('/api/imports/template', '_blank');
};

const loadImportHistory = async () => {
  try {
    const response = await axios.get('/api/imports/history', {
      params: {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize
      }
    });
    if (response.data.success) {
      importHistory.value = response.data.data;
      pagination.value.total = response.data.total;
    }
  } catch (error) {
    console.error('加载导入历史失败:', error);
  }
};

const viewErrors = (row) => {
  try {
    const detail = JSON.parse(row.error_details);
    currentErrors.value = Array.isArray(detail) ? detail : [detail];
    errorDialogVisible.value = true;
  } catch (e) {
    currentErrors.value = [row.error_details];
    errorDialogVisible.value = true;
  }
};

onMounted(() => {
  loadImportHistory();
});
</script>

<style scoped>
.el-upload__tip {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}
</style>
