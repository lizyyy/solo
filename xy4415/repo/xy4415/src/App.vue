<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-title">🎻 提琴归还放行工具</h1>
        <span class="app-subtitle">学校乐器租赁室</span>
      </div>
      <div class="header-right">
        <div class="header-info" v-if="lastUpdated">
          <span class="text-muted text-sm">数据时间: {{ dataDate }}</span>
          <span class="text-muted text-sm">|</span>
          <span class="text-muted text-sm">上次更新: {{ lastUpdated }}</span>
        </div>
        <div class="header-actions">
          <button class="btn btn-sm btn-secondary" @click="showSaveDialog">
            💾 保存数据
          </button>
          <button class="btn btn-sm btn-secondary" @click="showLoadDialog">
            📂 加载数据
          </button>
          <button class="btn btn-sm btn-danger" @click="confirmClearData">
            🗑️ 清空
          </button>
        </div>
      </div>
    </header>

    <main class="app-main">
      <section class="import-section">
        <div class="card">
          <div class="card-header">
            <span class="font-semibold">📥 数据导入</span>
          </div>
          <div class="card-body">
            <div class="grid grid-cols-2 gap-4">
              <div
                class="drop-zone"
                @click="triggerFileInput('rental')"
                @dragover.prevent="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop($event, 'rental')"
                :class="{ dragover: dragOverType === 'rental' }"
              >
                <div class="drop-zone-icon">📄</div>
                <div class="font-medium">租借单 CSV</div>
                <div class="text-sm text-muted mt-2">
                  {{ statistics.rentalCount }} 条记录已导入
                </div>
                <div class="text-sm text-muted">
                  点击或拖拽文件到此处
                </div>
              </div>

              <div
                class="drop-zone"
                @click="triggerFileInput('humidity')"
                @dragover.prevent="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop($event, 'humidity')"
                :class="{ dragover: dragOverType === 'humidity' }"
              >
                <div class="drop-zone-icon">🌡️</div>
                <div class="font-medium">琴盒湿度记录</div>
                <div class="text-sm text-muted mt-2">
                  {{ statistics.humidityCount }} 条记录已导入
                </div>
                <div class="text-sm text-muted">
                  点击或拖拽CSV文件到此处
                </div>
              </div>

              <div
                class="drop-zone"
                @click="triggerFileInput('inspection')"
                @dragover.prevent="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop($event, 'inspection')"
                :class="{ dragover: dragOverType === 'inspection' }"
              >
                <div class="drop-zone-icon">🔍</div>
                <div class="font-medium">弓毛/松香点检 JSON</div>
                <div class="text-sm text-muted mt-2">
                  {{ statistics.inspectionCount }} 条记录已导入
                </div>
                <div class="text-sm text-muted">
                  点击或拖拽JSON文件到此处
                </div>
              </div>

              <div
                class="drop-zone"
                @click="triggerFileInput('maintenance')"
                @dragover.prevent="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop($event, 'maintenance')"
                :class="{ dragover: dragOverType === 'maintenance' }"
              >
                <div class="drop-zone-icon">🔧</div>
                <div class="font-medium">维修备注 JSON</div>
                <div class="text-sm text-muted mt-2">
                  {{ statistics.maintenanceCount }} 条记录已导入
                </div>
                <div class="text-sm text-muted">
                  点击或拖拽JSON文件到此处
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="statistics-section">
        <div class="grid grid-cols-3 gap-4">
          <div class="stat-card card">
            <div class="stat-value" :style="{ color: statistics.blockedCount > 0 ? '#ef4444' : '#6b7280' }">
              {{ statistics.totalViolins }}
            </div>
            <div class="stat-label">提琴总数</div>
            <div class="stat-details">
              <span v-if="statistics.blockedCount > 0" class="text-danger">
                {{ statistics.blockedCount }} 架扣留
              </span>
              <span v-else class="text-muted">无扣留</span>
            </div>
          </div>

          <div class="stat-card card">
            <div class="stat-value" :style="{ color: statistics.overdueCount > 0 ? '#ef4444' : '#6b7280' }">
              {{ statistics.activeRentalCount }}
            </div>
            <div class="stat-label">活跃租借</div>
            <div class="stat-details">
              <span v-if="statistics.overdueCount > 0" class="text-danger">
                {{ statistics.overdueCount }} 笔逾期
              </span>
              <span v-else class="text-muted">无逾期</span>
            </div>
          </div>

          <div class="stat-card card">
            <div class="stat-value" :style="{ color: statistics.criticalCount > 0 ? '#ef4444' : statistics.highCount > 0 ? '#f97316' : '#22c55e' }">
              {{ statistics.criticalCount + statistics.highCount + statistics.mediumCount + statistics.lowCount }}
            </div>
            <div class="stat-label">风险乐器</div>
            <div class="stat-details">
              <span v-if="statistics.criticalCount > 0" class="text-danger">
                🔴 {{ statistics.criticalCount }} 严重
              </span>
              <span v-else-if="statistics.highCount > 0" class="text-warning">
                🟠 {{ statistics.highCount }} 高风险
              </span>
              <span v-else class="text-success">
                🟢 无高风险
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="export-section">
        <div class="card">
          <div class="card-header flex justify-between items-center">
            <span class="font-semibold">📤 数据导出</span>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-primary" @click="exportMaintenanceMarkdown">
                📋 待维修清单 (Markdown)
              </button>
              <button class="btn btn-sm btn-secondary" @click="exportAuditJson">
                📊 审计日志 (JSON)
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="risk-section">
        <div class="card" v-if="blockedList.length > 0">
          <div class="card-header" style="background-color: #fef2f2; border-bottom: 2px solid #ef4444;">
            <span class="font-semibold" style="color: #dc2626;">🚫 已扣留乐器 ({{ blockedList.length }})</span>
          </div>
          <div class="card-body">
            <div class="risk-list">
              <div
                v-for="risk in blockedList"
                :key="risk.id"
                class="risk-item blocked"
                @click="showDetail(risk)"
              >
                <div class="risk-header">
                  <div class="risk-title">
                    <span class="violin-name">{{ risk.violinName }}</span>
                    <span class="violin-id text-muted">({{ risk.violinId }})</span>
                  </div>
                  <div class="risk-badges">
                    <span class="badge badge-danger">已扣留</span>
                  </div>
                </div>
                <div class="risk-body">
                  <div class="risk-types">
                    <span
                      v-for="rt in risk.riskTypes"
                      :key="rt.type"
                      class="risk-type"
                      :class="`risk-type-${rt.severity}`"
                    >
                      {{ getRiskTypeText(rt.type) }}
                    </span>
                  </div>
                  <div class="risk-detail text-sm text-muted mt-2">
                    {{ risk.blockReason }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" v-if="criticalRisks.length > 0">
          <div class="card-header" style="background-color: #fef2f2;">
            <span class="font-semibold" style="color: #dc2626;">🔴 严重风险 ({{ criticalRisks.length }})</span>
          </div>
          <div class="card-body">
            <div class="risk-list">
              <div
                v-for="risk in criticalRisks"
                :key="risk.id"
                class="risk-item critical"
                @click="showDetail(risk)"
              >
                <div class="risk-header">
                  <div class="risk-title">
                    <span class="violin-name">{{ risk.violinName }}</span>
                    <span class="violin-id text-muted">({{ risk.violinId }})</span>
                  </div>
                  <div class="risk-badges">
                    <span v-if="risk.reviewedAt" class="badge badge-info">已复核</span>
                  </div>
                </div>
                <div class="risk-body">
                  <div class="risk-types">
                    <span
                      v-for="rt in risk.riskTypes"
                      :key="rt.type"
                      class="risk-type risk-type-critical"
                    >
                      {{ rt.description }}
                    </span>
                  </div>
                  <div class="risk-details mt-2">
                    <div v-for="detail in risk.details" :key="detail" class="text-sm text-muted">
                      • {{ detail }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" v-if="highRisks.length > 0">
          <div class="card-header" style="background-color: #fff7ed;">
            <span class="font-semibold" style="color: #c2410c;">🟠 高风险 ({{ highRisks.length }})</span>
          </div>
          <div class="card-body">
            <div class="risk-list">
              <div
                v-for="risk in highRisks"
                :key="risk.id"
                class="risk-item high"
                @click="showDetail(risk)"
              >
                <div class="risk-header">
                  <div class="risk-title">
                    <span class="violin-name">{{ risk.violinName }}</span>
                    <span class="violin-id text-muted">({{ risk.violinId }})</span>
                  </div>
                  <div class="risk-badges">
                    <span v-if="risk.reviewedAt" class="badge badge-info">已复核</span>
                  </div>
                </div>
                <div class="risk-body">
                  <div class="risk-types">
                    <span
                      v-for="rt in risk.riskTypes"
                      :key="rt.type"
                      class="risk-type risk-type-high"
                    >
                      {{ rt.description }}
                    </span>
                  </div>
                  <div class="risk-details mt-2">
                    <div v-for="detail in risk.details" :key="detail" class="text-sm text-muted">
                      • {{ detail }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" v-if="mediumRisks.length > 0">
          <div class="card-header" style="background-color: #fefce8;">
            <span class="font-semibold" style="color: #a16207;">🟡 中风险 ({{ mediumRisks.length }})</span>
          </div>
          <div class="card-body">
            <div class="risk-list">
              <div
                v-for="risk in mediumRisks"
                :key="risk.id"
                class="risk-item medium"
                @click="showDetail(risk)"
              >
                <div class="risk-header">
                  <div class="risk-title">
                    <span class="violin-name">{{ risk.violinName }}</span>
                    <span class="violin-id text-muted">({{ risk.violinId }})</span>
                  </div>
                  <div class="risk-badges">
                    <span v-if="risk.reviewedAt" class="badge badge-info">已复核</span>
                  </div>
                </div>
                <div class="risk-body">
                  <div class="risk-types">
                    <span
                      v-for="rt in risk.riskTypes"
                      :key="rt.type"
                      class="risk-type risk-type-medium"
                    >
                      {{ rt.description }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" v-if="lowRisks.length > 0">
          <div class="card-header" style="background-color: #f0fdf4;">
            <span class="font-semibold" style="color: #15803d;">🟢 低风险 ({{ lowRisks.length }})</span>
          </div>
          <div class="card-body">
            <div class="risk-list">
              <div
                v-for="risk in lowRisks"
                :key="risk.id"
                class="risk-item low"
                @click="showDetail(risk)"
              >
                <div class="risk-header">
                  <div class="risk-title">
                    <span class="violin-name">{{ risk.violinName }}</span>
                    <span class="violin-id text-muted">({{ risk.violinId }})</span>
                  </div>
                  <div class="risk-badges">
                    <span v-if="risk.reviewedAt" class="badge badge-info">已复核</span>
                  </div>
                </div>
                <div class="risk-body">
                  <div class="risk-types">
                    <span
                      v-for="rt in risk.riskTypes"
                      :key="rt.type"
                      class="risk-type risk-type-low"
                    >
                      {{ rt.description }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" v-if="noRisks.length > 0">
          <div class="card-header">
            <span class="font-semibold">⚪ 正常乐器 ({{ noRisks.length }})</span>
          </div>
          <div class="card-body">
            <div class="risk-list">
              <div
                v-for="risk in noRisks"
                :key="risk.id"
                class="risk-item normal"
                @click="showDetail(risk)"
              >
                <div class="risk-header">
                  <div class="risk-title">
                    <span class="violin-name">{{ risk.violinName }}</span>
                    <span class="violin-id text-muted">({{ risk.violinId }})</span>
                  </div>
                  <div class="risk-badges">
                    <span class="badge badge-success">可上架</span>
                    <span v-if="risk.reviewedAt" class="badge badge-info">已复核</span>
                  </div>
                </div>
                <div class="risk-body" v-if="risk.rentalInfo || risk.humidityInfo || risk.bowInspectionInfo">
                  <div class="risk-details text-sm text-muted">
                    <div v-if="risk.rentalInfo">
                      📋 租借: {{ risk.rentalInfo.studentName }} ({{ risk.rentalInfo.rentDate }} ~ {{ risk.rentalInfo.dueDate }})
                    </div>
                    <div v-if="risk.humidityInfo">
                      🌡️ 湿度: {{ risk.humidityInfo.latestHumidity }}% ({{ risk.humidityInfo.latestRecordTime }})
                    </div>
                    <div v-if="risk.bowInspectionInfo">
                      🔍 点检: {{ getConditionText(risk.bowInspectionInfo.bowHairCondition) }} / {{ getConditionText(risk.bowInspectionInfo.rosinCondition) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" v-if="violinRisks.length === 0">
          <div class="card-body">
            <div class="empty-state">
              <div class="empty-state-icon">🎻</div>
              <div class="empty-state-title">暂无乐器数据</div>
              <div class="empty-state-description">
                请通过上方的导入区域导入租借单、湿度记录、点检记录等数据
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <div v-if="showDetailModal" class="modal-overlay" @click.self="closeDetail">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3 class="modal-title">
            {{ selectedRisk?.violinName }}
            <span class="text-muted text-sm">({{ selectedRisk?.violinId }})</span>
          </h3>
          <button class="modal-close" @click="closeDetail">&times;</button>
        </div>
        <div class="modal-body" v-if="selectedRisk">
          <div class="detail-section">
            <h4 class="detail-section-title">风险概览</h4>
            <div class="detail-summary">
              <div class="detail-summary-item">
                <span class="detail-summary-label">风险级别</span>
                <span class="badge" :class="`badge-${getRiskBadgeClass(selectedRisk.riskLevel)}`">
                  {{ getRiskLevelText(selectedRisk.riskLevel) }}
                </span>
              </div>
              <div class="detail-summary-item">
                <span class="detail-summary-label">状态</span>
                <span v-if="selectedRisk.isBlocked" class="badge badge-danger">已扣留</span>
                <span v-else-if="selectedRisk.reviewedAt" class="badge badge-info">已复核</span>
                <span v-else class="badge badge-warning">待复核</span>
              </div>
            </div>
          </div>

          <div class="detail-section" v-if="selectedRisk.riskTypes.length > 0">
            <h4 class="detail-section-title">风险类型</h4>
            <div class="risk-types">
              <span
                v-for="rt in selectedRisk.riskTypes"
                :key="rt.type"
                class="risk-type"
                :class="`risk-type-${rt.severity}`"
              >
                {{ getRiskTypeText(rt.type) }}: {{ rt.description }}
              </span>
            </div>
            <div class="risk-details mt-3">
              <h5 class="detail-subtitle">详细说明:</h5>
              <ul>
                <li v-for="detail in selectedRisk.details" :key="detail" class="text-muted">
                  {{ detail }}
                </li>
              </ul>
            </div>
          </div>

          <div class="detail-section" v-if="selectedRisk.rentalInfo">
            <h4 class="detail-section-title">📋 租借信息</h4>
            <table class="table table-compact">
              <tr>
                <td class="text-muted">租借单号</td>
                <td>{{ selectedRisk.rentalInfo.rentalId }}</td>
              </tr>
              <tr>
                <td class="text-muted">学生姓名</td>
                <td>{{ selectedRisk.rentalInfo.studentName }}</td>
              </tr>
              <tr>
                <td class="text-muted">租借日期</td>
                <td>{{ selectedRisk.rentalInfo.rentDate }}</td>
              </tr>
              <tr>
                <td class="text-muted">应还日期</td>
                <td>{{ selectedRisk.rentalInfo.dueDate }}</td>
              </tr>
              <tr v-if="selectedRisk.rentalInfo.daysOverdue">
                <td class="text-muted">逾期天数</td>
                <td class="text-danger">{{ selectedRisk.rentalInfo.daysOverdue }} 天</td>
              </tr>
            </table>
          </div>

          <div class="detail-section" v-if="selectedRisk.humidityInfo">
            <h4 class="detail-section-title">🌡️ 湿度记录</h4>
            <table class="table table-compact">
              <tr>
                <td class="text-muted">最新记录时间</td>
                <td>{{ selectedRisk.humidityInfo.latestRecordTime }}</td>
              </tr>
              <tr>
                <td class="text-muted">最新湿度</td>
                <td :class="selectedRisk.humidityInfo.isOutOfRange ? 'text-danger' : ''">
                  {{ selectedRisk.humidityInfo.latestHumidity }}%
                  <span v-if="selectedRisk.humidityInfo.isOutOfRange" class="text-danger">
                    (正常范围: 40%-60%)
                  </span>
                </td>
              </tr>
              <tr v-if="selectedRisk.humidityInfo.minHumidity !== undefined">
                <td class="text-muted">湿度范围</td>
                <td>
                  {{ selectedRisk.humidityInfo.minHumidity }}% ~ {{ selectedRisk.humidityInfo.maxHumidity }}%
                </td>
              </tr>
            </table>
          </div>

          <div class="detail-section" v-if="selectedRisk.bowInspectionInfo">
            <h4 class="detail-section-title">🔍 弓毛/松香点检</h4>
            <table class="table table-compact">
              <tr>
                <td class="text-muted">点检日期</td>
                <td>{{ selectedRisk.bowInspectionInfo.inspectionDate }}</td>
              </tr>
              <tr>
                <td class="text-muted">弓毛状态</td>
                <td>
                  <span :class="selectedRisk.bowInspectionInfo.bowHairCondition === 'poor' ? 'text-danger' : ''">
                    {{ getConditionText(selectedRisk.bowInspectionInfo.bowHairCondition) }}
                  </span>
                </td>
              </tr>
              <tr>
                <td class="text-muted">松香状态</td>
                <td>
                  <span :class="selectedRisk.bowInspectionInfo.rosinCondition === 'poor' ? 'text-danger' : ''">
                    {{ getConditionText(selectedRisk.bowInspectionInfo.rosinCondition) }}
                  </span>
                </td>
              </tr>
              <tr>
                <td class="text-muted">总体状态</td>
                <td>
                  <span :class="{
                    'text-danger': selectedRisk.bowInspectionInfo.overallStatus === 'fail',
                    'text-warning': selectedRisk.bowInspectionInfo.overallStatus === 'needs_maintenance'
                  }">
                    {{ getStatusText(selectedRisk.bowInspectionInfo.overallStatus) }}
                  </span>
                </td>
              </tr>
              <tr v-if="selectedRisk.bowInspectionInfo.issues.length > 0">
                <td class="text-muted">存在问题</td>
                <td>{{ selectedRisk.bowInspectionInfo.issues.join('、') }}</td>
              </tr>
            </table>
          </div>

          <div class="detail-section" v-if="selectedRisk.duplicateRentals && selectedRisk.duplicateRentals.length > 0">
            <h4 class="detail-section-title">⚠️ 重复预约</h4>
            <div v-for="(dup, index) in selectedRisk.duplicateRentals" :key="index" class="duplicate-item">
              <div class="font-medium">冲突 {{ index + 1 }}:</div>
              <div class="text-sm text-muted mt-1">
                学生 {{ dup.studentName }} ({{ dup.rentDate }} ~ {{ dup.dueDate }})
                与学生 {{ dup.conflictStudentName }} 时间重叠
              </div>
            </div>
          </div>

          <div class="detail-section" v-if="selectedRisk.reviewNotes || selectedRisk.isBlocked">
            <h4 class="detail-section-title">📝 复核记录</h4>
            <div v-if="selectedRisk.reviewNotes">
              <div class="text-muted text-sm mb-1">
                复核人: {{ selectedRisk.reviewedBy }} | 复核时间: {{ selectedRisk.reviewedAt }}
              </div>
              <div class="review-notes">
                {{ selectedRisk.reviewNotes }}
              </div>
            </div>
            <div v-if="selectedRisk.isBlocked" class="mt-2">
              <div class="text-danger text-sm">
                🚫 已扣留 | 原因: {{ selectedRisk.blockReason }}
              </div>
              <div class="text-muted text-sm">
                扣留人: {{ selectedRisk.blockedBy }} | 时间: {{ selectedRisk.blockedAt }}
              </div>
            </div>
          </div>

          <div class="detail-section review-section">
            <h4 class="detail-section-title">✏️ 人工复核</h4>
            <div class="form-group">
              <label class="form-label">复核意见</label>
              <textarea
                v-model="reviewForm.notes"
                class="form-textarea"
                placeholder="请输入复核意见..."
                rows="3"
              ></textarea>
            </div>
            <div class="review-actions flex gap-3">
              <button
                class="btn btn-success"
                @click="submitReview('ok')"
              >
                ✅ 通过 - 可重新上架
              </button>
              <button
                class="btn btn-warning"
                @click="submitReview('maintenance')"
              >
                🔧 标记待维修
              </button>
              <button
                class="btn btn-danger"
                @click="submitReview('block')"
              >
                🚫 扣留 - 禁止上架
              </button>
              <button
                v-if="selectedRisk.isBlocked"
                class="btn btn-outline"
                @click="unblockViolin"
              >
                🔓 解除扣留
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showToast" class="toast" :class="toastType">
      {{ toastMessage }}
    </div>

    <input
      type="file"
      ref="rentalFileInput"
      style="display: none"
      accept=".csv"
      @change="handleFileSelect($event, 'rental')"
    />
    <input
      type="file"
      ref="humidityFileInput"
      style="display: none"
      accept=".csv"
      @change="handleFileSelect($event, 'humidity')"
    />
    <input
      type="file"
      ref="inspectionFileInput"
      style="display: none"
      accept=".json"
      @change="handleFileSelect($event, 'inspection')"
    />
    <input
      type="file"
      ref="maintenanceFileInput"
      style="display: none"
      accept=".json"
      @change="handleFileSelect($event, 'maintenance')"
    />
    <input
      type="file"
      ref="loadFileInput"
      style="display: none"
      accept=".json"
      @change="handleLoadFile"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDataStore } from './stores/dataStore'
import {
  getRiskLevelText,
  getRiskTypeText,
  getConditionText,
  getStatusText
} from './utils/riskEngine'
import { ViolinRisk } from './types'

const store = useDataStore()

const violinRisks = computed(() => store.violinRisks)
const criticalRisks = computed(() => store.criticalRisks)
const highRisks = computed(() => store.highRisks)
const mediumRisks = computed(() => store.mediumRisks)
const lowRisks = computed(() => store.lowRisks)
const noRisks = computed(() => store.noRisks)
const blockedList = computed(() => store.blockedList)
const statistics = computed(() => store.statistics)
const lastUpdated = computed(() => store.lastUpdated)
const dataDate = computed(() => store.dataDate)

const showDetailModal = ref(false)
const selectedRisk = ref<ViolinRisk | null>(null)
const reviewForm = ref({
  notes: ''
})

const dragOverType = ref<string | null>(null)

const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref<'success' | 'error' | 'info'>('info')

const rentalFileInput = ref<HTMLInputElement | null>(null)
const humidityFileInput = ref<HTMLInputElement | null>(null)
const inspectionFileInput = ref<HTMLInputElement | null>(null)
const maintenanceFileInput = ref<HTMLInputElement | null>(null)
const loadFileInput = ref<HTMLInputElement | null>(null)

function showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 3000)
}

function triggerFileInput(type: string) {
  switch (type) {
    case 'rental':
      rentalFileInput.value?.click()
      break
    case 'humidity':
      humidityFileInput.value?.click()
      break
    case 'inspection':
      inspectionFileInput.value?.click()
      break
    case 'maintenance':
      maintenanceFileInput.value?.click()
      break
  }
}

function handleDragOver(event: DragEvent, type: string) {
  event.preventDefault()
  dragOverType.value = type
}

function handleDragLeave() {
  dragOverType.value = null
}

function handleDrop(event: DragEvent, type: string) {
  event.preventDefault()
  dragOverType.value = null
  
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    processFile(files[0], type)
  }
}

function handleFileSelect(event: Event, type: string) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    processFile(input.files[0], type)
  }
  input.value = ''
}

