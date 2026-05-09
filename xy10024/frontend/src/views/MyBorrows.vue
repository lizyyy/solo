<template>
  <div>
    <el-card>
      <template #header>
        <span>我的借用记录</span>
      </template>
      <el-table :data="borrows" v-loading="loading" stripe>
        <el-table-column prop="id" label="记录ID" width="220">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.id.substring(0, 12) }}...</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="device_id" label="设备ID" width="220">
          <template #default="{ row }">
            <el-tag size="small">{{ row.device_id.substring(0, 12) }}...</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="purpose" label="用途" show-overflow-tooltip />
        <el-table-column prop="borrow_date" label="借用时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.borrow_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="expected_return_date" label="预计归还" width="170">
          <template #default="{ row }">
            {{ row.expected_return_date ? formatDate(row.expected_return_date) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="actual_return_date" label="实际归还" width="170">
          <template #default="{ row }">
            {{ row.actual_return_date ? formatDate(row.actual_return_date) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              type="warning"
              link
              size="small"
              :disabled="row.status !== 'borrowed'"
              @click="returnDevice(row)"
            >
              归还
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end;"
        @size-change="loadMyBorrows"
        @current-change="loadMyBorrows"
      />
    </el-card>

    <el-dialog v-model="returnDialogVisible" title="归还设备" width="400px">
      <el-form :model="returnForm" label-width="80px">
        <el-form-item label="归还备注">
          <el-input
            v-model="returnForm.notes"
            type="textarea"
            :rows="3"
            placeholder="请填写归还时的设备状况说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="returning" @click="confirmReturn">
          确认归还
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getUserBorrowHistory, returnDevice as apiReturnDevice } from '@/api/borrows'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'

const userStore = useUserStore()

const loading = ref(false)
const borrows = ref([])

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const returnDialogVisible = ref(false)
const selectedRecord = ref(null)
const returning = ref(false)
const returnForm = reactive({
  notes: ''
})

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function getStatusType(status) {
  const types = {
    borrowed: 'warning',
    returned: 'success',
    overdue: 'danger'
  }
  return types[status] || 'info'
}

function getStatusText(status) {
  const texts = {
    borrowed: '借用中',
    returned: '已归还',
    overdue: '已逾期'
  }
  return texts[status] || status
}

async function loadMyBorrows() {
  if (!userStore.user?.id) return

  loading.value = true
  try {
    const res = await getUserBorrowHistory(userStore.user.id, {
      page: pagination.page,
      page_size: pagination.pageSize
    })
    borrows.value = res.records || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('Failed to load my borrows:', error)
  } finally {
    loading.value = false
  }
}

function returnDevice(row) {
  selectedRecord.value = row
  returnForm.notes = ''
  returnDialogVisible.value = true
}

async function confirmReturn() {
  try {
    returning.value = true
    await apiReturnDevice(selectedRecord.value.id, {
      notes: returnForm.notes
    })
    ElMessage.success('归还成功')
    returnDialogVisible.value = false
    loadMyBorrows()
  } catch (error) {
    console.error('Failed to return device:', error)
  } finally {
    returning.value = false
  }
}

onMounted(() => {
  loadMyBorrows()
})
</script>
