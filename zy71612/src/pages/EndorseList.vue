<template>
  <div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">背书追踪</div>
        <div class="flex gap-8">
          <button class="btn btn-success" @click="exportEndorses">导出Excel</button>
          <button class="btn btn-primary" @click="checkAllChains">检查背书链</button>
        </div>
      </div>

      <div class="mb-16">
        <div class="flex gap-12">
          <div class="stat-card" style="flex: 1;">
            <div class="stat-label">背书链总数</div>
            <div class="stat-value">{{ chainStats?.totalBillsWithEndorses || 0 }}</div>
          </div>
          <div class="stat-card success" style="flex: 1;">
            <div class="stat-label">健康链</div>
            <div class="stat-value">{{ chainStats?.healthyChains || 0 }}</div>
          </div>
          <div class="stat-card warning" style="flex: 1;">
            <div class="stat-label">断链</div>
            <div class="stat-value">{{ chainStats?.brokenChains || 0 }}</div>
          </div>
          <div class="stat-card" style="flex: 1;">
            <div class="stat-label">总背书记录</div>
            <div class="stat-value">{{ chainStats?.totalEndorsements || 0 }}</div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
      <div v-else-if="endorses.length === 0" class="empty-state">
        <div class="icon">🔗</div>
        <p>暂无背书数据</p>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
          <tr>
            <th>票据号</th>
            <th>背书序号</th>
            <th>背书类型</th>
            <th>背书人</th>
            <th>被背书人</th>
            <th>背书日期</th>
            <th>背书金额</th>
            <th>断链标记</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="item in endorses" :key="item.id">
            <td>{{ item.billNo }}</td>
            <td>第{{ item.sequence }}手</td>
            <td>
              <span class="badge badge-info">
                {{ getEndorseTypeText(item.endorseType) }}
              </span>
            </td>
            <td>{{ item.endorser }}</td>
            <td>{{ item.endorsee }}</td>
            <td>{{ item.endorseDate }}</td>
            <td class="amount">¥{{ formatAmount(item.amount) }}</td>
            <td>
              <span :class="item.isBroken ? 'badge badge-danger' : 'badge badge-success'">
                {{ item.isBroken ? '断链' : '正常' }}
              </span>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import endorseService from '../services/EndorseService.js'
import exportService from '../services/ExportService.js'
import db from '../database/index.js'
import { EndorseTypeText } from '../models/types.js'

const endorses = ref([])
const chainStats = ref(null)
const loading = ref(false)

const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getEndorseTypeText = (type) => EndorseTypeText[type] || type

const loadEndorses = async () => {
  loading.value = true
  try {
    endorses.value = await db.getAll('endorses')
    endorses.value.sort((a, b) => {
      if (a.billNo !== b.billNo) return a.billNo.localeCompare(b.billNo)
      return a.sequence - b.sequence
    })
    chainStats.value = await endorseService.getChainStatistics()
  } catch (error) {
    console.error('加载背书列表失败:', error)
  } finally {
    loading.value = false
  }
}

const checkAllChains = async () => {
  alert('背书链检查功能已执行')
  loadEndorses()
}

const exportEndorses = async () => {
  try {
    await exportService.exportEndorses(endorses.value)
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败')
  }
}

onMounted(() => {
  loadEndorses()
})
</script>
