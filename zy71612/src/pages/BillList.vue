<template>
  <div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">票据列表</div>
        <div class="flex gap-8">
          <button class="btn btn-success" @click="exportBills">导出Excel</button>
          <button class="btn btn-primary" @click="showAddModal = true">新增票据</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-item">
          <label>票据号:</label>
          <input v-model="filters.billNo" placeholder="输入票据号" @input="loadBills" />
        </div>
        <div class="filter-item">
          <label>票据状态:</label>
          <select v-model="filters.status" @change="loadBills">
            <option value="">全部</option>
            <option v-for="(text, value) in BillStatusText" :key="value" :value="value">
              {{ text }}
            </option>
          </select>
        </div>
        <div class="filter-item">
          <label>处理状态:</label>
          <select v-model="filters.processStatus" @change="loadBills">
            <option value="">全部</option>
            <option v-for="(text, value) in ProcessStatusText" :key="value" :value="value">
              {{ text }}
            </option>
          </select>
        </div>
        <div class="filter-item">
          <label>到期日从:</label>
          <input type="date" v-model="filters.matureDateFrom" @change="loadBills" />
        </div>
        <div class="filter-item">
          <label>到:</label>
          <input type="date" v-model="filters.matureDateTo" @change="loadBills" />
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
      <div v-else-if="bills.length === 0" class="empty-state">
        <div class="icon">📋</div>
        <p>暂无票据数据</p>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
          <tr>
            <th>票据号</th>
            <th>承兑人</th>
            <th>出票人</th>
            <th>票面金额</th>
            <th>出票日期</th>
            <th>到期日期</th>
            <th>票据状态</th>
            <th>处理状态</th>
            <th>操作</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="item in bills" :key="item.id">
            <td>{{ item.billNo }}</td>
            <td>{{ item.acceptor }}</td>
            <td>{{ item.drawer }}</td>
            <td class="amount">¥{{ formatAmount(item.amount) }}</td>
            <td>{{ item.acceptDate }}</td>
            <td>{{ item.matureDate }}</td>
            <td>
              <span :class="getBillStatusBadgeClass(item.status)">
                {{ getBillStatusText(item.status) }}
              </span>
            </td>
            <td>
              <span :class="getProcessStatusBadgeClass(item.processStatus)">
                {{ getProcessStatusText(item.processStatus) }}
              </span>
            </td>
            <td>
              <div class="flex gap-8">
                <button class="btn btn-sm" @click="viewDetail(item)">详情</button>
                <button class="btn btn-sm btn-primary" @click="editBill(item)">编辑</button>
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>新增票据</h3>
          <button class="close-btn" @click="showAddModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>票据号 *</label>
            <input v-model="form.billNo" placeholder="请输入票据号" />
          </div>
          <div class="form-group">
            <label>承兑人</label>
            <input v-model="form.acceptor" placeholder="请输入承兑人" />
          </div>
          <div class="form-group">
            <label>出票人</label>
            <input v-model="form.drawer" placeholder="请输入出票人" />
          </div>
          <div class="form-group">
            <label>持票人</label>
            <input v-model="form.holder" placeholder="请输入持票人" />
          </div>
          <div class="form-group">
            <label>票面金额 *</label>
            <input type="number" v-model.number="form.amount" placeholder="请输入票面金额" />
          </div>
          <div class="form-group">
            <label>出票日期</label>
            <input type="date" v-model="form.acceptDate" />
          </div>
          <div class="form-group">
            <label>到期日期 *</label>
            <input type="date" v-model="form.matureDate" />
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="form.remark" rows="3" placeholder="请输入备注"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showAddModal = false">取消</button>
          <button class="btn btn-primary" @click="submitForm">确认提交</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import billService from '../services/BillService.js'
import exportService from '../services/ExportService.js'
import { BillStatusText, ProcessStatusText } from '../models/types.js'

const bills = ref([])
const loading = ref(false)
const showAddModal = ref(false)

const filters = reactive({
  billNo: '',
  status: '',
  processStatus: '',
  matureDateFrom: '',
  matureDateTo: ''
})

const form = reactive({
  billNo: '',
  acceptor: '',
  drawer: '',
  holder: '',
  amount: 0,
  acceptDate: '',
  matureDate: '',
  remark: ''
})

const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getBillStatusBadgeClass = (status) => {
  if (['collected', 'discounted'].includes(status)) {
    return 'badge badge-success'
  } else if (['expired', 'void'].includes(status)) {
    return 'badge badge-danger'
  } else if (status === 'collecting') {
    return 'badge badge-warning'
  }
  return 'badge badge-primary'
}

const getBillStatusText = (status) => BillStatusText[status] || status

const getProcessStatusBadgeClass = (status) => {
  if (status === 'confirmed') return 'badge badge-success'
  if (status === 'returned') return 'badge badge-danger'
  if (status === 'temp') return 'badge badge-info'
  return 'badge badge-warning'
}

const getProcessStatusText = (status) => ProcessStatusText[status] || status

const loadBills = async () => {
  loading.value = true
  try {
    const filterParams = {}
    if (filters.billNo) filterParams.billNo = filters.billNo
    if (filters.status) filterParams.status = filters.status
    if (filters.processStatus) filterParams.processStatus = filters.processStatus
    if (filters.matureDateFrom) filterParams.matureDateFrom = filters.matureDateFrom
    if (filters.matureDateTo) filterParams.matureDateTo = filters.matureDateTo
    
    bills.value = await billService.getAllBills(filterParams)
  } catch (error) {
    console.error('加载票据列表失败:', error)
  } finally {
    loading.value = false
  }
}

const exportBills = async () => {
  try {
    await exportService.exportBills(bills.value)
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败')
  }
}

const viewDetail = (item) => {
  console.log('查看详情:', item)
  alert('查看详情功能开发中')
}

const editBill = (item) => {
  console.log('编辑票据:', item)
  alert('编辑功能开发中')
}

const submitForm = async () => {
  try {
    await billService.createBill(form)
    alert('新增成功')
    showAddModal.value = false
    Object.keys(form).forEach(key => {
      form[key] = key === 'amount' ? 0 : ''
    })
    loadBills()
  } catch (error) {
    console.error('新增失败:', error)
    alert('新增失败: ' + error.message)
  }
}

onMounted(() => {
  loadBills()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #909399;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: #409eff;
}

.form-group textarea {
  resize: vertical;
}
</style>
