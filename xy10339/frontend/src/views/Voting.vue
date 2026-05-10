<template>
  <div>
    <h2>投票录入</h2>

    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header">
          <span>📝 新录入投票</span>
        </div>
      </template>
      
      <el-alert v-if="duplicateWarning" :title="duplicateWarning" type="warning" :closable="false" style="margin-bottom: 15px;" />
      <el-alert v-if="historicalVotes && historicalVotes.length > 0" type="info" :closable="false" style="margin-bottom: 15px;">
        <template #title>
          <strong>历史投票记录（不计入当前统计）：</strong>
          <ul style="margin: 10px 0 0 20px;">
            <li v-for="(v, idx) in historicalVotes" :key="idx">
              {{ v.vote_value === 'agree' ? '同意' : v.vote_value === 'disagree' ? '反对' : '弃权' }} - 
              时间：{{ v.created_at }} - 状态：{{ v.status === 'revoked' ? '已撤回' : v.status }}
              <span v-if="v.notes">- {{ v.notes }}</span>
            </li>
          </ul>
        </template>
      </el-alert>

      <el-form :model="voteForm" label-width="120px" :rules="rules" ref="voteFormRef">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="维修事项" prop="repair_item_id">
              <el-select v-model="voteForm.repair_item_id" placeholder="选择维修事项" 
                style="width: 100%;" @change="onRepairItemChange">
                <el-option v-for="item in repairItems" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="投票类型" prop="vote_type">
              <el-radio-group v-model="voteForm.vote_type">
                <el-radio value="direct">亲自投票</el-radio>
                <el-radio value="delegate">委托投票</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="楼栋" prop="building_id">
              <el-select v-model="voteForm.building_id" placeholder="选择楼栋" 
                style="width: 100%;" @change="onBuildingChange">
                <el-option v-for="b in buildings" :key="b.id" :label="b.name" :value="b.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="单元" prop="unit_number">
              <el-select v-model="voteForm.unit_number" placeholder="选择单元" 
                style="width: 100%;" @change="onUnitChange">
                <el-option v-for="u in availableUnits" :key="u" :label="`${u}单元`" :value="u" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="房号" prop="room_number">
              <el-select v-model="voteForm.room_number" placeholder="选择房号" 
                style="width: 100%;" @change="onRoomChange">
                <el-option v-for="h in availableRooms" :key="h.id" 
                  :label="`${h.room_number} (${h.area}㎡)`" 
                  :value="h.room_number" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="业主" prop="voter_owner_id">
              <el-select v-model="voteForm.voter_owner_id" placeholder="选择业主" style="width: 100%;">
                <el-option v-for="o in availableOwners" :key="o.id" 
                  :label="`${o.name} (${o.phone || '未登记电话'})`" 
                  :value="o.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="voteForm.vote_type === 'delegate'">
            <el-form-item label="委托" prop="delegate_id">
              <el-select v-model="voteForm.delegate_id" placeholder="选择有效委托" style="width: 100%;">
                <el-option v-for="d in availableDelegates" :key="d.id" 
                  :label="`委托人:${d.principal_name} -> 受托人:${d.agent_name} (${d.start_date}~${d.end_date})`" 
                  :value="d.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="表决意见" prop="vote_value">
              <el-radio-group v-model="voteForm.vote_value">
                <el-radio value="agree" label="同意" />
                <el-radio value="disagree" label="反对" />
                <el-radio value="abstain" label="弃权" />
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="备注">
              <el-input v-model="voteForm.notes" placeholder="可选" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item>
          <el-button type="primary" @click="submitVote" :loading="submitting">
            提交投票
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>📋 投票记录</span>
          <div>
            <el-select v-model="selectedRepairItemId" placeholder="选择维修事项" 
              style="width: 200px; margin-right: 10px;" @change="loadVotes">
              <el-option v-for="item in repairItems" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
            <el-select v-model="statusFilter" style="width: 120px; margin-right: 10px;" @change="loadVotes">
              <el-option label="仅有效" value="active" />
              <el-option label="含历史" value="all" />
            </el-select>
            <el-button type="primary" size="small" @click="exportExcel">导出公示表</el-button>
          </div>
        </div>
      </template>

      <el-table :data="votes" border stripe>
        <el-table-column prop="building_name" label="楼栋" width="150" />
        <el-table-column prop="unit_number" label="单元" width="80" />
        <el-table-column prop="room_number" label="房号" width="100" />
        <el-table-column prop="area" label="面积" width="80" />
        <el-table-column prop="voter_name" label="投票人" width="120" />
        <el-table-column label="表决" width="80">
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
        <el-table-column prop="principal_name" label="委托人" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'active' ? 'success' : 'info'">
              {{ scope.row.status === 'active' ? '有效' : '已撤回' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="180" />
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button link type="warning" size="small" 
              v-if="scope.row.status === 'active'"
              @click="revokeVote(scope.row)">
              撤回
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import api from '../api'

export default {
  data() {
    return {
      repairItems: [],
      buildings: [],
      selectedRepairItemId: '',
      statusFilter: 'active',
      votes: [],
      availableUnits: [],
      availableRooms: [],
      availableOwners: [],
      availableDelegates: [],
      duplicateWarning: '',
      historicalVotes: null,
      submitting: false,
      voteForm: {
        repair_item_id: '',
        building_id: '',
        unit_number: '',
        room_number: '',
        voter_owner_id: '',
        vote_value: 'agree',
        vote_type: 'direct',
        delegate_id: '',
        notes: ''
      },
      rules: {
        repair_item_id: [{ required: true, message: '请选择维修事项' }],
        building_id: [{ required: true, message: '请选择楼栋' }],
        unit_number: [{ required: true, message: '请选择单元' }],
        room_number: [{ required: true, message: '请选择房号' }],
        voter_owner_id: [{ required: true, message: '请选择业主' }],
        vote_value: [{ required: true, message: '请选择表决意见' }]
      }
    }
  },
  mounted() {
    this.loadRepairItems()
    this.loadBuildings()
  },
  methods: {
    async loadRepairItems() {
      const res = await api.repairItems.getAll()
      this.repairItems = res.data
      if (this.repairItems.length > 0) {
        this.voteForm.repair_item_id = this.repairItems[0].id
        this.selectedRepairItemId = this.repairItems[0].id
        this.loadVotes()
        this.loadAvailableDelegates()
      }
    },
    async loadBuildings() {
      const res = await api.buildings.getAll()
      this.buildings = res.data
    },
    async loadVotes() {
      if (!this.selectedRepairItemId) return
      const res = await api.voting.getByRepairItem(this.selectedRepairItemId, {
        status: this.statusFilter,
        include_history: this.statusFilter === 'all'
      })
      this.votes = res.data
    },
    async loadAvailableDelegates() {
      if (!this.voteForm.repair_item_id) return
      const res = await api.delegates.getAll({
        repair_item_id: this.voteForm.repair_item_id,
        status: 'active'
      })
      this.availableDelegates = res.data
    },
    onRepairItemChange() {
      this.loadAvailableDelegates()
      this.checkDuplicate()
    },
    async onBuildingChange() {
      const building = await api.buildings.getById(this.voteForm.building_id)
      const units = [...new Set(building.data.houses.map(h => h.unit_number))].sort()
      this.availableUnits = units
      this.voteForm.unit_number = ''
      this.voteForm.room_number = ''
      this.availableRooms = []
      this.availableOwners = []
      this.checkDuplicate()
    },
    async onUnitChange() {
      const building = await api.buildings.getById(this.voteForm.building_id)
      this.availableRooms = building.data.houses.filter(h => h.unit_number === this.voteForm.unit_number)
      this.voteForm.room_number = ''
      this.availableOwners = []
      this.checkDuplicate()
    },
    async onRoomChange() {
      if (!this.voteForm.room_number) return
      const ownersRes = await api.owners.searchByHouse(
        this.voteForm.building_id,
        this.voteForm.unit_number,
        this.voteForm.room_number
      )
      this.availableOwners = ownersRes.data
      if (this.availableOwners.length > 0) {
        this.voteForm.voter_owner_id = this.availableOwners[0].id
      }
      this.checkDuplicate()
    },
    async checkDuplicate() {
      if (!this.voteForm.repair_item_id || !this.voteForm.building_id || 
          !this.voteForm.unit_number || !this.voteForm.room_number) {
        this.duplicateWarning = ''
        this.historicalVotes = null
        return
      }

      const building = await api.buildings.getById(this.voteForm.building_id)
      const house = building.data.houses.find(h => 
        h.unit_number === this.voteForm.unit_number && 
        h.room_number === this.voteForm.room_number
      )

      if (!house) return

      const res = await api.voting.checkDuplicate(this.voteForm.repair_item_id, house.id)
      
      if (res.data.has_existing) {
        this.duplicateWarning = `⚠️ 该房屋在本维修事项下已有有效投票（${res.data.vote.vote_value === 'agree' ? '同意' : res.data.vote.vote_value === 'disagree' ? '反对' : '弃权'}），如要修改请先撤回原投票`
        this.historicalVotes = null
      } else {
        this.duplicateWarning = ''
        this.historicalVotes = res.data.historical || []
      }
    },
    async submitVote() {
      if (!this.voteForm.voter_owner_id) {
        alert('请选择业主')
        return
      }

      this.submitting = true
      try {
        const building = await api.buildings.getById(this.voteForm.building_id)
        const house = building.data.houses.find(h => 
          h.unit_number === this.voteForm.unit_number && 
          h.room_number === this.voteForm.room_number
        )

        if (!house) {
          alert('未找到房屋')
          this.submitting = false
          return
        }

        const data = {
          repair_item_id: this.voteForm.repair_item_id,
          house_id: house.id,
          voter_owner_id: this.voteForm.voter_owner_id,
          vote_value: this.voteForm.vote_value,
          vote_type: this.voteForm.vote_type,
          delegate_id: this.voteForm.vote_type === 'delegate' ? this.voteForm.delegate_id : null,
          notes: this.voteForm.notes
        }

        await api.voting.cast(data)
        alert('投票成功！')
        this.loadVotes()
        this.resetForm()
      } catch (error) {
        if (error.response && error.response.data) {
          alert(`投票失败：${error.response.data.message || error.response.data.error}`)
        } else {
          alert('投票失败')
        }
      } finally {
        this.submitting = false
      }
    },
    async revokeVote(row) {
      if (!confirm(`确定要撤回该投票吗？`)) return
      try {
        await api.voting.revoke(row.id)
        alert('撤回成功！')
        this.loadVotes()
      } catch (error) {
        alert(`撤回失败：${error.response?.data?.error || error.message}`)
      }
    },
    resetForm() {
      this.voteForm = {
        repair_item_id: this.repairItems[0]?.id || '',
        building_id: '',
        unit_number: '',
        room_number: '',
        voter_owner_id: '',
        vote_value: 'agree',
        vote_type: 'direct',
        delegate_id: '',
        notes: ''
      }
      this.duplicateWarning = ''
      this.historicalVotes = null
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
