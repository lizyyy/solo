<template>
  <div class="audit">
    <div class="page-title">审计导出</div>

    <el-row :gutter="20" class="audit-section">
      <el-col :span="12">
        <div class="page-container">
          <div class="section-title">
            <el-icon><Document /></el-icon>
            <span>导出选项</span>
          </div>
          <div class="export-options">
            <el-checkbox-group v-model="exportOptions">
              <div class="option-item">
                <el-checkbox label="invoices" border>
                  <span class="option-label">发票数据</span>
                  <span class="option-desc">包含所有发票的详细信息</span>
                </el-checkbox>
              </div>
              <div class="option-item">
                <el-checkbox label="redemptions" border>
                  <span class="option-label">红冲申请</span>
                  <span class="option-desc">包含所有红冲申请及状态历史</span>
                </el-checkbox>
              </div>
              <div class="option-item">
                <el-checkbox label="anomalies" border>
                  <span class="option-label">异常记录</span>
                  <span class="option-desc">包含检测到的所有异常及其依据</span>
                </el-checkbox>
              </div>
              <div class="option-item">
                <el-checkbox label="creditHistory" border>
                  <span class="option-label">额度历史</span>
                  <span class="option-desc">包含所有额度占用和回补记录</span>
                </el-checkbox>
              </div>
              <div class="option-item">
                <el-checkbox label="payments" border>
                  <span class="option-label">回款流水</span>
                  <span class="option-desc">包含所有回款的详细记录</span>
                </el-checkbox>
              </div>
              <div class="option-item">
                <el-checkbox label="statusHistory" border>
                  <span class="option-label">状态流转</span>
                  <span class="option-desc">包含所有红冲申请的状态变更历史</span>
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
          <div class="export-actions">
            <el-button type="primary" size="large" @click="handleExportExcel" :loading="exporting">
              <el-icon><Download /></el-icon>
              <span>导出 Excel</span>
            </el-button>
            <el-button size="large" @click="handleExportJson">
              <el-icon><DocumentCopy /></el-icon>
              <span>导出 JSON</span>
            </el-button>
          </div>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="page-container">
          <div class="section-title">
            <el-icon><DataLine /></el-icon>
            <span>数据概览</span>
          </div>
          <div class="data-summary">
            <div class="summary-item">
              <span class="summary-label">发票数量</span>
              <span class="summary-value">{{ invoiceStore.invoices.length }} 张</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">红冲申请</span>
              <span class="summary-value">{{ redemptionStore.redemptions.length }} 笔</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">异常记录</span>
              <span class="summary-value danger">{{ redemptionStore.anomalies.length }} 笔</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">重复红冲</span>
              <span class="summary-value warning">{{ redemptionStore.duplicateAnomalies.length }} 笔</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">提前释放</span>
              <span class="summary-value warning">{{ redemptionStore.earlyReleaseAnomalies.length }} 笔</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">未确认</span>
              <span class="summary-value danger">{{ redemptionStore.unconfirmedAnomalies.length }} 笔</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">额度记录</span>
              <span class="summary-value">{{ creditStore.creditHistory.length }} 条</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">回款流水</span>
              <span class="summary-value">{{ paymentStore.payments.length }} 笔</span>
            </div>
          </div>
        </div>

        <div class="page-container" style="margin-top: 20px;">
          <div class="section-title">
            <el-icon><InfoFilled /></el-icon>
            <span>导出说明</span>
          </div>
          <div class="export-notes">
            <p>• 导出文件包含完整的审计追踪信息，可用于财务核对和审计检查</p>
            <p>• 异常记录会标注判断理由和证据依据，便于人工复核</p>
            <p>• 状态流转历史记录每一步操作的操作人、时间和备注</p>
            <p>• 建议定期导出数据进行存档，确保数据安全</p>
          </div>
        </div>
      </el-col>
    </el-row>

    <div class="page-container">
      <div class="section-title">
        <el-icon><List /></el-icon>
        <span>异常审计报告</span>
      </div>
      <el-table :data="redemptionStore.anomalies" stripe border>
        <el-table-column prop="redemptionNo" label="红冲单号" width="140" />
        <el-table-column prop="invoiceNo" label="发票号码" width="180" />
        <el-table-column prop="buyerName" label="买方名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="amount" label="红冲金额" width="130">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="异常类型" width="180">
          <template #default="{ row }">
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <el-tag 
                v-for="anomaly in row.anomalies" 
                :key="anomaly.type"
                :type="getAnomalyTagType(anomaly.type)"
                size="small"
              >
                {{ getAnomalyLabel(anomaly.type) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="判断理由" min-width="250">
          <template #default="{ row }">
            <div v-for="anomaly in row.anomalies" :key="anomaly.type" class="reason-item">
              <div class="reason-box">{{ anomaly.reason }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="证据依据" min-width="250">
          <template #default="{ row }">
            <div v-for="anomaly in row.anomalies" :key="anomaly.type" class="evidence-item">
              {{ anomaly.evidence }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="当前状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useInvoiceStore } from '@/stores/invoice'
import { useRedemptionStore } from '@/stores/redemption'
import { useCreditStore } from '@/stores/credit'
import { usePaymentStore } from '@/stores/payment'
import { REDEMPTION_STATUS_LABEL, ANOMALY_LABELS } from '@/stores/redemption'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

const invoiceStore = useInvoiceStore()
const redemptionStore = useRedemptionStore()
const creditStore = useCreditStore()
const paymentStore = usePaymentStore()

const exportOptions = ref(['invoices', 'redemptions', 'anomalies', 'creditHistory', 'payments', 'statusHistory'])
const exporting = ref(false)

function formatMoney(value) {
  return '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getStatusLabel(status) {
  return REDEMPTION_STATUS_LABEL[status] || status
}

function getStatusTagType(status) {
  const typeMap = {
    draft: 'info',
    submitted: 'warning',
    buyer_confirmed: 'primary',
    processing: 'primary',
    completed: 'success',
    rejected: 'danger'
  }
  return typeMap[status] || 'info'
}

function getAnomalyLabel(type) {
  return ANOMALY_LABELS[type] || type
}

function getAnomalyTagType(type) {
  const typeMap = {
    duplicate: 'danger',
    early_release: 'warning',
    unconfirmed: 'danger'
  }
  return typeMap[type] || 'warning'
}

function collectExportData() {
  const data = {}

  if (exportOptions.value.includes('invoices')) {
    data.invoices = invoiceStore.invoices.map(inv => ({
      发票号码: inv.invoiceNo,
      发票代码: inv.invoiceCode,
      发票类型: inv.invoiceType,
      金额: inv.amount,
      税额: inv.taxAmount,
      价税合计: inv.totalAmount,
      买方名称: inv.buyerName,
      买方税号: inv.buyerTaxNo,
      卖方名称: inv.sellerName,
      卖方税号: inv.sellerTaxNo,
      开票日期: inv.invoiceDate,
      到期日期: inv.dueDate,
      状态: inv.status === 'normal' ? '正常' : '已作废',
      操作人: inv.operator,
      创建时间: dayjs(inv.createTime).format('YYYY-MM-DD HH:mm:ss'),
      备注: inv.remark
    }))
  }

  if (exportOptions.value.includes('redemptions')) {
    data.redemptions = redemptionStore.redemptions.map(red => ({
      红冲单号: red.redemptionNo,
      发票号码: red.invoiceNo,
      买方名称: red.buyerName,
      红冲金额: red.amount,
      税额: red.taxAmount,
      价税合计: red.totalAmount,
      红冲原因: red.reason,
      状态: getStatusLabel(red.status),
      申请人: red.applicant,
      审核人: red.reviewer,
      提交时间: red.submitTime ? dayjs(red.submitTime).format('YYYY-MM-DD HH:mm:ss') : '-',
      买方确认时间: red.buyerConfirmTime ? dayjs(red.buyerConfirmTime).format('YYYY-MM-DD HH:mm:ss') : '-',
      额度释放时间: red.creditReleaseTime ? dayjs(red.creditReleaseTime).format('YYYY-MM-DD HH:mm:ss') : '-',
      完成时间: red.completedTime ? dayjs(red.completedTime).format('YYYY-MM-DD HH:mm:ss') : '-',
      异常类型: red.anomalies?.map(a => getAnomalyLabel(a.type)).join('、') || '-',
      历史一致性: red.statusHistoryValid === false ? '不一致' : '一致',
      历史一致错误: red.statusHistoryErrors?.join('；') || '-',
      备注: red.remark
    }))
  }

  if (exportOptions.value.includes('anomalies')) {
    data.anomalies = []
    redemptionStore.anomalies.forEach(red => {
      red.anomalies.forEach(anomaly => {
        data.anomalies.push({
          红冲单号: red.redemptionNo,
          发票号码: red.invoiceNo,
          买方名称: red.buyerName,
          红冲金额: red.amount,
          异常类型: getAnomalyLabel(anomaly.type),
          判断理由: anomaly.reason,
          证据依据: anomaly.evidence,
          当前状态: getStatusLabel(red.status)
        })
      })
    })
  }

  if (exportOptions.value.includes('creditHistory')) {
    data.creditHistory = creditStore.creditHistory.map(cr => ({
      记录编号: cr.id,
      类型: cr.type === 'release' ? '回补' : '占用',
      金额: cr.amount,
      关联发票: cr.invoiceId || '-',
      关联红冲: cr.redemptionId || '-',
      操作人: cr.operator,
      操作时间: dayjs(cr.operateTime).format('YYYY-MM-DD HH:mm:ss'),
      备注: cr.remark
    }))
  }

  if (exportOptions.value.includes('payments')) {
    data.payments = paymentStore.payments.map(pay => ({
      回款单号: pay.paymentNo,
      关联红冲: pay.redemptionId || '-',
      关联发票: pay.invoiceId || '-',
      回款金额: pay.amount,
      支付方式: pay.paymentMethod,
      开户银行: pay.bankName,
      银行账号: pay.bankAccount,
      付款方: pay.payerName,
      收款方: pay.payeeName,
      回款时间: dayjs(pay.paymentTime).format('YYYY-MM-DD HH:mm:ss'),
      状态: pay.status === 'completed' ? '已完成' : '处理中',
      凭证号: pay.voucherNo,
      操作人: pay.operator,
      备注: pay.remark
    }))
  }

  if (exportOptions.value.includes('statusHistory')) {
    data.statusHistory = redemptionStore.statusHistory.map(his => ({
      记录编号: his.id,
      红冲单号: his.redemptionId,
      原状态: getStatusLabel(his.fromStatus),
      新状态: getStatusLabel(his.toStatus),
      操作人: his.operator,
      操作时间: dayjs(his.operateTime).format('YYYY-MM-DD HH:mm:ss'),
      备注: his.remark
    }))
  }

  return data
}

function handleExportExcel() {
  exporting.value = true

  setTimeout(() => {
    try {
      const data = collectExportData()
      const wb = XLSX.utils.book_new()

      Object.entries(data).forEach(([key, value]) => {
        const ws = XLSX.utils.json_to_sheet(value)
        const sheetNames = {
          invoices: '发票数据',
          redemptions: '红冲申请',
          anomalies: '异常记录',
          creditHistory: '额度历史',
          payments: '回款流水',
          statusHistory: '状态流转'
        }
        XLSX.utils.book_append_sheet(wb, ws, sheetNames[key] || key)
      })

      const fileName = `发票红冲审计报告_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
      XLSX.writeFile(wb, fileName)

      ElMessage.success('导出成功')
    } catch (error) {
      ElMessage.error('导出失败: ' + error.message)
    } finally {
      exporting.value = false
    }
  }, 500)
}

function handleExportJson() {
  const data = collectExportData()
  data.exportTime = new Date().toISOString()
  data.exportBy = '当前用户'

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `发票红冲审计报告_${dayjs().format('YYYYMMDD_HHmmss')}.json`
  link.click()
  URL.revokeObjectURL(url)

  ElMessage.success('导出成功')
}
</script>

<style lang="scss" scoped>
.audit {
  .audit-section {
    margin-bottom: 20px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #ebeef5;
  }

  .export-options {
    .option-item {
      margin-bottom: 12px;

      :deep(.el-checkbox) {
        width: 100%;
      }

      :deep(.el-checkbox__label) {
        width: 100%;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .option-label {
        font-size: 14px;
        font-weight: 500;
        color: #303133;
      }

      .option-desc {
        font-size: 12px;
        color: #909399;
      }
    }
  }

  .export-actions {
    margin-top: 24px;
    display: flex;
    gap: 12px;
  }

  .data-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;

    .summary-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 6px;

      .summary-label {
        font-size: 13px;
        color: #606266;
      }

      .summary-value {
        font-size: 15px;
        font-weight: 600;
        color: #303133;

        &.danger {
          color: #f56c6c;
        }

        &.warning {
          color: #e6a23c;
        }
      }
    }
  }

  .export-notes {
    p {
      margin: 8px 0;
      font-size: 13px;
      color: #606266;
      line-height: 1.6;
    }
  }

  .reason-item {
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .reason-box {
    background: #f8f9fa;
    border-left: 4px solid #409eff;
    padding: 8px 12px;
    border-radius: 0 4px 4px 0;
    font-size: 13px;
    color: #606266;
  }

  .evidence-item {
    font-size: 13px;
    color: #909399;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
