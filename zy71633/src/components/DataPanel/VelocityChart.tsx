import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useSimulationStore } from '../../store/useSimulationStore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export function VelocityChart() {
  const { result } = useSimulationStore();

  const data = {
    labels: result?.velocityData.map((d) => d.time.toFixed(1)) || [],
    datasets: [
      {
        label: '速度 (m/s)',
        data: result?.velocityData.map((d) => d.velocity) || [],
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0, 212, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(10, 22, 40, 0.9)',
        titleColor: '#00d4ff',
        bodyColor: '#ffffff',
        borderColor: '#00d4ff',
        borderWidth: 1,
        callbacks: {
          title: (items: any) => `时间: ${items[0].label} ms`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#9ca3af',
          font: {
            family: 'JetBrains Mono',
            size: 10,
          },
        },
        title: {
          display: true,
          text: '时间 (ms)',
          color: '#9ca3af',
          font: {
            family: 'JetBrains Mono',
            size: 10,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#9ca3af',
          font: {
            family: 'JetBrains Mono',
            size: 10,
          },
        },
        title: {
          display: true,
          text: '速度 (m/s)',
          color: '#9ca3af',
          font: {
            family: 'JetBrains Mono',
            size: 10,
          },
        },
      },
    },
  };

  return <Line data={data} options={options as any} />;
}
