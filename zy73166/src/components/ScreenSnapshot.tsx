interface Snapshot {
  materialCount: number;
  totalPoints: number;
  rSquaredValues: Record<string, number>;
  boundaryWarnings: string[];
}

interface Props {
  snapshot: Snapshot;
  hash: string;
}

export default function ScreenSnapshot({ snapshot, hash }: Props) {
  const avgR2 = Object.values(snapshot.rSquaredValues).length > 0
    ? Object.values(snapshot.rSquaredValues).reduce((a, b) => a + b, 0) / Object.values(snapshot.rSquaredValues).length
    : 0;

  return (
    <div className="card border-primary-200 bg-gradient-to-br from-primary-50/50 to-white">
      <div className="card-header">
        <div>
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <span>📸</span>
            屏幕快照
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            导出时自动绑定，防止"导出数字和屏幕分家"
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Hash</div>
          <code className="font-mono text-xs px-2 py-0.5 bg-white rounded border border-primary-200 text-primary-600">
            {hash}
          </code>
        </div>
      </div>

      <div className="card-body space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
            <div className="text-lg font-bold text-slate-800">{snapshot.materialCount}</div>
            <div className="text-[10px] text-slate-500">材料</div>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
            <div className="text-lg font-bold text-slate-800">{snapshot.totalPoints}</div>
            <div className="text-[10px] text-slate-500">数据点</div>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
            <div className={`text-lg font-bold ${avgR2 >= 0.999 ? 'text-green-600' : avgR2 >= 0.99 ? 'text-amber-600' : 'text-red-600'}`}>
              {avgR2.toFixed(4)}
            </div>
            <div className="text-[10px] text-slate-500">平均 R²</div>
          </div>
          <div className={`p-2 rounded-lg border text-center ${
            snapshot.boundaryWarnings.length === 0
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-lg font-bold ${
              snapshot.boundaryWarnings.length === 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {snapshot.boundaryWarnings.length}
            </div>
            <div className="text-[10px] text-slate-500">边界告警</div>
          </div>
        </div>

        {snapshot.boundaryWarnings.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 space-y-0.5 max-h-28 overflow-auto">
            {snapshot.boundaryWarnings.map((w, i) => (
              <div key={i}>• {w}</div>
            ))}
          </div>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700 select-none">
            查看各材料 R² 明细
          </summary>
          <div className="mt-2 p-2 bg-white rounded border border-slate-200 space-y-1 max-h-36 overflow-auto">
            {Object.entries(snapshot.rSquaredValues).map(([id, r2]) => (
              <div key={id} className="flex items-center justify-between">
                <span className="font-mono text-slate-500">{id}</span>
                <span className={`font-mono font-medium ${
                  r2 >= 0.999 ? 'text-green-600' : r2 >= 0.99 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  R² = {r2.toFixed(6)}
                </span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
