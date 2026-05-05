<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">创建实验</h1>
        <p class="text-gray-500 mt-1">配置实验参数，对比 Reactor 和 Proactor 模型</p>
      </div>
      <router-link to="/" class="text-sm text-gray-500 hover:text-gray-700">
        ← 返回列表
      </router-link>
    </div>

    <div v-if="validationErrors.length > 0" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-start">
        <svg class="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">参数验证失败</h3>
          <div class="mt-2 space-y-1">
            <p v-for="(error, index) in validationErrors" :key="index" class="text-sm text-red-700">
              <span class="font-medium">{{ error.field }}:</span> {{ error.message }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="validationHints.length > 0" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div class="flex items-start">
        <svg class="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-blue-800">提示</h3>
          <div class="mt-2 space-y-1">
            <p v-for="(hint, index) in validationHints" :key="index" class="text-sm text-blue-700">
              {{ hint.hint }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">实验名称 <span class="text-red-500">*</span></label>
            <input 
              v-model="form.name" 
              type="text" 
              class="form-input"
              placeholder="例如：基础对比实验"
              required
            />
          </div>
          <div class="form-group">
            <label class="form-label">种子值 (Seed)</label>
            <input 
              v-model.number="form.seed" 
              type="number" 
              class="form-input"
              placeholder="留空使用随机值"
            />
            <p class="text-xs text-gray-500 mt-1">相同种子值可复现实验结果</p>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">实验描述</label>
          <textarea 
            v-model="form.description" 
            rows="2" 
            class="form-input"
            placeholder="描述这个实验的目的...">
          </textarea>
        </div>
      </div>

      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">连接与事件配置</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="form-group">
            <label class="form-label">连接数</label>
            <input 
              v-model.number="form.connections" 
              type="number" 
              class="form-input"
              min="1"
              max="10000"
            />
            <p class="text-xs text-gray-500 mt-1">建议 1-1000</p>
          </div>
          <div class="form-group">
            <label class="form-label">读事件数</label>
            <input 
              v-model.number="form.readEvents" 
              type="number" 
              class="form-input"
              min="0"
              max="100000"
            />
            <p class="text-xs text-gray-500 mt-1">每个连接产生的读事件</p>
          </div>
          <div class="form-group">
            <label class="form-label">写事件数</label>
            <input 
              v-model.number="form.writeEvents" 
              type="number" 
              class="form-input"
              min="0"
              max="100000"
            />
            <p class="text-xs text-gray-500 mt-1">每个连接产生的写事件</p>
          </div>
        </div>
        <div class="mt-4 p-3 bg-gray-50 rounded-lg">
          <p class="text-sm text-gray-600">
            <span class="font-medium">预计总事件数:</span> 
            <span class="text-primary-600 font-semibold">{{ form.connections * (form.readEvents + form.writeEvents) }}</span>
          </p>
        </div>
      </div>

      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">性能参数</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="form-group">
            <label class="form-label">回调耗时 (ms)</label>
            <input 
              v-model.number="form.callbackDelay" 
              type="number" 
              class="form-input"
              min="0"
              max="10000"
            />
            <p class="text-xs text-gray-500 mt-1">模拟 handler 执行时间</p>
          </div>
          <div class="form-group">
            <label class="form-label">失败率</label>
            <div class="flex items-center space-x-3">
              <input 
                v-model.number="form.failureRate" 
                type="range" 
                class="flex-1"
                min="0"
                max="1"
                step="0.01"
              />
              <span class="text-sm font-medium text-gray-700 w-16 text-right">
                {{ (form.failureRate * 100).toFixed(0) }}%
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-1">模拟事件处理失败的概率</p>
          </div>
          <div class="form-group">
            <label class="form-label">线程池大小</label>
            <input 
              v-model.number="form.threadPoolSize" 
              type="number" 
              class="form-input"
              min="1"
              max="32"
            />
            <p class="text-xs text-gray-500 mt-1">仅 Proactor 模型使用</p>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">超时配置</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">读超时 (ms)</label>
            <input 
              v-model.number="form.readTimeout" 
              type="number" 
              class="form-input"
              min="100"
              max="60000"
            />
          </div>
          <div class="form-group">
            <label class="form-label">写超时 (ms)</label>
            <input 
              v-model.number="form.writeTimeout" 
              type="number" 
              class="form-input"
              min="100"
              max="60000"
            />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900">自定义 Handlers</h2>
          <button 
            type="button"
            @click="addHandler"
            class="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            <span>添加 Handler</span>
          </button>
        </div>
        
        <div v-if="form.handlers.length === 0" class="text-center py-8 text-gray-400">
          <p>暂无自定义 Handler，将使用默认 Handler</p>
        </div>
        
        <div v-else class="space-y-3">
          <div 
            v-for="(handler, index) in form.handlers" 
            :key="index"
            class="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
          >
            <input 
              v-model="handler.name" 
              type="text" 
              class="form-input flex-1"
              placeholder="Handler 名称"
            />
            <select v-model="handler.eventType" class="form-input w-48">
              <option value="connection_accepted">连接接受</option>
              <option value="connection_closed">连接关闭</option>
              <option value="read_ready">读就绪 (Reactor)</option>
              <option value="write_ready">写就绪 (Reactor)</option>
              <option value="read_completed">读完成 (Proactor)</option>
              <option value="write_completed">写完成 (Proactor)</option>
              <option value="read_timeout">读超时</option>
              <option value="write_timeout">写超时</option>
            </select>
            <button 
              type="button"
              @click="removeHandler(index)"
              class="text-red-500 hover:text-red-700"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="flex justify-end space-x-4">
        <button 
          type="button"
          @click="resetForm"
          class="btn-secondary"
          :disabled="loading"
        >
          重置
        </button>
        <button 
          type="submit"
          class="btn-primary flex items-center space-x-2"
          :disabled="loading"
        >
          <svg v-if="loading" class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ loading ? '创建中...' : '创建实验' }}</span>
        </button>
      </div>
    </form>

    <div v-if="seedData && seedData.seedExperiments && seedData.seedExperiments.length > 0" class="card">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">预设实验配置</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          v-for="preset in seedData.seedExperiments" 
          :key="preset.seed"
          class="p-4 border border-gray-200 rounded-lg hover:border-primary-300 cursor-pointer transition-colors"
          @click="usePreset(preset)"
        >
          <h3 class="font-medium text-gray-900 mb-1">{{ preset.name }}</h3>
          <p class="text-sm text-gray-500 mb-3">{{ preset.description }}</p>
          <div class="flex flex-wrap gap-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
              {{ preset.connections }} 连接
            </span>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-600">
              {{ preset.readEvents }} 读
            </span>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-600">
              {{ preset.writeEvents }} 写
            </span>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-600">
              {{ (preset.failureRate * 100).toFixed(0) }}% 失败率
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useExperimentStore } from '@/stores/experimentStore'

