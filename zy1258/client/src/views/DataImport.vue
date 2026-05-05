<template>
  <div>
    <h2 class="page-title">数据导入</h2>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>导入 manifest.json</span>
              <el-tag type="primary">必需</el-tag>
            </div>
          </template>
          <div class="import-section">
            <p class="description">
              导入 Webpack/Vite 生成的 manifest.json，包含版本信息和资源 hash。
            </p>
            <el-upload
              class="upload-demo"
              drag
              :auto-upload="false"
              :on-change="handleManifestChange"
              :limit="1"
              accept=".json"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将 manifest.json 拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">只能上传 JSON 文件</div>
              </template>
            </el-upload>
            <el-button
              type="primary"
              style="width: 100%; margin-top: 15px;"
              :loading="uploading.manifest"
              :disabled="!manifestFile"
              @click="uploadManifest"
            >
              导入 manifest.json
            </el-button>
            <div v-if="importResults.manifest" class="import-result success">
              <el-icon><CircleCheck /></el-icon>
              导入成功！版本: {{ importResults.manifest.version }}
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>导入 edge-logs.jsonl</span>
              <el-tag type="success">可选</el-tag>
            </div>
          </template>
          <div class="import-section">
            <p class="description">
              导入 CDN 边缘节点日志，分析缓存命中状态和版本混版情况。
            </p>
            <el-select
              v-model="edgeLogBatchId"
              placeholder="选择关联的发布批次（可选）"
              style="width: 100%; margin-bottom: 15px;"
              clearable
            >
              <el-option
                v-for="batch in batches"
                :key="batch.id"
                :label="`v${batch.version} (${batch.resourceCount} 资源)`"
                :value="batch.id"
              />
            </el-select>
            <el-upload
              class="upload-demo"
              drag
              :auto-upload="false"
              :on-change="handleEdgeLogsChange"
              :limit="1"
              accept=".jsonl,.log,.txt"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将 edge-logs.jsonl 拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">支持 .jsonl, .log, .txt 格式</div>
              </template>
            </el-upload>
            <el-button
              type="primary"
              style="width: 100%; margin-top: 15px;"
              :loading="uploading.edgeLogs"
              :disabled="!edgeLogsFile"
              @click="uploadEdgeLogs"
            >
              导入边缘日志
            </el-button>
            <div v-if="importResults.edgeLogs" class="import-result success">
              <el-icon><CircleCheck /></el-icon>
              导入成功！共 {{ importResults.edgeLogs.importedCount }} 条记录
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>导入 purge-events.yaml</span>
              <el-tag type="info">可选</el-tag>
            </div>
          </template>
          <div class="import-section">
            <p class="description">
              导入 CDN purge 操作记录，分析哪些节点可能遗漏了 purge。
            </p>
            <el-select
              v-model="purgeBatchId"
              placeholder="选择关联的发布批次（可选）"
              style="width: 100%; margin-bottom: 15px;"
              clearable
            >
              <el-option
                v-for="batch in batches"
                :key="batch.id"
                :label="`v${batch.version} (${batch.resourceCount} 资源)`"
                :value="batch.id"
              />
            </el-select>
            <el-upload
              class="upload-demo"
              drag
              :auto-upload="false"
              :on-change="handlePurgeEventsChange"
              :limit="1"
              accept=".yaml,.yml"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将 purge-events.yaml 拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">支持 .yaml, .yml 格式</div>
              </template>
            </el-upload>
            <el-button
              type="primary"
              style="width: 100%; margin-top: 15px;"
              :loading="uploading.purgeEvents"
              :disabled="!purgeEventsFile"
              @click="uploadPurgeEvents"
            >
              导入 Purge 记录
            </el-button>
            <div v-if="importResults.purgeEvents" class="import-result success">
              <el-icon><CircleCheck /></el-icon>
              导入成功！共 {{ importResults.purgeEvents.importedCount }} 条记录
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>示例文件说明</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="manifest.json">
          包含版本号、commit hash 和所有资源的 path、type、hash 等信息。
          <br>
          <code>server/examples/manifest-good.json</code> - 正常版本示例
          <br>
          <code>server/examples/manifest-bad-mixed-version.json</code> - 混版问题示例
        </el-descriptions-item>
        <el-descriptions-item label="edge-logs.jsonl">
          每行一个 JSON 对象的日志格式，包含 requestId、timestamp、url、method、statusCode、
          edgeNodeId、cacheStatus、cacheHitMiss、age、clientIp、userAgent 等字段。
          <br>
          <code>server/examples/edge-logs-mixed-cache.jsonl</code> - 混版缓存示例
        </el-descriptions-item>
        <el-descriptions-item label="purge-events.yaml">
          YAML 格式的 purge 操作记录列表，包含 purgeId、action、urls、status、edgeNodes、
          skippedNodes 等字段。
          <br>
          <code>server/examples/purge-events-with-skipped-nodes.yaml</code> - 漏节点示例
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { importApi, queryApi } from '../api'

