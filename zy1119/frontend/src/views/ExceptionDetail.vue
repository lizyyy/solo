<template>
  <div class="exception-detail">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <router-link to="/exceptions" class="btn btn-sm btn-outline-secondary me-2">
          ← 返回列表
        </router-link>
        <h2 class="d-inline-block align-middle mb-0">异常详情</h2>
      </div>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">加载中...</span>
      </div>
    </div>

    <div v-else-if="exception">
      <div class="row">
        <div class="col-md-6">
          <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">基本信息</h5>
              <span :class="getStatusBadgeClass(exception.status)">
                {{ getStatusText(exception.status) }}
              </span>
            </div>
            <div class="card-body">
              <table class="table table-borderless">
                <tbody>
                  <tr>
                    <td class="text-muted" style="width: 120px;">异常编号</td>
                    <td><strong>{{ exception.exception_no }}</strong></td>
                  </tr>
                  <tr>
                    <td class="text-muted">异常类型</td>
                    <td>
                      <span :class="getTypeBadgeClass(exception.type)">
                        {{ getTypeText(exception.type) }}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="text-muted">关联订单</td>
                    <td>
                      <router-link v-if="exception.Order" :to="`/orders/${exception.order_id}`">
                        {{ exception.Order.order_no }}
                      </router-link>
                      <span v-else class="text-muted">-</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="text-muted">影响数量</td>
                    <td>{{ exception.affected_quantity }}</td>
                  </tr>
                  <tr>
                    <td class="text-muted">处理方式</td>
                    <td>{{ getActionText(exception.action) }}</td>
                  </tr>
                  <tr>
                    <td class="text-muted">创建时间</td>
                    <td>{{ exception.created_at }}</td>
                  </tr>
                  <tr>
                    <td class="text-muted">更新时间</td>
                    <td>{{ exception.updated_at }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">异常描述</h5>
            </div>
            <div class="card-body">
              <p class="mb-0">{{ exception.description || '暂无描述' }}</p>
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="card mb-4" v-if="suggestions && suggestions.length > 0">
            <div class="card-header bg-info text-white">
              <h5 class="mb-0">💡 智能处理建议</h5>
            </div>
            <div class="card-body">
              <div v-for="(suggestion, index) in suggestions" :key="index" class="mb-3 p-3 border rounded">
                <h6 class="mb-2">
                  <span :class="suggestion.type === 'refund' ? 'badge bg-danger' : 'badge bg-primary'">
                    {{ suggestion.type === 'refund' ? '建议退款' : '建议调拨' }}
                  </span>
                </h6>
                <p class="mb-2 text-muted small">{{ suggestion.reason }}</p>
                <p class="mb-1"><strong>涉及商品:</strong> {{ suggestion.product_name }}</p>
                <p class="mb-1"><strong>建议数量:</strong> {{ suggestion.quantity }}</p>
                <p v-if="suggestion.refund_amount" class="mb-1">
                  <strong>退款金额:</strong> ¥{{ suggestion.refund_amount }}
                </p>
              </div>
            </div>
          </div>

          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">处理操作</h5>
            </div>
            <div class="card-body">
              <div v-if="exception.status === 'open' || exception.status === 'processing'" class="mb-3">
                <div class="mb-3">
                  <label class="form-label">选择处理方式</label>
                  <select class="form-select" v-model="selectedAction">
                    <option value="pending">待处理</option>
                    <option value="refund">退款</option>
                    <option value="transfer">调拨</option>
                    <option value="exchange">换货</option>
                    <option value="resolved">标记解决</option>
                  </select>
                </div>

                <div v-if="selectedAction === 'refund'" class="mb-3">
                  <label class="form-label">退款数量</label>
                  <input type="number" class="form-control" v-model.number="refundQuantity" min="1" :max="exception.affected_quantity">
                  <small class="text-muted">当前影响数量: {{ exception.affected_quantity }}</small>
                </div>

                <div class="mb-3">
                  <label class="form-label">处理备注</label>
                  <textarea class="form-control" rows="2" v-model="resolutionNote"></textarea>
                </div>

                <div class="d-grid gap-2">
                  <button 
                    class="btn btn-primary" 
                    @click="handleProcess"
                    :disabled="processing"
                  >
                    {{ processing ? '处理中...' : '确认处理' }}
                  </button>
                </div>
              </div>

              <div v-else class="text-center text-muted py-3">
                该异常已处理完毕
              </div>
            </div>
          </div>

          <div class="card mb-4" v-if="exception.resolution">
            <div class="card-header">
              <h5 class="mb-0">处理结果</h5>
            </div>
            <div class="card-body">
              <p class="mb-0">{{ exception.resolution }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { exceptionApi } from '../api'

export default {
  name: 'ExceptionDetail',
  props: ['id'],
  data() {
    return {
      loading: true,
      exception: null,
      suggestions: [],
      selectedAction: 'pending',
      refundQuantity: 1,
      resolutionNote: '',
      processing: false
    }
  },
  async mounted() {
    await this.loadException()
  },
  watch: {
    id() {
      this.loadException()
    }
  },
  methods: {
    async loadException() {
      this.loading = true
      try {
        const response = await exceptionApi.getById(this.id)
        if (response.data.success) {
          this.exception = response.data.data
          this.refundQuantity = this.exception.affected_quantity
          await this.loadSuggestions()
        }
      } catch (error) {
        console.error('加载异常失败:', error)
      } finally {
        this.loading = false
      }
    },
    async loadSuggestions() {
      try {
        const response = await exceptionApi.getSuggestions(this.id)
        if (response.data.success) {
          this.suggestions = response.data.data
        }
      } catch (error) {
        console.error('加载建议失败:', error)
      }
    },
    async handleProcess() {
      if (!this.selectedAction) {
        alert('请选择处理方式')
        return
      }

      if (this.selectedAction === 'refund' && this.refundQuantity < 1) {
        alert('请输入有效的退款数量')
        return
      }

      this.processing = true

      try {
        const data = {
          action: this.selectedAction,
          resolution: this.resolutionNote || null
        }

        if (this.selectedAction === 'refund') {
          data.quantity = this.refundQuantity
        }

        const response = await exceptionApi.resolve(this.id, data)
        if (response.data.success) {
          alert('处理成功！')
          await this.loadException()
        } else {
          alert('处理失败: ' + (response.data.message || '未知错误'))
        }
      } catch (error) {
        console.error('处理失败:', error)
        alert('处理失败: ' + (error.response?.data?.message || '未知错误'))
      } finally {
        this.processing = false
      }
    },
    getTypeBadgeClass(type) {
      const classes = {
        shortage: 'badge bg-danger',
        expiry: 'badge bg-warning text-dark',
        quality: 'badge bg-secondary',
        other: 'badge bg-light text-dark'
      }
      return classes[type] || 'badge bg-secondary'
    },
    getTypeText(type) {
      const texts = {
        shortage: '缺货',
        expiry: '临期/过期',
        quality: '质量问题',
        other: '其他'
      }
      return texts[type] || type
    },
    getStatusBadgeClass(status) {
      const classes = {
        open: 'badge bg-danger',
        processing: 'badge bg-warning text-dark',
        resolved: 'badge bg-success',
        closed: 'badge bg-secondary'
      }
      return classes[status] || 'badge bg-secondary'
    },
    getStatusText(status) {
      const texts = {
        open: '待处理',
        processing: '处理中',
        resolved: '已解决',
        closed: '已关闭'
      }
      return texts[status] || status
    },
    getActionText(action) {
      const texts = {
        pending: '待处理',
        transfer: '调拨',
        refund: '退款',
        exchange: '换货',
        resolved: '已解决'
      }
      return texts[action] || action
    }
  }
}
</script>
