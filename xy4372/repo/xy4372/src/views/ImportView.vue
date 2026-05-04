<template>
  <div class="page-container">
    <h2 class="page-title">数据导入</h2>

    <el-alert
      v-if="!appStore.currentSessionId"
      title="请先选择赛事"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom: 20px;"
    >
      <template #default>
        请在"赛事管理"页面创建或选择一个赛事后再进行数据导入。
        <el-button type="primary" link @click="router.push('/sessions')">前往赛事管理</el-button>
      </template>
    </el-alert>

    <template v-else>
      <el-row :gutter="20">
        <el-col :span="12" v-for="importType in importTypes" :key="importType.type">
          <el-card class="import-card" shadow="hover">
            <template #header>
              <div class="import-card-header">
                <div class="import-type-info">
                  <el-icon :size="24" :color="importType.color">
                    <component :is="importType.icon" />
                  </el-icon>
                  <span class="import-type-name">{{ importType.name }}</span>
                </div>
                <el-tag v-if="getImportedCount(importType.type) > 0" type="success" size="small">
                  已导入 {{ getImportedCount(importType.type) }} 条
                </el-tag>
              </div>
            </template>

            <p class="import-description">{{ importType.description }}</p>

            <div class="import-actions">
              <el-upload
                :auto-upload="false"
                :show-file-list="false"
                :on-change="(file) => handleFileSelect(file, importType.type)"
                accept=".xlsx,.xls,.xlsm,.csv"
              >
                <el-button type="primary">
                  <el-icon><Upload /></el-icon>
                  选择文件
                </el-button>
              </el-upload>
              <el-button 
                v-if="getImportedCount(importType.type) > 0" 
                type="danger" 
                text
                @click="handleClearImport(importType.type)"
              >
                清空数据
              </el-button>
            </div>

            <div v-if="getLatestLog(importType.type)" class="import-log">
              <el-divider />
              <div class="log-info">
                <span class="log-label">上次导入:</span>
                <span class="log-value">{{ getLatestLog(importType.type)?.fileName }}</span>
              </div>
              <div class="log-info">
                <span class="log-label">导入记录:</span>
                <span class="log-value">{{ getLatestLog(importType.type)?.recordCount }} 条</span>
              </div>
              <div v-if="getLatestLog(importType.type)?.warnings?.length > 0" class="log-warnings">
                <el-tag type="warning" size="small">
                  {{ getLatestLog(importType.type)?.warnings?.length }} 条警告
                </el-tag>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <div class="action-bar" style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #ebeef5;">
        <el-button type="primary" size="large" :loading="detecting" @click="handleDetectRisks">
          <el-icon><Search /></el-icon>
          执行风险检测
        </el-button>
        <el-button size="large" @click="router.push('/review')" v-if="appStore.sessionData.risks.length > 0">
          查看检测结果
        </el-button>
      </div>

      <el-dialog v-model="showProgressDialog" title="风险检测中" width="500px" :close-on-click-modal="false">
        <el-progress :percentage="progress" :status="progressStatus" />
        <p class="progress-text">{{ progressText }}</p>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Upload,
  Document,
  User,
  Wrench,
  ShoppingBag,
  Calendar,
  Search,
} from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import { useAppStore } from '@/stores'
import { parseFile, type ImportResult } from '@/utils/parser'
import { detectAllRisks } from '@/utils/riskDetector'
import type {
  Horse,
  VetRecord,
  ShoeingRecord,
  TackItem,
  RaceEntry,
  ImportLog,
} from '@/types'

const router = useRouter()
const appStore = useAppStore()

const detecting = ref(false)
const showProgressDialog = ref(false)
const progress = ref(0)
const progressStatus = ref<'success' | 'exception' | 'warning'>()
const progressText = ref('准备中...')

const importTypes = [
  {
    type: 'horses' as const,
    name: '参赛马匹清单',
    description: '导入参赛马匹的基本信息，包括马匹编号、名称、品种、骑手等。',
    icon: Document,
    color: '#409eff',
  },
  {
    type: 'vet_records' as const,
    name: '兽医休养记录',
    description: '导入马匹的兽医治疗记录和休养期信息，用于检测休养期未满风险。',
    icon: User,
    color: '#67c23a',
  },
  {
    type: 'shoeing' as const,
    name: '蹄铁维护表',
    description: '导入马匹的蹄铁维护记录，用于检测蹄铁维护是否超期。',
    icon: Wrench,
    color: '#e6a23c',
  },
  {
    type: 'tack' as const,
    name: '鞍具检查表',
    description: '导入鞍具信息和分配情况，用于检测鞍具尺寸是否匹配。',
    icon: ShoppingBag,
    color: '#909399',
  },
  {
    type: 'race_schedule' as const,
    name: '当天赛程',
    description: '导入当天的赛程安排，包括场次、时间、参赛马匹、天气温度等。',
    icon: Calendar,
    color: '#f56c6c',
  },
]

const importCounts = computed(() => ({
  horses: appStore.sessionData.horses.length,
  vet_records: appStore.sessionData.vetRecords.length,
  shoeing: appStore.sessionData.shoeingRecords.length,
  tack: appStore.sessionData.tackItems.length,
  race_schedule: appStore.sessionData.raceEntries.length,
}))