const manifestFile = ref<File | null>(null)
const edgeLogsFile = ref<File | null>(null)
const purgeEventsFile = ref<File | null>(null)

const edgeLogBatchId = ref<string>('')
const purgeBatchId = ref<string>('')

const batches = ref<any[]>([])

const uploading = ref({
  manifest: false,
  edgeLogs: false,
  purgeEvents: false
})

const importResults = ref({
  manifest: null as any,
  edgeLogs: null as any,
  purgeEvents: null as any
})

const loadBatches = async () => {
  try {
    const res = await queryApi.getReleaseBatches()
    if (res.data.success) {
      batches.value = res.data.data
    }
  } catch (error) {
    console.error('Failed to load batches:', error)
  }
}

const handleManifestChange = (file: any) => {
  manifestFile.value = file.raw
}

const handleEdgeLogsChange = (file: any) => {
  edgeLogsFile.value = file.raw
}

const handlePurgeEventsChange = (file: any) => {
  purgeEventsFile.value = file.raw
}

const uploadManifest = async () => {
  if (!manifestFile.value) return
  uploading.value.manifest = true
  try {
    const res = await importApi.importManifest(manifestFile.value)
    if (res.data.success) {
      importResults.value.manifest = res.data.data.releaseBatch
      ElMessage.success('Manifest 导入成功')
      loadBatches()
    }
  } catch (error: any) {
    ElMessage.error('导入失败: ' + (error.response?.data?.error || error.message))
  } finally {
    uploading.value.manifest = false
  }
}

const uploadEdgeLogs = async () => {
  if (!edgeLogsFile.value) return
  uploading.value.edgeLogs = true
  try {
    const res = await importApi.importEdgeLogs(edgeLogsFile.value, edgeLogBatchId.value || undefined)
    if (res.data.success) {
      importResults.value.edgeLogs = res.data.data
      ElMessage.success('边缘日志导入成功')
    }
  } catch (error: any) {
    ElMessage.error('导入失败: ' + (error.response?.data?.error || error.message))
  } finally {
    uploading.value.edgeLogs = false
  }
}

const uploadPurgeEvents = async () => {
  if (!purgeEventsFile.value) return
  uploading.value.purgeEvents = true
  try {
    const res = await importApi.importPurgeEvents(purgeEventsFile.value, purgeBatchId.value || undefined)
    if (res.data.success) {
      importResults.value.purgeEvents = res.data.data
      ElMessage.success('Purge 记录导入成功')
    }
  } catch (error: any) {
    ElMessage.error('导入失败: ' + (error.response?.data?.error || error.message))
  } finally {
    uploading.value.purgeEvents = false
  }
}

onMounted(() => {
  loadBatches()
})
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #303133;
}

.import-section {
  text-align: center;
}

.description {
  color: #909399;
  font-size: 14px;
  margin-bottom: 15px;
  line-height: 1.5;
}

.upload-demo {
  width: 100%;
}

.import-result {
  margin-top: 10px;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
}

.import-result.success {
  background-color: #f0f9eb;
  color: #67c23a;
}

.import-result.error {
  background-color: #fef0f0;
  color: #f56c6c;
}
</style>
