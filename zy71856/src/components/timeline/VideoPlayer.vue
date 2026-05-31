<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize } from 'lucide-vue-next';
import { formatDuration } from '@/utils/time';
import type { TimelineEvent } from '@/types/timeline';

interface Props {
  events: TimelineEvent[];
  currentTime: number;
  startTime: number;
  endTime: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'timeChange', time: number): void;
  (e: 'seek', event: TimelineEvent): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const isPlaying = ref(false);
const currentVideoTime = ref(0);
const duration = ref(0);
const showControls = ref(true);
let controlsTimeout: number | null = null;

const totalDuration = computed(() => {
  return props.endTime - props.startTime;
});

const progressPercent = computed(() => {
  if (totalDuration.value <= 0) return 0;
  const progress = (props.currentTime - props.startTime) / totalDuration.value * 100;
  return Math.max(0, Math.min(100, progress));
});

const marks = computed(() => {
  return props.events
    .filter(e => e.videoMark || e.type === 'video')
    .map(e => {
      const eventTime = e.videoMark?.startTime || 0;
      const percent = totalDuration.value > 0
        ? ((e.timestamp - props.startTime) / totalDuration.value * 100)
        : 0;
      return {
        event: e,
        percent: Math.max(0, Math.min(100, percent)),
        time: eventTime
      };
    });
});

function togglePlay() {
  if (!videoRef.value) {
    isPlaying.value = !isPlaying.value;
    return;
  }
  if (isPlaying.value) {
    videoRef.value.pause();
  } else {
    videoRef.value.play();
  }
  isPlaying.value = !isPlaying.value;
}

function skipBackward() {
  if (videoRef.value) {
    videoRef.value.currentTime = Math.max(0, videoRef.value.currentTime - 5);
  }
}

function skipForward() {
  if (videoRef.value) {
    videoRef.value.currentTime = Math.min(duration.value, videoRef.value.currentTime + 5);
  }
}

function onTimeUpdate() {
  if (videoRef.value) {
    currentVideoTime.value = videoRef.value.currentTime;
  }
}

function onLoadedMetadata() {
  if (videoRef.value) {
    duration.value = videoRef.value.duration;
  }
}

function onProgressClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  const newTime = props.startTime + totalDuration.value * percent;
  emit('timeChange', newTime);

  if (videoRef.value && duration.value > 0) {
    videoRef.value.currentTime = duration.value * percent;
  }
}

function onMarkClick(mark: { event: TimelineEvent; percent: number; time: number }, event: MouseEvent) {
  event.stopPropagation();
  emit('seek', mark.event);
  emit('timeChange', mark.event.timestamp);

  if (videoRef.value) {
    videoRef.value.currentTime = mark.time;
  }
}

function showControlsTemporarily() {
  showControls.value = true;
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  controlsTimeout = window.setTimeout(() => {
    if (isPlaying.value) {
      showControls.value = false;
    }
  }, 3000);
}

watch(() => props.currentTime, (newTime) => {
  if (videoRef.value && duration.value > 0) {
    const percent = (newTime - props.startTime) / totalDuration.value;
    videoRef.value.currentTime = duration.value * percent;
  }
});

onMounted(() => {
  document.addEventListener('mousemove', showControlsTemporarily);
});

onUnmounted(() => {
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  document.removeEventListener('mousemove', showControlsTemporarily);
});
</script>

<template>
  <div class="bg-gray-900 rounded-lg overflow-hidden">
    <div class="relative aspect-video bg-black">
      <video
        ref="videoRef"
        class="w-full h-full object-contain"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @click="togglePlay"
        poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'%3E%3Crect fill='%231e3a5f' width='800' height='450'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-family='sans-serif' font-size='24'%3E水利闸门操作演示视频%3C/text%3E%3C/svg%3E"
      >
        <source src="" type="video/mp4">
      </video>

      <div
        class="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity"
        :class="{ 'opacity-0 pointer-events-none': isPlaying && !showControls }"
        @click="togglePlay"
      >
        <div class="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer">
          <Play v-if="!isPlaying" class="w-10 h-10 text-white ml-1" />
          <Pause v-else class="w-10 h-10 text-white" />
        </div>
      </div>

      <div
        class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity"
        :class="{ 'opacity-0 pointer-events-none': isPlaying && !showControls }"
      >
        <div
          class="relative h-2 bg-white/20 rounded-full cursor-pointer mb-3 group"
          @click="onProgressClick"
        >
          <div
            class="absolute top-0 left-0 h-full bg-accent rounded-full"
            :style="{ width: `${progressPercent}%` }"
          />
          <div
            v-for="mark in marks"
            :key="mark.event.id"
            class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-danger -ml-1.5 cursor-pointer hover:scale-125 transition-transform z-10 border-2 border-white"
            :style="{ left: `${mark.percent}%` }"
            :title="mark.event.title"
            @click="onMarkClick(mark, $event)"
          />
          <div
            class="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-accent -ml-2 opacity-0 group-hover:opacity-100 transition-opacity border-2 border-white shadow-lg"
            :style="{ left: `${progressPercent}%` }"
          />
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button
              class="p-1.5 rounded hover:bg-white/20 transition-colors"
              @click="skipBackward"
            >
              <SkipBack class="w-5 h-5 text-white" />
            </button>
            <button
              class="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              @click="togglePlay"
            >
              <Play v-if="!isPlaying" class="w-5 h-5 text-white ml-0.5" />
              <Pause v-else class="w-5 h-5 text-white" />
            </button>
            <button
              class="p-1.5 rounded hover:bg-white/20 transition-colors"
              @click="skipForward"
            >
              <SkipForward class="w-5 h-5 text-white" />
            </button>
            <span class="text-white text-sm font-mono">
              {{ formatDuration(currentVideoTime * 1000) }} / {{ formatDuration(duration * 1000) }}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <button class="p-1.5 rounded hover:bg-white/20 transition-colors">
              <Volume2 class="w-5 h-5 text-white" />
            </button>
            <button class="p-1.5 rounded hover:bg-white/20 transition-colors">
              <Maximize class="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
