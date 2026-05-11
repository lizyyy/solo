<template>
  <div>
    <h2 class="page-title">签收回执</h2>

    <el-alert
      title="签收回执功能说明"
      type="info"
      :closable="false"
      class="mb-20"
    >
      签收回执记录了每个老人的餐食签收情况。签收回执与具体批次关联，需在【配送批次管理】→ 点击【详情】→ 切换到【签收回执】标签页中进行管理。
    </el-alert>

    <el-card class="card-section">
      <template #header>
        <span>功能入口导航</span>
      </template>
      <el-steps :active="3" finish-status="success">
        <el-step title="选择批次" description="进入配送批次管理" />
        <el-step title="查看详情" description="点击批次的详情按钮" />
        <el-step title="管理签收" description="在签收回执标签页操作" />
      </el-steps>

      <div style="text-align: center; margin-top: 30px;">
        <el-button type="primary" size="large" @click="goToBatches">
          <el-icon><Document /></el-icon>
          前往配送批次管理
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const goToBatches = () => {
  router.push('/batches');
};
</script>
