import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Beaker, Plus, Save } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function Samples() {
  const navigate = useNavigate();
  const { samples, setSelectedSampleId, addSample, paramTable } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [origin, setOrigin] = useState('A');
  const [dest, setDest] = useState('E');
  const [stops, setStops] = useState('3');
  const [priority, setPriority] = useState('distance');
  const [version, setVersion] = useState(String(paramTable.currentVersion));

  const goReview = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    navigate('/review');
  };

  const saveSample = () => {
    if (!name.trim()) return;
    addSample({
      name: name.trim(),
      description: desc.trim(),
      data: { origin, destination: dest, maxStops: Number(stops), priority },
      paramVersion: Number(version),
      isExample: false,
    });
    setName(''); setDesc(''); setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl text-navy-800 font-semibold">边界样例库</h2>
          <p className="text-sm text-slate-500 mt-1">点任一样本行直接进入复核页，参数版本与样本绑定</p>
        </div>
        <button className="btn btn-sm" onClick={() => setShowAdd((s) => !s)}>
          <Plus className="w-3.5 h-3.5" /> 新增样本
        </button>
      </div>

      {showAdd && (
        <div className="card p-4 space-y-3 border-navy-300">
          <p className="text-sm font-medium text-navy-800">录入新边界样本</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input className="border border-slate-300 px-2 py-1.5 text-sm col-span-2" placeholder="样本名称" value={name} onChange={(e) => setName(e.target.value)} />
            <select className="border border-slate-300 px-2 py-1.5 text-sm" value={version} onChange={(e) => setVersion(e.target.value)}>
              {paramTable.versions.map((v) => (
                <option key={v.id} value={v.versionNo}>参数版本 v{v.versionNo}</option>
              ))}
            </select>
            <input className="border border-slate-300 px-2 py-1.5 text-sm col-span-2" placeholder="描述（触发什么边界）" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <select className="border border-slate-300 px-2 py-1.5 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="distance">距离优先</option>
              <option value="cost">成本优先</option>
              <option value="balanced">均衡</option>
            </select>
            <input className="border border-slate-300 px-2 py-1.5 text-sm" placeholder="起点" value={origin} onChange={(e) => setOrigin(e.target.value)} />
            <input className="border border-slate-300 px-2 py-1.5 text-sm" placeholder="终点" value={dest} onChange={(e) => setDest(e.target.value)} />
            <input className="border border-slate-300 px-2 py-1.5 text-sm" placeholder="最大停站数" value={stops} onChange={(e) => setStops(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-sm" onClick={() => setShowAdd(false)}>取消</button>
            <button className="btn btn-sm btn-primary" onClick={saveSample}><Save className="w-3.5 h-3.5" /> 保存</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {samples.map((s) => (
          <div key={s.id} className="card p-5 hover-float cursor-pointer" onClick={() => goReview(s.id)}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 border-2 border-navy-600 flex items-center justify-center">
                <Beaker className="w-5 h-5 text-navy-700" />
              </div>
              {s.isExample && <span className="badge badge-navy">官方样例</span>}
            </div>
            <h3 className="font-display text-base text-navy-800 font-semibold mb-1">{s.name}</h3>
            <p className="text-sm text-slate-500 mb-3 min-h-[2.5em]">{s.description}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="badge badge-navy">v{s.paramVersion}</span>
              {Object.entries(s.data).map(([k, v]) => (
                <span key={k} className="badge badge-navy bg-white">
                  {k}={String(v)}
                </span>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono-data">{s.createdAt.slice(0, 16)}</span>
              <span className="text-sm text-navy-700 font-medium flex items-center">
                去复核 <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <Link to="/review" className="btn btn-sm btn-primary">
        或直接前往空白复核页手动粘贴 →
      </Link>
    </div>
  );
}