async function processFile(file: File, type: string) {
  try {
    const content = await readFileContent(file)
    let result
    
    switch (type) {
      case 'rental':
        result = store.importRentalRecords(content)
        if (result.success) {
          showToastMessage(`成功导入 ${result.count} 条租借记录`, 'success')
        } else {
          showToastMessage(`导入失败: ${result.errors.join(', ')}`, 'error')
        }
        break
      case 'humidity':
        result = store.importHumidityRecords(content)
        if (result.success) {
          showToastMessage(`成功导入 ${result.count} 条湿度记录`, 'success')
        } else {
          showToastMessage(`导入失败: ${result.errors.join(', ')}`, 'error')
        }
        break
      case 'inspection':
        result = store.importBowInspections(content)
        if (result.success) {
          showToastMessage(`成功导入 ${result.count} 条点检记录`, 'success')
        } else {
          showToastMessage(`导入失败: ${result.errors.join(', ')}`, 'error')
        }
        break
      case 'maintenance':
        result = store.importMaintenanceNotes(content)
        if (result.success) {
          showToastMessage(`成功导入 ${result.count} 条维修备注`, 'success')
        } else {
          showToastMessage(`导入失败: ${result.errors.join(', ')}`, 'error')
        }
        break
    }
  } catch (error) {
    showToastMessage(`文件读取失败: ${(error as Error).message}`, 'error')
  }
}

