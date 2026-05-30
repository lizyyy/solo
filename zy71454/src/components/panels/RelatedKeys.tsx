import { useMemo } from 'react';
import { Link2 } from 'lucide-react';
import usePianoStore from '../../store/usePianoStore';

interface RelatedKeysProps {
  currentKey: number;
}

export default function RelatedKeys({ currentKey }: RelatedKeysProps) {
  const { keys, getRelatedKeys, setSelectedKey } = usePianoStore();

  const relatedKeys = useMemo(() => {
    return getRelatedKeys(currentKey).map(item => ({
      ...item,
      keyData: keys.find(k => k.keyNumber === item.keyNumber),
    }));
  }, [currentKey, getRelatedKeys, keys]);

  if (relatedKeys.length === 0) {
    return null;
  }

  return (
    <div className="bg-zinc-800/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={14} className="text-zinc-400" />
        <h4 className="text-sm font-medium text-zinc-300">智能关联</h4>
      </div>
      
      <div className="space-y-2">
        {relatedKeys.map(({ keyNumber, reason, similarity, keyData }) => (
          <button
            key={keyNumber}
            onClick={() => setSelectedKey(keyNumber)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-700/50 transition-colors text-left group"
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                keyData?.isBlack ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-800'
              }`}>
                {keyData?.noteName}
              </div>
              <div>
                <div className="text-sm text-zinc-200">#{keyNumber}</div>
                <div className="text-xs text-zinc-500">{keyData?.pressure}g · {keyData?.reboundTime}ms</div>
              </div>
              </div>
            <div className="text-right">
              <div className="text-xs text-orange-400">{similarity}%</div>
              <div className="text-xs text-zinc-500 max-w-32 truncate">{reason}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
