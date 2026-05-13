<template>
  <div class="volunteer-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>志愿者列表</span>
          <div style="display: flex; gap: 10px;">
            <el-button type="primary" @click="initData">初始化演示数据</el-button>
            <el-button type="success" @click="$router.push('/report')">导出报告</el-button>
          </div>
        </div>
      </template>
      
      <el-table :data="volunteers" border style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="phone" label="手机号" width="150" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'danger'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="viewDetail(row.id)">
              查看详情
            </el-button>
            <el-button type="warning" size="small" @click="viewSubsidy(row.id)">
              补贴记录
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>异常名单</span>
      </template>
      <el-table :data="exceptions" border style="width: 100%">
        <el-table-column prop="volunteer_name" label="姓名" width="120" />
        <el-table-column prop="exception_type" label="异常类型" width="150">
          <template #default="{ row }">
            <el-tag :type="getExceptionTagType(row.exception_type)">
              {{ row.exception_type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleException(row)">
              处理
            </el-button>
            <el-button type="success" size="small" @click="reviewException(row)">
              复核
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'VolunteerList',
  data() {
    return {
      volunteers: [],
      exceptions: []
    }
  },
  mounted() {
    this.loadVolunteers()
    this.loadExceptions()
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
    async loadExceptions() {
      try {
        const res = await axios.get('/api/exceptions')
        this.exceptions = res.data
      } catch (e) {
        console.error(e)
      }
    },
    async initData() {
      try {
        await axios.post('/api/init-demo-data')
        this.$message.success('演示数据初始化成功')
        this.loadVolunteers()
        this.loadExceptions()
      } catch (e) {
        this.$message.error('初始化失败')
      }
    },
    viewDetail(id) {
      this.$router.push(`/volunteer/${id}`)
    },
    viewSubsidy(id) {
      this.$router.push(`/volunteer/${id}?tab=subsidy`)
    },
    async handleException(row) {
      try {
        await axios.put(`/api/exceptions/${row.id}/handle`, {
          handled_by: '当前用户',
          handler_remark: '已处理'
        })
        this.$message.success('处理成功')
        this.loadExceptions()
      } catch (e) {
        this.$message.error('处理失败')
      }
    },
    async reviewException(row) {
      try {
        await axios.put(`/api/exceptions/${row.id}/review`, {
          operator: '当前用户',
          review_result: 'pass'
        })
        this.$message.success('复核通过')
        this.loadExceptions()
      } catch (e) {
        this.$message.error('复核失败')
      }
    },
    getExceptionTagType(type) {
      const types = {
        '考勤异常': 'warning',
        '物资包拦截': 'danger',
        '补贴异常': 'info'
      }
      return types[type] || 'info'
    },
    getStatusType(status) {
      const types = {
        '待处理': 'warning',
        '已处理': 'success',
        '复核通过': 'success',
        '复核驳回': 'danger'
      }
      return types[status] || 'info'
    }
  }
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
