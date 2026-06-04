import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { useStore } from '@/store/useStore'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export default function VarianceChart() {
  const svdResult = useStore(s => s.svdResult)

  if (!svdResult) return null

  const ratios = svdResult.explainedVarianceRatio.slice(0, 10)
  const labels = ratios.map((_, i) => `PC${i + 1}`)
  const cumulative = ratios.reduce((acc, v, i) => {
    acc.push((acc[i - 1] ?? 0) + v)
    return acc
  }, [] as number[])

  const data = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: '各主成分方差贡献率',
        data: ratios,
        backgroundColor: '#1a5276',
        borderColor: '#1a5276',
        borderWidth: 1,
        order: 2,
      },
      {
        type: 'line' as const,
        label: '累计方差贡献率',
        data: cumulative,
        borderColor: '#f0a500',
        backgroundColor: 'rgba(240, 165, 0, 0.1)',
        pointBackgroundColor: '#f0a500',
        pointBorderColor: '#f0a500',
        fill: true,
        tension: 0.3,
        order: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#d1d5db' },
      },
      title: {
        display: true,
        text: '方差贡献率',
        color: '#f3f4f6',
        font: { size: 16 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) => {
            const label = ctx.dataset.label ?? ''
            return `${label}: ${(ctx.parsed.y * 100).toFixed(1)}%`
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      y: {
        ticks: {
          color: '#9ca3af',
          callback: (value: string | number) => `${Number(value) * 100}%`,
        },
        grid: { color: 'rgba(255,255,255,0.05)' },
        max: 1,
      },
    },
  }

  return (
    <div className="h-[300px] rounded-lg border border-indigo-800 bg-indigo-950 p-4">
      <Chart type="bar" data={data} options={options} />
    </div>
  )
}
