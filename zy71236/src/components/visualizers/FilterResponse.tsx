import { FilterParams } from '../../types/synth';

interface FilterResponseProps {
  filter: FilterParams;
  width?: number;
  height?: number;
}

export function FilterResponse({ filter, width = 200, height = 80 }: FilterResponseProps) {
  const { type, cutoff, resonance } = filter;

  const generateResponse = (freq: number): number => {
    const normalizedFreq = freq / 20000;
    const normalizedCutoff = cutoff / 20000;
    const q = resonance;

    let gain = 0;

    switch (type) {
      case 'lowpass':
        gain = 1 / Math.sqrt(1 + Math.pow(normalizedFreq / normalizedCutoff, 4));
        if (q > 1) {
          const peakGain = q * 0.3;
          const peakWidth = 0.1;
          const peak = Math.exp(-Math.pow((normalizedFreq - normalizedCutoff) / peakWidth, 2)) * peakGain;
          gain = Math.min(1, gain + peak);
        }
        break;
      case 'highpass':
        gain = 1 / Math.sqrt(1 + Math.pow(normalizedCutoff / normalizedFreq, 4));
        break;
      case 'bandpass':
        const bandwidth = 0.1 + (1 / (q + 1)) * 0.3;
        gain = Math.exp(-Math.pow((Math.log2(freq / cutoff)) / bandwidth, 2));
        break;
      case 'notch':
        const notchWidth = 0.05 + (1 / (q + 1)) * 0.1;
        gain = 1 - Math.exp(-Math.pow((Math.log2(freq / cutoff)) / notchWidth, 2));
        break;
    }

    return gain;
  };

  const points: { x: number; y: number }[] = [];
  const numPoints = 100;

  for (let i = 0; i <= numPoints; i++) {
    const freq = 20 * Math.pow(1000, i / numPoints);
    const x = (i / numPoints) * width;
    const gain = generateResponse(freq);
    const y = height - gain * height;
    points.push({ x, y });
  }

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-700 bg-gray-900/50 p-2">
      <svg width={width} height={height} className="block">
        <defs>
          <linearGradient id="filterFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF00AA" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FF00AA" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#374151"
          strokeWidth="1"
          strokeDasharray="2,2"
        />

        <path
          d={`${pathD} L ${width} ${height} L 0 ${height} Z`}
          fill="url(#filterFill)"
        />

        <path
          d={pathD}
          fill="none"
          stroke="#FF00AA"
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 0 4px #FF00AA)' }}
        />

        <line
          x1={width * (Math.log10(cutoff / 20) / 3)}
          y1={0}
          x2={width * (Math.log10(cutoff / 20) / 3)}
          y2={height}
          stroke="#FF00AA"
          strokeWidth="1"
          strokeDasharray="3,3"
          opacity="0.5"
        />
      </svg>

      <div className="flex justify-between text-[10px] text-gray-500 font-mono px-1">
        <span>20Hz</span>
        <span>{cutoff.toFixed(0)}Hz</span>
        <span>20kHz</span>
      </div>
    </div>
  );
}
