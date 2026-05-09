<template>
  <div class="layout">
    <el-container>
      <el-aside width="220px" class="aside">
        <div class="logo">仓库盘点系统</div>
        <el-menu
          :default-active="activeMenu"
          class="sidebar-menu"
          router
        >
          <el-menu-item index="/dashboard">
            <el-icon><Monitor /></el-icon>
            <span>仪表盘</span>
          </el-menu-item>
          <el-menu-item index="/count-tasks">
            <el-icon><Document /></el-icon>
            <span>盘点任务</span>
          </el-menu-item>
          <el-menu-item 
            v-if="isAdmin" 
            index="/warehouses"
          >
            <el-icon><OfficeBuilding /></el-icon>
            <span>仓库管理</span>
          </el-menu-item>
          <el-menu-item 
            v-if="isAdmin" 
            index="/products"
          >
            <el-icon><Goods /></el-icon>
            <span>商品管理</span>
          </el-menu-item>
          <el-menu-item index="/history">
            <el-icon><Clock /></el-icon>
            <span>操作日志</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      
      <el-container>
        <el-header class="header">
          <div class="header-left">
            <div v-if="!isOnline" class="offline-badge">
              <el-icon><WarningFilled /></el-icon>
              <span>离线模式</span>
            </div>
          </div>
          
          <div class="header-right">
            <el-dropdown @command="handleCommand">
              <span class="user-info">
                <el-icon><User /></el-icon>
                {{ user?.fullName }}
                <el-icon><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>
        
        <el-main class="main">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessageBox } from 'element-plus'
import { 
  Monitor, Document, OfficeBuilding, Goods, Clock, 
  User, ArrowDown, WarningFilled 
} from '@element-plus/icons-vue'

export default {
  name: 'Layout',
  components: {
    Monitor, Document, OfficeBuilding, Goods, Clock,
    User, ArrowDown, WarningFilled
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const store = useStore()
    
    const user = computed(() => store.state.user)
    const isAdmin = computed(() => store.getters.isAdmin)
    const isOnline = computed(() => store.state.isOnline)
    const activeMenu = computed(() => {
      const path = route.path
      if (path.startsWith('/count-tasks/')) {
        return '/count-tasks'
      }
      return path
    })
    
    const handleCommand = async (command) => {
      if (command === 'logout') {
        try {
          await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          })
          
          store.dispatch('logout')
          router.push('/login')
        } catch {
        }
      }
    }
    
    return {
      user,
      isAdmin,
      isOnline,
      activeMenu,
      handleCommand
    }
  }
}
</script>

<style scoped>
.layout {
  height: 100vh;
}

.aside {
  background-color: #304156;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-menu {
  border-right: none;
  background-color: #304156;
}

.sidebar-menu .el-menu-item {
  color: #bfcbd9;
}

.sidebar-menu .el-menu-item:hover {
  background-color: #263445;
}

.sidebar-menu .el-menu-item.is-active {
  background-color: #409eff;
  color: white;
}

.header {
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #e4e7ed;
}

.offline-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #e6a23c;
  font-size: 14px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  color: #606266;
}

.main {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
