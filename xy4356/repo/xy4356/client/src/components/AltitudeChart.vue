<template>
  <div v-if="flightPath && flightPath.length > 0">
    <div ref="chartRef" style="height: 300px; width: 100%;">
      <canvas ref="canvasRef"></canvas>
    </div>
    <div style="margin-top: 1rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
      <div class="card" style="padding: 1rem; margin: 0;">
        <div style="font-size: 0.75rem; color: var(--gray-500);">总上升</div>
        <div style="font-size: 1.25rem; font-weight: 600; color: var(--success-color);">
          +{{ totalAscent.toFixed(0) }} 米
        </div>
      </div>
      <div class="card" style="padding: 1rem; margin: 0;">
        <div style="font-size: 0.75rem; color: var(--gray-500);">总下降</div>
        <div style="font-size: 1.25rem; font-weight: 600; color: var(--danger-color);">
          -{{ totalDescent.toFixed(0) }} 米
        </div>
      </div>
      <div class="card" style="padding: 1rem; margin: 0;">
        <div style="font-size: 0.75rem; color: var(--gray-500);">最大高度</div>
        <div style="font-size: 1.25rem; font-weight: 600; color: var(--primary-color);">
          {{ maxAltitude.toFixed(0) }} 米
        </div>
      </div>
      <div class="card" style="padding: 1rem; margin: 0;">
        <div style="font-size: 0.75rem; color: var(--gray-500);">航点数量</div>
        <div style="font-size: 1.25rem; font-weight: 600; color: var(--gray-700);">
          {{ flightPath.length }} 个
        </div>
      </div>
    </div>
  </div>
  <div v-else class="empty-state">
    <div class="empty-icon">📊</div>
    <h3 class="empty-title">暂无高度数据</h3>
    <p class="empty-description">上传航线 KML 文件后即可查看高度剖面图</p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const props = defineProps({
  flightPath: {
    type: Array,
    default: () => []
  }
});

const canvasRef = ref(null);
const chartRef = ref(null);
let chart = null;

const totalAscent = computed(() => {
  let ascent = 0;
  for (let i = 1; i < props.flightPath.length; i++) {
    const diff = (props.flightPath[i].altitude || 0) - (props.flightPath[i - 1].altitude || 0);
    if (diff > 0) ascent += diff;
  }
  return ascent;
});

const totalDescent = computed(() => {
  let descent = 0;
  for (let i = 1; i < props.flightPath.length; i++) {
    const diff = (props.flightPath[i - 1].altitude || 0) - (props.flightPath[i].altitude || 0);
    if (diff > 0) descent += diff;
  }
  return descent;
});

const maxAltitude = computed(() => {
  if (props.flightPath.length === 0) return 0;
  return Math.max(...props.flightPath.map(p => p.altitude || 0));
});

const createChart = () => {
  if (!canvasRef.value || props.flightPath.length === 0) return;

  if (chart) {
    chart.destroy();
    chart = null;
  }

  const ctx = canvasRef.value.getContext('2d');
  
  const labels = props.flightPath.map((_, index) => `航点 ${index + 1}`);
  const data = props.flightPath.map(p => p.altitude || 0);
  
  const backgroundColors = data.map((alt, index) => {
    if (index === 0) return 'rgba(16, 185, 129, 0.8)';
    if (index === data.length - 1) return 'rgba(239, 68, 68, 0.8)';
    return 'rgba(59, 130, 246, 0.6)';
  });

  const borderColors = data.map((_, index) => {
    if (index === 0) return 'rgb(16, 185, 129)';
    if (index === data.length - 1) return 'rgb(239, 68, 68)';
    return 'rgb(59, 130, 246)';
  });

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '飞行高度 (米)',
        data,
        fill: true,
        backgroundColor: (context) => {
          const ctx2 = context.chart.ctx;
          const gradient = ctx2.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
          return gradient;
        },
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: backgroundColors,
        pointBorderColor: borderColors,
        pointBorderWidth: 2,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const point = props.flightPath[index];
              const isFirst = index === 0;
              const isLast = index === props.flightPath.length - 1;
              return [
                `${isFirst ? '🚀 起飞点' : (isLast ? '🪂 降落点' : `📍 航点 ${index + 1}`)}`,
                `高度: ${(point.altitude || 0).toFixed(1)} 米`,
                `纬度: ${point.latitude.toFixed(6)}°`,
                `经度: ${point.longitude.toFixed(6)}°`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: '航点顺序'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: '高度 (米)'
          },
          beginAtZero: true
        }
      }
    }
  });
};

watch(() => props.flightPath, () => {
  nextTick(() => {
    createChart();
  });
}, { deep: true });

onMounted(() => {
  nextTick(() => {
    createChart();
  });
});
</script>
