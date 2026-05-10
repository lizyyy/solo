<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>维修事项</h2>
      <el-button type="primary" @click="showCreateDialog">新增维修事项</el-button>
    </div>

    <el-table :data="items" border stripe>
      <el-table-column prop="name" label="事项名称" width="180" />
      <el-table-column prop="description" label="描述" />
      <el-table-column prop="estimated_cost" label="预算金额" width="120">
        <template #default="scope">
          ￥{{ scope.row.estimated_cost?.toLocaleString() || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="start_date" label="开始日期" width="120" />
      <el-table-column prop="end_date" label="结束日期" width="120" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'active' ? 'success' : 'info'">
            {{ scope.row.status === 'active' ? '进行中' : '已结束' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="viewStatistics(scope.row)">
            查看统计
          </el-button>
          <el-button link type="warning" size="small" @click="showEditDialog(scope.row)">
            编辑
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑维修事项' : '新增维修事项'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="事项名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="预算金额">
          <el-input-number v-model="form.estimated_cost" :min="0" />
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="form.start_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="form.end_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="进行中" value="active" />
            <el-option label="已结束" value="closed" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import api from '../api'

export default {
  data() {
    return {
      items: [],
      dialogVisible: false,
      isEdit: false,
      form: {
        id: null,
        name: '',
        description: '',
        estimated_cost: 0,
        start_date: '',
        end_date: '',
        status: 'active'
      }
    }
  },
  mounted() {
    this.loadItems()
  },
  methods: {
    async loadItems() {
      const res = await api.repairItems.getAll()
      this.items = res.data
    },
    showCreateDialog() {
      this.isEdit = false
      this.form = {
        id: null,
        name: '',
        description: '',
        estimated_cost: 0,
        start_date: '',
        end_date: '',
        status: 'active'
      }
      this.dialogVisible = true
    },
    showEditDialog(row) {
      this.isEdit = true
      this.form = { ...row }
      this.dialogVisible = true
    },
    async saveItem() {
      if (this.isEdit) {
        await api.repairItems.update(this.form.id, this.form)
      } else {
        await api.repairItems.create(this.form)
      }
      this.dialogVisible = false
      this.loadItems()
    },
    viewStatistics(row) {
      this.$router.push({ path: '/statistics', query: { repairItemId: row.id } })
    }
  }
}
</script>
