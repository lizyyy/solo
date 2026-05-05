<template>
  <a-layout class="simulator-layout">
    <a-layout-header class="simulator-header">
      <div class="header-content">
        <div class="header-left">
          <h2 class="app-title">
            <laptop-outlined /> 操作系统机制实验台
          </h2>
        </div>
        <div class="header-right">
          <a-dropdown>
            <a-button type="primary">
              <plus-outlined /> 加载样例
            </a-button>
            <template #overlay>
              <a-menu @click="handleLoadSample">
                <a-menu-item 
                  v-for="(sample, index) in sampleWorkloads" 
                  :key="index"
                  :data-index="index"
                >
                  {{ sample.name }}
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
          
          <a-upload
            :showUploadList="false"
            :before-upload="handleImportWorkload"
            accept=".json"
          >
            <a-button>
              <upload-outlined /> 导入
            </a-button>
          </a-upload>
          
          <a-dropdown>
            <a-button type="default">
              <download-outlined /> 导出
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item key="markdown" @click="handleExportMarkdown">
                  <file-text-outlined /> Markdown 报告
                </a-menu-item>
                <a-menu-item key="json" @click="handleExportJSON">
                  <file-jpg-outlined /> JSON 报告
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>
    </a-layout-header>

    <a-layout-content class="simulator-content">
      <a-row :gutter="[16, 16]" style="height: 100%">
        <a-col :span="18" class="main-panel">
          <a-card title="控制面板" class="control-panel">
            <a-space :size="16">
              <a-space>
                <a-button 
                  type="primary" 
                  :icon="simulatorStore.isAutoRunning ? 'pause' : 'play'"
                  @click="toggleAutoRun"
                >
                  {{ simulatorStore.isAutoRunning ? '暂停' : '运行' }}
                </a-button>
                <a-button @click="handleStep" :disabled="simulatorStore.isAutoRunning">
                  <step-forward-outlined /> 单步
                </a-button>
                <a-button @click="handleStep10" :disabled="simulatorStore.isAutoRunning">
                  前进 10 步
                </a-button>
                <a-button danger @click="handleReset">
                  <reload-outlined /> 重置
                </a-button>
              </a-space>
              
              <a-divider type="vertical" />
              
              <a-space>
                <span>速度:</span>
                <a-slider 
                  v-model:value="autoRunSpeed" 
                  :min="50" 
                  :max="2000" 
                  :step="50"
                  :reverse="true"
                  style="width: 150px"
                  @change="handleSpeedChange"
                />
                <span>{{ formatSpeedLabel }}</span>
              </a-space>
              
              <a-divider type="vertical" />
              
              <a-space>
                <a-button @click="handleTakeSnapshot">
                  <camera-outlined /> 快照
                </a-button>
                <a-dropdown>
                  <a-button>
                    <history-outlined /> 历史 ({{ simulatorStore.snapshots.length }})
                  </a-button>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item 
                        v-for="(snapshot, index) in simulatorStore.snapshots" 
                        :key="snapshot.id"
                        @click="handleLoadSnapshot(snapshot)"
                      >
                        Tick {{ snapshot.tick }}: {{ snapshot.description || '无描述' }}
                      </a-menu-item>
                      <a-menu-divider v-if="simulatorStore.snapshots.length > 0" />
                      <a-menu-item v-if="simulatorStore.snapshots.length === 0" disabled>
                        暂无快照
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </a-space>
              
              <a-space class="tick-display">
                <a-badge :count="simulatorStore.tick" :showZero="true">
                  <span class="tick-label">Tick</span>
                </a-badge>
              </a-space>
            </a-space>
          </a-card>

          <a-card title="任务管理" class="task-management-panel">
            <template #extra>
              <a-button type="primary" size="small" @click="showCreateTaskModal">
                <plus-outlined /> 新建任务
              </a-button>
            </template>
            
            <a-table 
              :columns="taskColumns" 
              :data-source="simulatorStore.tasks"
              :pagination="false"
              :row-key="'id'"
              :row-selection="{
                selectedRowKeys: selectedTaskIds,
                onChange: (keys) => { selectedTaskIds = keys as string[] }
              }"
              @row-click="(record) => simulatorStore.selectTask(record.id)"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                  <span class="task-name">{{ record.name }}</span>
                  <a-tag :color="getTaskTypeColor(record.type)" class="task-type-tag">
                    {{ getTaskTypeLabel(record.type) }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'state'">
                  <a-tag :color="getTaskStateColor(record.state)">
                    {{ getTaskStateLabel(record.state) }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'executionMode'">
                  <a-tag :color="getModeColor(record.executionMode)">
                    {{ getModeLabel(record.executionMode) }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'priority'">
                  <a-rate v-model:value="record.priority" :count="5" disabled />
                </template>
                <template v-else-if="column.key === 'action'">
                  <a-space>
                    <a-button size="small" @click.stop="() => simulatorStore.selectTask(record.id)">
                      查看
                    </a-button>
                    <a-popconfirm 
                      title="确定删除此任务?" 
                      @confirm="() => simulatorStore.removeTask(record.id)"
                    >
                      <a-button size="small" danger type="link">
                        删除
                      </a-button>
                    </a-popconfirm>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-card>

          <a-card title="调度队列" class="queue-panel">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-descriptions title="运行中" :column="1" size="small" bordered>
                  <a-descriptions-item>
                    <template v-if="simulatorStore.runningTask">
                      <a-tag color="orange">{{ simulatorStore.runningTask.name }}</a-tag>
                      <div class="queue-detail">
                        指令: {{ simulatorStore.runningTask.currentInstructionIndex + 1 }}/{{ simulatorStore.runningTask.instructions.length }}
                      </div>
                    </template>
                    <span v-else class="empty-queue">空闲</span>
                  </a-descriptions-item>
                </a-descriptions>
              </a-col>
              
              <a-col :span="8">
                <a-descriptions title="就绪队列" :column="1" size="small" bordered>
                  <a-descriptions-item>
                    <template v-if="simulatorStore.readyQueue.length > 0">
                      <a-space wrap>
                        <a-tag 
                          v-for="taskId in simulatorStore.readyQueue" 
                          :key="taskId"
                          color="green"
                        >
                          {{ getTaskName(taskId) }}
                        </a-tag>
                      </a-space>
                    </template>
                    <span v-else class="empty-queue">空</span>
                  </a-descriptions-item>
                </a-descriptions>
              </a-col>
              
              <a-col :span="8">
                <a-descriptions title="阻塞队列" :column="1" size="small" bordered>
                  <a-descriptions-item>
                    <template v-if="simulatorStore.blockedQueue.length > 0">
                      <a-space wrap>
                        <a-tag 
                          v-for="taskId in simulatorStore.blockedQueue" 
                          :key="taskId"
                          color="red"
                        >
                          {{ getTaskName(taskId) }}
                        </a-tag>
                      </a-space>
                    </template>
                    <span v-else class="empty-queue">空</span>
                  </a-descriptions-item>
                </a-descriptions>
              </a-col>
            </a-row>
          </a-card>
        </a-col>

        <a-col :span="6" class="right-panel">
          <a-card title="配置" class="config-panel">
            <a-form layout="vertical" :model="configForm">
              <a-form-item label="时间片长度 (Tick)">
                <a-input-number 
                  v-model:value="configForm.timeSlice" 
                  :min="1" 
                  :max="20"
                  @change="handleConfigChange"
                />
              </a-form-item>
              
              <a-form-item label="I/O 延迟 (Tick)">
                <a-input-number 
                  v-model:value="configForm.ioLatency" 
                  :min="1" 
                  :max="10"
                  @change="handleConfigChange"
                />
              </a-form-item>
              
              <a-form-item label="调度算法">
                <a-select 
                  v-model:value="configForm.schedulerType"
                  @change="handleConfigChange"
                >
                  <a-select-option value="round_robin">时间片轮转 (RR)</a-select-option>
                  <a-select-option value="priority">优先级调度</a-select-option>
                  <a-select-option value="fcfs">先来先服务 (FCFS)</a-select-option>
                </a-select>
              </a-form-item>
              
              <a-form-item>
                <a-checkbox 
                  v-model:checked="configForm.enablePreemption"
                  @change="handleConfigChange"
                >
                  启用抢占
                </a-checkbox>
              </a-form-item>
              
              <a-form-item>
                <a-checkbox 
                  v-model:checked="configForm.enableTimerInterrupt"
                  @change="handleConfigChange"
                >
                  启用定时器中断
                </a-checkbox>
              </a-form-item>
              
              <a-form-item label="定时器间隔 (Tick)" v-if="configForm.enableTimerInterrupt">
                <a-input-number 
                  v-model:value="configForm.timerInterval" 
                  :min="1" 
                  :max="20"
                  @change="handleConfigChange"
                />
              </a-form-item>
            </a-form>
          </a-card>

          <a-card title="事件时间线" class="timeline-panel">
            <a-timeline mode="left">
              <a-timeline-item 
                v-for="event in recentEvents" 
                :key="event.id"
                :color="getEventColor(event.type)"
                @click="simulatorStore.selectEvent(event.id)"
                class="timeline-item"
                :class="{ 'selected': simulatorStore.selectedEventId === event.id }"
              >
                <template #dot>
                  <component :is="getEventIcon(event.type)" />
                </template>
                <div class="timeline-content">
                  <div class="timeline-tick">Tick {{ event.tick }}</div>
                  <div class="timeline-description">{{ event.description }}</div>
                  <div v-if="event.taskName" class="timeline-task">
                    <a-tag size="small">{{ event.taskName }}</a-tag>
                  </div>
                </div>
              </a-timeline-item>
              
              <a-timeline-item v-if="simulatorStore.events.length === 0">
                暂无事件，开始运行以观察系统行为
              </a-timeline-item>
            </a-timeline>
          </a-card>

          <a-card 
            v-if="simulatorStore.selectedTask" 
            title="任务详情" 
            class="task-detail-panel"
          >
            <template #extra>
              <a-button size="small" @click="simulatorStore.selectTask(null)">
                关闭
              </a-button>
            </template>
            
            <a-descriptions :column="1" size="small" bordered>
              <a-descriptions-item label="名称">
                {{ simulatorStore.selectedTask.name }}
              </a-descriptions-item>
              <a-descriptions-item label="类型">
                {{ getTaskTypeLabel(simulatorStore.selectedTask.type) }}
              </a-descriptions-item>
              <a-descriptions-item label="状态">
                <a-tag :color="getTaskStateColor(simulatorStore.selectedTask.state)">
                  {{ getTaskStateLabel(simulatorStore.selectedTask.state) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="优先级">
                {{ simulatorStore.selectedTask.priority }}
              </a-descriptions-item>
              <a-descriptions-item label="CPU 时间">
                {{ simulatorStore.selectedTask.cpuTimeUsed }} ticks
              </a-descriptions-item>
              <a-descriptions-item label="I/O 时间">
                {{ simulatorStore.selectedTask.ioTimeUsed }} ticks
              </a-descriptions-item>
              <a-descriptions-item label="总时间">
                {{ simulatorStore.selectedTask.totalTime }} ticks
              </a-descriptions-item>
            </a-descriptions>
            
            <a-divider>指令序列</a-divider>
            
            <a-list :data-source="simulatorStore.selectedTask.instructions" size="small">
              <template #renderItem="{ item, index }">
                <a-list-item 
                  :class="{ 'current-instruction': index === simulatorStore.selectedTask!.currentInstructionIndex }"
                >
                  <a-list-item-meta>
                    <template #title>
                      <span :class="{ 'executing': index === simulatorStore.selectedTask!.currentInstructionIndex }">
                        [{{ index + 1 }}] {{ getInstructionLabel(item.type) }}
                      </span>
                    </template>
                    <template #description>
                      {{ item.description }} ({{ item.duration }} ticks)
                    </template>
                  </a-list-item-meta>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>
      </a-row>
    </a-layout-content>

    <a-modal
      v-model:open="createTaskModalVisible"
      title="新建任务"
      @ok="handleCreateTask"
      okText="创建"
      cancelText="取消"
    >
      <a-form :model="newTaskForm" layout="vertical">
        <a-form-item label="任务名称" required>
          <a-input v-model:value="newTaskForm.name" placeholder="请输入任务名称" />
        </a-form-item>
        
        <a-form-item label="任务类型" required>
          <a-radio-group v-model:value="newTaskForm.type">
            <a-radio value="process">进程</a-radio>
            <a-radio value="thread">线程</a-radio>
            <a-radio value="coroutine">协程</a-radio>
          </a-radio-group>
        </a-form-item>
        
        <a-form-item label="优先级">
          <a-rate v-model:value="newTaskForm.priority" :count="5" />
        </a-form-item>
        
        <a-form-item label="指令序列">
          <div class="instruction-list">
            <a-table 
              :columns="instructionColumns"
              :data-source="newTaskForm.instructions"
              :pagination="false"
              :row-key="'id'"
              size="small"
            >
              <template #bodyCell="{ column, record, index }">
                <template v-else-if="column.key === 'type'">
                  <a-select 
                    v-model:value="record.type" 
                    style="width: 120px"
                    @change="updateInstructionType(record.id, record.type)"
                  >
                    <a-select-option value="compute">计算</a-select-option>
                    <a-select-option value="io">I/O</a-select-option>
                    <a-select-option value="syscall">系统调用</a-select-option>
                    <a-select-option value="yield">让出</a-select-option>
                    <a-select-option value="terminate">终止</a-select-option>
                  </a-select>
                </template>
                <template v-else-if="column.key === 'description'">
                  <a-input v-model:value="record.description" placeholder="描述" />
                </template>
                <template v-else-if="column.key === 'duration'">
                  <a-input-number v-model:value="record.duration" :min="1" style="width: 80px" />
                </template>
                <template v-else-if="column.key === 'action'">
                  <a-space>
                    <a-button 
                      size="small" 
                      :disabled="index === 0"
                      @click="moveInstruction(index, -1)"
                    >
                      <up-outlined />
                    </a-button>
                    <a-button 
                      size="small"
                      :disabled="index === newTaskForm.instructions.length - 1"
                      @click="moveInstruction(index, 1)"
                    >
                      <down-outlined />
                    </a-button>
                    <a-button 
                      size="small" 
                      danger
                      @click="removeInstruction(index)"
                    >
                      <delete-outlined />
                    </a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
            <a-button type="dashed" style="width: 100%; margin-top: 8px" @click="addInstruction">
              <plus-outlined /> 添加指令
            </a-button>
          </div>
        </a-form-item>
        
        <a-form-item>
          <a-select 
            v-model:value="selectedInstructionTemplate"
            placeholder="快速添加指令模板"
            @change="addInstructionFromTemplate"
            allow-clear
          >
            <a-select-option 
              v-for="(tmpl, key) in instructionTemplates" 
              :key="key"
              :value="key"
            >
              {{ tmpl.description }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="snapshotModalVisible"
      title="保存快照"
      @ok="handleSaveSnapshot"
    >
      <a-form-item label="描述">
        <a-textarea 
          v-model:value="snapshotDescription"
          placeholder="为当前状态添加描述..."
          :rows="3"
        />
      </a-form-item>
    </a-modal>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import { 
  LaptopOutlined, 
  PlusOutlined, 
  UploadOutlined, 
  DownloadOutlined,
  ReloadOutlined,
  StepForwardOutlined,
  CameraOutlined,
  HistoryOutlined,
  UpOutlined,
  DownOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FileJpgOutlined
} from '@ant-design/icons-vue'
import { useSimulatorStore } from '@/stores/simulator'
import { SAMPLE_WORKLOADS, INSTRUCTION_TEMPLATES, ANOMALY_EXAMPLES } from '@/core/samples'
import { TASK_TYPE_LABELS, TASK_STATE_LABELS, TASK_STATE_COLORS, EXECUTION_MODE_LABELS, EXECUTION_MODE_COLORS } from '@/core/constants'
import { TaskType, TaskState, ExecutionMode, EventType, Instruction } from '@/types'
import { generateId, isValidWorkload } from '@/core/utils'

const simulatorStore = useSimulatorStore()

const sampleWorkloads = SAMPLE_WORKLOADS
const instructionTemplates = INSTRUCTION_TEMPLATES
const anomalyExamples = ANOMALY_EXAMPLES

const createTaskModalVisible = ref(false)
const snapshotModalVisible = ref(false)
const snapshotDescription = ref('')
const selectedInstructionTemplate = ref<string>('')
const autoRunSpeed = ref(500)
const selectedTaskIds = ref<string[]>([])

const newTaskForm = reactive({
  name: '',
  type: 'process' as TaskType,
  priority: 1,
  instructions: [
    { id: generateId(), type: 'compute' as const, description: '计算任务', duration: 3 },
    { id: generateId(), type: 'terminate' as const, description: '退出', duration: 1 }
  ] as (Instruction & { id: string })[]
})

const configForm = reactive({
  ...simulatorStore.config
})

watch(() => simulatorStore.config, (newConfig) => {
  Object.assign(configForm, newConfig)
}, { deep: true })

watch(autoRunSpeed, (speed) => {
  simulatorStore.setAutoRunSpeed(speed)
})

const formatSpeedLabel = computed(() => {
  if (autoRunSpeed.value <= 100) return '极快'
  if (autoRunSpeed.value <= 300) return '快'
  if (autoRunSpeed.value <= 700) return '正常'
  if (autoRunSpeed.value <= 1200) return '慢'
  return '极慢'
})

const recentEvents = computed(() => {
  return simulatorStore.events.slice(-20).reverse()
})

const taskColumns = [
  { title: '名称', key: 'name', dataIndex: 'name' },
  { title: '状态', key: 'state', dataIndex: 'state', width: 100 },
  { title: '模式', key: 'executionMode', dataIndex: 'executionMode', width: 80 },
  { title: '优先级', key: 'priority', dataIndex: 'priority', width: 120 },
  { title: '操作', key: 'action', width: 150 }
]

const instructionColumns = [
  { title: '类型', key: 'type', width: 120 },
  { title: '描述', key: 'description' },
  { title: '时长', key: 'duration', width: 100 },
  { title: '操作', key: 'action', width: 150 }
]

const getTaskTypeLabel = (type: TaskType): string => TASK_TYPE_LABELS[type]
const getTaskStateLabel = (state: TaskState): string => TASK_STATE_LABELS[state]
const getTaskStateColor = (state: TaskState): string => TASK_STATE_COLORS[state]
const getModeLabel = (mode: ExecutionMode): string => EXECUTION_MODE_LABELS[mode]
const getModeColor = (mode: ExecutionMode): string => EXECUTION_MODE_COLORS[mode]

const getTaskTypeColor = (type: TaskType): string => {
  switch (type) {
    case TaskType.PROCESS: return 'blue'
    case TaskType.THREAD: return 'purple'
    case TaskType.COROUTINE: return 'cyan'
    default: return 'default'
  }
}

const getTaskName = (taskId: string): string => {
  const task = simulatorStore.tasks.find(t => t.id === taskId)
  return task?.name || taskId.substring(0, 8)
}

const getInstructionLabel = (type: Instruction['type']): string => {
  const labels: Record<string, string> = {
    compute: '计算',
    io: 'I/O',
    syscall: '系统调用',
    yield: '让出',
    terminate: '终止'
  }
  return labels[type] || type
}

const getEventColor = (type: EventType): string => {
  const colors: Record<EventType, string> = {
    [EventType.TASK_CREATE]: 'blue',
    [EventType.TASK_START]: 'green',
    [EventType.CONTEXT_SWITCH]: 'orange',
    [EventType.SYSTEM_CALL]: 'purple',
    [EventType.TIMER_INTERRUPT]: 'red',
    [EventType.IO_START]: 'cyan',
    [EventType.IO_COMPLETE]: 'cyan',
    [EventType.COROUTINE_YIELD]: 'magenta',
    [EventType.COROUTINE_RESUME]: 'magenta',
    [EventType.TASK_BLOCK]: 'red',
    [EventType.TASK_WAKEUP]: 'green',
    [EventType.TASK_TERMINATE]: 'gray'
  }
  return colors[type] || 'blue'
}

const getEventIcon = (type: EventType) => {
  // 简化，实际可以用不同的图标
  return 'circle'
}

const toggleAutoRun = () => {
  if (simulatorStore.isAutoRunning) {
    simulatorStore.stopAutoRun()
  } else {
    simulatorStore.startAutoRun()
  }
}

const handleStep = () => {
  simulatorStore.step()
}

const handleStep10 = () => {
  simulatorStore.stepMulti(10)
}

const handleReset = () => {
  simulatorStore.reset()
  Object.assign(configForm, {
    timeSlice: 5,
    ioLatency: 3,
    schedulerType: 'round_robin',
    enablePreemption: true,
    enableTimerInterrupt: true,
    timerInterval: 5
  })
  message.success('已重置')
}

const handleSpeedChange = () => {
  simulatorStore.setAutoRunSpeed(autoRunSpeed.value)
}

const handleConfigChange = () => {
  simulatorStore.updateConfig(configForm)
}

const showCreateTaskModal = () => {
  newTaskForm.name = ''
  newTaskForm.type = 'process'
  newTaskForm.priority = 1
  newTaskForm.instructions = [
    { id: generateId(), type: 'compute', description: '计算任务', duration: 3 },
    { id: generateId(), type: 'terminate', description: '退出', duration: 1 }
  ]
  createTaskModalVisible.value = true
}

const handleCreateTask = () => {
  if (!newTaskForm.name.trim()) {
    message.error('请输入任务名称')
    return
  }
  
  const instructions: Instruction[] = newTaskForm.instructions.map(({ id, ...rest }) => rest)
  
  simulatorStore.addTask(
    newTaskForm.name,
    newTaskForm.type,
    instructions,
    newTaskForm.priority
  )
  
  createTaskModalVisible.value = false
  message.success('任务已创建')
}

const addInstruction = () => {
  newTaskForm.instructions.push({
    id: generateId(),
    type: 'compute',
    description: '新指令',
    duration: 1
  })
}

const removeInstruction = (index: number) => {
  newTaskForm.instructions.splice(index, 1)
}

const moveInstruction = (index: number, direction: number) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= newTaskForm.instructions.length) return
  
  const [item] = newTaskForm.instructions.splice(index, 1)
  newTaskForm.instructions.splice(newIndex, 0, item)
}

const updateInstructionType = (_id: string, _type: string) => {
  // 类型已通过 v-model 更新
}

const addInstructionFromTemplate = (key: string) => {
  const template = instructionTemplates[key]
  if (template) {
    newTaskForm.instructions.splice(newTaskForm.instructions.length - 1, 0, {
      id: generateId(),
      type: template.type,
      description: template.description,
      duration: template.defaultDuration,
      details: template.details
    })
  }
  selectedInstructionTemplate.value = ''
}

const handleLoadSample = ({ key, domEvent }: { key: string; domEvent: MouseEvent }) => {
  const target = domEvent.target as HTMLElement
  const menuItem = target.closest('.ant-dropdown-menu-item')
  const index = menuItem ? parseInt(menuItem.getAttribute('data-index') || '0') : parseInt(key)
  
  if (index >= 0 && index < sampleWorkloads.length) {
    simulatorStore.loadSampleWorkload(index)
    message.success(`已加载样例: ${sampleWorkloads[index].name}`)
  }
}

const handleImportWorkload = (file: File) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      if (!isValidWorkload(data)) {
        message.error('无效的 workload 格式')
        return
      }
      simulatorStore.initFromWorkload(data)
      message.success('导入成功')
    } catch (err) {
      message.error('解析 JSON 失败')
    }
  }
  reader.readAsText(file)
  return false
}

const handleTakeSnapshot = () => {
  snapshotDescription.value = ''
  snapshotModalVisible.value = true
}

const handleSaveSnapshot = () => {
  simulatorStore.takeSnapshot(snapshotDescription.value)
  snapshotModalVisible.value = false
  message.success('快照已保存')
}

const handleLoadSnapshot = (snapshot: any) => {
  simulatorStore.loadSnapshot(snapshot)
  message.success('已加载快照')
}

const handleExportMarkdown = () => {
  const content = simulatorStore.exportMarkdown()
  if (!content) {
    message.error('先生成实验再导出报告')
    return
  }
  
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `os-report-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
  message.success('Markdown 报告已导出')
}

const handleExportJSON = () => {
  const content = simulatorStore.exportJSON()
  if (!content) {
    message.error('先生成实验再导出报告')
    return
  }
  
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `os-report-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.success('JSON 报告已导出')
}

onUnmounted(() => {
  simulatorStore.stopAutoRun()
})
</script>

<style scoped>
.simulator-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.simulator-header {
  background: #001529;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-title {
  color: white;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  display: flex;
  gap: 12px;
}

.simulator-content {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.main-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.control-panel {
  margin-bottom: 16px;
}

.tick-display {
  margin-left: auto;
}

.tick-label {
  margin-right: 8px;
  font-weight: bold;
}

.task-management-panel {
  flex: 1;
}

.task-name {
  font-weight: 500;
}

.task-type-tag {
  margin-left: 8px;
}

.queue-panel {
  margin-top: 16px;
}

.queue-detail {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.empty-queue {
  color: #999;
  font-style: italic;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

.config-panel {
  flex-shrink: 0;
}

.timeline-panel {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.timeline-panel .ant-card-body {
  flex: 1;
  overflow: auto;
}

.timeline-item {
  cursor: pointer;
  padding: 4px 0;
  border-radius: 4px;
}

.timeline-item:hover {
  background: #f5f5f5;
}

.timeline-item.selected {
  background: #e6f7ff;
}

.timeline-tick {
  font-size: 12px;
  color: #999;
}

.timeline-description {
  font-size: 13px;
}

.timeline-task {
  margin-top: 4px;
}

.task-detail-panel {
  flex-shrink: 0;
  max-height: 400px;
  overflow: auto;
}

.current-instruction {
  background: #fffbe6;
  border-left: 3px solid #faad14;
}

.current-instruction .executing {
  color: #fa8c16;
  font-weight: bold;
}

.instruction-list {
  max-height: 200px;
  overflow-y: auto;
}
</style>
