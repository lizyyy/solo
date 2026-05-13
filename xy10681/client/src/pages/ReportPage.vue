<template>
  <div class="report-page">
    <el-page-header @back="$router.push('/')" title="报告导出" />
    
    <el-card style="margin-top: 20px;">
      <template #header>
        <span>筛选条件</span>
      </template>
      <el-form :model="filters" :inline="true" label-width="100px">
        <el-form-item label="志愿者">
          <el-select v-model="filters.volunteer_id" placeholder="全部" style="width: 150px" clearable>
            <el-option v-for="v in volunteers" :key="v.id" :label="v.name" :value="v.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="责任人">
          <el-input v-model="filters.operator" placeholder="操作人" style="width: 150px" />
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="filters.start_date" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="filters.end_date" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="exportReport">导出Excel报告</el-button>
          <el-button @click="loadAuditLogs">查询修改记录</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>操作时间线预览</span>
      </template>
      <el-table :data="timelinePreview" border style="width: 100%">
        <el-table-column prop="volunteer_name" label="志愿者" width="120" />
        <el-table-column prop="action" label="操作类型" width="150" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="operator" label="责任人" width="120" />
        <el-table-column prop="operate_time" label="操作时间" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>修改记录审计</span>
      </template>
      <el-table :data="auditLogs" border style="width: 100%">
        <el-table-column prop="module" label="模块" width="150">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ row.module }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="field_name" label="字段名" width="150" />
        <el-table-column prop="old_value" label="修改前" />
        <el-table-column prop="new_value" label="修改后" />
        <el-table-column prop="operation" label="操作类型" width="100" />
        <el-table-column prop="operator" label="责任人" width="120" />
        <el-table-column prop="operate_time" label="操作时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'ReportPage',
  data() {
    return {
      volunteers: [],
      filters: {
        volunteer_id: null,
        operator: '',
        start_date: '',
        end_date: ''
      },
      timelinePreview: [],
      auditLogs: []
    }
  },
  mounted() {
    this.loadVolunteers()
    this.loadTimelinePreview()
    this.loadAuditLogs()
  },
  methods: {
    async loadVolunteers() {
      try {
        const res = await axios.get('/api/volunteers')
        this.volunteers = res.data
      } catch (e) {
        console.error(e)
      }
    },
    async loadTimelinePreview() {
      try {
        const res = await axios.get('/api/timeline/1')
        this.timelinePreview = res.data
      } catch (e) {
        console.error(e)
      }
    },
    async loadAuditLogs() {
      try {
        const res = await axios.get('/api/audit-logs', { params: this.filters })
        this.auditLogs = res.data
      } catch (e) {
        console.error(e)
      }
    },
    exportReport() {
      const params = new URLSearchParams()
      if (this.filters.volunteer_id) params.append('volunteer_id', this.filters.volunteer_id)
      if (this.filters.operator) params.append('operator', this.filters.operator)
      if (this.filters.start_date) params.append('start_date', this.filters.start_date)
      if (this.filters.end_date) params.append('end_date', this.filters.end_date)
      
      window.open(`/api/report/export?${params.toString()}`, '_blank')
      this.$message.success('正在生成报告，请稍候...')
    },
    getStatusType(status) {
      const types = {
        '已审核': 'success',
        '已发放': 'success',
        '已签到': 'primary',
        '已签退': 'primary',
        '已排班': 'info',
        '待处理': 'warning',
        '已处理': 'success',
        '已拦截': 'danger'
      }
      return types[status] || 'info'
    }
  }
}
</script>

<style scoped>
.report-page {
  padding-bottom: 20px;
}
</style>
