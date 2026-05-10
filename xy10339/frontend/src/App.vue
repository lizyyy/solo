<template>
  <el-container>
    <el-aside width="200px" style="background-color: #545c64; min-height: 100vh;">
      <el-menu
        :default-active="activeMenu"
        background-color="#545c64"
        text-color="#fff"
        active-text-color="#ffd04b"
        router
      >
        <el-menu-item index="/">
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/repair-items">
          <span>维修事项</span>
        </el-menu-item>
        <el-menu-item index="/building">
          <span>楼栋房屋</span>
        </el-menu-item>
        <el-menu-item index="/owners">
          <span>业主信息</span>
        </el-menu-item>
        <el-menu-item index="/voting">
          <span>投票录入</span>
        </el-menu-item>
        <el-menu-item index="/delegates">
          <span>委托管理</span>
        </el-menu-item>
        <el-menu-item index="/statistics">
          <span>统计进度</span>
        </el-menu-item>
        <el-menu-item index="/disputes">
          <span>争议记录</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>

<script>
export default {
  computed: {
    activeMenu() {
      return this.$route.path
    }
  }
}
</script>

<style>
body {
  margin: 0;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
}
.el-main {
  padding: 20px;
}
</style>
