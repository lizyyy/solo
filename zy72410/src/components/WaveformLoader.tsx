interface WaveformLoaderProps {
  text?: string;
}

export default function WaveformLoader({ text = '加载中...' }: WaveformLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="flex items-end gap-1 h-8">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="waveform-bar"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
      <p className="text-studio-silver font-mono text-sm">{text}</p>
    </div>
  );
}
