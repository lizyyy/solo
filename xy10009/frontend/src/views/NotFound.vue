<template>
  <div class="not-found">
    <div class="content">
      <h1>404</h1>
      <h2>页面不存在</h2>
      <p>您访问的页面可能已被删除或不存在</p>
      <el-button type="primary" @click="$router.push('/')">
        返回首页
      </el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'NotFound'
}
</script>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.content {
  text-align: center;
}

.content h1 {
  font-size: 120px;
  font-weight: bold;
  color: #409eff;
  margin: 0;
}

.content h2 {
  font-size: 24px;
  color: #303133;
  margin: 20px 0 10px;
}

.content p {
  color: #909399;
  margin-bottom: 30px;
}
</style>
