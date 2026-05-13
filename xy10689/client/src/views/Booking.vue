<template>
  <div>
    <h2 style="margin-bottom: 20px">预约管理</h2>
    
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" :model="filters">
        <el-form-item label="会议室">
          <el-select v-model="filters.roomId" placeholder="选择会议室" clearable>
            <el-option v-for="room in rooms" :key="room.id" :label="room.name" :value="room.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="选择状态" clearable>
            <el-option label="已确认" value="confirmed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="showAddDialog = true">新增预约</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="bookings" style="width: 100%">
        <el-table-column prop="room_name" label="会议室" />
        <el-table-column prop="title" label="会议主题" />
        <el-table-column prop="user_name" label="预订人" />
        <el-table-column prop="start_time" label="开始时间" />
        <el-table-column prop="end_time" label="结束时间" />
        <el-table-column prop="attendees" label="参会人数" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 'confirmed' ? 'success' : 'danger'">
              {{ row.status === 'confirmed' ? '已确认' : '已取消' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="viewHistory(row)">修改记录</el-button>
            <el-button size="small" type="danger" :disabled="row.status === 'cancelled'" @click="cancelBooking(row)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showAddDialog" title="新增预约" width="500px">
      <el-form :model="bookingForm" label-width="80px">
        <el-form-item label="会议室">
          <el-select v-model="bookingForm.room_id" placeholder="选择会议室">
            <el-option v-for="room in rooms" :key="room.id" :label="room.name" :value="room.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="会议主题">
          <el-input v-model="bookingForm.title" />
        </el-form-item>
        <el-form-item label="预订人">
          <el-input v-model="bookingForm.user_name" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="bookingForm.start_time" type="datetime" placeholder="选择开始时间" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="bookingForm.end_time" type="datetime" placeholder="选择结束时间" />
        </el-form-item>
        <el-form-item label="参会人数">
          <el-input-number v-model="bookingForm.attendees" :min="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="submitBooking">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showHistoryDialog" title="修改历史" width="600px">
      <el-table :data="historyList" style="width: 100%">
        <el-table-column prop="field_name" label="修改字段" />
        <el-table-column prop="old_value" label="修改前" />
        <el-table-column prop="new_value" label="修改后" />
        <el-table-column prop="modified_by" label="操作人" />
        <el-table-column prop="modified_at" label="操作时间" />
      </el-table>
    </el-dialog>

    <el-dialog v-model="showCancelDialog" title="取消预约" width="400px">
      <el-form :model="cancelForm" label-width="80px">
        <el-form-item label="取消原因">
          <el-input v-model="cancelForm.reason" type="textarea" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="cancelForm.cancelled_by" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCancelDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmCancel">确认取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getBookings, getRooms, createBooking, cancelBooking, getModificationHistory } from '../api'
import dayjs from 'dayjs'

const filters = ref({ roomId: '', status: '' })
const bookings = ref([])
const rooms = ref([])
const showAddDialog = ref(false)
const showHistoryDialog = ref(false)
const showCancelDialog = ref(false)
const historyList = ref([])
const currentBooking = ref(null)

const bookingForm = ref({
  room_id: '',
  title: '',
  user_name: '',
  start_time: '',
  end_time: '',
  attendees: 1,
  needs_projector: 0
})

const cancelForm = ref({
  reason: '',
  cancelled_by: ''
})

const loadData = async () => {
  try {
    const res = await getBookings(filters.value)
    bookings.value = res.data.map(item => ({
      ...item,
      start_time: dayjs(item.start_time).format('YYYY-MM-DD HH:mm'),
      end_time: dayjs(item.end_time).format('YYYY-MM-DD HH:mm')
    }))
  } catch (e) {
    console.error(e)
  }
}

const loadRooms = async () => {
  try {
    const res = await getRooms()
    rooms.value = res.data
  } catch (e) {
    console.error(e)
  }
}

const submitBooking = async () => {
  try {
    const data = {
      ...bookingForm.value,
      start_time: dayjs(bookingForm.value.start_time).format('YYYY-MM-DD HH:mm:ss'),
      end_time: dayjs(bookingForm.value.end_time).format('YYYY-MM-DD HH:mm:ss')
    }
    await createBooking(data)
    ElMessage.success('预约成功')
    showAddDialog.value = false
    loadData()
    bookingForm.value = { room_id: '', title: '', user_name: '', start_time: '', end_time: '', attendees: 1, needs_projector: 0 }
  } catch (e) {
    console.error(e)
  }
}

const viewHistory = async (row) => {
  try {
    const res = await getModificationHistory({ entity_type: 'booking', entity_id: row.id })
    historyList.value = res.data
    showHistoryDialog.value = true
  } catch (e) {
    console.error(e)
  }
}

const cancelBooking = (row) => {
  currentBooking.value = row
  showCancelDialog.value = true
}

const confirmCancel = async () => {
  try {
    await cancelBooking(currentBooking.value.id, cancelForm.value)
    ElMessage.success('取消成功')
    showCancelDialog.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  loadData()
  loadRooms()
})
</script>
