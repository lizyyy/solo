<template>
  <el-drawer
    v-model="visible"
    title="发票审核"
    direction="ltr"
    size="600px"
    :before-close="handleClose"
  >
    <div class="review-content">
      <el-alert
        v-if="invoice?.duplicates?.length > 0"
        title="该发票存在重复记录"
        type="warning"
        :closable="false"
        style="margin-bottom: 20px"
      >
        <template #default>
          <p v-for="(dup, idx) in invoice.duplicates" :key="idx">
            与发票 {{ dup.duplicate_with }} 重复：{{ dup.reason }}
          </p>
          <div style="margin-top: 12px">
            <el-radio-group v-model="duplicateAction" size="large">
              <el-radio value="keep">保留原票，驳回此票</el-radio>
              <el-radio value="replace">使用此票，替换原票</el-radio>
            </el-radio-group>
          </div>
        </template>
      </el-alert>

      <el-card shadow="hover" class="edit-card">
        <template #header>
          <div class="card-title">
            <span>编辑字段</span>
            <el-tag type="info">人工修正</el-tag>
          </div>
        </template>
        <el-form :model="form" label-width="100px">
          <el-form-item label="发票号码">
            <el-input v-model="form.invoice_number" placeholder="请输入" />
          </el-form-item>
          <el-form-item label="发票代码">
            <el-input v-model="form.invoice_code" placeholder="请输入" />
          </el-form-item>
          <el-form-item label="税号">
            <el-input v-model="form.tax_number" placeholder="请输入" />
          </el-form-item>
          <el-form-item label="金额">
            <el-input-number v-model="form.amount" :precision="2" :min="0" style="width: 100%" />
          </el-form-item>
          <el-form-item label="开票日期">
            <el-date-picker v-model="form.invoice_date" type="date" style="width: 100%" />
          </el-form-item>
          <el-form-item label="销售方">
            <el-input v-model="form.seller_name" placeholder="请输入" />
          </el-form-item>
          <el-form-item label="购买方">
            <el-input v-model="form.buyer_name" placeholder="请输入" />
          </el-form-item>
        </el-form>
      </el-card>

      <el-card shadow="hover" class="reason-card">
        <template #header>
          <div class="card-title">
            <span>审核意见</span>
            <el-tag type="warning">必填</el-tag>
          </div>
        </template>
        <el-form :model="reviewForm" label-width="100px">
          <el-form-item label="审核结果" required>
            <el-radio-group v-model="reviewForm.action" size="large">
              <el-radio value="approve" type="success">通过</el-radio>
              <el-radio value="reject" type="danger">驳回</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="审核理由" required>
            <el-input
              v-model="reviewForm.reason"
              type="textarea"
              :rows="4"
              placeholder="请详细说明审核理由，以便复盘..."
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </el-card>

      <div class="review-footer">
        <el-button size="large" @click="handleClose">取消</el-button>
        <el-button 
          type="primary" 
          size="large" 
          :loading="submitting"
          @click="submitReview"
        >
          提交审核
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, watch, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { reviewInvoice, resolveDuplicate } from '../api'

const props = defineProps({
  visible: Boolean,
  invoice: Object
})

const emit = defineEmits(['update:visible', 'reviewed'])

const submitting = ref(false)
const duplicateAction = ref('keep')

const form = reactive({
  invoice_number: '',
  invoice_code: '',
  tax_number: '',
  amount: 0,
  invoice_date: '',
  seller_name: '',
  buyer_name: ''
})

const reviewForm = reactive({
  action: 'approve',
  reason: ''
})

watch(() => props.invoice, (val) => {
  if (val) {
    Object.assign(form, {
      invoice_number: val.invoice_number || '',
      invoice_code: val.invoice_code || '',
      tax_number: val.tax_number || '',
      amount: val.amount || 0,
      invoice_date: val.invoice_date || '',
      seller_name: val.seller_name || '',
      buyer_name: val.buyer_name || ''
    })
  }
}, { immediate: true })

watch(() => props.visible, (val) => {
  if (val) {
    reviewForm.reason = ''
    reviewForm.action = 'approve'
    duplicateAction.value = 'keep'
  }
})

function getChangedFields() {
  const changed = {}
  const fields = ['invoice_number', 'invoice_code', 'tax_number', 'amount', 'invoice_date', 'seller_name', 'buyer_name']
  fields.forEach(field => {
    if (form[field] !== props.invoice?.[field]) {
      changed[field] = form[field]
    }
  })
  return Object.keys(changed).length > 0 ? changed : null
}

async function submitReview() {
  if (!reviewForm.reason.trim()) {
    ElMessage.warning('请填写审核理由')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要${reviewForm.action === 'approve' ? '通过' : '驳回'}此发票吗？`,
      '确认审核',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  submitting.value = true
  try {
    const changedFields = getChangedFields()
    
    if (props.invoice?.duplicates?.length > 0 && duplicateAction.value) {
      await resolveDuplicate(props.invoice.id, {
        keepOriginal: duplicateAction.value === 'keep',
        operator: '质量负责人',
        reason: reviewForm.reason
      })
    } else {
      await reviewInvoice(props.invoice.id, {
        action: reviewForm.action,
        operator: '质量负责人',
        reason: reviewForm.reason,
        updatedFields: changedFields
      })
    }

    ElMessage.success('审核完成')
    emit('reviewed')
    handleClose()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '审核失败')
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<style scoped>
.review-content {
  padding: 0 20px 20px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.edit-card,
.reason-card {
  margin-bottom: 20px;
}

.review-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}
</style>
