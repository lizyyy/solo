<template>
  <div class="editor-layout">
    <header class="editor-header">
      <div class="header-left">
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <span class="project-name">{{ project?.name || '未命名项目' }}</span>
        <el-tag v-if="currentStateInfo" :type="currentStateTagType">
          当前: {{ currentStateInfo.name }}
        </el-tag>
      </div>
      <div class="header-right">
        <el-button @click="runCheck" :loading="checking">
          <el-icon><View /></el-icon>
          检查状态机
        </el-button>
        <el-button @click="runExecution" :loading="executing" type="primary">
          <el-icon><VideoPlay /></el-icon>
          执行事件序列
        </el-button>
        <el-dropdown @command="handleExport">
          <el-button type="success">
            <el-icon><Download /></el-icon>
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="json">状态机定义 (JSON)</el-dropdown-item>
              <el-dropdown-item command="yaml">状态机定义 (YAML)</el-dropdown-item>
              <el-dropdown-item divided command="html">演练报告 (HTML)</el-dropdown-item>
              <el-dropdown-item command="markdown">演练报告 (Markdown)</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>
    
    <main class="editor-main">
      <div class="graph-area" v-loading="loading">
        <StateGraph
          :machine="machine"
          :current-state="currentState"
          :selected-state="selectedState"
          :selected-transition="selectedTransition"
          :highlighted-edges="highlightedEdges"
          @select-state="onSelectState"
          @select-transition="onSelectTransition"
        />
      </div>
      
      <div class="right-panel">
        <el-tabs v-model="activeTab" class="panel-tabs">
          <el-tab-pane label="事件序列" name="events">
            <div class="panel-content">
              <EventPanel
                :machine="machine"
                :event-sequence="eventSequence"
                :current-step="currentStep"
                :execution-results="executionResults"
                @update="onUpdateEventSequence"
                @step="onStepEvent"
                @run="onRunSequence"
              />
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="执行时间线" name="timeline">
            <div class="panel-content">
              <TimelinePanel
                :timeline="timeline"
                :machine="machine"
              />
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="属性" name="properties">
            <div class="panel-content">
              <PropertyPanel
                :machine="machine"
                :selected-state="selectedState"
                :selected-transition="selectedTransition"
              />
            </div>
          </el-tab-pane>
          
          <el-tab-pane :label="`检查结果 ${checkResults?.summary?.totalIssues || 0}`" name="checks">
            <div class="panel-content">
              <CheckPanel
                :check-results="checkResults"
                @locate="onLocateIssue"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { projectApi } from '@/api';
import type { StateMachine, TimelineEntry, CheckResults, EventItem } from '@/api';
import StateGraph from '@/components/StateGraph.vue';
import EventPanel from '@/components/EventPanel.vue';
import TimelinePanel from '@/components/TimelinePanel.vue';
import PropertyPanel from '@/components/PropertyPanel.vue';
import CheckPanel from '@/components/CheckPanel.vue';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const checking = ref(false);
const executing = ref(false);
const activeTab = ref('events');
const project = ref<any>(null);
const machine = ref<StateMachine | null>(null);
const eventSequence = ref<EventItem[]>([]);
const currentState = ref<string>('');
const selectedState = ref<string | null>(null);
const selectedTransition = ref<any>(null);
const highlightedEdges = ref<string[]>([]);
const timeline = ref<TimelineEntry[]>([]);
const currentStep = ref(-1);
const executionResults = ref<any[]>([]);
const checkResults = ref<CheckResults | null>(null);

const currentStateInfo = computed(() => {
  if (!machine.value || !currentState.value) return null;
  return machine.value.states[currentState.value];
});

const currentStateTagType = computed(() => {
  if (!currentStateInfo.value) return '';
  switch (currentStateInfo.value.type) {
    case 'initial': return 'info';
    case 'final': return 'warning';
    default: return '';
  }
});

const goBack = () => {
  router.push('/');
};

