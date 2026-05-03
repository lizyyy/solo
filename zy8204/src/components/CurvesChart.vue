<template>
  <div class="curves-container">
    <div class="chart-container" v-if="rqdChartData.labels.length > 0">
      <div class="chart-title">RQD 曲线</div>
      <Bar
        :data="rqdChartData"
        :options="chartOptions"
        :height="200"
      />
    </div>
    <div class="chart-container" v-if="recoveryChartData.labels.length > 0">
      <div class="chart-title">取芯率曲线</div>
      <Bar
        :data="recoveryChartData"
        :options="chartOptions"
        :height="200"
      />
    </div>
    <div class="empty-state" v-if="rqdChartData.labels.length === 0 && recoveryChartData.labels.length === 0">
      <div class="empty-state-icon">📊</div>
      <div>暂无 RQD 和取芯率数据</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps({
  rqdData: {
    type: Array,
    default: () => []
  },
  recoveryData: {
    type: Array,
    default: () => []
  },
  selectedBoxNumber: {
    type: Number,
    default: null
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          const index = context.dataIndex
          const data = context.dataset.data
          const label = context.chart.data.labels[index]
          return `${label}: ${data[index].toFixed(1)}%`
        }
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      max: 100,
      ticks: {
        callback: function(value) {
          return value + '%'
        }
      }
    },
    y: {
      ticks: {
        display: true,
        font: {
          size: 10
        }
      }
    }
  }
}

const rqdChartData = computed(() => {
  if (props.rqdData.length === 0) {
    return { labels: [], datasets: [] }
  }
  
  const labels = props.rqdData.map(d => `箱${d.box_number}`)
  const data = props.rqdData.map(d => d.y)
  const backgroundColors = props.rqdData.map(d => {
    if (props.selectedBoxNumber === d.box_number) {
      return '#3498db'
    }
    if (d.y < 30) return '#e74c3c'
    if (d.y < 60) return '#f39c12'
    return '#27ae60'
  })
  
  return {
    labels,
    datasets: [
      {
        label: 'RQD (%)',
        data,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors,
        borderWidth: 1
      }
    ]
  }
})

const recoveryChartData = computed(() => {
  if (props.recoveryData.length === 0) {
    return { labels: [], datasets: [] }
  }
  
  const labels = props.recoveryData.map(d => `箱${d.box_number}`)
  const data = props.recoveryData.map(d => d.y)
  const backgroundColors = props.recoveryData.map(d => {
    if (props.selectedBoxNumber === d.box_number) {
      return '#3498db'
    }
    if (d.y < 50) return '#e74c3c'
    if (d.y < 80) return '#f39c12'
    return '#27ae60'
  })
  
  return {
    labels,
    datasets: [
      {
        label: '取芯率 (%)',
        data,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors,
        borderWidth: 1
      }
    ]
  }
})
</script>

<style scoped>
.chart-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.5rem;
  text-align: center;
}
</style>
