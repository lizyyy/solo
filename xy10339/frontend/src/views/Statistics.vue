<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>统计进度</h2>
      <div>
        <el-select v-model="selectedRepairItemId" placeholder="选择维修事项" 
          style="width: 250px; margin-right: 10px;" @change="loadStatistics">
          <el-option v-for="item in repairItems" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-button type="primary" @click="exportExcel">导出公示表</el-button>
      </div>
    </div>

    <el-row :gutter="20" v-if="stats">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>📊 {{ stats.repair_item?.name }} - 投票统计</span>
            </div>
          </template>
          
          <el-row :gutter="20">
            <el-col :span="6">
              <el-statistic title="总户数" :value="stats.totals?.total_houses" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="总建筑面积" :value="stats.totals?.total_area" suffix="㎡" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="已投票户数" :value="stats.voting_progress?.voted_houses" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="投票率" :value="stats.voting_progress?.voted_percentage" suffix="%" />
            </el-col>
          </el-row>

          <el-divider />

          <h3 style="margin-bottom: 15px;">通过情况（双50%规则）</h3>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-card>
                <template #header>
                  <span>户数比例</span>
                </template>
                <el-progress 
                  :percentage="parseFloat(stats.results?.people_pass_rate || 0)"
                  :status="parseFloat(stats.results?.people_pass_rate || 0) >= 50 ? 'success' : 'warning'"
                  :format="percentage => `同意户数: ${stats.results?.agreed?.houses || 0} / ${stats.totals?.total_houses || 0} (${percentage}%)`"
                />
                <p style="margin-top: 10px; color: #909399; font-size: 12px;">
                  需要 ≥ 50%
                </p>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card>
                <template #header>
                  <span>面积比例</span>
                </template>
                <el-progress 
                  :percentage="parseFloat(stats.results?.area_pass_rate || 0)"
                  :status="parseFloat(stats.results?.area_pass_rate || 0) >= 50 ? 'success' : 'warning'"
                  :format="percentage => `同意面积: ${stats.results?.agreed?.area || 0} / ${stats.totals?.total_area || 0} ㎡ (${percentage}%)`"
                />
                <p style="margin-top: 10px; color: #909399; font-size: 12px;">
                  需要 ≥ 50%
                </p>
              </el-card>
            </el-col>
          </el-row>

          <el-alert 
            :title="stats.results?.passed ? '✅ 投票通过！' : '❌ 投票未通过'"
            :type="stats.results?.passed ? 'success' : 'warning'"
            :closable="false"
            style="margin-top: 20px;"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;" v-if="stats">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>📝 投票结果明细</span>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="同意户数">
              <el-tag type="success">{{ stats.results?.agreed?.houses || 0 }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="同意面积">
              {{ stats.results?.agreed?.area || 0 }} ㎡
            </el-descriptions-item>
            <el-descriptions-item label="反对户数">
              <el-tag type="danger">{{ stats.results?.disagreed?.houses || 0 }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="反对面积">
              {{ stats.results?.disagreed?.area || 0 }} ㎡
            </el-descriptions-item>
            <el-descriptions-item label="弃权户数">
              <el-tag type="info">{{ stats.results?.abstained?.houses || 0 }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="弃权面积">
              {{ stats.results?.abstained?.area || 0 }} ㎡
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>⚠️ 特殊标记</span>
            </div>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="需复核的委托投票">
              <el-tag type="warning" v-if="stats.flags?.invalid_delegate_vote_count > 0">
                {{ stats.flags?.invalid_delegate_vote_count }} 票
              </el-tag>
              <span v-else style="color: #67c23a;">无</span>
            </el-descriptions-item>
            <el-descriptions-item label="已撤回的投票">
              {{ stats.flags?.revoked_vote_count || 0 }} 票（不计入统计）
            </el-descriptions-item>
            <el-descriptions-item label="有效委托数">
              {{ stats.flags?.active_delegate_count || 0 }} 个
            </el-descriptions-item>
            <el-descriptions-item label="未投票户数">
              <el-tag type="info">{{ stats.voting_progress?.not_voted_houses || 0 }} 户</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px;" v-if="stats && stats.voting_progress?.not_voted_list?.length > 0">
      <template #header>
        <div class="card-header">
          <span>📋 未投票房屋（前20户）</span>
        </div>
      </template>
      <el-table :data="stats.voting_progress.not_voted_list" border stripe size="small">
        <el-table-column prop="building_name" label="楼栋" />
        <el-table-column prop="unit_number" label="单元" width="80" />
        <el-table-column prop="room_number" label="房号" width="80" />
        <el-table-column prop="area" label="面积" width="100" />
        <el-table-column prop="owner_name" label="业主" />
        <el-table-column prop="owner_phone" label="电话" />
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px;" v-if="stats">
      <template #header>
        <div class="card-header">
          <span>📖 统计口径说明</span>
        </div>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="计入统计的投票">
          {{ stats.counting_rules?.counted_votes }}
        </el-descriptions-item>
        <el-descriptions-item label="不计入统计的投票">
          {{ stats.counting_rules?.excluded_votes }}
        </el-descriptions-item>
        <el-descriptions-item label="委托投票有效性">
          {{ stats.counting_rules?.delegate_rules }}
        </el-descriptions-item>
        <el-descriptions-item label="通过条件">
          <strong style="color: #e6a23c;">{{ stats.counting_rules?.pass_criteria }}</strong>
        </el-descriptions-item>
        <el-descriptions-item label="户数比例公式">
          {{ stats.counting_rules?.people_rate_calc }}
        </el-descriptions-item>
        <el-descriptions-item label="面积比例公式">
          {{ stats.counting_rules?.area_rate_calc }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script>
import api from '../api'

export default {
  data() {
    return {
      repairItems: [],
      selectedRepairItemId: '',
      stats: null
    }
  },
  mounted() {
    this.loadRepairItems()
  },
  methods: {
    async loadRepairItems() {
      const res = await api.repairItems.getAll()
      this.repairItems = res.data
      
      const fromQuery = this.$route.query.repairItemId
      if (fromQuery) {
        this.selectedRepairItemId = fromQuery
        this.loadStatistics()
      } else if (this.repairItems.length > 0) {
        this.selectedRepairItemId = this.repairItems[0].id
        this.loadStatistics()
      }
    },
    async loadStatistics() {
      if (!this.selectedRepairItemId) return
      try {
        const res = await api.statistics.getByRepairItem(this.selectedRepairItemId)
        this.stats = res.data
      } catch (error) {
        console.error(error)
      }
    },
    exportExcel() {
      if (!this.selectedRepairItemId) return
      window.open(`/api/export/excel/${this.selectedRepairItemId}`, '_blank')
    }
  }
}
</script>

<style scoped>
.card-header {
  font-weight: bold;
}
</style>
