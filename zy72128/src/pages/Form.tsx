import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  FileText, 
  Music, 
  Image, 
  MessageCircle, 
  MoreHorizontal,
  AlertCircle
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { 
  NotificationStatus, 
  SourceInput, 
  SourceType, 
  statusLabels,
  sourceTypeLabels 
} from '../types';

const statusOptions: { value: NotificationStatus; label: string }[] = [
  { value: 'pending', label: '待确认' },
  { value: 'confirmed', label: '已确认' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' }
];

const sourceTypeOptions: { value: SourceType; label: string; icon: typeof FileText }[] = [
  { value: 'repertoire', label: '曲目表', icon: FileText },
  { value: 'audio', label: '音频文件', icon: Music },
  { value: 'contract', label: '合同截图', icon: Image },
  { value: 'chat', label: '群聊批注', icon: MessageCircle },
  { value: 'other', label: '其他材料', icon: MoreHorizontal }
];

export default function Form() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getNotification, addNotification, updateNotification, addSource } = useStore();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    title: '',
    status: 'pending' as NotificationStatus,
    studentName: '',
    instrument: '',
    piece: '',
    rehearsalTime: '',
    reason: ''
  });

  const [sources, setSources] = useState<SourceInput[]>([]);
  const [changeReason, setChangeReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEdit && id) {
      const notification = getNotification(id);
      if (notification) {
        setFormData({
          title: notification.title,
          status: notification.status,
          studentName: notification.studentName,
          instrument: notification.instrument,
          piece: notification.piece,
          rehearsalTime: notification.rehearsalTime || '',
          reason: notification.reason
        });
      }
    }
  }, [isEdit, id, getNotification]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) newErrors.title = '请输入通知标题';
    if (!formData.studentName.trim()) newErrors.studentName = '请输入学生姓名';
    if (!formData.instrument.trim()) newErrors.instrument = '请输入乐器';
    if (!formData.piece.trim()) newErrors.piece = '请输入曲目';
    if (!formData.reason.trim()) newErrors.reason = '请输入替补原因';
    
    if (isEdit && !changeReason.trim()) {
      newErrors.changeReason = '请输入修改原因';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    let targetId = id;

    if (isEdit && id) {
      updateNotification(id, formData, changeReason);
    } else {
      targetId = addNotification(formData, sources);
      sources.forEach(source => {
        addSource(targetId, source);
      });
    }

    navigate(`/notification/${targetId}`);
  };

  const handleAddSource = () => {
    setSources([...sources, {
      type: 'other',
      name: '',
      description: '',
      reference: ''
    }]);
  };

  const handleRemoveSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const handleSourceChange = (index: number, field: keyof SourceInput, value: string) => {
    const newSources = [...sources];
    newSources[index] = { ...newSources[index], [field]: value };
    setSources(newSources);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          to={isEdit ? `/notification/${id}` : '/'} 
          className="flex items-center gap-2 text-burgundy-700 hover:text-burgundy-900"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{isEdit ? '返回详情' : '返回列表'}</span>
        </Link>
      </div>

      <div className="card">
        <h1 className="text-2xl font-serif font-bold text-burgundy-900 mb-6">
          {isEdit ? '编辑通知' : '新建替补排练通知'}
        </h1>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="label-text">
                通知标题 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例如：小提琴替补 - 张小明"
                className={`input-field ${errors.title ? 'border-red-400' : ''}`}
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="label-text">
                学生姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.studentName}
                onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                placeholder="请输入学生姓名"
                className={`input-field ${errors.studentName ? 'border-red-400' : ''}`}
              />
              {errors.studentName && <p className="text-red-500 text-sm mt-1">{errors.studentName}</p>}
            </div>

            <div>
              <label className="label-text">
                乐器 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.instrument}
                onChange={(e) => setFormData({ ...formData, instrument: e.target.value })}
                placeholder="例如：小提琴、大提琴"
                className={`input-field ${errors.instrument ? 'border-red-400' : ''}`}
              />
              {errors.instrument && <p className="text-red-500 text-sm mt-1">{errors.instrument}</p>}
            </div>

            <div>
              <label className="label-text">
                曲目 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.piece}
                onChange={(e) => setFormData({ ...formData, piece: e.target.value })}
                placeholder="例如：贝多芬第五交响曲"
                className={`input-field ${errors.piece ? 'border-red-400' : ''}`}
              />
              {errors.piece && <p className="text-red-500 text-sm mt-1">{errors.piece}</p>}
            </div>

            <div>
              <label className="label-text">排练时间</label>
              <input
                type="text"
                value={formData.rehearsalTime}
                onChange={(e) => setFormData({ ...formData, rehearsalTime: e.target.value })}
                placeholder="例如：2024-06-15 19:00"
                className="input-field"
              />
            </div>

            <div>
              <label className="label-text">状态</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as NotificationStatus })}
                className="input-field"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label-text">
                替补原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="请详细说明替补原因，包括原演奏者情况、替补学生评估等..."
                rows={4}
                className={`input-field resize-none ${errors.reason ? 'border-red-400' : ''}`}
              />
              {errors.reason && <p className="text-red-500 text-sm mt-1">{errors.reason}</p>}
            </div>
          </div>

          {isEdit && (
            <div className="p-4 bg-gold-50 border border-gold-200 rounded-lg">
              <label className="label-text flex items-center gap-2 text-gold-800">
                <AlertCircle className="w-4 h-4" />
                修改原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="请说明本次修改的原因，以便后续追溯..."
                rows={2}
                className={`input-field resize-none mt-2 ${errors.changeReason ? 'border-red-400' : ''}`}
              />
              {errors.changeReason && <p className="text-red-500 text-sm mt-1">{errors.changeReason}</p>}
              <p className="text-xs text-gold-600 mt-2">
                修改将生成新版本，旧版本会被保留以便追溯
              </p>
            </div>
          )}

          {!isEdit && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-serif font-bold text-burgundy-900 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  来源材料
                </h2>
                <button
                  onClick={handleAddSource}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-burgundy-700 border border-burgundy-300 rounded hover:bg-burgundy-50"
                >
                  <Plus className="w-4 h-4" />
                  添加来源
                </button>
              </div>

              {sources.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-parchment-300 rounded-lg">
                  <p className="text-gray-500 mb-2">暂未添加来源材料</p>
                  <p className="text-sm text-gray-400">可添加曲目表、音频文件、合同截图、群聊批注等</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sources.map((source, index) => (
                    <div key={index} className="p-4 bg-parchment-50 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <select
                          value={source.type}
                          onChange={(e) => handleSourceChange(index, 'type', e.target.value)}
                          className="input-field w-32 text-sm"
                        >
                          {sourceTypeOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRemoveSource(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={source.name}
                          onChange={(e) => handleSourceChange(index, 'name', e.target.value)}
                          placeholder="材料名称"
                          className="input-field text-sm"
                        />
                        <input
                          type="text"
                          value={source.description}
                          onChange={(e) => handleSourceChange(index, 'description', e.target.value)}
                          placeholder="简要描述（可选）"
                          className="input-field text-sm"
                        />
                        <input
                          type="text"
                          value={source.reference}
                          onChange={(e) => handleSourceChange(index, 'reference', e.target.value)}
                          placeholder="引用/文件路径（可选）"
                          className="input-field text-sm font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4 border-t border-parchment-300">
            <Link
              to={isEdit ? `/notification/${id}` : '/'}
              className="px-6 py-2 text-burgundy-700 border border-burgundy-300 rounded hover:bg-burgundy-50 transition-colors"
            >
              取消
            </Link>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 btn-primary"
            >
              <Save className="w-4 h-4" />
              {isEdit ? '保存修改' : '创建通知'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
