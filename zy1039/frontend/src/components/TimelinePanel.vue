<template>
  <div class="timeline-panel">
    <div v-if="timeline.length === 0" class="empty-state">
      <el-icon class="empty-icon"><Clock /></el-icon>
      <div class="empty-title">暂无执行记录</div>
      <div class="empty-desc">执行事件序列后将在此显示时间线</div>
    </div>
    
    <el-timeline v-else class="timeline-container">
      <el-timeline-item
        v-for="(entry, index) in timeline"
        :key="index"
        :class="getTimelineClass(entry)"
        :timestamp="formatTimestamp(entry.timestamp)"
        placement="top"
      >
        <div class="timeline-content">
          <div class="timeline-title">
            <el-icon v-if="entry.type === 'initial'"><Start /></el-icon>
            <el-icon v-else-if="entry.type === 'transition'"><Right /></el-icon>
            <el-icon v-else-if="entry.type === 'invalid_event'"><Warning /></el-icon>
            <el-icon v-else-if="entry.type === 'guard_failed'"><CircleClose /></el-icon>
            <el-icon v-else><InfoFilled /></el-icon>
            {{ entry.message }}
          </div>
          
          <div class="timeline-detail" v-if="entry.type === 'initial'">
            状态: <strong>{{ entry.stateInfo?.name || entry.state }}</strong>
            ({{ getStateTypeLabel(entry.stateInfo?.type) }})
          </div>
          
          <div class="timeline-detail" v-else-if="entry.type === 'transition'">
            <div>事件: <code>{{ entry.event }}</code></div>
            <div>
              {{ entry.fromStateInfo?.name }} → {{ entry.toStateInfo?.name }}
              <el-tag v-if="entry.isFinal" type="warning" size="small" style="margin-left: 8px;">
                终态
              </el-tag>
            </div>
            
            <div
              v-if="entry.transition?.guardResult"
              class="timeline-guard"
              :class="{
                passed: entry.transition.guardResult.passed,
                failed: !entry.transition.guardResult.passed
              }"
            >
              <div>
                <strong>守卫条件:</strong>
                {{ entry.transition.guardResult.passed ? '✅ 通过' : '❌ 失败' }}
              </div>
              <div v-if="entry.transition.guardResult.condition">
                条件: <code>{{ entry.transition.guardResult.condition }}</code>
              </div>
              <div v-if="entry.transition.guardResult.reason">
                原因: {{ entry.transition.guardResult.reason }}
              </div>
            </div>
          </div>
          
          <div class="timeline-detail" v-else-if="entry.type === 'invalid_event'">
            <div>事件: <code>{{ entry.event }}</code></div>
            <div>当前状态: {{ entry.fromStateInfo?.name }}</div>
            <div v-if="entry.availableEvents?.length">
              可用事件: {{ entry.availableEvents.map(e => `\`${e}\``).join(', ') }}
            </div>
          </div>
          
          <div class="timeline-detail" v-else-if="entry.type === 'guard_failed'">
            <div>事件: <code>{{ entry.event }}</code></div>
            <div>当前状态: {{ entry.fromStateInfo?.name }}</div>
            <div style="margin-top: 8px;">
              <strong>所有守卫条件均不满足:</strong>
            </div>
            <div v-for="(t, i) in entry.transitions" :key="i" style="margin-top: 4px; padding-left: 16px;">
              → {{ t.target }}: {{ t.guard?.description || t.guard?.condition || '无守卫' }}
            </div>
          </div>
          
          <div class="timeline-detail" v-else-if="entry.type === 'error'">
            <div>{{ entry.message }}</div>
          </div>
          
          <div v-if="entry.contextSnapshot && Object.keys(entry.contextSnapshot).length > 0" style="margin-top: 8px;">
            <el-collapse>
              <el-collapse-item title="上下文快照" name="1">
                <pre style="font-size: 11px; background: #f5f7fa; padding: 8px; border-radius: 4px; margin: 0;">
{{ JSON.stringify(entry.contextSnapshot, null, 2) }}
                </pre>
              </el-collapse-item>
            </el-collapse>
          </div>
        </div>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script setup lang="ts">
import type { TimelineEntry, State } from '@/api';

interface Props {
  timeline: TimelineEntry[];
  machine: any;
}

const props = withDefaults(defineProps<Props>(), {
  timeline: () => [],
  machine: null
});

const getTimelineClass = (entry: TimelineEntry) => {
  switch (entry.type) {
    case 'initial':
      return 'info';
    case 'transition':
      return entry.isFinal ? 'warning' : 'success';
    case 'invalid_event':
    case 'guard_failed':
    case 'error':
      return 'error';
    default:
      return '';
  }
};

const formatTimestamp = (ts: number) => {
  return new Date(ts).toLocaleTimeString('zh-CN');
};

const getStateTypeLabel = (type?: State['type']) => {
  switch (type) {
    case 'initial': return '初始状态';
    case 'final': return '终态';
    default: return '普通状态';
  }
};
</script>