function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      resolve(content)
    }
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    reader.readAsText(file)
  })
}

function showDetail(risk: ViolinRisk) {
  selectedRisk.value = { ...risk }
  reviewForm.value.notes = risk.reviewNotes || ''
  showDetailModal.value = true
}

function closeDetail() {
  showDetailModal.value = false
  selectedRisk.value = null
  reviewForm.value.notes = ''
}

function submitReview(decision: 'ok' | 'block' | 'maintenance') {
  if (!selectedRisk.value) return
  
  if (!reviewForm.value.notes.trim()) {
    showToastMessage('请输入复核意见', 'error')
    return
  }
  
  store.addReviewNote(
    selectedRisk.value.violinId,
    reviewForm.value.notes,
    decision
  )
  
  const messages: Record<string, string> = {
    ok: '复核通过，乐器可重新上架',
    block: '乐器已扣留，禁止上架',
    maintenance: '乐器已标记为待维修'
  }
  
  showToastMessage(messages[decision], 'success')
  closeDetail()
}

function unblockViolin() {
  if (!selectedRisk.value) return
  
  store.unblockViolin(selectedRisk.value.violinId)
  showToastMessage('已解除扣留', 'success')
  closeDetail()
}

function showSaveDialog() {
  const data = store.exportAppData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `violin-data-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToastMessage('数据已保存', 'success')
}

function showLoadDialog() {
  loadFileInput.value?.click()
}

async function handleLoadFile(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  
  try {
    const content = await readFileContent(input.files[0])
    const data = JSON.parse(content)
    
    if (store.importAppData(data)) {
      showToastMessage('数据已加载', 'success')
    } else {
      showToastMessage('数据格式不正确', 'error')
    }
  } catch (error) {
    showToastMessage(`加载失败: ${(error as Error).message}`, 'error')
  }
  
  input.value = ''
}

function confirmClearData() {
  if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
    store.clearAllData()
    showToastMessage('数据已清空', 'info')
  }
}

function exportMaintenanceMarkdown() {
  const markdown = store.exportMaintenanceMarkdown()
  const blob = new Blob([markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `maintenance-list-${new Date().toISOString().split('T')[0]}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToastMessage('待维修清单已导出', 'success')
}

