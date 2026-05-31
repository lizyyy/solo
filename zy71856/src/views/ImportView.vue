<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useImportStore } from '@/stores/import';
import { useGateStore } from '@/stores/gate';
import { useTimelineStore } from '@/stores/timeline';
import DataImport from '@/components/import/DataImport.vue';

const router = useRouter();
const importStore = useImportStore();
const gateStore = useGateStore();
const timelineStore = useTimelineStore();

const { packages, isProcessing } = storeToRefs(importStore);

onMounted(async () => {
  await importStore.loadPackages();
});

async function handleFileSelected(file: File) {
  await importStore.importFile(file);
}

async function handleLoadDemo() {
  await importStore.loadDemoData();
}

async function handleProcess(packageId: string) {
  const result = await importStore.processPackage(packageId);
  if (result && result.session) {
    await gateStore.setSession(result.session);
    await timelineStore.setEvents(result.events);
    router.push('/gate');
  }
}

async function handleSelect(packageId: string) {
  await importStore.selectPackage(packageId);
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div class="max-w-[1200px] mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900">数据导入</h1>
            <p class="text-sm text-gray-500">支持正常记录、晚到附件、重复项、人工更正混合数据</p>
          </div>
          <div class="flex items-center gap-3">
            <span
              v-if="isProcessing"
              class="inline-flex items-center gap-2 text-sm text-warning"
            >
              <span class="w-3 h-3 border-2 border-warning/30 border-t-warning rounded-full animate-spin" />
              数据处理中...
            </span>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1200px] mx-auto p-6">
      <DataImport
        :packages="packages"
        :is-processing="isProcessing"
        @file-selected="handleFileSelected"
        @process="handleProcess"
        @select="handleSelect"
        @load-demo="handleLoadDemo"
      />
    </main>
  </div>
</template>
