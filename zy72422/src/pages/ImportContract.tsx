import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Check, AlertCircle, Music } from 'lucide-react';
import { useRoyaltyStore } from '../store/useRoyaltyStore';
import type { RoyaltyRecord, Track } from '../types';

export default function ImportContract() {
  const navigate = useNavigate();
  const { addRecord, addEvidenceNode, currentOperator } = useRoyaltyStore();
  const [step, setStep] = useState<'upload' | 'parsing' | 'preview'>('upload');
  const [contractNo, setContractNo] = useState('');
  const [recordStore, setRecordStore] = useState('');
  const [parsedTracks, setParsedTracks] = useState<Track[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const sampleContracts = [
    {
      no: 'HT-DEMO-001',
      store: '演示唱片店（顺利流程）',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=music%20contract%20paper%20document%20tracklist%20clean%20professional&image_size=landscape_4_3',
      tracks: [
        { name: '星空下的约定', remark: '首版母带确认', hasRework: false },
        { name: '海边的卡夫卡', remark: '正常交付', hasRework: false },
        { name: '城市回响', remark: '正常交付', hasRework: false },
      ]
    },
    {
      no: 'HT-DEMO-002',
      store: '演示唱片店（含返工）',
      image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=music%20contract%20with%20red%20pen%20marks%20corrections%20notes&image_size=landscape_4_3',
      tracks: [
        { name: '迷途羔羊', remark: '正常交付', hasRework: false },
        { name: '旧时光', remark: '返工原因：人声有杂音，需重新录制', hasRework: true, reworkReason: '人声有杂音，需重新录制' },
        { name: '远方的信', remark: '返工原因：混音比例不对，人声太小', hasRework: true, reworkReason: '混音比例不对，人声太小' },
      ]
    }
  ];

  const handleUploadDemo = (sample: typeof sampleContracts[0]) => {
    setContractNo(sample.no);
    setRecordStore(sample.store);
    setStep('parsing');

    setTimeout(() => {
      const tracks: Track[] = sample.tracks.map((t, i) => ({
        id: `trk-demo-${Date.now()}-${i}`,
        name: t.name,
        trackNumber: i + 1,
        remark: t.remark,
        hasReworkReason: t.hasRework,
        reworkReason: t.reworkReason,
      }));
      setParsedTracks(tracks);
      setStep('preview');
    }, 1500);
  };

  const handleConfirm = () => {
    const hasRework = parsedTracks.some(t => t.hasReworkReason);
    const recordId = `rec-${Date.now()}`;
    
    const newRecord: RoyaltyRecord = {
      id: recordId,
      contractNo,
      recordStore,
      importDate: new Date().toISOString().split('T')[0],
      status: hasRework ? 'review' : 'normal',
      contractImage: sampleContracts[0].image,
      tracks: parsedTracks,
      evidenceChain: [
        {
          id: `ev-${Date.now()}-1`,
          type: 'import',
          title: '合同截图导入',
          description: `${currentOperator}上传合同页截图 ${contractNo}`,
          operator: currentOperator,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        },
        {
          id: `ev-${Date.now()}-2`,
          type: 'parse',
          title: '自动解析轨道信息',
          description: `成功解析${parsedTracks.length}条轨道信息${hasRework ? `，检测到${parsedTracks.filter(t => t.hasReworkReason).length}条轨道备注包含返工原因` : ''}`,
          operator: '系统',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        }
      ],
      rehearsalChanges: [],
    };

    if (hasRework) {
      newRecord.evidenceChain.push({
        id: `ev-${Date.now()}-3`,
        type: 'manual_fix',
        title: '标记待复核',
        description: '检测到返工原因，自动标记为待复核状态，需版权运营确认',
        operator: '系统',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      });
      newRecord.reviewNote = '请版权运营复核返工原因后确认分账';
    }

    addRecord(newRecord);
    navigate(`/record/${recordId}`);
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-primary-800">合同导入</h1>
        <p className="text-primary-500 mt-1">上传合同页截图，系统自动解析轨道信息</p>
      </div>

      {step === 'upload' && (
        <div className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragActive ? 'border-primary-500 bg-primary-50' : 'border-primary-200 bg-white hover:border-primary-300'
            }`}
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDrop={() => setDragActive(false)}
          >
            <Upload className="w-12 h-12 text-primary-300 mx-auto mb-4" />
            <h3 className="font-medium text-primary-700 mb-2">拖拽合同截图到此处</h3>
            <p className="text-sm text-primary-400 mb-4">或点击选择文件上传（支持 JPG、PNG）</p>
            <button className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors">
              选择文件
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-card border border-primary-100 overflow-hidden">
            <div className="p-4 border-b border-primary-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-500" />
              <h2 className="font-serif font-semibold text-primary-800">快速体验（演示数据）</h2>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-primary-500 mb-4">选择一份演示合同快速体验完整流程：</p>
              {sampleContracts.map((sample, index) => (
                <button
                  key={index}
                  onClick={() => handleUploadDemo(sample)}
                  className="w-full p-4 text-left border border-primary-100 rounded-lg hover:bg-primary-50 hover:border-primary-200 transition-colors flex items-center gap-4"
                >
                  <div className="w-16 h-16 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Music className="w-8 h-8 text-primary-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-primary-800">{sample.no}</h4>
                    <p className="text-sm text-primary-500">{sample.store}</p>
                    <p className="text-xs text-primary-400 mt-1">
                      {sample.tracks.length} 条轨道
                      {sample.tracks.some(t => t.hasRework) && ' · 含返工原因'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'parsing' && (
        <div className="bg-white rounded-xl shadow-card border border-primary-100 p-12 text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <h3 className="font-medium text-primary-800 mb-2">正在解析合同...</h3>
          <p className="text-sm text-primary-400">系统正在识别轨道信息和备注内容</p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-card border border-primary-100 overflow-hidden">
            <div className="p-4 border-b border-primary-100 flex items-center gap-2">
              <Check className="w-5 h-5 text-accent-success" />
              <h2 className="font-serif font-semibold text-primary-800">解析结果预览</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-1">合同编号</label>
                  <input
                    type="text"
                    value={contractNo}
                    onChange={e => setContractNo(e.target.value)}
                    className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-1">唱片店</label>
                  <input
                    type="text"
                    value={recordStore}
                    onChange={e => setRecordStore(e.target.value)}
                    className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>

              <div className="border-t border-primary-100 pt-4">
                <h4 className="font-medium text-primary-700 mb-3">轨道列表</h4>
                <div className="space-y-2">
                  {parsedTracks.map(track => (
                    <div
                      key={track.id}
                      className={`p-3 rounded-lg border ${
                        track.hasReworkReason
                          ? 'bg-accent-reworkLight/30 border-accent-rework/30'
                          : 'bg-primary-50 border-primary-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-sm font-medium text-primary-600 shadow-sm">
                          {track.trackNumber}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary-800">{track.name}</span>
                            {track.hasReworkReason && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-accent-reworkLight text-accent-rework">
                                <AlertCircle className="w-3 h-3" />
                                返工
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-primary-500 mt-0.5">{track.remark}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {parsedTracks.some(t => t.hasReworkReason) && (
                <div className="p-3 bg-accent-warningLight/50 rounded-lg border border-accent-warning/30">
                  <p className="text-sm text-amber-700">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    检测到 <strong>{parsedTracks.filter(t => t.hasReworkReason).length}</strong> 条轨道包含返工原因，记录将标记为「待复核」状态，需要版权运营确认后才能完成分账。
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 text-primary-500 hover:text-primary-700 transition-colors"
            >
              重新上传
            </button>
            <button
              onClick={handleConfirm}
              disabled={!contractNo || !recordStore}
              className="px-6 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              确认导入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