function exportAuditJson() {
  const json = store.exportAuditJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToastMessage('审计日志已导出', 'success')
}

function getRiskBadgeClass(level: string): string {
  switch (level) {
    case 'critical': return 'danger'
    case 'high': return 'warning'
    case 'medium': return 'warning'
    case 'low': return 'success'
    default: return 'info'
  }
}
</script>

<style>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.app-subtitle {
  font-size: 14px;
  opacity: 0.85;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.header-info {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions .btn {
  background-color: rgba(255, 255, 255, 0.15);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.header-actions .btn:hover {
  background-color: rgba(255, 255, 255, 0.25);
}

.app-main {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.import-section,
.statistics-section,
.export-section,
.risk-section {
  margin-bottom: 24px;
}

.statistics-section .grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  padding: 20px;
  text-align: center;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.stat-details {
  font-size: 12px;
}

.text-danger {
  color: #dc2626;
}

.text-warning {
  color: #d97706;
}

.text-success {
  color: #16a34a;
}

.risk-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk-item {
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.risk-item:hover {
  box-shadow: var(--shadow);
  border-color: var(--primary-color);
}

.risk-item.blocked {
  border-left: 4px solid #ef4444;
  background-color: #fef2f2;
}

.risk-item.critical {
  border-left: 4px solid #ef4444;
}

.risk-item.high {
  border-left: 4px solid #f97316;
}

.risk-item.medium {
  border-left: 4px solid #eab308;
}

.risk-item.low {
  border-left: 4px solid #22c55e;
}

.risk-item.normal {
  border-left: 4px solid #6b7280;
}

.risk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.risk-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.violin-name {
  font-weight: 600;
  font-size: 15px;
}

.violin-id {
  font-size: 12px;
}

.risk-badges {
  display: flex;
  gap: 6px;
}

.risk-types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.risk-type {
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 4px;
  font-weight: 500;
}

.risk-type-critical {
  background-color: #fef2f2;
  color: #dc2626;
}

.risk-type-high {
  background-color: #fff7ed;
  color: #c2410c;
}

.risk-type-medium {
  background-color: #fefce8;
  color: #a16207;
}

.risk-type-low {
  background-color: #f0fdf4;
  color: #15803d;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.modal {
  background-color: white;
  border-radius: var(--radius-lg);
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-large {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}

.modal-close:hover {
  background-color: var(--bg-tertiary);
}

.modal-body {
  padding: 24px;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.detail-subtitle {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}

.detail-summary {
  display: flex;
  gap: 24px;
}

.detail-summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-summary-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.table-compact {
  font-size: 13px;
}

.table-compact td {
  padding: 8px 12px;
}

.duplicate-item {
  padding: 12px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
}

.review-section {
  background-color: var(--bg-secondary);
  padding: 16px;
  border-radius: var(--radius);
}

.review-actions {
  flex-wrap: wrap;
}

.review-notes {
  padding: 12px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-sm);
  white-space: pre-wrap;
}

.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: var(--radius);
  color: white;
  font-weight: 500;
  z-index: 2000;
  animation: slideUp 0.3s ease;
}

.toast.success {
  background-color: #22c55e;
}

.toast.error {
  background-color: #ef4444;
}

.toast.info {
  background-color: #3b82f6;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .header-right {
    width: 100%;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .statistics-section .grid {
    grid-template-columns: 1fr;
  }
  
  .import-section .grid {
    grid-template-columns: 1fr;
  }
  
  .review-actions {
    flex-direction: column;
  }
}
</style>
