<template>
  <router-view />
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}

.text-success { color: #67c23a; }
.text-warning { color: #e6a23c; }
.text-danger { color: #f56c6c; }
.text-info { color: #909399; }
.text-primary { color: #409eff; }

.badge-success {
  background-color: #f0f9eb;
  color: #67c23a;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.badge-warning {
  background-color: #fdf6ec;
  color: #e6a23c;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.badge-danger {
  background-color: #fef0f0;
  color: #f56c6c;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.badge-info {
  background-color: #f4f4f5;
  color: #909399;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.badge-primary {
  background-color: #ecf5ff;
  color: #409eff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.card-section {
  margin-bottom: 20px;
}

.card-section:last-child {
  margin-bottom: 0;
}

.mr-5 { margin-right: 5px; }
.mr-10 { margin-right: 10px; }
.ml-5 { margin-left: 5px; }
.ml-10 { margin-left: 10px; }
.mb-10 { margin-bottom: 10px; }
.mb-20 { margin-bottom: 20px; }
</style>
