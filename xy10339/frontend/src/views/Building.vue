<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>楼栋房屋</h2>
      <el-button type="primary" @click="showBuildingDialog">新增楼栋</el-button>
    </div>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>🏢 楼栋列表</span>
            </div>
          </template>
          <el-menu :default-active="selectedBuilding?.id || ''" @select="selectBuilding">
            <el-menu-item v-for="b in buildings" :key="b.id" :index="b.id">
              {{ b.name }} ({{ b.unit_count }}单元, {{ b.total_area }}㎡)
            </el-menu-item>
          </el-menu>
        </el-card>
      </el-col>
      <el-col :span="16">
        <el-card v-if="selectedBuilding">
          <template #header>
            <div class="card-header" style="display: flex; justify-content: space-between;">
              <span>🏠 {{ selectedBuilding.name }} - 房屋明细</span>
              <el-button size="small" type="primary" @click="showHouseDialog">新增房屋</el-button>
            </div>
          </template>
          <el-table :data="selectedBuilding.houses" border stripe>
            <el-table-column prop="unit_number" label="单元" width="80" />
            <el-table-column prop="room_number" label="房号" width="100" />
            <el-table-column prop="area" label="面积(㎡)" width="100" />
            <el-table-column prop="owner_name" label="业主" width="120" />
            <el-table-column prop="owner_phone" label="联系电话" width="150" />
          </el-table>
        </el-card>
        <el-card v-else>
          <el-empty description="请选择楼栋查看房屋明细" />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="buildingDialogVisible" title="新增楼栋" width="500px">
      <el-form :model="buildingForm" label-width="100px">
        <el-form-item label="楼栋名称">
          <el-input v-model="buildingForm.name" />
        </el-form-item>
        <el-form-item label="单元数">
          <el-input-number v-model="buildingForm.unit_count" :min="1" />
        </el-form-item>
        <el-form-item label="总面积">
          <el-input-number v-model="buildingForm.total_area" :min="0" :precision="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="buildingDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveBuilding">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="houseDialogVisible" title="新增房屋" width="600px">
      <el-form :model="houseForm" label-width="100px">
        <el-form-item label="单元号">
          <el-input v-model="houseForm.unit_number" />
        </el-form-item>
        <el-form-item label="房号">
          <el-input v-model="houseForm.room_number" />
        </el-form-item>
        <el-form-item label="面积">
          <el-input-number v-model="houseForm.area" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="业主姓名">
          <el-input v-model="houseForm.ownerName" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="houseForm.ownerPhone" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="houseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveHouse">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import api from '../api'

export default {
  data() {
    return {
      buildings: [],
      selectedBuilding: null,
      buildingDialogVisible: false,
      houseDialogVisible: false,
      buildingForm: {
        name: '',
        unit_count: 1,
        total_area: 0
      },
      houseForm: {
        unit_number: '',
        room_number: '',
        area: 0,
        ownerName: '',
        ownerPhone: ''
      }
    }
  },
  mounted() {
    this.loadBuildings()
  },
  methods: {
    async loadBuildings() {
      const res = await api.buildings.getAll()
      this.buildings = res.data
      if (this.buildings.length > 0 && !this.selectedBuilding) {
        this.selectBuilding(this.buildings[0].id)
      }
    },
    async selectBuilding(id) {
      const res = await api.buildings.getById(id)
      this.selectedBuilding = res.data
    },
    showBuildingDialog() {
      this.buildingForm = { name: '', unit_count: 1, total_area: 0 }
      this.buildingDialogVisible = true
    },
    async saveBuilding() {
      await api.buildings.create(this.buildingForm)
      this.buildingDialogVisible = false
      this.loadBuildings()
    },
    showHouseDialog() {
      this.houseForm = { unit_number: '', room_number: '', area: 0, ownerName: '', ownerPhone: '' }
      this.houseDialogVisible = true
    },
    async saveHouse() {
      const data = {
        unit_number: this.houseForm.unit_number,
        room_number: this.houseForm.room_number,
        area: this.houseForm.area,
        owners: this.houseForm.ownerName ? [{
          name: this.houseForm.ownerName,
          phone: this.houseForm.ownerPhone
        }] : []
      }
      await api.buildings.addHouse(this.selectedBuilding.id, data)
      this.houseDialogVisible = false
      this.selectBuilding(this.selectedBuilding.id)
    }
  }
}
</script>

<style scoped>
.card-header {
  font-weight: bold;
}
</style>
