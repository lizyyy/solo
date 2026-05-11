<template>
  <el-container style="height: 100vh;">
    <el-header style="background-color: #409EFF; color: white; padding: 0 20px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center;">
        <h2 style="margin: 0; font-size: 20px;">🏥 体检套餐加项台</h2>
      </div>
      <div style="display: flex; align-items: center; gap: 20px;">
        <span>当前操作人：</span>
        <el-select v-model="currentStaff" placeholder="选择操作人" style="width: 150px;">
          <el-option
            v-for="staff in staffList"
            :key="staff.id"
            :label="staff.name"
            :value="staff"
          />
        </el-select>
      </div>
    </el-header>
    
    <el-container>
      <el-aside width="200px" style="background-color: #545c64;">
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#545c64"
          text-color="#fff"
          active-text-color="#ffd04b"
          style="height: 100%; border-right: none;"
        >
          <el-menu-item index="/appointments">
            <el-icon><Document /></el-icon>
            <span>预约管理</span>
          </el-menu-item>
          <el-menu-item index="/customers">
            <el-icon><User /></el-icon>
            <span>客户管理</span>
          </el-menu-item>
          <el-menu-item index="/packages">
            <el-icon><ShoppingBag /></el-icon>
            <span>套餐管理</span>
          </el-menu-item>
          <el-menu-item index="/items">
            <el-icon><List /></el-icon>
            <span>项目管理</span>
          </el-menu-item>
          <el-menu-item index="/departments">
            <el-icon><OfficeBuilding /></el-icon>
            <span>科室管理</span>
          </el-menu-item>
          <el-menu-item index="/department-usage">
            <el-icon><DataLine /></el-icon>
            <span>科室负载</span>
          </el-menu-item>
          <el-menu-item index="/transactions">
            <el-icon><Money /></el-icon>
            <span>流水记录</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      
      <el-main style="background-color: #f0f2f5; padding: 20px; overflow-y: auto;">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { staffApi } from '../api'
import { Document, User, ShoppingBag, List, OfficeBuilding, DataLine, Money } from '@element-plus/icons-vue'

const route = useRoute()
const staffList = ref([])
const currentStaff = ref(null)

const activeMenu = computed(() => {
  if (route.path.startsWith('/appointments/')) {
    return '/appointments'
  }
  return route.path
})

onMounted(async () => {
  try {
    const res = await staffApi.getAll()
    staffList.value = res.data
    if (staffList.value.length > 0) {
      currentStaff.value = staffList.value[0]
    }
  } catch (error) {
    console.error('获取员工列表失败:', error)
  }
})
</script>

<style scoped>
.el-menu-item {
  height: 50px;
  line-height: 50px;
}
</style>
