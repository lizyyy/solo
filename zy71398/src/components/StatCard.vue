<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title: string
  value: string | number
  icon: Component
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}>()
</script>

<template>
  <div class="card hover:shadow-md transition-shadow duration-200">
    <div class="card-body">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-sm font-medium text-slate-500">{{ title }}</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">{{ value }}</p>
          <div v-if="trend" class="flex items-center mt-2">
            <span
              :class="[
                'text-xs font-medium',
                trend === 'up' ? 'text-success-600' : '',
                trend === 'down' ? 'text-danger-600' : '',
                trend === 'neutral' ? 'text-slate-600' : ''
              ]"
            >
              {{ trendValue }}
            </span>
          </div>
        </div>
        <div
          :class="[
            'w-12 h-12 rounded-xl flex items-center justify-center',
            color === 'primary' ? 'bg-primary-100' : '',
            color === 'success' ? 'bg-success-100' : '',
            color === 'warning' ? 'bg-warning-100' : '',
            color === 'danger' ? 'bg-danger-100' : '',
            color === 'info' || !color ? 'bg-info-100' : ''
          ]"
        >
          <component
            :is="icon"
            :class="[
              'w-6 h-6',
              color === 'primary' ? 'text-primary-600' : '',
              color === 'success' ? 'text-success-600' : '',
              color === 'warning' ? 'text-warning-600' : '',
              color === 'danger' ? 'text-danger-600' : '',
              color === 'info' || !color ? 'text-info-600' : ''
            ]"
          />
        </div>
      </div>
    </div>
  </div>
</template>
