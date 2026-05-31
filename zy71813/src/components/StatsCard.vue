<template>
  <div class="card p-4">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm text-gray-500">{{ title }}</p>
        <p class="text-2xl font-bold mt-1" :class="valueClass">{{ value }}</p>
      </div>
      <div class="text-3xl">{{ icon }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  value: number;
  icon: string;
  valueClass?: string;
}>();
</script>