const route = useRoute()
const router = useRouter()
const store = useExperimentStore()

const loading = computed(() => store.loading)
const validationErrors = computed(() => store.validationErrors)
const validationHints = computed(() => store.validationHints)
const seedData = computed(() => store.seedData)

const defaultForm = {
  name: '',
  description: '',
  seed: null,
  connections: 10,
  readEvents: 100,
  writeEvents: 50,
  callbackDelay: 10,
  readTimeout: 5000,
  writeTimeout: 5000,
  failureRate: 0,
  threadPoolSize: 4,
  handlers: []
}

const form = ref({ ...defaultForm })

const usePreset = (preset) => {
  form.value = { ...defaultForm, ...preset }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const addHandler = () => {
  form.value.handlers.push({
    name: '',
    eventType: 'read_ready'
  })
}

const removeHandler = (index) => {
  form.value.handlers.splice(index, 1)
}

const resetForm = () => {
  form.value = { ...defaultForm }
  store.clearValidation()
}

const handleSubmit = async () => {
  try {
    const result = await store.createExperiment(form.value)
    router.push(`/experiment/${result.id}`)
  } catch (error) {
    console.error('Failed to create experiment:', error)
  }
}

onMounted(async () => {
  await store.fetchSeedData()
  
  if (route.query.preset) {
    try {
      const preset = JSON.parse(route.query.preset)
      usePreset(preset)
    } catch (e) {
      console.error('Failed to parse preset:', e)
    }
  }
})
</script>
