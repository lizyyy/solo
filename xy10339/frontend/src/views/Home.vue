<template>
  <div>
    <h2>社区维修基金投票台</h2>
    <el-alert
      title="欢迎使用社区维修基金投票管理系统"
      type="success"
      :closable="false"
      style="margin-bottom: 20px;"
    />
    
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>📋 功能导航</span>
            </div>
          </template>
          <el-menu mode="horizontal" @select="handleMenuSelect">
            <el-menu-item index="1" @click="$router.push('/voting')">
              投票录入
            </el-menu-item>
            <el-menu-item index="2" @click="$router.push('/statistics')">
              统计进度
            </el-menu-item>
            <el-menu-item index="3" @click="$router.push('/disputes')">
              争议记录
            </el-menu-item>
          </el-menu>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>🏠 基础数据</span>
            </div>
          </template>
          <el-menu mode="horizontal">
            <el-menu-item index="4" @click="$router.push('/repair-items')">
              维修事项
            </el-menu-item>
            <el-menu-item index="5" @click="$router.push('/building')">
              楼栋房屋
            </el-menu-item>
            <el-menu-item index="6" @click="$router.push('/owners')">
              业主信息
            </el-menu-item>
          </el-menu>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>📝 统计口径</span>
            </div>
          </template>
          <div style="font-size: 13px; line-height: 1.8;">
            <p><strong>投票规则：</strong>双50%通过制</p>
            <p>• 同意户数比例 ≥ 50%</p>
            <p>• 同意房屋面积比例 ≥ 50%</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>📖 系统说明</span>
        </div>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="数据初始化">
          系统已预置样例数据：1号电梯维修、12套房屋、1条委托投票、1条撤回后重投记录
        </el-descriptions-item>
        <el-descriptions-item label="投票类型">
          支持亲自投票和委托投票两种方式
        </el-descriptions-item>
        <el-descriptions-item label="重复投票拦截">
          同一房屋在同一维修事项下只能有一票有效投票，需撤回后才能重新投票
        </el-descriptions-item>
        <el-descriptions-item label="委托有效性">
          委托投票需检查：委托状态、是否已撤销、是否在有效期内
        </el-descriptions-item>
        <el-descriptions-item label="统计口径">
          只统计 status=active 的有效投票，撤回的投票不计入
        </el-descriptions-item>
        <el-descriptions-item label="导出公示">
          支持导出Excel格式的完整投票公示表，包含统计口径说明
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'Home',
  methods: {
    handleMenuSelect(index) {
      console.log('Selected:', index)
    }
  }
}
</script>

<style scoped>
.card-header {
  font-weight: bold;
}
</style>
