<template>
  <div class="check-panel">
    <div v-if="!checkResults" class="empty-state">
      <el-icon class="empty-icon"><View /></el-icon>
      <div class="empty-title">尚未执行检查</div>
      <div class="empty-desc">点击顶部"检查状态机"按钮开始检查</div>
    </div>
    
    <div v-else class="check-content">
      <div class="check-summary" :class="summaryClass">
        <div class="summary-header">
          <el-icon v-if="checkResults.summary.overall === 'pass'" class="summary-icon success"><CircleCheck /></el-icon>
          <el-icon v-else-if="checkResults.summary.overall === 'warning'" class="summary-icon warning"><Warning /></el-icon>
          <el-icon v-else class="summary-icon error"><CircleClose /></el-icon>
          <span class="summary-title">
            {{ summaryTitle }}
          </span>
        </div>
        <div class="summary-stats">
          <el-tag type="info">
            状态: {{ checkResults.machine.stateCount }} 个
          </el-tag>
          <el-tag type="info">
            事件: {{ checkResults.machine.eventCount }} 个
          </el-tag>
          <el-tag v-if="checkResults.summary.totalIssues > 0" type="danger">
            问题: {{ checkResults.summary.totalIssues }} 个
          </el-tag>
          <el-tag v-else type="success">
            全部通过
          </el-tag>
        </div>
      </div>
      
      <div class="check-list">
        <el-collapse v-model="expandedChecks">
          <el-collapse-item
            v-for="check in checkResults.checks"
            :key="check.id"
            :name="check.id"
          >
            <template #title>
              <div class="check-item-header">
                <span class="check-status">
                  <el-icon v-if="check.passed" class="status-success"><CircleCheck /></el-icon>
                  <el-icon v-else class="status-error"><CircleClose /></el-icon>
                </span>
                <span class="check-name">{{ check.name }}</span>
                <el-tag
                  v-if="check.count > 0"
                  :type="check.severity === 'error' ? 'danger' : 'warning'"
                  size="small"
                >
                  {{ check.count }} 个问题
                </el-tag>
              </div>
            </template>
            
            <div class="check-description">{{ check.description }}</div>
            
            <div v-if="check.issues.length > 0" class="issues-list">
              <div
                v-for="(issue, idx) in check.issues"
                :key="idx"
                class="issue-item"
                :class="`issue-${check.severity}`"
                @click="onLocateIssue(issue)"
              >
                <div class="issue-header">
                  <el-tag :type="check.severity === 'error' ? 'danger' : 'warning'" size="small">
                    {{ check.severity === 'error' ? '错误' : '警告' }}
                  </el-tag>
                  <span class="issue-message">{{ issue.message }}</span>
                </div>
                
                <div v-if="issue.detail" class="issue-detail">
                  {{ issue.detail }}
                </div>
                
                <div v-if="issue.location && Object.keys(issue.location).length > 0" class="issue-location">
                  <div class="location-label">定位:</div>
                  <div class="location-content">
                    <el-tag v-if="issue.location.state" size="small" class="location-tag">
                      状态: {{ issue.stateInfo?.name || issue.state }}
                    </el-tag>
                    <el-tag v-if="issue.location.event" size="small" class="location-tag">
                      事件: {{ issue.event }}
                    </el-tag>
                    <el-tag v-if="issue.location.target" size="small" class="location-tag">
                      目标: {{ issue.location.target }}
                    </el-tag>
                  </div>
                </div>
                
                <div v-if="issue.transitions && issue.transitions.length > 0" class="issue-transitions">
                  <div class="transitions-label">相关转换:</div>
                  <div class="transitions-list">
                    <div v-for="(t, ti) in issue.transitions" :key="ti" class="transition-item">
                      <code>{{ t.source }} → {{ t.target }}</code>
                      <span v-if="t.description" class="transition-desc">: {{ t.description }}</span>
                      <div v-if="t.guard" class="transition-guard">
                        守卫: <code>{{ t.guard.condition }}</code>
                        <span v-if="t.guard.description"> ({{ t.guard.description }})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { CheckResults, IssueItem } from '@/api';

