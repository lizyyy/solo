import { useCalibrationStore } from '../../store/calibrationStore';
import { TEST_TRACKS } from '../../data/testTracks';
import { Music } from 'lucide-react';

export default function TrackSelector() {
  const { testTrack, setTestTrack } = useCalibrationStore();

  const difficultyColors = {
    easy: 'bg-success-500/20 text-success-400 border-success-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    hard: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
  };

  const difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Music size={16} className="text-brass-400" />
        <label className="text-sm font-medium text-brass-300">测试曲目</label>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {TEST_TRACKS.map((track) => (
          <button
            key={track.id}
            onClick={() => setTestTrack(track.id)}
            className={`
              flex items-center justify-between p-3 rounded-lg border-2
              transition-all duration-200 text-left
              ${testTrack === track.id
                ? 'bg-brass-500/20 border-brass-500 shadow-lg shadow-brass-500/20'
                : 'bg-walnut-800 border-walnut-600 hover:border-walnut-500'}
            `}
          >
            <div className="flex flex-col">
              <span className={`font-medium ${testTrack === track.id ? 'text-brass-300' : 'text-walnut-200'}`}>
                {track.name}
              </span>
              <span className="text-xs text-walnut-400">{track.description}</span>
            </div>
            <span
              className={`
                px-2 py-1 rounded text-xs font-medium border
                ${difficultyColors[track.difficulty]}
              `}
            >
              {difficultyLabels[track.difficulty]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