function getImportedCount(type: string): number {
  return importCounts.value[type as keyof typeof importCounts.value] || 0
}

function getLatestLog(type: string): ImportLog | undefined {
  return appStore.importLogs
    .filter(log => log.type === type)
    .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())[0]
}

async function handleFileSelect(
  file: UploadFile,
  importType: 'horses' | 'vet_records' | 'shoeing' | 'tack' | 'race_schedule'
): Promise<void> {
  if (!file.raw) return

  try {
    const result = await parseFile(file.raw, importType)

    if (!result.success && result.errors.length > 0) {
      ElMessage.error(`导入失败: ${result.errors.join('; ')}`)
      return
    }

    if (result.data.length === 0) {
      ElMessage.warning('文件中没有有效数据')
      return
    }

    switch (importType) {
      case 'horses':
        await appStore.saveHorses(result.data as Horse[])
        break
      case 'vet_records':
        await appStore.saveVetRecords(result.data as VetRecord[])
        break
      case 'shoeing':
        await appStore.saveShoeingRecords(result.data as ShoeingRecord[])
        break
      case 'tack':
        await appStore.saveTackItems(result.data as TackItem[])
        break
      case 'race_schedule':
        await appStore.saveRaceEntries(result.data as RaceEntry[])
        break
    }

    await appStore.addImportLog({
      sessionId: appStore.currentSessionId!,
      type: importType,
      fileName: file.name,
      recordCount: result.data.length,
      importedAt: new Date().toISOString(),
      errors: result.errors,
      warnings: result.warnings,
    })

    if (result.warnings.length > 0) {
      ElMessage.warning(`导入完成，但有 ${result.warnings.length} 条警告`)
    } else {
      ElMessage.success(`成功导入 ${result.data.length} 条数据`)
    }
  } catch (err) {
    ElMessage.error(`导入失败: ${(err as Error).message}`)
  }
}

async function handleClearImport(type: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要清空已导入的数据吗？此操作不可撤销。',
      '确认清空',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )

    switch (type) {
      case 'horses':
        await appStore.saveHorses([])
        break
      case 'vet_records':
        await appStore.saveVetRecords([])
        break
      case 'shoeing':
        await appStore.saveShoeingRecords([])
        break
      case 'tack':
        await appStore.saveTackItems([])
        break
      case 'race_schedule':
        await appStore.saveRaceEntries([])
        break
    }

    ElMessage.success('数据已清空')
  } catch {
    // 用户取消
  }
}

async function handleDetectRisks(): Promise<void> {
  const { horses, vetRecords, shoeingRecords, tackItems, raceEntries } = appStore.sessionData

  if (raceEntries.length === 0) {
    ElMessage.warning('请先导入当天赛程数据')
    return
  }

  detecting.value = true
  showProgressDialog.value = true
  progress.value = 10
  progressText.value = '准备检测数据...'

  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    progress.value = 30
    progressText.value = '检测休养期风险...'

    const settings = await appStore.settings
    const session = appStore.currentSession
    const raceDate = session?.date || new Date().toISOString().split('T')[0]

    await new Promise(resolve => setTimeout(resolve, 200))
    progress.value = 50
    progressText.value = '检测重复排赛风险...'

    const risks = detectAllRisks({
      sessionId: appStore.currentSessionId!,
      horses,
      vetRecords,
      shoeingRecords,
      tackItems,
      raceEntries,
      settings,
      raceDate,
    })

    await new Promise(resolve => setTimeout(resolve, 200))
    progress.value = 80
    progressText.value = '保存检测结果...'

    await appStore.saveCurrentRisks(risks)
    await appStore.updateCurrentSessionStatus('reviewing')

    await new Promise(resolve => setTimeout(resolve, 100))
    progress.value = 100
    progressStatus.value = 'success'
    progressText.value = `检测完成，共发现 ${risks.length} 个风险`

    setTimeout(() => {
      showProgressDialog.value = false
      progress.value = 0
      progressStatus.value = undefined
      progressText.value = ''
      
      if (risks.length > 0) {
        ElMessage.success(`检测完成，共发现 ${risks.length} 个风险，请前往复核页面处理`)
      } else {
        ElMessage.success('检测完成，未发现风险')
      }
    }, 1000)
  } catch (err) {
    progressStatus.value = 'exception'
    progressText.value = `检测失败: ${(err as Error).message}`
    ElMessage.error(`风险检测失败: ${(err as Error).message}`)
  } finally {
    detecting.value = false
  }
}

onMounted(() => {
  if (appStore.currentSessionId) {
    appStore.loadCurrentSessionData()
  }
  appStore.loadSettings()
})
</script>

<style scoped>
.import-card {
  margin-bottom: 20px;
}

.import-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.import-type-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.import-type-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.import-description {
  color: #909399;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
}

.import-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.import-log {
  font-size: 13px;
}

.log-info {
  display: flex;
  margin-bottom: 8px;
}

.log-label {
  color: #909399;
  width: 80px;
}

.log-value {
  color: #303133;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-warnings {
  margin-top: 8px;
}

.progress-text {
  text-align: center;
  margin-top: 16px;
  color: #606266;
}
</style>
