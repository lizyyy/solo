<template>
  <el-container class="layout-container">
    <el-aside :width="isCollapse ? '64px' : '200px'" class="aside">
      <div class="logo">
        <img v-if="!isCollapse" src="/vite.svg" alt="logo" class="logo-img" />
        <span v-if="!isCollapse" class="logo-text">库存管理</span>
        <span v-else class="logo-text">库</span>
      </div>

      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :collapse-transition="false"
        router
        class="sidebar-menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataBoard /></el-icon>
          <template #title>仪表盘</template>
        </el-menu-item>

        <el-menu-item index="/inventory">
          <el-icon><Goods /></el-icon>
          <template #title>库存管理</template>
        </el-menu-item>

        <el-menu-item index="/inventory/records">
          <el-icon><Document /></el-icon>
          <template #title>变动记录</template>
        </el-menu-item>

        <el-menu-item index="/inventory/transfers">
          <el-icon><Transfer /></el-icon>
          <template #title>门店调拨</template>
        </el-menu-item>

        <el-menu-item index="/products">
          <el-icon><ShoppingBag /></el-icon>
          <template #title>商品管理</template>
        </el-menu-item>

        <el-menu-item v-if="userStore.isAdmin" index="/stores">
          <el-icon><OfficeBuilding /></el-icon>
          <template #title>门店管理</template>
        </el-menu-item>

        <el-menu-item index="/audit">
          <el-icon><List /></el-icon>
          <template #title>审计日志</template>
        </el-menu-item>

        <el-menu-item index="/export">
          <el-icon><Download /></el-icon>
          <template #title>报表导出</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="toggleCollapse">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
        </div>

        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" class="avatar">
                {{ userStore.user?.name?.charAt(0) || 'U' }}
              </el-avatar>
              <span class="username">{{ userStore.user?.name }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>
                  <el-icon><User /></el-icon>
                  <span>{{ userStore.user?.username }}</span>
                </el-dropdown-item>
                <el-dropdown-item>
                  <el-icon><LocationFilled /></el-icon>
                  <span>角色: {{ roleLabel }}</span>
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  <span>退出登录</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { ElMessageBox } from 'element-plus';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const isCollapse = ref(false);

const activeMenu = computed(() => route.path);

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    ADMIN: '管理员',
    MANAGER: '经理',
    OPERATOR: '操作员',
    VIEWER: '查看员',
  };
  return map[userStore.user?.role || ''] || '未知';
});

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value;
};

const handleCommand = (command: string) => {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }).then(() => {
      userStore.logout();
      router.push('/login');
    });
  }
};

onMounted(() => {
  if (!userStore.user) {
    userStore.initFromStorage();
  }
});
</script>

<style lang="scss" scoped>
.layout-container {
  height: 100vh;
}

.aside {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #2b2f3a;
    color: #fff;

    .logo-img {
      width: 32px;
      height: 32px;
      margin-right: 10px;
    }

    .logo-text {
      font-size: 18px;
      font-weight: 600;
      white-space: nowrap;
    }
  }

  .sidebar-menu {
    border-right: none;
  }
}

.header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;

  .header-left {
    display: flex;
    align-items: center;

    .collapse-btn {
      font-size: 20px;
      cursor: pointer;
      color: #606266;
      transition: color 0.3s;

      &:hover {
        color: #409eff;
      }
    }
  }

  .header-right {
    .user-info {
      display: flex;
      align-items: center;
      cursor: pointer;

      .avatar {
        margin-right: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        font-weight: 600;
      }

      .username {
        margin-right: 5px;
      }
    }
  }
}

.main {
  background-color: #f5f7fa;
  padding: 20px;
}
</style>