const loadProject = async () => {
  const projectId = route.params.projectId as string;
  if (!projectId) return;
  
  loading.value = true;
  try {
    const res = await projectApi.get(projectId);
    if (res.data.success) {
      project.value = res.data.project;
      machine.value = res.data.project.machine || null;
      eventSequence.value = res.data.project.eventSequence || [];
      checkResults.value = res.data.project.checkResults || null;
      
      if (machine.value) {
        currentState.value = machine.value.initialState;
      }
      
      if (res.data.project.executionHistory) {
        timeline.value = res.data.project.executionHistory.timeline;
        currentStep.value = res.data.project.executionHistory.timeline.length - 1;
      }
    }
  } catch (error) {
    ElMessage.error('加载项目失败');
  } finally {
    loading.value = false;
  }
};

const runCheck = async () => {
  if (!project.value) return;
  
  checking.value = true;
  try {
    const res = await projectApi.check(project.value.id);
    if (res.data.success) {
      checkResults.value = res.data.checkResults;
      activeTab.value = 'checks';
      
      const totalIssues = res.data.checkResults.summary.totalIssues;
      if (totalIssues > 0) {
        ElMessage.warning(`发现 ${totalIssues} 个问题`);
      } else {
        ElMessage.success('检查通过，未发现问题');
      }
    }
  } catch (error) {
    ElMessage.error('检查失败');
  } finally {
    checking.value = false;
  }
};

const runExecution = async () => {
  if (!project.value || eventSequence.value.length === 0) {
    ElMessage.warning('请先添加事件序列');
    return;
  }
  
  executing.value = true;
  try {
    const res = await projectApi.execute(project.value.id, {
      eventSequence: eventSequence.value
    });
    
    if (res.data.success) {
      timeline.value = res.data.executionResult.timeline;
      currentStep.value = timeline.value.length - 1;
      
      const lastEntry = timeline.value[timeline.value.length - 1];
      if (lastEntry.toState) {
        currentState.value = lastEntry.toState;
      }
      
      activeTab.value = 'timeline';
      
      // 更新高亮边
      highlightedEdges.value = [];
      for (const entry of timeline.value) {
        if (entry.type === 'transition' && entry.fromState && entry.toState) {
          highlightedEdges.value.push(`${entry.fromState}->${entry.toState}`);
        }
      }
      
      if (res.data.executionResult.success) {
        ElMessage.success('执行成功');
      } else {
        ElMessage.error('执行失败，请查看时间线');
      }
    }
  } catch (error) {
    ElMessage.error('执行失败');
  } finally {
    executing.value = false;
  }
};

const handleExport = (type: string) => {
  if (!project.value) return;
  
  switch (type) {
    case 'json':
    case 'yaml':
      window.open(`/api/projects/${project.value.id}/export?format=${type}&download=true`, '_blank');
      break;
    case 'html':
    case 'markdown':
      window.open(`/api/reports/${project.value.id}?format=${type}&download=true`, '_blank');
      break;
  }
};

const onSelectState = (stateId: string) => {
  selectedState.value = stateId;
  selectedTransition.value = null;
  activeTab.value = 'properties';
};

const onSelectTransition = (transition: any) => {
  selectedTransition.value = transition;
  selectedState.value = null;
  activeTab.value = 'properties';
};

const onUpdateEventSequence = (sequence: EventItem[]) => {
  eventSequence.value = sequence;
};

const onStepEvent = async (event: EventItem, index: number) => {
  // 单步执行
};

const onRunSequence = async () => {
  await runExecution();
};

const onLocateIssue = (issue: any) => {
  if (issue.location?.state) {
    selectedState.value = issue.location.state;
    selectedTransition.value = null;
    activeTab.value = 'properties';
  }
};

onMounted(() => {
  loadProject();
});

watch(
  () => route.params.projectId,
  () => {
    loadProject();
  }
);
</script>
