<template>
  <div class="container">
    <div class="header">
      <h1>🎯 室内混响时间估计系统</h1>
      <p>采样时间检测 · 巡检备注核对 · 实验复盘分析</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-icon success">📊</div>
        <div class="stat-card-title">总记录数</div>
        <div class="stat-card-value">{{ service.getRecords().length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon warning">⏰</div>
        <div class="stat-card-title">时间缺失</div>
        <div class="stat-card-value">{{ service.getMissingTimeRecords().length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon danger">⚠️</div>
        <div class="stat-card-title">待处理冲突</div>
        <div class="stat-card-value">{{ pendingConflicts.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon info">📝</div>
        <div class="stat-card-title">巡检备注</div>
        <div class="stat-card-value">{{ service.getNotes().length }}</div>
      </div>
    </div>

    <div class="workflow-steps">
      <div class="workflow-step" :class="{ active: workflowStep === 1, completed: workflowStep > 1 }">
        <div class="workflow-step-number">{{ workflowStep > 1 ? '✓' : '1' }}</div>
        <div class="workflow-step-label">导入手写巡检备注</div>
      </div>
      <div class="workflow-step" :class="{ active: workflowStep === 2, completed: workflowStep > 2 }">
        <div class="workflow-step-number">{{ workflowStep > 2 ? '✓' : '2' }}</div>
        <div class="workflow-step-label">老岑核对安全阈值表</div>
      </div>
      <div class="workflow-step" :class="{ active: workflowStep === 3, completed: workflowStep > 3 }">
        <div class="workflow-step-number">{{ workflowStep > 3 ? '✓' : '3' }}</div>
        <div class="workflow-step-label">实验复盘图更新</div>
      </div>
    </div>

    <div class="messages">
      <div
        v-for="msg in recentMessages"
        :key="msg.id"
        :class="['message', 'message-' + msg.severity]"
      >
        <div class="message-title">{{ msg.title }}</div>
        <div class="message-content">{{ msg.message }}</div>
        <div v-if="msg.suggestion" class="message-suggestion">💡 {{ msg.suggestion }}</div>
      </div>
    </div>

    <div class="tabs">
      <div class="tab" :class="{ active: activeTab === 'records' }" @click="activeTab = 'records'">
        📋 记录管理
      </div>
      <div class="tab" :class="{ active: activeTab === 'missing' }" @click="activeTab = 'missing'">
        ⏰ 时间缺失
      </div>
      <div class="tab" :class="{ active: activeTab === 'conflicts' }" @click="activeTab = 'conflicts'">
        ⚠️ 冲突处理
      </div>
      <div class="tab" :class="{ active: activeTab === 'chart' }" @click="activeTab = 'chart'">
        📈 实验复盘图
      </div>
      <div class="tab" :class="{ active: activeTab === 'selfcheck' }" @click="activeTab = 'selfcheck'">
        🔍 系统自检
      </div>
    </div>

    <div class="tab-content" :class="{ active: activeTab === 'records' }">
      <div class="card">
        <div class="card-header">
          <h2>📋 混响时间记录</h2>
          <div class="action-buttons">
            <select v-model="selectedBatchId" class="form-control" style="width: 200px; margin-right: 8px;">
              <option value="">全部批次</option>
              <option v-for="batch in batches" :key="batch.id" :value="batch.id">
                {{ batch.name }} ({{ batch.recordIds.length }}条)
              </option>
            </select>
            <button class="btn btn-primary" @click="showImportModal = true">
              导入记录
            </button>
            <button class="btn btn-secondary" @click="loadDemoData">
              加载演示数据
            </button>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>采样时间</th>
              <th>测量地点</th>
              <th>频率</th>
              <th>混响时间 T60</th>
              <th>类型</th>
              <th>来源批次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in filteredRecords" :key="record.id" class="clickable" @click="showRecordDetail(record)">
              <td>{{ formatTime(record.sampleTime) }}</td>
              <td>{{ record.location }}</td>
              <td>{{ record.frequency }} Hz</td>
              <td>{{ record.reverberationTime }} 秒</td>
              <td>
                <span :class="['badge', record.isSupplement ? 'badge-warning' : 'badge-success']">
                  {{ record.isSupplement ? '补录' : '正常' }}
                </span>
              </td>
              <td>
                <span class="badge badge-info">{{ getBatchName(record.batchId) }}</span>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn btn-small btn-secondary" @click.stop="showRecordDetail(record)">
                    详情
                  </button>
                  <button class="btn btn-small btn-secondary" @click.stop="addNoteToRecord(record)">
                    添加备注
                  </button>
                  <button class="btn btn-small btn-warning" @click.stop="addSupplementToRecord(record)">
                    补录
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredRecords.length === 0">
              <td colspan="7">
                <div class="empty-state">
                  <div class="empty-state-icon">📭</div>
                  <div>暂无记录，点击"导入记录"或"加载演示数据"开始</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="tab-content" :class="{ active: activeTab === 'missing' }">
      <div class="card">
        <div class="card-header">
          <h2>⏰ 采样时间缺失记录</h2>
          <div class="action-buttons">
            <button class="btn btn-primary" @click="detectMissingTime">
              重新检测
            </button>
          </div>
        </div>

        <div v-if="missingRecords.length === 0" class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div>未发现采样时间缺失</div>
        </div>

        <div v-for="missing in missingRecords" :key="missing.id" class="card" style="margin-bottom: 16px;">
          <div class="missing-detail">
            <div class="missing-detail-row">
              <span class="missing-detail-label">缺失间隔：</span>
              <span class="missing-detail-value">{{ Math.round(missing.gapDuration) }} 分钟</span>
            </div>
            <div class="missing-detail-row">
              <span class="missing-detail-label">前一条记录：</span>
              <span class="missing-detail-value">{{ formatTime(missing.previousRecord.sampleTime) }}</span>
            </div>
            <div class="missing-detail-row">
              <span class="missing-detail-label">后一条记录：</span>
              <span class="missing-detail-value">{{ formatTime(missing.nextRecord.sampleTime) }}</span>
            </div>
            <div class="missing-detail-row">
              <span class="missing-detail-label">状态：</span>
              <span class="missing-detail-value">
                <span :class="['badge', missing.status === 'pending_review' ? 'badge-warning' : missing.status === 'kept' ? 'badge-info' : 'badge-success']">
                  {{ formatMissingStatus(missing.status) }}
                </span>
              </span>
            </div>
            <div v-if="missing.keepReason" class="missing-detail-row">
              <span class="missing-detail-label">保留理由：</span>
              <span class="missing-detail-value">{{ missing.keepReason }}</span>
            </div>
            <div v-if="missing.reviewedBy" class="missing-detail-row">
              <span class="missing-detail-label">处理人：</span>
              <span class="missing-detail-value">{{ missing.reviewedBy }}</span>
            </div>
          </div>

          <div v-if="missing.status === 'pending_review'" class="action-buttons">
            <button class="btn btn-success" @click="showKeepMissingModal(missing)">
              保留此间隔
            </button>
            <button class="btn btn-warning" @click="resolveWithSupplement(missing)">
              补录解决
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="tab-content" :class="{ active: activeTab === 'conflicts' }">
      <div class="card">
        <div class="card-header">
          <h2>⚠️ 备注与阈值冲突处理</h2>
        </div>

        <div v-if="conflicts.length === 0" class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div>暂无冲突需要处理</div>
        </div>

        <div v-for="conflict in conflicts" :key="conflict.id" class="card" style="margin-bottom: 16px;">
          <div :class="['message', conflict.status === 'pending' ? 'message-error' : conflict.status === 'confirmed' ? 'message-warning' : 'message-success']">
            <div class="message-title">
              {{ conflict.status === 'pending' ? '🚨 待处理冲突' : conflict.status === 'confirmed' ? '⚠️ 已确认冲突' : '✅ 已驳回' }}
            </div>
            <div class="message-content">
              手写巡检备注与安全阈值表存在不一致
            </div>
          </div>

          <div class="conflict-evidence">
            <h4 style="margin-bottom: 12px;">📋 冲突证据</h4>
            <div class="conflict-evidence-item">
              <span class="conflict-evidence-label">巡检备注内容：</span>
              <span class="conflict-evidence-value note">{{ conflict.evidence.noteContent }}</span>
            </div>
            <div class="conflict-evidence-item">
              <span class="conflict-evidence-label">备注含义：</span>
              <span class="conflict-evidence-value note">{{ conflict.evidence.noteMeaning }}</span>
            </div>
            <div class="conflict-evidence-item">
              <span class="conflict-evidence-label">记录值：</span>
              <span class="conflict-evidence-value threshold">{{ conflict.evidence.recordValue }}</span>
            </div>
            <div class="conflict-evidence-item">
              <span class="conflict-evidence-label">安全阈值范围：</span>
              <span class="conflict-evidence-value threshold">{{ conflict.evidence.thresholdRange }}</span>
            </div>
            <div class="conflict-evidence-item">
              <span class="conflict-evidence-label">阈值含义：</span>
              <span class="conflict-evidence-value threshold">{{ conflict.evidence.thresholdMeaning }}</span>
            </div>
          </div>

          <div v-if="conflict.status === 'pending'" class="action-buttons" style="margin-top: 16px;">
            <button class="btn btn-danger" @click="resolveConflict(conflict.id, 'confirm')">
              确认冲突（数据异常）
            </button>
            <button class="btn btn-success" @click="resolveConflict(conflict.id, 'reject')">
              驳回冲突（以备注为准）
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="tab-content" :class="{ active: activeTab === 'chart' }">
      <div class="card">
        <div class="card-header">
          <h2>📈 实验复盘图</h2>
          <button class="btn btn-primary" @click="exportData">
            导出数据
          </button>
        </div>

        <div class="chart-container">
          <canvas ref="chartCanvas"></canvas>
        </div>

        <div style="margin-top: 24px;">
          <h3>📌 可点击查看详情的缺失记录</h3>
          <p style="color: #666; font-size: 13px; margin-bottom: 16px;">
            点击下面的缺失记录，可以查看维修师傅老岑当时保留它的理由
          </p>
          
          <div v-if="keptMissingRecords.length === 0" class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div>暂无保留的缺失记录</div>
          </div>

          <div 
            v-for="missing in keptMissingRecords" 
            :key="missing.id" 
            class="card clickable" 
            style="margin-bottom: 12px; cursor: pointer;"
            @click="showMissingDetail(missing)"
          >
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>🔴 缺失间隔：{{ Math.round(missing.gapDuration) }} 分钟</strong>
                <div style="color: #666; font-size: 13px; margin-top: 4px;">
                  {{ formatTime(missing.previousRecord.sampleTime) }} → {{ formatTime(missing.nextRecord.sampleTime) }}
                </div>
              </div>
              <span class="badge badge-info">点击查看详情</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="tab-content" :class="{ active: activeTab === 'selfcheck' }">
      <div class="card">
        <div class="card-header">
          <h2>🔍 系统自检</h2>
          <button class="btn btn-primary" @click="runSelfCheck">
            运行自检
          </button>
        </div>

        <div v-if="selfCheckResults">
          <div class="grid grid-2">
            <div class="card" style="margin: 0;">
              <h4>📋 重复导入检查</h4>
              <div :class="['message', selfCheckResults.duplicateCheck.hasDuplicates ? 'message-warning' : 'message-success']">
                <div class="message-title">
                  {{ selfCheckResults.duplicateCheck.hasDuplicates ? '⚠️ 发现重复记录' : '✅ 无重复记录' }}
                </div>
                <div class="message-content">
                  重复记录数量：{{ selfCheckResults.duplicateCheck.count }}
                </div>
              </div>
            </div>

            <div class="card" style="margin: 0;">
              <h4>⏰ 采样时间检查</h4>
              <div :class="['message', selfCheckResults.missingTimeCheck.hasIssues ? 'message-warning' : 'message-success']">
                <div class="message-title">
                  {{ selfCheckResults.missingTimeCheck.hasIssues ? '⚠️ 发现时间缺失' : '✅ 采样时间连续' }}
                </div>
                <div class="message-content">
                  缺失数量：{{ selfCheckResults.missingTimeCheck.count || 0 }}
                </div>
              </div>
            </div>

            <div class="card" style="margin: 0;">
              <h4>🔄 补录重算检查</h4>
              <div :class="['message', selfCheckResults.supplementRecalcCheck.hasIssues ? 'message-error' : 'message-success']">
                <div class="message-title">
                  {{ selfCheckResults.supplementRecalcCheck.hasIssues ? '❌ 补录有问题' : '✅ 补录正常' }}
                </div>
                <div class="message-content">
                  问题数量：{{ selfCheckResults.supplementRecalcCheck.count }}
                </div>
              </div>
            </div>

            <div class="card" style="margin: 0;">
              <h4>📤 导出一致性检查</h4>
              <div :class="['message', selfCheckResults.exportConsistencyCheck.consistent ? 'message-success' : 'message-error']">
                <div class="message-title">
                  {{ selfCheckResults.exportConsistencyCheck.consistent ? '✅ 导出数据一致' : '❌ 导出数据不一致' }}
                </div>
                <div class="message-content">
                  记录总数：{{ selfCheckResults.exportConsistencyCheck.recordCount }}
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top: 20px;">
            <h4>⚠ 备注阈值冲突</h4>
            <div class="message message-info">
              <div class="message-title">待处理冲突数量：{{ selfCheckResults.noteThresholdConflicts }}</div>
              <div class="message-suggestion">请前往"冲突处理"标签页处理</div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div>点击"运行自检"按钮开始系统检查</div>
        </div>
      </div>
    </div>

    <div v-if="showImportModal" class="modal-overlay" @click.self="showImportModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>导入混响时间记录</h3>
          <button class="modal-close" @click="showImportModal = false">×</button>
        </div>
        
        <div class="form-group">
          <label>批次名称</label>
          <input type="text" v-model="importForm.batchName" class="form-control" placeholder="例如：2026年6月第一次测量">
        </div>
        <div class="form-group">
          <label>操作人</label>
          <input type="text" v-model="importForm.operator" class="form-control" placeholder="例如：老岑">
        </div>
        <div class="form-group">
          <label>采样时间</label>
          <input type="datetime-local" v-model="importForm.sampleTime" class="form-control">
        </div>
        <div class="form-group">
          <label>测量地点</label>
          <input type="text" v-model="importForm.location" class="form-control" placeholder="例如：会议室A">
        </div>
        <div class="form-group">
          <label>频率 (Hz)</label>
          <input type="number" v-model="importForm.frequency" class="form-control" placeholder="例如：500">
        </div>
        <div class="form-group">
          <label>混响时间 T60 (秒)</label>
          <input type="number" step="0.01" v-model="importForm.reverberationTime" class="form-control" placeholder="例如：1.2">
        </div>
        <div class="form-group">
          <label>材料类型</label>
          <select v-model="importForm.materialType" class="form-control">
            <option value="normal">正常材料</option>
            <option value="wrong_caliber">错口径材料</option>
            <option value="supplement">补录材料</option>
          </select>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showImportModal = false">取消</button>
          <button class="btn btn-primary" @click="importSingleRecord">导入</button>
        </div>
      </div>
    </div>

    <div v-if="showKeepMissingModalData" class="modal-overlay" @click.self="showKeepMissingModalData = null">
      <div class="modal">
        <div class="modal-header">
          <h3>保留采样时间缺失间隔</h3>
          <button class="modal-close" @click="showKeepMissingModalData = null">×</button>
        </div>
        
        <div class="form-group">
          <label>保留理由（维修师傅老岑填写）</label>
          <textarea v-model="keepReasonForm.reason" class="form-control" placeholder="请说明为什么保留这个时间间隔..."></textarea>
        </div>
        <div class="form-group">
          <label>处理人</label>
          <input type="text" v-model="keepReasonForm.reviewer" class="form-control" placeholder="例如：老岑">
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showKeepMissingModalData = null">取消</button>
          <button class="btn btn-primary" @click="confirmKeepMissing">确认保留</button>
        </div>
      </div>
    </div>

    <div v-if="showNoteModal" class="modal-overlay" @click.self="showNoteModal = null">
      <div class="modal">
        <div class="modal-header">
          <h3>添加巡检备注</h3>
          <button class="modal-close" @click="showNoteModal = null">×</button>
        </div>
        
        <div class="form-group">
          <label>备注内容</label>
          <textarea v-model="noteForm.content" class="form-control" placeholder="输入巡检备注..."></textarea>
        </div>
        <div class="form-group">
          <label>填写人</label>
          <input type="text" v-model="noteForm.author" class="form-control" placeholder="例如：质检员小王">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" v-model="noteForm.isHandwritten"> 
            是否为手写备注
          </label>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showNoteModal = null">取消</button>
          <button class="btn btn-primary" @click="saveNote">保存备注</button>
        </div>
      </div>
    </div>

    <div v-if="showMissingDetailModal" class="modal-overlay" @click.self="showMissingDetailModal = null">
      <div class="modal">
        <div class="modal-header">
          <h3>缺失记录详情</h3>
          <button class="modal-close" @click="showMissingDetailModal = null">×</button>
        </div>
        
        <div class="missing-detail">
          <div class="missing-detail-row">
            <span class="missing-detail-label">缺失间隔：</span>
            <span class="missing-detail-value">{{ Math.round(showMissingDetailModal.gapDuration) }} 分钟</span>
          </div>
          <div class="missing-detail-row">
            <span class="missing-detail-label">保留理由：</span>
            <span class="missing-detail-value">{{ showMissingDetailModal.keepReason }}</span>
          </div>
          <div class="missing-detail-row">
            <span class="missing-detail-label">处理人：</span>
            <span class="missing-detail-value">{{ showMissingDetailModal.reviewedBy }}</span>
          </div>
          <div class="missing-detail-row">
            <span class="missing-detail-label">处理时间：</span>
            <span class="missing-detail-value">{{ formatTime(showMissingDetailModal.reviewedAt) }}</span>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showMissingDetailModal = null">关闭</button>
        </div>
      </div>
    </div>

    <div v-if="showRecordDetailModal" class="modal-overlay" @click.self="showRecordDetailModal = null">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>📋 记录详情</h3>
          <button class="modal-close" @click="showRecordDetailModal = null">×</button>
        </div>
        
        <div v-if="recordDetail" class="record-detail">
          <div class="detail-section">
            <h4>基本信息</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">采样时间：</span>
                <span class="detail-value">{{ formatTime(recordDetail.record.sampleTime) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">测量地点：</span>
                <span class="detail-value">{{ recordDetail.record.location }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">频率：</span>
                <span class="detail-value">{{ recordDetail.record.frequency }} Hz</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">混响时间：</span>
                <span class="detail-value">{{ recordDetail.record.reverberationTime }} 秒</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">类型：</span>
                <span class="detail-value">
                  <span :class="['badge', recordDetail.record.isSupplement ? 'badge-warning' : 'badge-success']">
                    {{ recordDetail.record.isSupplement ? '补录记录' : '正常记录' }}
                  </span>
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">来源批次：</span>
                <span class="detail-value">
                  <span class="badge badge-info">{{ getBatchName(recordDetail.record.batchId) }}</span>
                </span>
              </div>
            </div>
          </div>

          <div v-if="recordDetail.supplements.length > 0" class="detail-section">
            <h4>📝 补录记录</h4>
            <div v-for="sup in recordDetail.supplements" :key="sup.id" class="supplement-item">
              <div class="supplement-header">
                <span class="badge badge-warning">补录</span>
                <span>{{ formatTime(sup.sampleTime) }} - {{ sup.reverberationTime }} 秒</span>
              </div>
              <div class="supplement-reason">补录原因：{{ sup.supplementReason }}</div>
              <div class="supplement-operator">补录人：{{ sup.supplementedBy }}</div>
            </div>
          </div>

          <div v-if="recordDetail.notes.length > 0" class="detail-section">
            <h4>📝 巡检备注</h4>
            <div v-for="note in recordDetail.notes" :key="note.id" class="note-item">
              <div class="note-header">
                <span class="badge" :class="note.isHandwritten ? 'badge-warning' : 'badge-info'">
                  {{ note.isHandwritten ? '手写备注' : '系统备注' }}
                </span>
                <span class="note-author">{{ note.author }}</span>
                <span class="note-time">{{ formatTime(note.createTime) }}</span>
              </div>
              <div class="note-content">{{ note.noteContent }}</div>
            </div>
          </div>

          <div v-if="recordDetail.relatedMissing.length > 0" class="detail-section">
            <h4>⏰ 关联的时间缺失</h4>
            <div v-for="m in recordDetail.relatedMissing" :key="m.id" class="missing-item">
              <span class="badge" :class="m.status === 'kept' ? 'badge-info' : m.status === 'resolved' ? 'badge-success' : 'badge-warning'">
                {{ formatMissingStatus(m.status) }}
              </span>
              <span>间隔 {{ Math.round(m.gapDuration) }} 分钟</span>
            </div>
          </div>

          <div v-if="recordDetail.relatedConflicts.length > 0" class="detail-section">
            <h4>⚠️ 关联的冲突</h4>
            <div v-for="c in recordDetail.relatedConflicts" :key="c.id" class="conflict-item">
              <span class="badge" :class="c.status === 'pending' ? 'badge-danger' : c.status === 'confirmed' ? 'badge-warning' : 'badge-success'">
                {{ c.status === 'pending' ? '待处理' : c.status === 'confirmed' ? '已确认' : '已驳回' }}
              </span>
              <span>备注与阈值冲突</span>
            </div>
          </div>

          <div v-if="recordDetail.changeLogs.length > 0" class="detail-section">
            <h4>📜 变更历史</h4>
            <div class="change-log-list">
              <div v-for="log in recordDetail.changeLogs" :key="log.id" class="change-log-item">
                <div class="change-log-header">
                  <span class="badge badge-info">{{ formatChangeLogType(log.type) }}</span>
                  <span class="change-log-operator">{{ log.operator }}</span>
                  <span class="change-log-time">{{ formatTime(log.timestamp) }}</span>
                </div>
                <div class="change-log-desc">{{ log.description }}</div>
                <div v-if="log.details && Object.keys(log.details).length > 0" class="change-log-details">
                  <details>
                    <summary>查看详情</summary>
                    <pre>{{ JSON.stringify(log.details, null, 2) }}</pre>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showRecordDetailModal = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ReverberationService } from './services/ReverberationService.js'
import { MessageService } from './services/MessageService.js'
import Chart from 'chart.js/auto'

export default {
  name: 'App',
  setup() {
    const service = new ReverberationService()
    const messageService = new MessageService()
    
    const activeTab = ref('records')
    const workflowStep = ref(1)
    const records = ref([])
    const batches = ref([])
    const selectedBatchId = ref('')
    const missingRecords = ref([])
    const conflicts = ref([])
    const recentMessages = ref([])
    const selfCheckResults = ref(null)
    const chartCanvas = ref(null)
    let chartInstance = null

    const showImportModal = ref(false)
    const showKeepMissingModalData = ref(null)
    const showNoteModal = ref(null)
    const showMissingDetailModal = ref(null)
    const showRecordDetailModal = ref(false)
    const recordDetail = ref(null)

    const importForm = ref({
      sampleTime: '',
      location: '',
      frequency: 500,
      reverberationTime: 1.0,
      materialType: 'normal',
      batchName: '',
      operator: ''
    })

    const keepReasonForm = ref({
      reason: '',
      reviewer: '老岑'
    })

    const noteForm = ref({
      content: '',
      author: '',
      isHandwritten: false
    })
    let currentNoteRecordId = null

    const pendingConflicts = computed(() => {
      return conflicts.value.filter(c => c.status === 'pending')
    })

    const filteredRecords = computed(() => {
      if (!selectedBatchId.value) return records.value
      return records.value.filter(r => r.batchId === selectedBatchId.value)
    })

    const keptMissingRecords = computed(() => {
      return missingRecords.value.filter(m => m.status === 'kept')
    })

    function getBatchName(batchId) {
      if (!batchId) return '未知批次'
      const batch = service.getBatchById(batchId)
      return batch ? batch.name : '未知批次'
    }

    function formatChangeLogType(type) {
      const map = {
        'create': '创建',
        'update': '更新',
        'delete': '删除',
        'detect': '检测',
        'review': '复核',
        'supplement': '补录'
      }
      return map[type] || type
    }

    function formatTime(timeStr) {
      if (!timeStr) return '-'
      const d = new Date(timeStr)
      return d.toLocaleString('zh-CN', { 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }

    function formatMissingStatus(status) {
      const map = {
        'pending_review': '待复核',
        'kept': '已保留',
        'resolved': '已解决'
      }
      return map[status] || status
    }

    function refreshData() {
      records.value = service.getRecords()
      batches.value = service.getBatches()
      missingRecords.value = service.getMissingTimeRecords()
      conflicts.value = service.getConflicts()
      recentMessages.value = messageService.getRecentMessages(5)
      
      nextTick(() => {
        updateChart()
      })
    }

    function updateChart() {
      if (!chartCanvas.value) return
      
      const chartData = service.getReviewChartData()
      
      if (chartInstance) {
        chartInstance.destroy()
      }

      const ctx = chartCanvas.value.getContext('2d')
      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: '实验复盘 - 记录统计'
            },
            legend: {
              position: 'top'
            }
          },
          scales: {
            x: {
              stacked: true
            },
            y: {
              stacked: true,
              beginAtZero: true
            }
          }
        }
      })
    }

    function loadDemoData() {
      messageService.clearMessages()
      
      service.addSafetyThreshold({
        frequency: 500,
        minReverberationTime: 0.5,
        maxReverberationTime: 1.5,
        location: '会议室A',
        updatedBy: '系统'
      })

      const demoRecords = [
        { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
        { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 },
        { sampleTime: '2026-06-04T10:35:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 },
        { sampleTime: '2026-06-04T11:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.8 },
        { sampleTime: '2026-06-04T11:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.0 }
      ]

      const results = service.importRecords(demoRecords, '演示用户', '首次导入演示数据')
      const messages = messageService.formatImportResults(results)
      messages.forEach(m => messageService.addCustomMessage(m))
      
      messageService.addMessage('self_check_complete')
      
      refreshData()
    }

    function importSingleRecord() {
      const data = {
        sampleTime: importForm.value.sampleTime ? new Date(importForm.value.sampleTime).toISOString() : null,
        location: importForm.value.location,
        frequency: Number(importForm.value.frequency),
        reverberationTime: Number(importForm.value.reverberationTime),
        materialType: importForm.value.materialType
      }

      const results = service.importRecords(
        [data],
        importForm.value.operator || '系统用户',
        importForm.value.batchName || null
      )
      const messages = messageService.formatImportResults(results)
      messages.forEach(m => messageService.addCustomMessage(m))
      
      showImportModal.value = false
      importForm.value = { 
        sampleTime: '', 
        location: '', 
        frequency: 500, 
        reverberationTime: 1.0, 
        materialType: 'normal',
        batchName: '',
        operator: ''
      }
      refreshData()
    }

    function detectMissingTime() {
      service.detectMissingTimeGaps()
      refreshData()
      messageService.addMessage('missing_sample_time')
    }

    function showKeepMissingModal(missing) {
      showKeepMissingModalData.value = missing
      keepReasonForm.value = { reason: '', reviewer: '老岑' }
    }

    function confirmKeepMissing() {
      if (!showKeepMissingModalData.value) return
      
      const result = service.reviewMissingRecord(
        showKeepMissingModalData.value.id,
        'keep',
        keepReasonForm.value.reason,
        keepReasonForm.value.reviewer
      )

      if (result.success) {
        messageService.addMessage('keep_reason_recorded')
        showKeepMissingModalData.value = null
        refreshData()
      }
    }

    function resolveWithSupplement(missing) {
      messageService.addCustomMessage({
        title: '请补录缺失数据',
        message: `请在 ${formatTime(missing.expectedTime)} 附近补录采样数据`,
        severity: 'info',
        suggestion: '使用记录管理中的"补录"功能添加数据'
      })
      activeTab.value = 'records'
    }

    function addNoteToRecord(record) {
      currentNoteRecordId = record.id
      noteForm.value = { content: '', author: '', isHandwritten: false }
      showNoteModal.value = record
    }

    function saveNote() {
      if (!currentNoteRecordId) return
      
      const result = service.addInspectionNote({
        recordId: currentNoteRecordId,
        noteContent: noteForm.value.content,
        author: noteForm.value.author,
        isHandwritten: noteForm.value.isHandwritten
      })

      if (result.conflicts.length > 0) {
        messageService.addMessage('note_threshold_conflict')
      } else {
        messageService.addMessage('workflow_step1_complete')
      }

      workflowStep.value = 2
      showNoteModal.value = null
      refreshData()
    }

    function addSupplementToRecord(record) {
      messageService.addCustomMessage({
        title: '补录功能',
        message: '请在导入时选择"补录材料"类型，系统会自动关联原始记录。',
        severity: 'info'
      })
      showImportModal.value = true
      importForm.value.materialType = 'supplement'
    }

    function resolveConflict(conflictId, decision) {
      const result = service.resolveConflict(conflictId, decision, '老岑')
      
      if (result.success) {
        messageService.addCustomMessage({
          title: decision === 'confirm' ? '冲突已确认' : '冲突已驳回',
          message: decision === 'confirm' 
            ? '已确认数据异常，请联系现场重新测量。' 
            : '已驳回冲突，以手写巡检备注为准。',
          severity: decision === 'confirm' ? 'warning' : 'success'
        })
        
        if (workflowStep.value === 2) {
          workflowStep.value = 3
          messageService.addMessage('workflow_step3_complete')
        }
        
        refreshData()
      }
    }

    function runSelfCheck() {
      selfCheckResults.value = service.runSelfCheck()
      messageService.addMessage('self_check_complete')
      recentMessages.value = messageService.getRecentMessages(5)
    }

    function exportData() {
      const data = service.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `混响时间数据_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      messageService.addMessage('export_consistent')
      recentMessages.value = messageService.getRecentMessages(5)
    }

    function showMissingDetail(missing) {
      showMissingDetailModal.value = missing
    }

    function showRecordDetail(record) {
      recordDetail.value = service.getRecordDetail(record.id)
      showRecordDetailModal.value = true
    }

    onMounted(() => {
      refreshData()
    })

    watch(activeTab, () => {
      nextTick(() => {
        if (activeTab.value === 'chart') {
          updateChart()
        }
      })
    })

    return {
      service,
      activeTab,
      workflowStep,
      records,
      batches,
      selectedBatchId,
      filteredRecords,
      missingRecords,
      conflicts,
      recentMessages,
      selfCheckResults,
      chartCanvas,
      showImportModal,
      showKeepMissingModalData,
      showNoteModal,
      showMissingDetailModal,
      showRecordDetailModal,
      recordDetail,
      importForm,
      keepReasonForm,
      noteForm,
      pendingConflicts,
      keptMissingRecords,
      formatTime,
      formatMissingStatus,
      formatChangeLogType,
      getBatchName,
      loadDemoData,
      importSingleRecord,
      detectMissingTime,
      showKeepMissingModal,
      confirmKeepMissing,
      resolveWithSupplement,
      addNoteToRecord,
      saveNote,
      addSupplementToRecord,
      resolveConflict,
      runSelfCheck,
      exportData,
      showMissingDetail,
      showRecordDetail
    }
  }
}
</script>
