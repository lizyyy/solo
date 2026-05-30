import { useEffect, useRef } from 'react';
import type { ADSRParams } from '@/types';

interface EnvelopeCurveProps {
  raw: ADSRParams;
  conclusion: ADSRParams;
}

function buildPath(params: ADSRParams, width: number, height: number): string {
  const totalMs = params.attack + params.decay + params.release + 1000;
  const pxPerMs = width / totalMs;
  const padY = 20;
  const plotH = height - padY * 2;

  const ax = params.attack * pxPerMs;
  const dx = params.decay * pxPerMs;
  const sustainY = padY + plotH * (1 - params.sustain / 100);
  const peakY = padY;
  const sustainLen = width * 0.2;
  const rx = params.release * pxPerMs;

  const points: [number, number][] = [
    [0, height - padY],
    [ax, peakY],
    [ax + dx, sustainY],
    [ax + dx + sustainLen, sustainY],
    [ax + dx + sustainLen + rx, height - padY],
  ];

  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
}

export default function EnvelopeCurve({ raw, conclusion }: EnvelopeCurveProps) {
  const rawRef = useRef<SVGPathElement>(null);
  const concRef = useRef<SVGPathElement>(null);

  const vbWidth = 600;
  const vbHeight = 200;

  useEffect(() => {
    const paths = [rawRef.current, concRef.current];
    paths.forEach((path) => {
      if (!path) return;
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      path.getBoundingClientRect();
      path.style.transition = 'stroke-dashoffset 1.2s ease-out';
      path.style.strokeDashoffset = '0';
    });
  }, [raw, conclusion]);

  const rawPath = buildPath(raw, vbWidth, vbHeight);
  const concPath = buildPath(conclusion, vbWidth, vbHeight);

  const totalMs = conclusion.attack + conclusion.decay + conclusion.release + 1000;
  const pxPerMs = vbWidth / totalMs;
  const padY = 20;
  const plotH = vbHeight - padY * 2;

  const attackEnd = conclusion.attack * pxPerMs;
  const decayEnd = attackEnd + conclusion.decay * pxPerMs;
  const sustainLen = vbWidth * 0.2;
  const sustainEnd = decayEnd + sustainLen;
  const releaseEnd = sustainEnd + conclusion.release * pxPerMs;
  const sustainY = padY + plotH * (1 - conclusion.sustain / 100);

  return (
    <div className="w-full rounded-xl bg-synth-card border border-synth-border p-4">
      <svg
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={0} y={0} width={attackEnd} height={vbHeight} fill="#39FF14" opacity={0.06} />
        <rect x={attackEnd} y={0} width={decayEnd - attackEnd} height={vbHeight} fill="#FFB800" opacity={0.06} />
        <rect x={decayEnd} y={0} width={sustainLen} height={vbHeight} fill="#3B82F6" opacity={0.06} />
        <rect x={sustainEnd} y={0} width={releaseEnd - sustainEnd} height={vbHeight} fill="#EF4444" opacity={0.06} />

        <text x={attackEnd / 2} y={vbHeight - 4} textAnchor="middle" fill="#39FF14" fontSize="9" fontFamily="JetBrains Mono">A</text>
        <text x={(attackEnd + decayEnd) / 2} y={vbHeight - 4} textAnchor="middle" fill="#FFB800" fontSize="9" fontFamily="JetBrains Mono">D</text>
        <text x={(decayEnd + sustainEnd) / 2} y={vbHeight - 4} textAnchor="middle" fill="#3B82F6" fontSize="9" fontFamily="JetBrains Mono">S</text>
        <text x={(sustainEnd + releaseEnd) / 2} y={vbHeight - 4} textAnchor="middle" fill="#EF4444" fontSize="9" fontFamily="JetBrains Mono">R</text>

        <path
          ref={rawRef}
          d={rawPath}
          fill="none"
          stroke="#39FF14"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          opacity={0.4}
        />
        <path
          ref={concRef}
          d={concPath}
          fill="none"
          stroke="#39FF14"
          strokeWidth={2}
        />

        <circle
          cx={conclusion.attack * pxPerMs}
          cy={padY}
          r={4}
          fill="#39FF14"
          className="drop-shadow-[0_0_6px_rgba(57,255,20,0.6)]"
        />

        <line
          x1={decayEnd}
          y1={sustainY}
          x2={sustainEnd}
          y2={sustainY}
          stroke="#3B82F6"
          strokeWidth={1}
          strokeDasharray="2 2"
          opacity={0.5}
        />
      </svg>
    </div>
  );
}
