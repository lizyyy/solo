import { useParams, Link, useNavigate } from 'react-router-dom';
import { useShotStore } from '@/store/useShotStore';
import { FilmBorder } from '@/components/common/FilmBorder';
import { StatusBadge } from '@/components/common/StatusBadge';
import { VersionTag } from '@/components/common/VersionTag';
import { FIELD_LABELS } from '@/types';
import { validateShotNumber, canEdit } from '@/utils/validation';
import { detectFieldChanges } from '@/utils/diff';
import {
  ChevronLeft,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import type { ShotVersion } from '@/types';

export function ShotEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getShotById, getCurrentVersion, currentUser, updateShot, shots } = useShotStore();

  const shot = id ? getShotById(id) : undefined;
  const currentVersion = id ? getCurrentVersion(id) : undefined;

  const [formData, setFormData] = useState<Partial<ShotVersion>>({});
  const [reason, setReason] = useState('');
  const [isMajorChange, setIsMajorChange] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [shotNumberInput, setShotNumberInput] = useState('');

  useEffect(() => {
    if (currentVersion) {
      setFormData({
        title: currentVersion.title,
        duration: currentVersion.duration,
        dialogue: currentVersion.dialogue,
        actionDescription: currentVersion.actionDescription,
        artNotes: currentVersion.artNotes,
        vfxNotes: currentVersion.vfxNotes,
        referenceLinks: currentVersion.referenceLinks,
        storyboardImage: currentVersion.storyboardImage,
      });
    }
    if (shot) {
      setShotNumberInput(shot.shotNumber);
    }
  }, [currentVersion, shot]);

  if (!shot || !currentVersion) {
    return (
      <div className="p-6">
        <p className="text-film-text-secondary">镜头不存在</p>
        <Link to="/" className="text-film-primary hover:underline">
          返回列表
        </Link>
      </div>
    );
  }

  if (!canEdit(shot, currentUser.role)) {
    return (
      <div className="p-6">
        <div className="bg-film-danger/20 border border-film-danger/50 rounded-xl p-6 max-w-md mx-auto text-center">
          <AlertTriangle className="w-12 h-12 text-film-danger mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-film-text-primary mb-2">无编辑权限</h3>
          <p className="text-film-text-secondary mb-4">
            {shot.status === 'locked'
              ? '此版本已被导演锁定，只有导演可以解锁后编辑。'
              : '您的角色没有编辑此镜头的权限。'}
          </p>
          <Link
            to={`/shot/${shot.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-film-primary text-white rounded-lg"
          >
            返回详情
          </Link>
        </div>
      </div>
    );
  }

  const detectedChanges = detectFieldChanges(currentVersion, formData, reason, currentUser.id);

  const handleChange = (field: keyof ShotVersion, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleShotNumberChange = (value: string) => {
    setShotNumberInput(value);
    const validation = validateShotNumber(value, shots, shot.id);
    setValidationError(validation.message);
  };

  const handleSave = () => {
    if (!reason.trim()) {
      alert('请填写修改理由！');
      return;
    }

    if (validationError) {
      alert('镜头号格式错误或已存在！');
      return;
    }

    if (detectedChanges.length === 0) {
      alert('没有检测到任何修改！');
      return;
    }

    const result = updateShot(shot.id, formData, reason, isMajorChange);
    if (result) {
      navigate(`/shot/${shot.id}`);
    }
  };

  const editableFields = [
    { key: 'title', label: '镜头标题', type: 'text' },
    { key: 'duration', label: '时长(秒)', type: 'number' },
    { key: 'dialogue', label: '台词', type: 'textarea' },
    { key: 'actionDescription', label: '动作描述', type: 'textarea' },
    { key: 'artNotes', label: '美术备注', type: 'textarea' },
    { key: 'vfxNotes', label: '特效说明', type: 'textarea' },
    { key: 'referenceLinks', label: '参考资料', type: 'textarea' },
    { key: 'storyboardImage', label: '分镜图URL', type: 'text' },
  ];

  return (
    <div className="min-h-screen">
      <FilmBorder>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/shot/${shot.id}`}
                className="p-2 text-film-text-muted hover:text-film-text-primary hover:bg-film-card rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-lg text-film-primary font-bold">
                    编辑 - {shot.shotNumber}
                  </span>
                  <StatusBadge status={shot.status} size="sm" />
                  <VersionTag version={currentVersion.version} size="sm" />
                </div>
                <h2 className="text-xl font-bold text-film-text-primary">
                  编辑分镜
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/shot/${shot.id}`)}
                className="flex items-center gap-2 px-4 py-2 text-film-text-secondary hover:text-film-text-primary hover:bg-film-card rounded-lg text-sm font-medium transition-colors"
              >
                <X className="w-4 h-4" />
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={detectedChanges.length === 0 || !reason.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-film-primary hover:bg-film-primary/80 disabled:bg-film-border disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                保存新版本
              </button>
            </div>
          </div>
        </div>
      </FilmBorder>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-film-card border border-film-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-film-text-primary mb-4">镜头号</h3>
            <div>
              <label className="block text-sm text-film-text-secondary mb-2">
                镜头号（格式：S01-E001）
              </label>
              <input
                type="text"
                value={shotNumberInput}
                onChange={(e) => handleShotNumberChange(e.target.value)}
                className={`w-full px-4 py-3 bg-film-panel border rounded-lg text-film-text-primary placeholder-film-text-muted focus:outline-none focus:ring-2 transition-colors ${
                  validationError
                    ? 'border-film-danger focus:ring-film-danger/30'
                    : 'border-film-border focus:ring-film-primary/30 focus:border-film-primary'
                }`}
              />
              {validationError && (
                <p className="mt-2 text-sm text-film-danger flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {validationError}
                </p>
              )}
            </div>
          </div>

          {editableFields.map((field) => (
            <div key={field.key} className="bg-film-card border border-film-border rounded-xl p-6">
              <label className="block text-sm text-film-text-secondary mb-2">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={String(formData[field.key as keyof ShotVersion] ?? '')}
                  onChange={(e) => handleChange(field.key as keyof ShotVersion, e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-film-panel border border-film-border rounded-lg text-film-text-primary placeholder-film-text-muted focus:outline-none focus:ring-2 focus:ring-film-primary/30 focus:border-film-primary transition-colors resize-none"
                />
              ) : (
                <input
                  type={field.type}
                  value={String(formData[field.key as keyof ShotVersion] ?? '')}
                  onChange={(e) =>
                    handleChange(
                      field.key as keyof ShotVersion,
                      field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                    )
                  }
                  className="w-full px-4 py-3 bg-film-panel border border-film-border rounded-lg text-film-text-primary placeholder-film-text-muted focus:outline-none focus:ring-2 focus:ring-film-primary/30 focus:border-film-primary transition-colors"
                />
              )}
            </div>
          ))}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-film-card border border-film-border rounded-xl p-6 sticky top-24">
            <h3 className="text-lg font-semibold text-film-text-primary mb-4">保存设置</h3>

            <div className="mb-6">
              <label className="block text-sm text-film-text-secondary mb-2">
                <MessageSquare className="w-4 h-4 inline mr-1" />
                修改理由 <span className="text-film-danger">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请详细说明本次修改的原因..."
                rows={4}
                className="w-full px-4 py-3 bg-film-panel border border-film-border rounded-lg text-film-text-primary placeholder-film-text-muted focus:outline-none focus:ring-2 focus:ring-film-primary/30 focus:border-film-primary transition-colors resize-none"
              />
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMajorChange}
                  onChange={(e) => setIsMajorChange(e.target.checked)}
                  className="w-4 h-4 rounded border-film-border bg-film-panel text-film-primary focus:ring-film-primary"
                />
                <span className="text-sm text-film-text-primary">重大版本变更（主版本号+1）</span>
              </label>
            </div>

            {detectedChanges.length > 0 ? (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-film-text-primary mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-film-success" />
                  检测到 {detectedChanges.length} 处修改
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {detectedChanges.map((change, index) => (
                    <div
                      key={index}
                      className="p-3 bg-film-panel rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2 text-film-primary font-medium mb-1">
                        <span>{FIELD_LABELS[change.fieldName] || change.fieldName}</span>
                        <ArrowRight className="w-3 h-3 text-film-text-muted" />
                      </div>
                      <div className="text-xs space-y-1">
                        <p className="text-film-text-muted line-through decoration-red-500/50">
                          {change.oldValue || '(空)'}
                        </p>
                        <p className="text-film-success">
                          {change.newValue || '(空)'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-6 text-center py-4 text-film-text-muted text-sm">
                尚未检测到任何修改
              </div>
            )}

            <div className="p-4 bg-film-secondary/50 rounded-lg text-sm text-film-text-secondary">
              <p className="mb-2">
                <strong>保存后：</strong>
              </p>
              <ul className="space-y-1 text-xs">
                <li>• 将创建新版本，历史版本永不丢失</li>
                <li>• 所有修改字段将记录旧值和新值</li>
                <li>• 审计日志将记录本次操作</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
