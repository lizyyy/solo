<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑预约' : '新建预约'"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-alert
      v-if="validationErrors.length > 0"
      :title="validationErrors.join('; ')"
      type="error"
      :closable="false"
      class="validation-alert"
      show-icon
    />

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      @change="handleFormChange"
    >
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="顾客姓名" prop="customer_name">
            <el-input v-model="form.customer_name" placeholder="请输入顾客姓名" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="联系电话" prop="customer_phone">
            <el-input v-model="form.customer_phone" placeholder="请输入联系电话" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="预约类型" prop="reservation_type">
            <el-radio-group v-model="form.reservation_type">
              <el-radio-button label="shared">散客拼桌</el-radio-button>
              <el-radio-button label="private">包场</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="玩家人数" prop="player_count">
            <el-input-number 
              v-model="form.player_count" 
              :min="1" 
              :max="20"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="选择剧本" prop="script_id">
            <el-select 
              v-model="form.script_id" 
              placeholder="请选择剧本"
              style="width: 100%"
              @change="handleScriptChange"
            >
              <el-option
                v-for="script in store.scripts"
                :key="script.id"
                :label="`${script.name} (${script.duration_minutes}分钟, ${script.min_players}-${script.max_players}人, ¥${script.price})`"
                :value="script.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="选择桌位" prop="table_id">
            <el-select 
              v-model="form.table_id" 
              placeholder="请选择桌位"
              style="width: 100%"
            >
              <el-option
                v-for="table in availableTables"
                :key="table.id"
                :label="`${table.name} (容纳${table.capacity}人) - ${table.location || ''}`"
                :value="table.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="日期" prop="date">
            <el-date-picker
              v-model="form.date"
              type="date"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="开始时间" prop="start_time">
            <el-time-picker
              v-model="form.start_time"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择开始时间"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="预计结束">
            <el-input :value="calculatedEndTime" disabled />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="主持人">
        <el-select 
          v-model="form.host_id" 
          placeholder="请选择主持人（可选）"
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="host in availableHosts"
            :key="host.id"
            :label="`${host.name} - ${host.skills || ''}`"
            :value="host.id"
          />
        </el-select>
      </el-form-item>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="预计金额">
            <el-input :value="`¥${calculatedAmount.toFixed(2)}`" disabled>
              <template #prefix>
                <el-icon><Money /></el-icon>
              </template>
            </el-input>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="定金金额" prop="deposit_amount">
            <el-input-number 
              v-model="form.deposit_amount" 
              :min="0" 
              :precision="2"
              :step="10"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="备注">
        <el-input
          v-model="form.notes"
          type="textarea"
          :rows="2"
          placeholder="请输入备注信息"
        />
      </el-form-item>

      <el-form-item label="幂等键（可选）">
        <el-input
          v-model="idempotencyKey"
          placeholder="用于重复操作去重，如：customer-xxx-date-time"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button 
        type="primary" 
        :loading="saving"
        @click="handleSave"
      >
        {{ isEdit ? '保存修改' : '确认预约' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSchedulerStore } from '../stores/scheduler'
import { ElMessage } from 'element-plus'
import { addMinutes, format } from 'date-fns'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  reservation: {
    type: Object,
    default: null
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'saved'])

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const store = useSchedulerStore()
const formRef = ref(null)
const saving = ref(false)
const validationErrors = ref([])
const idempotencyKey = ref('')

const defaultForm = {
  customer_name: '',
  customer_phone: '',
  reservation_type: 'shared',
  player_count: 1,
  script_id: '',
  table_id: '',
  date: '',
  start_time: '14:00',
  host_id: '',
  deposit_amount: 0,
  notes: '',
  status: 'confirmed'
}

const form = ref({ ...defaultForm })

const rules = {
  customer_name: [{ required: true, message: '请输入顾客姓名', trigger: 'blur' }],
  customer_phone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  reservation_type: [{ required: true, message: '请选择预约类型', trigger: 'change' }],
  player_count: [{ required: true, message: '请输入玩家人数', trigger: 'blur' }],
  script_id: [{ required: true, message: '请选择剧本', trigger: 'change' }],
  table_id: [{ required: true, message: '请选择桌位', trigger: 'change' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  start_time: [{ required: true, message: '请选择开始时间', trigger: 'change' }]
}

const selectedScript = computed(() => {
  if (!form.value.script_id) return null
  return store.getScriptById(form.value.script_id)
})

const calculatedEndTime = computed(() => {
  if (!selectedScript.value || !form.value.start_time) return '-'
  const [hours, minutes] = form.value.start_time.split(':').map(Number)
  const date = new Date(2000, 0, 1, hours, minutes)
  const endDate = addMinutes(date, selectedScript.value.duration_minutes)
  return format(endDate, 'HH:mm')
})

const calculatedAmount = computed(() => {
  if (!selectedScript.value) return 0
  let baseAmount = selectedScript.value.price
  if (form.value.reservation_type === 'private') {
    baseAmount *= 1.5
  }
  return Math.round(baseAmount * 100) / 100
})

const availableTables = computed(() => {
  return store.tables
})

const availableHosts = computed(() => {
  return store.hosts
})

function handleScriptChange() {
  const script = selectedScript.value
  if (script && form.value.player_count < script.min_players) {
    form.value.player_count = script.min_players
  }
}

async function handleFormChange() {
  if (form.value.script_id && form.value.table_id && form.value.date && form.value.start_time) {
    const result = await store.validateReservation({
      script_id: form.value.script_id,
      table_id: form.value.table_id,
      date: form.value.date,
      start_time: form.value.start_time,
      player_count: form.value.player_count,
      reservation_type: form.value.reservation_type,
      host_id: form.value.host_id || undefined
    })
    validationErrors.value = result.errors || []
  }
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (props.isEdit && props.reservation) {
      form.value = {
        customer_name: props.reservation.customer_name,
        customer_phone: props.reservation.customer_phone,
        reservation_type: props.reservation.reservation_type,
        player_count: props.reservation.player_count,
        script_id: props.reservation.script_id,
        table_id: props.reservation.table_id,
        date: props.reservation.date,
        start_time: props.reservation.start_time,
        host_id: props.reservation.host_id || '',
        deposit_amount: props.reservation.deposit_amount || 0,
        notes: props.reservation.notes || '',
        status: props.reservation.status
      }
    } else {
      form.value = {
        ...defaultForm,
        date: store.selectedDate,
        table_id: props.reservation?.table_id || '',
        start_time: props.reservation?.start_time || '14:00'
      }
    }
    validationErrors.value = []
    idempotencyKey.value = ''
  }
}, { immediate: true })

async function handleSave() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    if (props.isEdit) {
      await store.updateReservation(props.reservation.id, form.value)
    } else {
      await store.createReservation(form.value, idempotencyKey.value || undefined)
    }
    emit('saved')
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    saving.value = false
  }
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<style scoped>
.validation-alert {
  margin-bottom: 20px;
}
</style>
