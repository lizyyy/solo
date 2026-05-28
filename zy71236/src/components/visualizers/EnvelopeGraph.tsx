import { EnvelopeParams } from '../../types/synth';

interface EnvelopeGraphProps {
  envelope: EnvelopeParams;
  width?: number;
  height?: number;
}

export function EnvelopeGraph({ envelope, width = 200, height = 80 }: EnvelopeGraphProps) {
  const { attack, decay, sustain, release } = envelope;

  const totalTime = attack + decay + 0.5 + release;
  const scale = width / totalTime;

  const points = [
    { x: 0, y: height },
    { x: attack * scale, y: 0 },
    { x: (attack + decay) * scale, y: height * (1 - sustain) },
    { x: (attack + decay + 0.5) * scale, y: height * (1 - sustain) },
    { x: width, y: height },
  ];

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-700 bg-gray-900/50 p-2">
      <svg width={width} height={height} className="block">
        <defs>
          <linearGradient id="envFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00F0FF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((g, i) => (
          <line
            key={i}
            x1={0}
            y1={height * g}
            x2={width}
            y2={height * g}
            stroke="#374151"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        ))}

        <path
          d={`${pathD} L ${width} ${height} L 0 ${height} Z`}
          fill="url(#envFill)"
        />

        <path
          d={pathD}
          fill="none"
          stroke="#00F0FF"
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 0 4px #00F0FF)' }}
        />

        {points.slice(1, -1).map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#121212"
            stroke="#00F0FF"
            strokeWidth="2"
          />
        ))}
      </svg>

      <div className="flex justify-between text-[10px] text-gray-500 font-mono px-1">
        <span>A</span>
        <span>D</span>
        <span>S</span>
        <span>R</span>
      </div>
    </div>
  );
}
