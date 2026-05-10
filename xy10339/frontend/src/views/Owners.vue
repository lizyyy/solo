<template>
  <div>
    <h2>业主信息</h2>
    
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>🔍 按房屋查询业主</span>
          <el-button type="primary" @click="showOwnerDialog">新增业主</el-button>
        </div>
      </template>
      <el-form :inline="true" :model="searchForm" label-width="80px">
        <el-form-item label="楼栋">
          <el-select v-model="searchForm.building_id" placeholder="选择楼栋" style="width: 200px;">
            <el-option v-for="b in buildings" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="单元">
          <el-input v-model="searchForm.unit_number" placeholder="如：1" style="width: 100px;" />
        </el-form-item>
        <el-form-item label="房号">
          <el-input v-model="searchForm.room_number" placeholder="如：101" style="width: 100px;" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="searchOwners">查询</el-button>
          <el-button @click="loadAllOwners">全部</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="owners" border stripe>
      <el-table-column prop="name" label="业主姓名" width="120" />
      <el-table-column prop="phone" label="联系电话" width="150" />
      <el-table-column prop="building_name" label="楼栋" width="150" />
      <el-table-column prop="unit_number" label="单元" width="80" />
      <el-table-column prop="room_number" label="房号" width="100" />
      <el-table-column prop="house_area" label="房屋面积" width="120">
        <template #default="scope">
          {{ scope.row.house_area || '-' }} ㎡
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="scope">
          <el-button link type="warning" size="small" @click="showEditDialog(scope.row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑业主' : '新增业主'" width="500px">
      <el-form :model="ownerForm" label-width="100px">
        <el-form-item label="姓名">
          <el-input v-model="ownerForm.name" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="ownerForm.phone" />
        </el-form-item>
        <el-form-item label="身份证">
          <el-input v-model="ownerForm.id_card" />
        </el-form-item>
        <el-form-item label="房屋">
          <el-select v-model="ownerForm.house_id" placeholder="选择房屋" style="width: 100%;">
            <el-option v-for="h in houses" :key="h.id" 
              :label="`${h.building_name} ${h.unit_number}单元${h.room_number}室`" 
              :value="h.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveOwner">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import api from '../api'

export default {
  data() {
    return {
      owners: [],
      buildings: [],
      houses: [],
      searchForm: {
        building_id: '',
        unit_number: '',
        room_number: ''
      },
      dialogVisible: false,
      isEdit: false,
      ownerForm: {
        id: null,
        name: '',
        phone: '',
        id_card: '',
        house_id: ''
      }
    }
  },
  mounted() {
    this.loadAllOwners()
    this.loadBuildings()
    this.loadHouses()
  },
  methods: {
    async loadAllOwners() {
      const res = await api.owners.getAll()
      this.owners = res.data
    },
    async loadBuildings() {
      const res = await api.buildings.getAll()
      this.buildings = res.data
    },
    async loadHouses() {
      const allHouses = []
      for (const b of this.buildings) {
        const res = await api.buildings.getById(b.id)
        res.data.houses.forEach(h => {
          allHouses.push({ ...h, building_name: res.data.name })
        })
      }
      this.houses = allHouses
    },
    async searchOwners() {
      if (!this.searchForm.building_id) {
        this.loadAllOwners()
        return
      }
      const res = await api.owners.searchByHouse(
        this.searchForm.building_id,
        this.searchForm.unit_number,
        this.searchForm.room_number
      )
      this.owners = res.data
    },
    showOwnerDialog() {
      this.isEdit = false
      this.ownerForm = { id: null, name: '', phone: '', id_card: '', house_id: '' }
      this.dialogVisible = true
    },
    showEditDialog(row) {
      this.isEdit = true
      this.ownerForm = { ...row }
      this.dialogVisible = true
    },
    async saveOwner() {
      if (this.isEdit) {
        await api.owners.update(this.ownerForm.id, this.ownerForm)
      } else {
        await api.owners.create(this.ownerForm)
      }
      this.dialogVisible = false
      this.loadAllOwners()
    }
  }
}
</script>

<style scoped>
.card-header {
  font-weight: bold;
}
</style>
