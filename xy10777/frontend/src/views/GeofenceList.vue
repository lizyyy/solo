<template>
  <div class="geofence-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>围栏列表</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新增围栏
          </el-button>
        </div>
      </template>
      
      <el-table :data="geofences" border>
        <el-table-column prop="name" label="围栏名称" width="200" />
        <el-table-column prop="fence_type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.fence_type === 'polygon' ? 'primary' : 'success'" size="small">
              {{ row.fence_type === 'polygon' ? '多边形' : '圆形' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="is_active" label="状态" width="100">
          <template #default="{ row }">
            <el-switch v-model="row.is_active" @change="toggleActive(row)" size="small" />
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="viewOnMap(row)">查看地图</el-button>
            <el-button size="small" type="danger" @click="deleteGeofence(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showMapDialog" title="围栏地图查看" width="90%" top="5vh">
      <div ref="mapContainer" style="height: 500px"></div>
    </el-dialog>

    <el-dialog v-model="showCreateDialog" title="新增围栏" width="600px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="围栏名称">
          <el-input v-model="formData.name" placeholder="请输入围栏名称" />
        </el-form-item>
        <el-form-item label="围栏类型">
          <el-select v-model="formData.fence_type" placeholder="请选择围栏类型">
            <el-option label="多边形" value="polygon" />
            <el-option label="圆形" value="circle" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="formData.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="坐标数据">
          <el-input v-model="coordinatesText" type="textarea" :rows="4" placeholder="JSON格式坐标数据，如：[[116.39,39.90],[116.40,39.90],...]" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createGeofence">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import L from 'leaflet'
import { geofenceApi } from '@/api'

const geofences = ref([])
const showMapDialog = ref(false)
const showCreateDialog = ref(false)
const mapContainer = ref(null)
let map = null
let currentGeofence = null

const formData = ref({
  name: '',
  fence_type: 'polygon',
  description: '',
  coordinates: []
})

const coordinatesText = ref('')

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const loadGeofences = async () => {
  const res = await geofenceApi.list()
  geofences.value = res.data
}

const toggleActive = async (row) => {
  await geofenceApi.update(row.id, { is_active: row.is_active })
  ElMessage.success('状态更新成功')
}

const viewOnMap = (geofence) => {
  currentGeofence = geofence
  showMapDialog.value = true
  nextTick(() => {
    initMap(geofence)
  })
}

const initMap = (geofence) => {
  if (map) {
    map.remove()
  }
  
  map = L.map(mapContainer.value).setView([39.90923, 116.397428], 13)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

  if (geofence.fence_type === 'polygon' && geofence.coordinates) {
    const latLngs = geofence.coordinates.map(coord => [coord[1], coord[0]])
    L.polygon(latLngs, { color: 'blue', fillOpacity: 0.3 }).addTo(map)
    map.fitBounds(latLngs)
  } else if (geofence.fence_type === 'circle' && geofence.coordinates) {
    const center = [geofence.coordinates[1], geofence.coordinates[0]]
    L.circle(center, { radius: geofence.radius || 500, color: 'red', fillOpacity: 0.3 }).addTo(map)
    map.setView(center, 14)
  }
}

const openCreateDialog = () => {
  formData.value = {
    name: '',
    fence_type: 'polygon',
    description: '',
    coordinates: []
  }
  coordinatesText.value = ''
  showCreateDialog.value = true
}

const createGeofence = async () => {
  try {
    formData.value.coordinates = JSON.parse(coordinatesText.value)
  } catch (e) {
    ElMessage.error('坐标数据格式错误，请输入正确的JSON格式')
    return
  }
  
  await geofenceApi.create(formData.value)
  ElMessage.success('创建围栏成功')
  showCreateDialog.value = false
  loadGeofences()
}

const deleteGeofence = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该围栏吗？', '提示', { type: 'warning' })
    await geofenceApi.delete(row.id)
    ElMessage.success('删除成功')
    loadGeofences()
  } catch (e) {
    // User cancelled
  }
}

watch(showMapDialog, (val) => {
  if (!val && map) {
    map.remove()
    map = null
  }
})

loadGeofences()
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>