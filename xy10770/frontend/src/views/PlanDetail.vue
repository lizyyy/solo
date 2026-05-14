<template>
  <div class="plan-detail">
    <el-button @click="goBack" style="margin-bottom: 20px;">
      <i class="el-icon-arrow-left"></i> 返回列表
    </el-button>

    <el-card v-loading="loading" shadow="hover">
      <div slot="header">
        <span style="font-size: 18px; font-weight: bold;">压测计划详情</span>
        <el-tag :type="getStatusTagType(plan.status)" style="margin-left: 10px;">
          {{ getStatusText(plan.status) }}
        </el-tag>
      </div>

      <el-descriptions title="基本信息" border :column="3">
        <el-descriptions-item label="ID">{{ plan.id }}</el-descriptions-item>
        <el-descriptions-item label="计划名称">{{ plan.name }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ plan.version }}</el-descriptions-item>
        <el-descriptions-item label="API名称">{{ plan.api_name }}</el-descriptions-item>
        <el-descriptions-item label="API地址">{{ plan.api_url }}</el-descriptions-item>
        <el-descriptions-item label="请求方法">
          <el-tag :type="getMethodTagType(plan.method)" size="small">{{ plan.method }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建人">{{ plan.created_by }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(plan.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="审批人">{{ plan.approved_by || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider></el-divider>

      <h3 style="margin-bottom: 15px;">
        <i class="el-icon-s-order"></i> 并发阶梯配置
      </h3>
      <el-table :data="plan.concurrency_steps || []" border stripe size="small">
        <el-table-column prop="step_order" label="阶梯顺序" width="100"></el-table-column>
        <el-table-column prop="concurrent_users" label="并发用户数" width="120"></el-table-column>
        <el-table-column prop="duration_seconds" label="持续时间(秒)" width="120"></el-table-column>
        <el-table-column prop="ramp_up_seconds" label="爬升时间(秒)" width="120"></el-table-column>
        <el-table-column prop="target_qps" label="目标QPS" width="100"></el-table-column>
        <el-table-column prop="actual_qps" label="实际QPS" width="100"></el-table-column>
      </el-table>

      <el-divider></el-divider>

      <h3 style="margin-bottom: 15px;">
        <i class="el-icon-data-analysis"></i> 响应分位数据
      </h3>
      <el-table :data="plan.response_percentiles || []" border stripe size="small">
        <el-table-column prop="p50" label="P50(ms)" width="100"></el-table-column>
        <el-table-column prop="p75" label="P75(ms)" width="100"></el-table-column>
        <el-table-column prop="p90" label="P90(ms)" width="100"></el-table-column>
        <el-table-column prop="p95" label="P95(ms)" width="100"></el-table-column>
        <el-table-column prop="p99" label="P99(ms)" width="100"></el-table-column>
        <el-table-column prop="p999" label="P999(ms)" width="100"></el-table-column>
        <el-table-column prop="avg_response_time" label="平均响应(ms)" width="120"></el-table-column>
        <el-table-column prop="total_requests" label="总请求数" width="100"></el-table-column>
        <el-table-column prop="success_requests" label="成功数" width="100"></el-table-column>
        <el-table-column prop="failed_requests" label="失败数" width="100"></el-table-column>
      </el-table>

      <el-divider></el-divider>

      <h3 style="margin-bottom: 15px;">
        <i class="el-icon-warning-outline"></i> 错误分布
        <el-badge :value="anomalyCount" class="item" type="danger" style="margin-left: 10px;"></el-badge>
      </h3>
      <el-table :data="plan.error_distributions || []" border stripe size="small">
        <el-table-column prop="error_type" label="错误类型" width="120"></el-table-column>
        <el-table-column prop="error_code" label="错误码" width="100"></el-table-column>
        <el-table-column prop="error_message" label="错误信息" min-width="200" show-overflow-tooltip></el-table-column>
        <el-table-column prop="count" label="数量" width="80"></el-table-column>
        <el-table-column prop="percentage" label="占比(%)" width="100"></el-table-column>
        <el-table-column prop="is_anomaly" label="异常标记" width="100">
          <template slot-scope="scope">
            <el-tag v-if="scope.row.is_anomaly" type="danger" size="small">是</el-tag>
            <el-tag v-else type="success" size="small">否</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="anomaly_reason" label="异常原因" min-width="150" show-overflow-tooltip></el-table-column>
        <el-table-column label="操作" width="150">
          <template slot-scope="scope">
            <el-button size="mini" type="warning" @click="markAnomaly(scope.row)">
              {{ scope.row.is_anomaly ? '取消异常' : '标记异常' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-divider></el-divider>

      <h3 style="margin-bottom: 15px;">
        <i class="el-icon-alarm"></i> 瓶颈分析
        <el-badge :value="unconfirmedCount" class="item" type="warning" style="margin-left: 10px;"></el-badge>
      </h3>
      <el-table :data="plan.bottlenecks || []" border stripe size="small">
        <el-table-column prop="bottleneck_type" label="瓶颈类型" width="120"></el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip></el-table-column>
        <el-table-column prop="severity" label="严重程度" width="100">
          <template slot-scope="scope">
            <el-tag :type="getSeverityTagType(scope.row.severity)" size="small">{{ scope.row.severity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_confirmed" label="确认状态" width="100">
          <template slot-scope="scope">
            <el-tag v-if="scope.row.is_confirmed" type="success" size="small">已确认</el-tag>
            <el-tag v-else type="warning" size="small">待确认</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="confirmed_by" label="确认人" width="100"></el-table-column>
        <el-table-column prop="suggestion" label="优化建议" min-width="150" show-overflow-tooltip></el-table-column>
        <el-table-column label="操作" width="120">
          <template slot-scope="scope">
            <el-button size="mini" type="primary" @click="confirmBottleneck(scope.row)" :disabled="scope.row.is_confirmed">
              确认
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog title="标记异常" :visible.sync="anomalyDialogVisible" width="500px">
      <el-form label-width="100px">
        <el-form-item label="是否异常">
          <el-switch v-model="anomalyForm.is_anomaly" active-text="是" inactive-text="否"></el-switch>
        </el-form-item>
        <el-form-item label="异常原因">
          <el-input type="textarea" v-model="anomalyForm.anomaly_reason" :rows="4" placeholder="请输入异常原因"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="anomalyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAnomaly">确定</el-button>
      </div>
    </el-dialog>

    <el-dialog title="确认瓶颈" :visible.sync="bottleneckDialogVisible" width="500px">
      <el-form label-width="100px">
        <el-form-item label="确认人">
          <el-input v-model="bottleneckForm.confirmed_by"></el-input>
        </el-form-item>
        <el-form-item label="优化建议">
          <el-input type="textarea" v-model="bottleneckForm.suggestion" :rows="4" placeholder="请输入优化建议"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="bottleneckDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitBottleneck">确定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'PlanDetail',
  data() {
    return {
      loading: false,
      plan: {},
      anomalyDialogVisible: false,
      anomalyForm: {
        id: null,
        is_anomaly: false,
        anomaly_reason: ''
      },
      bottleneckDialogVisible: false,
      bottleneckForm: {
        id: null,
        confirmed_by: '',
        suggestion: ''
      }
    }
  },
  computed: {
    anomalyCount() {
      return (this.plan.error_distributions || []).filter(e => e.is_anomaly).length
    },
    unconfirmedCount() {
      return (this.plan.bottlenecks || []).filter(b => !b.is_confirmed).length
    }
  },
  mounted() {
    this.fetchPlanDetail()
  },
  methods: {
    async fetchPlanDetail() {
      this.loading = true
      try {
        const planId = this.$route.params.id
        const response = await this.$http.get(`/plans/${planId}`)
        if (response.data.code === 200) {
          this.plan = response.data.data
        } else {
          this.$message.error(response.data.message)
        }
      } catch (error) {
        this.$message.error('获取详情失败')
      } finally {
        this.loading = false
      }
    },
    goBack() {
      this.$router.push('/')
    },
    markAnomaly(row) {
      this.anomalyForm.id = row.id
      this.anomalyForm.is_anomaly = !row.is_anomaly
      this.anomalyForm.anomaly_reason = row.anomaly_reason || ''
      this.anomalyDialogVisible = true
    },
    async submitAnomaly() {
      try {
        const response = await this.$http.post(`/errors/${this.anomalyForm.id}/anomaly`, null, {
          params: {
            is_anomaly: this.anomalyForm.is_anomaly,
            anomaly_reason: this.anomalyForm.anomaly_reason
          }
        })
        if (response.data.code === 200) {
          this.$message.success('操作成功')
          this.anomalyDialogVisible = false
          this.fetchPlanDetail()
        } else {
          this.$message.error(response.data.message)
        }
      } catch (error) {
        this.$message.error('操作失败')
      }
    },
    confirmBottleneck(row) {
      this.bottleneckForm.id = row.id
      this.bottleneckForm.confirmed_by = ''
      this.bottleneckForm.suggestion = ''
      this.bottleneckDialogVisible = true
    },
    async submitBottleneck() {
      if (!this.bottleneckForm.confirmed_by) {
        this.$message.warning('请输入确认人')
        return
      }
      try {
        const response = await this.$http.post(`/bottlenecks/${this.bottleneckForm.id}/confirm`, null, {
          params: {
            confirmed_by: this.bottleneckForm.confirmed_by,
            suggestion: this.bottleneckForm.suggestion
          }
        })
        if (response.data.code === 200) {
          this.$message.success('确认成功')
          this.bottleneckDialogVisible = false
          this.fetchPlanDetail()
        } else {
          this.$message.error(response.data.message)
        }
      } catch (error) {
        this.$message.error('操作失败')
      }
    },
    getMethodTagType(method) {
      const map = { 'GET': 'success', 'POST': 'primary', 'PUT': 'warning', 'DELETE': 'danger' }
      return map[method] || ''
    },
    getStatusTagType(status) {
      const map = {
        'success': 'success',
        'pending_review': 'warning',
        'intercepted': 'danger',
        'retryable': 'info',
        'approved': 'primary',
        'draft': 'info'
      }
      return map[status] || ''
    },
    getStatusText(status) {
      const map = {
        'success': '成功',
        'pending_review': '待复核',
        'intercepted': '已拦截',
        'retryable': '可重试',
        'approved': '已审批',
        'draft': '草稿'
      }
      return map[status] || status
    },
    getSeverityTagType(severity) {
      const map = { 'high': 'danger', 'medium': 'warning', 'low': 'info' }
      return map[severity] || ''
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleString('zh-CN', { hour12: false })
    }
  }
}
</script>

<style scoped>
.plan-detail {
  padding: 0;
}
.el-descriptions {
  margin-bottom: 20px;
}
h3 {
  font-size: 16px;
  color: #303133;
  font-weight: bold;
}
</style>