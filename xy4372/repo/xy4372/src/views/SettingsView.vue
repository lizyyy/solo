<template>
  <div class="page-container">
    <h2 class="page-title">系统设置</h2>

    <el-card class="settings-card">
      <template #header>
        <div class="section-header">
          <span>风险检测阈值设置</span>
          <el-button type="primary" @click="handleSaveSettings">
            <el-icon><Check /></el-icon>
            保存设置
          </el-button>
        </div>
      </template>

      <el-form
        :model="settingsForm"
        :rules="settingsRules"
        ref="settingsFormRef"
        label-width="200px"
        class="settings-form"
      >
        <el-form-item label="默认休养期天数" prop="defaultRestPeriodDays">
          <el-input-number
            v-model="settingsForm.defaultRestPeriodDays"
            :min="1"
            :max="90"
            :step="1"
          />
          <span class="form-hint">兽医记录中未指定休养天数时的默认值</span>
        </el-form-item>

        <el-form-item label="蹄铁维护周期(天)" prop="shoeingIntervalDays">
          <el-input-number
            v-model="settingsForm.shoeingIntervalDays"
            :min="7"
            :max="180"
            :step="1"
          />
          <span class="form-hint">蹄铁记录中未指定下次维护日期时的默认间隔</span>
        </el-form-item>

        <el-form-item label="高温阈值(°C)" prop="highTemperatureThreshold">
          <el-input-number
            v-model="settingsForm.highTemperatureThreshold"
            :min="25"
            :max="45"
            :step="1"
          />
          <span class="form-hint">超过此温度的场次将被标记为高温风险</span>
        </el-form-item>

        <el-form-item label="尺寸容差(单位)" prop="sizeTolerance">
          <el-input-number
            v-model="settingsForm.sizeTolerance"
            :min="0"
            :max="10"
            :step="0.5"
          />
          <span class="form-hint">鞍具尺寸与马匹预期尺寸的允许差异范围</span>
        </el-form-item>

        <el-divider />

        <el-form-item label="关于">
          <div class="about-section">
            <p><strong>马术俱乐部赛前预检工具</strong></p>
            <p>版本: 1.0.0</p>
            <p>本工具用于赛前自动检测以下风险:</p>
            <ul>
              <li>休养期未满 - 兽医记录中的休养期未到</li>
              <li>重复排赛 - 同一匹马在同一天内被安排多场比赛</li>
              <li>蹄铁维护超期 - 蹄铁维护记录已超期</li>
              <li>鞍具尺寸不匹配 - 分配的鞍具尺寸可能不匹配</li>
              <li>高温场次风险 - 比赛温度过高存在中暑风险</li>
            </ul>
            <p class="storage-info">
              <el-icon><InfoFilled /></el-icon>
              所有数据仅存储在本地浏览器的 IndexedDB 中，不会上传到任何服务器。
            </p>
          </div>
        </el-form-item>

        <el-divider />

        <el-form-item label="数据管理">
          <div class="data-management">
            <el-button type="danger" @click="handleClearAllData">
              <el-icon><Delete /></el-icon>
              清除所有本地数据
            </el-button>
            <span class="form-hint warning">此操作将清除所有赛事数据，不可恢复！</span>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  Check,
  Delete,
  InfoFilled,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores'
import type { AppSettings } from '@/types'

const appStore = useAppStore()

const settingsFormRef = ref<FormInstance>()
const settingsForm = reactive<AppSettings>({
  defaultRestPeriodDays: 14,
  shoeingIntervalDays: 42,
  highTemperatureThreshold: 35,
  sizeTolerance: 2,
  reviewRequired: true,
})

const settingsRules: FormRules<AppSettings> = {
  defaultRestPeriodDays: [
    { type: 'number', required: true, message: '请输入默认休养期天数', trigger: 'blur' },
    { type: 'number', min: 1, max: 90, message: '休养期天数应在 1-90 之间', trigger: 'blur' },
  ],
  shoeingIntervalDays: [
    { type: 'number', required: true, message: '请输入蹄铁维护周期', trigger: 'blur' },
    { type: 'number', min: 7, max: 180, message: '维护周期应在 7-180 天之间', trigger: 'blur' },
  ],
  highTemperatureThreshold: [
    { type: 'number', required: true, message: '请输入高温阈值', trigger: 'blur' },
    { type: 'number', min: 25, max: 45, message: '高温阈值应在 25-45°C 之间', trigger: 'blur' },
  ],
  sizeTolerance: [
    { type: 'number', required: true, message: '请输入尺寸容差', trigger: 'blur' },
    { type: 'number', min: 0, max: 10, message: '尺寸容差应在 0-10 之间', trigger: 'blur' },
  ],
}

async function handleSaveSettings(): Promise<void> {
  if (!settingsFormRef.value) return

  await settingsFormRef.value.validate(async (valid) => {
    if (valid) {
      Object.assign(appStore.settings, settingsForm)
      await appStore.saveCurrentSettings()
      ElMessage.success('设置已保存')
    }
  })
}

async function handleClearAllData(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要清除所有本地数据吗？此操作将删除所有赛事记录、导入数据和风险检测结果，且不可恢复！',
      '确认清除',
      {
        confirmButtonText: '确定清除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    const db = await import('@/database')
    const idb = await db.getDB()
    
    const storeNames = Array.from(idb.objectStoreNames)
    for (const storeName of storeNames) {
      await idb.clear(storeName)
    }

    appStore.clearCurrentSession()
    await appStore.loadSessions()
    await appStore.loadSettings()

    ElMessage.success('所有数据已清除')
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(`清除失败: ${(err as Error).message}`)
    }
  }
}

onMounted(() => {
  appStore.loadSettings()
  Object.assign(settingsForm, appStore.settings)
})
</script>

<style scoped>
.settings-card {
  max-width: 800px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 600;
}

.settings-form {
  padding: 20px 0;
}

.form-hint {
  margin-left: 16px;
  color: #909399;
  font-size: 13px;
}

.form-hint.warning {
  color: #f56c6c;
}

.about-section {
  color: #606266;
  line-height: 1.8;
}

.about-section p {
  margin: 8px 0;
}

.about-section ul {
  margin: 12px 0;
  padding-left: 24px;
}

.about-section li {
  margin: 4px 0;
}

.storage-info {
  margin-top: 16px;
  padding: 12px;
  background-color: #ecf5ff;
  border-radius: 4px;
  color: #409eff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.data-management {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