interface Props {
  checkResults: CheckResults | null;
}

const props = withDefaults(defineProps<Props>(), {
  checkResults: null
});

const emit = defineEmits<{
  (e: 'locate', issue: IssueItem): void;
}>();

const expandedChecks = ref<string[]>([]);

const summaryClass = computed(() => {
  if (!props.checkResults) return '';
  switch (props.checkResults.summary.overall) {
    case 'pass': return 'summary-pass';
    case 'warning': return 'summary-warning';
    default: return 'summary-fail';
  }
});

const summaryTitle = computed(() => {
  if (!props.checkResults) return '';
  switch (props.checkResults.summary.overall) {
    case 'pass': return '状态机检查通过';
    case 'warning': return '状态机存在警告';
    default: return '状态机存在错误';
  }
});

const onLocateIssue = (issue: IssueItem) => {
  emit('locate', issue);
};

watch(
  () => props.checkResults,
  (newResults) => {
    if (newResults) {
      expandedChecks.value = newResults.checks.filter(c => !c.passed).map(c => c.id);
    }
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.check-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-title {
    font-size: 16px;
    color: #606266;
    margin-bottom: 8px;
  }

  .empty-desc {
    font-size: 13px;
  }
}

.check-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.check-summary {
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: #f5f7fa;

  &.summary-pass {
    background: #f0f9eb;
    border-left: 4px solid #67c23a;
  }

  &.summary-warning {
    background: #fdf6ec;
    border-left: 4px solid #e6a23c;
  }

  &.summary-fail {
    background: #fef0f0;
    border-left: 4px solid #f56c6c;
  }

  .summary-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;

    .summary-icon {
      font-size: 24px;
      margin-right: 12px;

      &.success {
        color: #67c23a;
      }

      &.warning {
        color: #e6a23c;
      }

      &.error {
        color: #f56c6c;
      }
    }

    .summary-title {
      font-size: 16px;
      font-weight: 600;
    }
  }

  .summary-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    :deep(.el-tag) {
      font-size: 12px;
    }
  }
}

.check-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.check-item-header {
  display: flex;
  align-items: center;
  width: 100%;

  .check-status {
    margin-right: 8px;

    .status-success {
      color: #67c23a;
    }

    .status-error {
      color: #f56c6c;
    }
  }

  .check-name {
    flex: 1;
    font-weight: 500;
  }
}

.check-description {
  font-size: 13px;
  color: #909399;
  margin-bottom: 12px;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.issue-item {
  padding: 12px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #ebeef5;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
  }

  &.issue-error {
    border-left: 3px solid #f56c6c;
  }

  &.issue-warning {
    border-left: 3px solid #e6a23c;
  }

  .issue-header {
    display: flex;
    align-items: center;
    margin-bottom: 8px;

    .el-tag {
      margin-right: 12px;
    }

    .issue-message {
      font-size: 14px;
      font-weight: 500;
      color: #303133;
    }
  }

  .issue-detail {
    font-size: 13px;
    color: #606266;
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .issue-location {
    margin-top: 8px;

    .location-label {
      font-size: 12px;
      color: #909399;
      margin-bottom: 4px;
    }

    .location-content {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;

      .location-tag {
        background: #ecf5ff;
        border-color: #d9ecff;
        color: #409eff;
      }
    }
  }

  .issue-transitions {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #ebeef5;

    .transitions-label {
      font-size: 12px;
      color: #909399;
      margin-bottom: 6px;
    }

    .transitions-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .transition-item {
      font-size: 13px;

      code {
        background: #f4f4f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
      }

      .transition-desc {
        color: #606266;
      }

      .transition-guard {
        margin-top: 4px;
        padding-left: 16px;
        font-size: 12px;
        color: #909399;
      }
    }
  }
}

:deep(.el-collapse-item__header) {
  height: auto;
  padding: 12px 0;
}

:deep(.el-collapse-item__wrap) {
  border-bottom: none;
}
</style>
