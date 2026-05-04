<template>
  <div>
    <div class="stats-grid" style="margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">已导入设备</div>
            <div class="stat-card-value">{{ stats.devices || 0 }}</div>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">扫描记录</div>
            <div class="stat-card-value">{{ stats.scans || 0 }}</div>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">配对事件</div>
            <div class="stat-card-value">{{ stats.pairingEvents || 0 }}</div>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">区域数量</div>
            <div class="stat-card-value">{{ stats.zones || 0 }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <h3 class="card-title">文件格式说明</h3>
      </div>
      <div class="card-body">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          <div class="file-format-card">
            <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">devices.csv</h4>
            <p style="font-size: 13px; color: var(--color-gray-600); margin-bottom: 12px;">
              设备台账：设备基本信息
            </p>
            <pre style="background: var(--color-gray-50); padding: 12px; border-radius: var(--radius-md); font-size: 11px; overflow-x: auto; margin: 0;">
mac_address,device_name,device_type,serial_number,model,battery_level,status
AA:BB:CC:DD:EE:01,价签-牛奶区1,esl,SN001,ESL-100,85,active
BB:CC:DD:EE:FF:02,打印机-收银台1,printer,SN002,PRT-200,45,active
            </pre>
          </div>

          <div class="file-format-card">
            <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">ble-scans.jsonl</h4>
            <p style="font-size: 13px; color: var(--color-gray-600); margin-bottom: 12px;">
              蓝牙扫描记录：每行一个JSON
            </p>
            <pre style="background: var(--color-gray-50); padding: 12px; border-radius: var(--radius-md); font-size: 11px; overflow-x: auto; margin: 0;">
{"mac_address":"AA:BB:CC:DD:EE:01","rssi":-65,"tx_power":0,"scan_timestamp":"2025-01-15T10:00:00Z","gateway_id":"GW001"}
{"mac_address":"BB:CC:DD:EE:FF:02","rssi":-72,"tx_power":0,"scan_timestamp":"2025-01-15T10:01:00Z","gateway_id":"GW001"}
            </pre>
          </div>

          <div class="file-format-card">
            <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">pairing-events.csv</h4>
            <p style="font-size: 13px; color: var(--color-gray-600); margin-bottom: 12px;">
              配对事件：连接/断开记录
            </p>
            <pre style="background: var(--color-gray-50); padding: 12px; border-radius: var(--radius-md); font-size: 11px; overflow-x: auto; margin: 0;">
mac_address,event_time,event_type,success,error_message,host_device
AA:BB:CC:DD:EE:01,2025-01-15T10:05:00Z,connect,true,,Phone-001
BB:CC:DD:EE:FF:02,2025-01-15T10:06:00Z,connect,false,Connection timeout,Phone-002
            </pre>
          </div>

          <div class="file-format-card">
            <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">zones.json</h4>
            <p style="font-size: 13px; color: var(--color-gray-600); margin-bottom: 12px;">
              区域定义：门店区域配置
            </p>
            <pre style="background: var(--color-gray-50); padding: 12px; border-radius: var(--radius-md); font-size: 11px; overflow-x: auto; margin: 0;">
[
  {"zone_code":"A01","zone_name":"生鲜区","zone_type":"store","rssi_threshold":-80,"disconnect_timeout_minutes":120,"allowed_device_types":["esl","scanner"]},
  {"zone_code":"A02","zone_name":"收银区","zone_type":"store","rssi_threshold":-70,"disconnect_timeout_minutes":60,"allowed_device_types":["printer","scanner","headset"]}
]
            </pre>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <h3 class="card-title">批量导入</h3>
        <span class="badge badge-primary">推荐</span>
      </div>
      <div class="card-body">
        <div 
          class="file-drop-zone" 
          :class="{ dragover: batchDragover }"
          @dragenter.prevent="batchDragover = true"
          @dragleave.prevent="batchDragover = false"
          @dragover.prevent
          @drop.prevent="handleBatchDrop"
          @click="triggerBatchFiles"
        >
          <div v-html="IconUpload"></div>
          <h4 class="file-drop-zone-title">拖放文件到此处或点击选择</h4>
          <p class="file-drop-zone-desc">支持 devices.csv, ble-scans.jsonl, pairing-events.csv, zones.json</p>
          <input 
            type="file" 
            ref="batchFileInput"
            style="display: none;"
            multiple
            accept=".csv,.jsonl,.json"
            @change="handleBatchSelect"
          />
        </div>

        <div v-if="batchFiles.length > 0" class="file-list">
          <div v-for="(file, index) in batchFiles" :key="index" class="file-item">
            <div class="file-item-icon">
              <span v-html="getFileIcon(file.type)"></span>
            </div>
            <div class="file-item-info">
              <div class="file-item-name">{{ file.name }}</div>
              <div class="file-item-size">{{ formatFileSize(file.size) }}</div>
            </div>
            <div class="file-item-status">
              <span v-if="file.uploading" class="badge badge-primary">上传中...</span>
              <span v-else-if="file.success" class="badge badge-success">成功: {{ file.count }} 条</span>
              <span v-else-if="file.error" class="badge badge-danger">失败: {{ file.error }}</span>
              <span v-else class="badge badge-secondary">等待上传</span>
            </div>
          </div>
        </div>

        <div v-if="batchFiles.length > 0" style="margin-top: 16px; display: flex; gap: 12px;">
          <button 
            class="btn btn-primary" 
            :disabled="batchUploading || batchFiles.every(f => f.success)"
            @click="uploadBatch"
          >
            {{ batchUploading ? '上传中...' : '开始上传' }}
          </button>
          <button class="btn btn-secondary" @click="clearBatch">清空选择</button>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">导入设备台账 (devices.csv)</h3>
        </div>
        <div class="card-body">
          <div 
            class="file-drop-zone" 
            :class="{ dragover: devicesDragover }"
            @dragenter.prevent="devicesDragover = true"
            @dragleave.prevent="devicesDragover = false"
            @dragover.prevent
            @drop.prevent="handleDevicesDrop"
            @click="triggerDevicesFile"
          >
            <div v-html="IconUpload"></div>
            <h4 class="file-drop-zone-title">选择 devices.csv 文件</h4>
            <input 
              type="file" 
              ref="devicesFileInput"
              style="display: none;"
              accept=".csv"
              @change="handleDevicesSelect"
            />
          </div>
          <div style="margin-top: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
              <input type="checkbox" v-model="devicesOptions.updateExisting" />
              更新已存在的设备
            </label>
          </div>
          <div v-if="devicesFile" style="margin-top: 16px;">
            <div class="file-item">
              <div class="file-item-icon">
                <span v-html="IconCSV"></span>
              </div>
              <div class="file-item-info">
                <div class="file-item-name">{{ devicesFile.name }}</div>
                <div class="file-item-size">{{ formatFileSize(devicesFile.size) }}</div>
              </div>
              <div class="file-item-status">
                <button class="btn btn-sm btn-primary" :disabled="devicesUploading" @click="uploadDevices">
                  {{ devicesUploading ? '上传中...' : '上传' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">导入扫描记录 (ble-scans.jsonl)</h3>
        </div>
        <div class="card-body">
          <div 
            class="file-drop-zone" 
            :class="{ dragover: scansDragover }"
            @dragenter.prevent="scansDragover = true"
            @dragleave.prevent="scansDragover = false"
            @dragover.prevent
            @drop.prevent="handleScansDrop"
            @click="triggerScansFile"
          >
            <div v-html="IconUpload"></div>
            <h4 class="file-drop-zone-title">选择 ble-scans.jsonl 文件</h4>
            <input 
              type="file" 
              ref="scansFileInput"
              style="display: none;"
              accept=".jsonl,.json"
              @change="handleScansSelect"
            />
          </div>
          <div style="margin-top: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
              <input type="checkbox" v-model="scansOptions.linkToDevice" checked />
              自动关联到设备台账
            </label>
          </div>
          <div v-if="scansFile" style="margin-top: 16px;">
            <div class="file-item">
              <div class="file-item-icon">
                <span v-html="IconJSON"></span>
              </div>
              <div class="file-item-info">
                <div class="file-item-name">{{ scansFile.name }}</div>
                <div class="file-item-size">{{ formatFileSize(scansFile.size) }}</div>
              </div>
              <div class="file-item-status">
                <button class="btn btn-sm btn-primary" :disabled="scansUploading" @click="uploadScans">
                  {{ scansUploading ? '上传中...' : '上传' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">导入配对事件 (pairing-events.csv)</h3>
        </div>
        <div class="card-body">
          <div 
            class="file-drop-zone" 
            :class="{ dragover: pairingDragover }"
            @dragenter.prevent="pairingDragover = true"
            @dragleave.prevent="pairingDragover = false"
            @dragover.prevent
            @drop.prevent="handlePairingDrop"
            @click="triggerPairingFile"
          >
            <div v-html="IconUpload"></div>
            <h4 class="file-drop-zone-title">选择 pairing-events.csv 文件</h4>
            <input 
              type="file" 
              ref="pairingFileInput"
              style="display: none;"
              accept=".csv"
              @change="handlePairingSelect"
            />
          </div>
          <div style="margin-top: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
              <input type="checkbox" v-model="pairingOptions.linkToDevice" checked />
              自动关联到设备台账
            </label>
          </div>
          <div v-if="pairingFile" style="margin-top: 16px;">
            <div class="file-item">
              <div class="file-item-icon">
                <span v-html="IconCSV"></span>
              </div>
              <div class="file-item-info">
                <div class="file-item-name">{{ pairingFile.name }}</div>
                <div class="file-item-size">{{ formatFileSize(pairingFile.size) }}</div>
              </div>
              <div class="file-item-status">
                <button class="btn btn-sm btn-primary" :disabled="pairingUploading" @click="uploadPairing">
                  {{ pairingUploading ? '上传中...' : '上传' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">导入区域定义 (zones.json)</h3>
        </div>
        <div class="card-body">
          <div 
            class="file-drop-zone" 
            :class="{ dragover: zonesDragover }"
            @dragenter.prevent="zonesDragover = true"
            @dragleave.prevent="zonesDragover = false"
            @dragover.prevent
            @drop.prevent="handleZonesDrop"
            @click="triggerZonesFile"
          >
            <div v-html="IconUpload"></div>
            <h4 class="file-drop-zone-title">选择 zones.json 文件</h4>
            <input 
              type="file" 
              ref="zonesFileInput"
              style="display: none;"
              accept=".json"
              @change="handleZonesSelect"
            />
          </div>
          <div style="margin-top: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
              <input type="checkbox" v-model="zonesOptions.updateExisting" />
              更新已存在的区域
            </label>
          </div>
          <div v-if="zonesFile" style="margin-top: 16px;">
            <div class="file-item">
              <div class="file-item-icon">
                <span v-html="IconJSON"></span>
              </div>
              <div class="file-item-info">
                <div class="file-item-name">{{ zonesFile.name }}</div>
                <div class="file-item-size">{{ formatFileSize(zonesFile.size) }}</div>
              </div>
              <div class="file-item-status">
                <button class="btn btn-sm btn-primary" :disabled="zonesUploading" @click="uploadZones">
                  {{ zonesUploading ? '上传中...' : '上传' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <div class="card-header">
        <h3 class="card-title">风险分析</h3>
      </div>
      <div class="card-body">
        <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" v-model="analyzeOptions.reanalyzeExisting" />
            重新分析所有设备
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" v-model="analyzeOptions.clearPrevious" />
            清除之前的异常
          </label>
          <button class="btn btn-primary" :disabled="analyzing" @click="runAnalysis">
            <span v-html="IconRefresh"></span> {{ analyzing ? '分析中...' : '执行风险分析' }}
          </button>
        </div>
        <p style="margin-top: 12px; font-size: 12px; color: var(--color-gray-500);">
          风险分析将检测：RSSI信号波动、长时间失联、低电量、配对失败、随机地址漂移、重复设备、区域越界等问题
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useApi } from '@/utils/api'
import { 
  RefreshIcon,
  UploadIcon
} from '@/components/icons'

export default {
  name: 'Import',
  setup() {
    const api = useApi()

    const stats = ref({
      devices: 0,
      scans: 0,
      pairingEvents: 0,
      zones: 0
    })

    const batchDragover = ref(false)
    const batchFiles = ref([])
    const batchUploading = ref(false)
    const batchFileInput = ref(null)

    const devicesDragover = ref(false)
    const devicesFile = ref(null)
    const devicesUploading = ref(false)
    const devicesFileInput = ref(null)
    const devicesOptions = ref({
      updateExisting: false
    })

    const scansDragover = ref(false)
    const scansFile = ref(null)
    const scansUploading = ref(false)
    const scansFileInput = ref(null)
    const scansOptions = ref({
      linkToDevice: true
    })

    const pairingDragover = ref(false)
    const pairingFile = ref(null)
    const pairingUploading = ref(false)
    const pairingFileInput = ref(null)
    const pairingOptions = ref({
      linkToDevice: true
    })

    const zonesDragover = ref(false)
    const zonesFile = ref(null)
    const zonesUploading = ref(false)
    const zonesFileInput = ref(null)
    const zonesOptions = ref({
      updateExisting: false
    })

    const analyzing = ref(false)
    const analyzeOptions = ref({
      reanalyzeExisting: false,
      clearPrevious: false
    })

    const IconRefresh = RefreshIcon()
    const IconUpload = UploadIcon()
    const IconCSV = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`
    const IconJSON = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>`

    const loadStats = async () => {
      try {
        const result = await api.stats()
        stats.value = result || {
          devices: 0,
          scans: 0,
          pairingEvents: 0,
          zones: 0
        }
      } catch (error) {
        console.error('Failed to load stats:', error)
      }
    }

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const getFileIcon = (type) => {
      if (type && type.includes('csv')) return IconCSV
      if (type && type.includes('json')) return IconJSON
      return IconCSV
    }

    const triggerBatchFiles = () => {
      batchFileInput.value?.click()
    }

    const handleBatchSelect = (e) => {
      const files = Array.from(e.target.files || [])
      files.forEach(file => {
        batchFiles.value.push({
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          uploading: false,
          success: false,
          error: null,
          count: 0
        })
      })
    }

    const handleBatchDrop = (e) => {
      batchDragover.value = false
      const files = Array.from(e.dataTransfer.files || [])
      files.forEach(file => {
        batchFiles.value.push({
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          uploading: false,
          success: false,
          error: null,
          count: 0
        })
      })
    }

    const clearBatch = () => {
      batchFiles.value = []
      if (batchFileInput.value) {
        batchFileInput.value.value = ''
      }
    }

    const uploadBatch = async () => {
      batchUploading.value = true
      
      for (const fileItem of batchFiles.value) {
        if (fileItem.success) continue
        
        fileItem.uploading = true
        fileItem.error = null
        
        try {
          let result
          const name = fileItem.name.toLowerCase()
          
          if (name.includes('devices') && name.endsWith('.csv')) {
            result = await api.import.devices(fileItem.file, devicesOptions.value)
          } else if (name.includes('ble-scans') && (name.endsWith('.jsonl') || name.endsWith('.json'))) {
            result = await api.import.bleScans(fileItem.file, scansOptions.value)
          } else if (name.includes('pairing') && name.endsWith('.csv')) {
            result = await api.import.pairingEvents(fileItem.file, pairingOptions.value)
          } else if (name.includes('zones') && name.endsWith('.json')) {
            result = await api.import.zones(fileItem.file, zonesOptions.value)
          } else {
            fileItem.error = '无法识别的文件类型'
            continue
          }
          
          fileItem.success = true
          fileItem.count = result?.count || 0
          showNotification('success', '上传成功', `${fileItem.name}: 导入 ${fileItem.count} 条记录`)
        } catch (error) {
          fileItem.error = error.message || '上传失败'
          showNotification('error', '上传失败', `${fileItem.name}: ${error.message}`)
        } finally {
          fileItem.uploading = false
        }
      }
      
      batchUploading.value = false
      loadStats()
    }

    const triggerDevicesFile = () => {
      devicesFileInput.value?.click()
    }

    const handleDevicesSelect = (e) => {
      const files = e.target.files
      if (files && files.length > 0) {
        devicesFile.value = files[0]
      }
    }

    const handleDevicesDrop = (e) => {
      devicesDragover.value = false
      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        devicesFile.value = files[0]
      }
    }

    const uploadDevices = async () => {
      if (!devicesFile.value) return
      
      devicesUploading.value = true
      try {
        const result = await api.import.devices(devicesFile.value, devicesOptions.value)
        showNotification('success', '导入成功', `成功导入 ${result.count || 0} 个设备`)
        devicesFile.value = null
        if (devicesFileInput.value) {
          devicesFileInput.value.value = ''
        }
        loadStats()
      } catch (error) {
        showNotification('error', '导入失败', error.message)
      } finally {
        devicesUploading.value = false
      }
    }

    const triggerScansFile = () => {
      scansFileInput.value?.click()
    }

    const handleScansSelect = (e) => {
      const files = e.target.files
      if (files && files.length > 0) {
        scansFile.value = files[0]
      }
    }

    const handleScansDrop = (e) => {
      scansDragover.value = false
      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        scansFile.value = files[0]
      }
    }

    const uploadScans = async () => {
      if (!scansFile.value) return
      
      scansUploading.value = true
      try {
        const result = await api.import.bleScans(scansFile.value, scansOptions.value)
        showNotification('success', '导入成功', `成功导入 ${result.count || 0} 条扫描记录`)
        scansFile.value = null
        if (scansFileInput.value) {
          scansFileInput.value.value = ''
        }
        loadStats()
      } catch (error) {
        showNotification('error', '导入失败', error.message)
      } finally {
        scansUploading.value = false
      }
    }

    const triggerPairingFile = () => {
      pairingFileInput.value?.click()
    }

    const handlePairingSelect = (e) => {
      const files = e.target.files
      if (files && files.length > 0) {
        pairingFile.value = files[0]
      }
    }

    const handlePairingDrop = (e) => {
      pairingDragover.value = false
      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        pairingFile.value = files[0]
      }
    }

    const uploadPairing = async () => {
      if (!pairingFile.value) return
      
      pairingUploading.value = true
      try {
        const result = await api.import.pairingEvents(pairingFile.value, pairingOptions.value)
        showNotification('success', '导入成功', `成功导入 ${result.count || 0} 条配对事件`)
        pairingFile.value = null
        if (pairingFileInput.value) {
          pairingFileInput.value.value = ''
        }
        loadStats()
      } catch (error) {
        showNotification('error', '导入失败', error.message)
      } finally {
        pairingUploading.value = false
      }
    }

    const triggerZonesFile = () => {
      zonesFileInput.value?.click()
    }

    const handleZonesSelect = (e) => {
      const files = e.target.files
      if (files && files.length > 0) {
        zonesFile.value = files[0]
      }
    }

    const handleZonesDrop = (e) => {
      zonesDragover.value = false
      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        zonesFile.value = files[0]
      }
    }

    const uploadZones = async () => {
      if (!zonesFile.value) return
      
      zonesUploading.value = true
      try {
        const result = await api.import.zones(zonesFile.value, zonesOptions.value)
        showNotification('success', '导入成功', `成功导入 ${result.count || 0} 个区域`)
        zonesFile.value = null
        if (zonesFileInput.value) {
          zonesFileInput.value.value = ''
        }
        loadStats()
      } catch (error) {
        showNotification('error', '导入失败', error.message)
      } finally {
        zonesUploading.value = false
      }
    }

    const runAnalysis = async () => {
      analyzing.value = true
      try {
        const result = await api.import.analyze(analyzeOptions.value)
        showNotification('success', '分析完成', `发现 ${result.anomaliesCreated || 0} 个新异常`)
        loadStats()
      } catch (error) {
        showNotification('error', '分析失败', error.message)
      } finally {
        analyzing.value = false
      }
    }

    const showNotification = (type, title, message) => {
      const event = new CustomEvent('notification', {
        detail: { type, title, message }
      })
      window.dispatchEvent(event)
    }

    onMounted(() => {
      loadStats()
    })

    return {
      stats,
      batchDragover,
      batchFiles,
      batchUploading,
      batchFileInput,
      devicesDragover,
      devicesFile,
      devicesUploading,
      devicesFileInput,
      devicesOptions,
      scansDragover,
      scansFile,
      scansUploading,
      scansFileInput,
      scansOptions,
      pairingDragover,
      pairingFile,
      pairingUploading,
      pairingFileInput,
      pairingOptions,
      zonesDragover,
      zonesFile,
      zonesUploading,
      zonesFileInput,
      zonesOptions,
      analyzing,
      analyzeOptions,
      IconRefresh,
      IconUpload,
      IconCSV,
      IconJSON,
      loadStats,
      formatFileSize,
      getFileIcon,
      triggerBatchFiles,
      handleBatchSelect,
      handleBatchDrop,
      clearBatch,
      uploadBatch,
      triggerDevicesFile,
      handleDevicesSelect,
      handleDevicesDrop,
      uploadDevices,
      triggerScansFile,
      handleScansSelect,
      handleScansDrop,
      uploadScans,
      triggerPairingFile,
      handlePairingSelect,
      handlePairingDrop,
      uploadPairing,
      triggerZonesFile,
      handleZonesSelect,
      handleZonesDrop,
      uploadZones,
      runAnalysis
    }
  }
}
</script>

<style scoped>
.file-format-card {
  padding: 16px;
  background: var(--color-gray-50);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-gray-200);
}
</style>
