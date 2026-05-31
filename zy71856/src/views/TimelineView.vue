<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useTimelineStore } from '@/stores/timeline';
import { useGateStore } from '@/stores/gate';
import Timeline from '@/components/timeline/Timeline.vue';
import ScoreSheet from '@/components/score/ScoreSheet.vue';

const route = useRoute();
const timelineStore = useTimelineStore();
const gateStore = useGateStore();

const { events, isLoading } = storeToRefs(timelineStore);
const { currentSession } = storeToRefs(gateStore);

onMounted(async () => {
  const sessionId = route.query.sessionId as string;
  if (sessionId) {
    await timelineStore.loadBySession(sessionId);
  } else {
    await timelineStore.loadAll();
  }
});

function handleExport(format: 'json' | 'csv' | 'report') {
  timelineStore.exportData(format, currentSession.value);
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div class="max-w-[1920px] mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900">时间线评估</h1>
            <p class="text-sm text-gray-500">步骤视频、操作记录、评分表统一展示</p>
          </div>
          <div v-if="currentSession" class="text-sm text-gray-600">
            学员：<span class="font-medium text-primary-600">{{ currentSession.studentName }}</span>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1920px] mx-auto p-6">
      <div class="flex gap-6">
        <div class="flex-1 min-w-0">
          <Timeline
            :events="events"
            :is-loading="isLoading"
            @export="handleExport"
          />
        </div>

        <div v-if="currentSession" class="w-96 flex-shrink-0">
          <div class="sticky top-24">
            <ScoreSheet
              :session="currentSession"
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
