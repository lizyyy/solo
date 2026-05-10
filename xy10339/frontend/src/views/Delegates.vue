<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>委托管理</h2>
      <el-button type="primary" @click="showCreateDialog">新增委托</el-button>
    </div>

    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header">
          <span>🔍 筛选</span>
        </div>
      </template>
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="维修事项">
          <el-select v-model="filterForm.repair_item_id" placeholder="全部" 
            style="width: 200px;" @change="loadDelegates">
            <el-option label="全部" value="" />
            <el-option v-for="item in repairItems" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" style="width: 120px;" @change="loadDelegates">
            <el-option label="全部" value="all" />
            <el-option label="有效" value="active" />
            <el-option label="已撤销" value="revoked" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="delegates" border stripe>
      <el-table-column prop="repair_item_name" label="维修事项" width="180">
        <template #default="scope">
          {{ scope.row.repair_item_name || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="principal_name" label="委托人" width="100" />
      <el-table-column label="委托人房屋" width="200">
        <template #default="scope">
          {{ scope.row.principal_building }} {{ scope.row.principal_unit }}单元{{ scope.row.principal_room }}室
        </template>
      </el-table-column>
      <el-table-column prop="agent_name" label="受托人" width="100" />
      <el-table-column prop="agent_phone" label="受托人电话" width="150" />
      <el-table-column prop="start_date" label="开始日期" width="120" />
      <el-table-column prop="end_date" label="结束日期" width="120" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'active' && !scope.row.revoked_at ? 'success' : 'info'">
            {{ scope.row.status === 'active' && !scope.row.revoked_at ? '有效' : '已撤销' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="120">
        <template #default="scope">
          <el-button link type="warning" size="small"
            v-if="scope.row.status === 'active' && !scope.row.revoked_at"
            @click="revokeDelegate(scope.row)">
            撤销
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="新增委托" width="600px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="维修事项">
          <el-select v-model="form.repair_item_id" placeholder="选择维修事项" style="width: 100%;">
            <el-option v-for="item in repairItems" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="委托人">
          <el-select v-model="form.principal_owner_id" placeholder="选择业主" style="width: 100%;">
            <el-option v-for="o in owners" :key="o.id" 
              :label="`${o.name} (${o.building_name || ''} ${o.unit_number || ''}单元${o.room_number || ''}室)`" 
              :value="o.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="受托人">
          <el-select v-model="form.agent_owner_id" placeholder="选择业主" style="width: 100%;">
            <el-option v-for="o in owners" :key="o.id" 
              :label="`${o.name} (${o.phone || '未登记电话'})`" 
              :value="o.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="form.start_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="form.end_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDelegate">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import api from '../api'

export default {
  data() {
    return {
      repairItems: [],
      owners: [],
      delegates: [],
      filterForm: {
        repair_item_id: '',
        status: 'all'
      },
      dialogVisible: false,
      form: {
        repair_item_id: '',
        principal_owner_id: '',
        agent_owner_id: '',
        start_date: '',
        end_date: ''
      }
    }
  },
  mounted() {
    this.loadRepairItems()
    this.loadOwners()
    this.loadDelegates()
  },
  methods: {
    async loadRepairItems() {
      const res = await api.repairItems.getAll()
      this.repairItems = res.data
    },
    async loadOwners() {
      const res = await api.owners.getAll()
      this.owners = res.data
    },
    async loadDelegates() {
      const params = { ...this.filterForm }
      if (!params.repair_item_id) delete params.repair_item_id
      const res = await api.delegates.getAll(params)
      this.delegates = res.data
    },
    showCreateDialog() {
      this.form = {
        repair_item_id: this.repairItems[0]?.id || '',
        principal_owner_id: '',
        agent_owner_id: '',
        start_date: '',
        end_date: ''
      }
      this.dialogVisible = true
    },
    async saveDelegate() {
      const principal = this.owners.find(o => o.id === this.form.principal_owner_id)
      const agent = this.owners.find(o => o.id === this.form.agent_owner_id)
      
      const data = {
        ...this.form,
        agent_name: agent?.name,
        agent_phone: agent?.phone
      }
      
      try {
        await api.delegates.create(data)
        alert('委托创建成功！')
        this.dialogVisible = false
        this.loadDelegates()
      } catch (error) {
        alert(`创建失败：${error.response?.data?.error || error.message}`)
      }
    },
    async revokeDelegate(row) {
      if (!confirm('确定要撤销该委托吗？')) return
      try {
        await api.delegates.revoke(row.id)
        alert('委托已撤销！')
        this.loadDelegates()
      } catch (error) {
        alert(`撤销失败：${error.response?.data?.error || error.message}`)
      }
    }
  }
}
</script>

<style scoped>
.card-header {
  font-weight: bold;
}
</style>
