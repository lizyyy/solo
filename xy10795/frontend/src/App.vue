<template>
    <el-container class="app-container">
        <el-header class="app-header">
            <h1>项目风险周报生成器</h1>
        </el-header>
        <el-main class="app-main">
            <router-view />
        </el-main>
    </el-container>
</template>

<script setup>
</script>

<style scoped>
.app-container {
    height: 100vh;
}

.app-header {
    background-color: #409eff;
    color: white;
    display: flex;
    align-items: center;
    padding: 0 20px;
}

.app-header h1 {
    margin: 0;
    font-size: 24px;
}

.app-main {
    background-color: #f5f7fa;
    padding: 20px;
}
</style>
