<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>争议记录</h2>
      <el-select v-model="selectedRepairItemId" placeholder="选择维修事项" 
        style="width: 250px;" @change="loadDisputes">
        <el-option v-for="item in repairItems" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
    </div>

    <el-alert
      title="争议记录说明"
      type="info"
      :closable="false"
      style="margin-bottom: 20px;"
    >
      <p>• <strong>无效委托投票</strong>：委托状态非active、已撤销或不在有效期内的委托投票，需要复核</p>
      <p>• <strong>已撤回投票</strong>：业主主动撤回的投票，不计入统计</p>
    </el-alert>

    <el-card v-if="disputes">
      <template #header>
        <div class="card-header">
          <span>⚠️ 无效委托投票（需复核）</span>
          <el-tag type="warning" v-if="disputes.invalid_delegate_votes?.length > 0">
            {{ disputes.invalid_delegate_votes.length }} 条
          </el-tag>
        </div>
      </template>

      <el-table v-if="disputes.invalid_delegate_votes?.length > 0" 
        :data="disputes.invalid_delegate_votes" border stripe>
        <el-table-column prop="building_name" label="楼栋" />
        <el-table-column prop="unit_number" label="单元" width="80" />
        <el-table-column prop="room_number" label="房号" width="80" />
        <el-table-column prop="area" label="面积" width="100" />
        <el-table-column prop="voter_name" label="投票人" />
        <el-table-column label="委托状态" width="120">
          <template #default="scope">
            <el-tag type="danger">{{ scope.row.delegate_status || '未知' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="委托有效期" width="220">
          <template #default="scope">
            {{ scope.row.start_date }} ~ {{ scope.row.end_date }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="投票时间" width="180" />
        <el-table-column label="问题">
          <template #default="scope">
            <span v-if="scope.row.delegate_status !== 'active'" style="color: #f56c6c;">
              委托状态为 {{ scope.row.delegate_status }}
            </span>
            <span v-else-if="scope.row.delegate_revoked_at" style="color: #f56c6c;">
              委托已撤销
            </span>
            <span v-else style="color: #f56c6c;">
              委托不在有效期内
            </span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无无效委托投票" />
    </el-card>

    <el-card style="margin-top: 20px;" v-if="disputes">
      <template #header>
        <div class="card-header">
          <span>📜 已撤回投票（不计入统计）</span>
          <el-tag type="info" v-if="disputes.withdrawn_votes?.length > 0">
            {{ disputes.withdrawn_votes.length }} 条
          </el-tag>
        </div>
      </template>

      <el-table v-if="disputes.withdrawn_votes?.length > 0" 
        :data="disputes.withdrawn_votes" border stripe>
        <el-table-column prop="building_name" label="楼栋" />
        <el-table-column prop="unit_number" label="单元" width="80" />
        <el-table-column prop="room_number" label="房号" width="80" />
        <el-table-column prop="area" label="面积" width="100" />
        <el-table-column prop="voter_name" label="投票人" />
        <el-table-column label="表决意见" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.vote_value === 'agree' ? 'success' : scope.row.vote_value === 'disagree' ? 'danger' : 'info'">
              {{ scope.row.vote_value === 'agree' ? '同意' : scope.row.vote_value === 'disagree' ? '反对' : '弃权' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="vote_type" label="类型" width="100">
          <template #default="scope">
            {{ scope.row.vote_type === 'delegate' ? '委托' : '亲自' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="投票时间" width="180" />
        <el-table-column prop="revoked_at" label="撤回时间" width="180" />
        <el-table-column prop="notes" label="备注" />
      </el-table>
      <el-empty v-else description="暂无撤回投票记录" />
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
      disputes: null
    }
  },
  mounted() {
    this.loadRepairItems()
  },
  methods: {
    async loadRepairItems() {
      const res = await api.repairItems.getAll()
      this.repairItems = res.data
      if (this.repairItems.length > 0) {
        this.selectedRepairItemId = this.repairItems[0].id
        this.loadDisputes()
      }
    },
    async loadDisputes() {
      if (!this.selectedRepairItemId) return
      try {
        const res = await api.voting.getDisputes(this.selectedRepairItemId)
        this.disputes = res.data
      } catch (error) {
        console.error(error)
      }
    }
  }
}
</script>

<style scoped>
.card-header {
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
