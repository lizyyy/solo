<template>
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <div class="text-sm text-gray-500 mb-1">总记录数</div>
      <div class="text-2xl font-bold text-gray-800">{{ stats.total }}</div>
    </div>
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <div class="text-sm text-gray-500 mb-1">严重拥堵</div>
      <div class="text-2xl font-bold text-red-600">{{ stats.severe }}</div>
    </div>
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <div class="text-sm text-gray-500 mb-1">高度拥堵</div>
      <div class="text-2xl font-bold text-orange-500">{{ stats.high }}</div>
    </div>
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <div class="text-sm text-gray-500 mb-1">待复核</div>
      <div class="text-2xl font-bold text-yellow-600">{{ stats.needsReview }}</div>
    </div>
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <div class="text-sm text-gray-500 mb-1">流程中</div>
      <div class="text-2xl font-bold text-blue-600">{{ stats.pending }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStore } from '../store'

const { stats } = useStore()
</script>
