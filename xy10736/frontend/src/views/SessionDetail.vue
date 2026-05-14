<template>
  <div class="detail-page">
    <div class="page-header">
      <el-button @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon>返回
      </el-button>
      <h2 class="page-title">会话详情</h2>
      <el-button type="primary" @click="exportReport">
        <el-icon><Download /></el-icon>导出验收报告
      </el-button>
    </div>

    <el-card v-if="report" class="report-card">
      <h3 class="section-title">验收基本信息</h3>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="版本号">{{ report['验收基本信息']['版本号'] }}</el-descriptions-item>
        <el-descriptions-item label="测试会话ID">{{ report['验收基本信息']['测试会话ID'] }}</el-descriptions-item>
        <el-descriptions-item label="操作人员">{{ report['验收基本信息']['操作人员'] }}</el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ report['验收基本信息']['开始时间'] }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{ report['验收基本信息']['结束时间'] }}</el-descriptions-item>
        <el-descriptions-item label="会话状态">{{ report['验收基本信息']['会话状态'] }}</el-descriptions-item>
      </el-descriptions>

      <h3 class="section-title">验收统计概览</h3>
      <el-row :gutter="20" class="summary-row">
        <el-col :span="6">
          <div class="summary-item">
            <div class="summary-label">应埋点总数</div>
            <div class="summary-value">{{ report['验收统计概览']['应埋点总数'] }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="summary-item success">
            <div class="summary-label">已收到事件数</div>
            <div class="summary-value">{{ report['验收统计概览']['已收到事件数'] }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="summary-item danger">
            <div class="summary-label">漏报事件数</div>
            <div class="summary-value">{{ report['验收统计概览']['漏报事件数'] }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="summary-item" :class="passRate >= 95 ? 'success' : 'warning'">
            <div class="summary-label">通过率</div>
            <div class="summary-value">{{ report['验收统计概览']['通过率'] }}</div>
          </div>
        </el-col>
      </el-row>

      <div class="result-banner" :class="passRate >= 95 ? 'pass' : 'fail'">
        <el-icon size="24"><CircleCheck /></el-icon>
        <span class="result-text">验收结果：{{ report['验收统计概览']['验收结果'] }}</span>
      </div>

      <h3 class="section-title">已收到的埋点事件</h3>
      <el-table :data="report['已收到的埋点事件']" stripe border max-height="400">
        <el-table-column prop="埋点编码" label="埋点编码" width="180" />
        <el-table-column prop="埋点名称" label="埋点名称" width="140" />
        <el-table-column prop="所属页面" label="所属页面" width="120" />
        <el-table-column prop="触发页面" label="触发页面" show-overflow-tooltip />
        <el-table-column prop="用户ID" label="用户ID" width="120" />
        <el-table-column prop="触发时间" label="触发时间" width="180" />
        <el-table-column prop="状态" label="状态" width="100">
          <template #default="{ row }">
            <el-tag type="success" size="small">{{ row['状态'] }}</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <h3 class="section-title">漏报检测记录</h3>
      <el-table :data="report['漏报检测记录']" stripe border max-height="400">
        <el-table-column prop="埋点编码" label="埋点编码" width="180" />
        <el-table-column prop="埋点名称" label="埋点名称" width="140" />
        <el-table-column prop="所属页面" label="所属页面" width="120" />
        <el-table-column prop="检测时间" label="检测时间" width="180" />
        <el-table-column prop="状态" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getDetectionStatusType(row['状态'])" size="small">{{ row['状态'] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="漏报原因" label="漏报原因" show-overflow-tooltip />
        <el-table-column prop="解决方案" label="解决方案" show-overflow-tooltip />
      </el-table>

      <h3 class="section-title">版本复核建议</h3>
      <el-alert
        :title="report['版本复核信息']['复核结论']"
        :description="report['版本复核信息']['建议']"
        :type="passRate >= 95 ? 'success' : 'warning'"
        show-icon
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { reportAPI } from '@/api'

const route = useRoute()
const report = ref(null)
const sessionId = computed(() => route.params.id)

const passRate = computed(() => {
  if (!report.value) return 0
  return parseFloat(report.value['验收统计概览']['通过率'])
})

const loadReport = async () => {
  const res = await reportAPI.getAcceptance(sessionId.value)
  report.value = res.data
}

const exportReport = () => {
  reportAPI.exportExcel(sessionId.value)
  ElMessage.success('导出中...')
}

const getDetectionStatusType = (status) => {
  const map = { '待确认': 'warning', '已确认': 'danger', '已解决': 'success', '已忽略': 'info' }
  return map[status] || 'info'
}

onMounted(loadReport)
</script>

<style scoped>
.detail-page { padding: 0; }
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.page-title { font-size: 24px; color: #303133; margin: 0; }
.report-card { border-radius: 12px; }
.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 24px 0 16px 0;
  padding-left: 12px;
  border-left: 4px solid #409eff;
}
.summary-row { margin-bottom: 20px; }
.summary-item {
  padding: 20px;
  text-align: center;
  background: #f5f7fa;
  border-radius: 8px;
}
.summary-item.success { background: #f0f9ff; }
.summary-item.success .summary-value { color: #67c23a; }
.summary-item.danger { background: #fef0f0; }
.summary-item.danger .summary-value { color: #f56c6c; }
.summary-item.warning { background: #fdf6ec; }
.summary-item.warning .summary-value { color: #e6a23c; }
.summary-label { font-size: 14px; color: #909399; margin-bottom: 8px; }
.summary-value { font-size: 28px; font-weight: 700; color: #303133; }
.result-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-radius: 8px;
  margin-bottom: 24px;
}
.result-banner.pass {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  color: #67c23a;
}
.result-banner.fail {
  background: linear-gradient(135deg, #fef0f0 0%, #fde2e2 100%);
  color: #f56c6c;
}
.result-text { font-size: 18px; font-weight: 600; }
</style>
