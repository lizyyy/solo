import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClipStore } from '@/store/clipStore';
import type { SourceType, ChangeType, UpdateClipRequest } from 'shared/types';
import { SOURCE_TYPE_CONFIG, CHANGE_TYPE_CONFIG } from 'shared/constants';
import SourceTag from '@/components/SourceTag';
import ChangeTypeBadge from '@/components/ChangeTypeBadge';
import {
  ArrowLeft,
  Save,
  Scissors,
  FileText,
  Music,
  AlertCircle,
  Info,
} from 'lucide-react';

const ClipForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = id && id !== 'new';
  const { currentClip, loading, fetchClip, createClip, updateClip } = useClipStore();

  const [formData, setFormData] = useState({
    title: '',
    guest: '',
    episode: '',
    duration: '',
    sourceType: 'edit_point' as SourceType,
    changeType: 'material_only' as ChangeType,
    editPointContent: '',
    adScriptContent: '',
    audioTrackBefore: '',
    audioTrackAfter: '',
    reason: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchClipCallback = useCallback(fetchClip, [fetchClip]);

  useEffect(() => {
    if (isEdit && id) {
      fetchClipCallback(id);
    }
  }, [isEdit, id, fetchClipCallback]);

  useEffect(() => {
    if (currentClip && isEdit) {
      setFormData(prev => ({
        ...prev,
        title: currentClip.title,
        guest: currentClip.guest,
        episode: currentClip.episode,
        duration: Math.floor(currentClip.duration / 60).toString(),
        editPointContent: currentClip.editPointContent || '',
        adScriptContent: currentClip.adScriptContent || '',
        audioTrackBefore: currentClip.audioTrackBefore || '',
        audioTrackAfter: currentClip.audioTrackAfter || '',
      }));
    }
  }, [currentClip, isEdit]);

  const sourceTypeOptions: { type: SourceType; disabled?: boolean; hint: string }[] = isEdit
    ? [
        { type: 'ad_script', disabled: !!currentClip?.adScriptContent, hint: '补录广告口播表' },
        { type: 'audio_track', disabled: false, hint: '记录原始音轨改动' },
        { type: 'edit_point', disabled: false, hint: '修改剪辑点内容' },
      ]
    : [{ type: 'edit_point', disabled: false, hint: '录入剪辑点' }];

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = '请输入标题';
    }
    if (!formData.guest.trim()) {
      newErrors.guest = '请输入嘉宾姓名';
    }
    if (!formData.episode.trim()) {
      newErrors.episode = '请输入播客期数';
    }
    if (!formData.duration.trim() || isNaN(Number(formData.duration))) {
      newErrors.duration = '请输入有效的时长（分钟）';
    }

    if (formData.sourceType === 'edit_point' && !formData.editPointContent.trim()) {
      newErrors.editPointContent = '请输入剪辑点内容';
    }
    if (formData.sourceType === 'ad_script' && !formData.adScriptContent.trim()) {
      newErrors.adScriptContent = '请输入广告口播表内容';
    }
    if (formData.sourceType === 'audio_track') {
      if (!formData.audioTrackAfter.trim()) {
        newErrors.audioTrackAfter = '请输入修改后的内容';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const duration = Number(formData.duration) * 60;

    if (isEdit && id) {
      const updateData: Record<string, unknown> = {
        changeType: formData.changeType,
        sourceType: formData.sourceType,
        reason: formData.reason || undefined,
      };

      if (formData.sourceType === 'edit_point') {
        updateData.editPointContent = formData.editPointContent;
        updateData.title = formData.title;
        updateData.guest = formData.guest;
        updateData.episode = formData.episode;
        updateData.duration = duration;
      } else if (formData.sourceType === 'ad_script') {
        updateData.adScriptContent = formData.adScriptContent;
      } else if (formData.sourceType === 'audio_track') {
        updateData.audioTrackBefore = formData.audioTrackBefore || undefined;
        updateData.audioTrackAfter = formData.audioTrackAfter;
      }

      const clip = await updateClip(id, updateData as unknown as UpdateClipRequest);
      if (clip) {
        navigate(`/clip/${id}`);
      }
    } else {
      const clip = await createClip({
        title: formData.title,
        guest: formData.guest,
        episode: formData.episode,
        duration,
        editPointContent: formData.editPointContent,
        operatorId: '',
      });
      if (clip) {
        navigate('/');
      }
    }
  };

  if (isEdit && loading && !currentClip) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-studio-border rounded w-1/4" />
          <div className="card p-6 space-y-4">
            <div className="h-4 bg-studio-border rounded w-full" />
            <div className="h-4 bg-studio-border rounded w-3/4" />
            <div className="h-20 bg-studio-border rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={() => navigate(isEdit ? `/clip/${id}` : '/')}
          className="p-2 hover:bg-studio-border rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-studio-muted" />
        </button>
        <div>
          <h1 className="font-serif text-2xl font-semibold text-slate-850">
            {isEdit ? '编辑片段' : '新建片段'}
          </h1>
          <p className="text-studio-muted">
            {isEdit
              ? '补录材料或修改内容，请明确标记变更类型'
              : '录入剪辑点信息，广告口播表可后续补录'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6">
          <h2 className="section-title">基本信息</h2>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-850 mb-1.5">
                标题 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`input-field ${errors.title ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="例如：第42期：AI时代的创意产业"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.title}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-850 mb-1.5">
                嘉宾 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`input-field ${errors.guest ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                value={formData.guest}
                onChange={e => setFormData({ ...formData, guest: e.target.value })}
                placeholder="嘉宾姓名"
              />
              {errors.guest && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.guest}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-850 mb-1.5">
                期数 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`input-field ${errors.episode ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                value={formData.episode}
                onChange={e => setFormData({ ...formData, episode: e.target.value })}
                placeholder="例如：EP42"
              />
              {errors.episode && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.episode}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-850 mb-1.5">
                时长（分钟） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className={`input-field ${errors.duration ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                value={formData.duration}
                onChange={e => setFormData({ ...formData, duration: e.target.value })}
                placeholder="30"
                min="1"
              />
              {errors.duration && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.duration}
                </p>
              )}
            </div>
          </div>
        </div>

        {isEdit && (
          <div className="card p-6">
            <h2 className="section-title">变更类型</h2>

            <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">请明确标记本次变更类型</p>
                <p className="text-blue-600">
                  区分"补材料"和"改结论"有助于制作人了解变更影响，避免上线清单与明细不一致。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-850 mb-2">
                  来源类型
                </label>
                <div className="space-y-2">
                  {sourceTypeOptions.map(option => {
                    const config = SOURCE_TYPE_CONFIG[option.type];
                    const isSelected = formData.sourceType === option.type;
                    const Icon = option.type === 'edit_point' ? Scissors : option.type === 'ad_script' ? FileText : Music;

                    return (
                      <label
                        key={option.type}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50'
                            : option.disabled
                            ? 'border-studio-border bg-studio-bg opacity-50 cursor-not-allowed'
                            : 'border-studio-border hover:border-amber-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="sourceType"
                          value={option.type}
                          checked={isSelected}
                          onChange={() => !option.disabled && setFormData({ ...formData, sourceType: option.type })}
                          disabled={option.disabled}
                          className="w-4 h-4 text-amber-700"
                        />
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-amber-700' : 'text-studio-muted'}`} />
                        <div>
                          <p className={`font-medium ${isSelected ? 'text-amber-700' : 'text-slate-850'}`}>
                            {config.label}
                          </p>
                          <p className="text-xs text-studio-muted">{option.hint}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-850 mb-2">
                  变更类型 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {(Object.keys(CHANGE_TYPE_CONFIG) as ChangeType[]).map(type => {
                    const config = CHANGE_TYPE_CONFIG[type];
                    const isSelected = formData.changeType === type;

                    return (
                      <label
                        key={type}
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-studio-border hover:border-amber-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="changeType"
                          value={type}
                          checked={isSelected}
                          onChange={() => setFormData({ ...formData, changeType: type })}
                          className="w-4 h-4 mt-1 text-amber-700"
                        />
                        <div>
                          <p className={`font-medium ${isSelected ? 'text-amber-700' : 'text-slate-850'}`}>
                            <ChangeTypeBadge type={type} />
                          </p>
                          <p className="text-xs text-studio-muted mt-1">
                            {config.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-850 mb-1.5">
                变更说明（可选）
              </label>
              <textarea
                className="textarea-field"
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                placeholder="简要说明本次变更的原因..."
                rows={2}
              />
            </div>
          </div>
        )}

        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            {formData.sourceType === 'edit_point' && (
              <><Scissors className="w-5 h-5 text-amber-700" /> 剪辑点内容</>
            )}
            {formData.sourceType === 'ad_script' && (
              <><FileText className="w-5 h-5 text-amber-700" /> 广告口播表</>
            )}
            {formData.sourceType === 'audio_track' && (
              <><Music className="w-5 h-5 text-amber-700" /> 原始音轨变更</>
            )}
            <SourceTag type={formData.sourceType} />
          </h2>

          {formData.sourceType === 'edit_point' && (
            <div>
              <label className="block text-sm font-medium text-slate-850 mb-1.5">
                剪辑点内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`textarea-field ${errors.editPointContent ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                value={formData.editPointContent}
                onChange={e => setFormData({ ...formData, editPointContent: e.target.value })}
                placeholder="00:05:20 - 00:12:45  嘉宾讨论XXX&#10;00:25:10 - 00:32:00  案例分析XXX"
                rows={6}
              />
              {errors.editPointContent && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.editPointContent}
                </p>
              )}
            </div>
          )}

          {formData.sourceType === 'ad_script' && (
            <div>
              <label className="block text-sm font-medium text-slate-850 mb-1.5">
                广告口播表内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`textarea-field ${errors.adScriptContent ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                value={formData.adScriptContent}
                onChange={e => setFormData({ ...formData, adScriptContent: e.target.value })}
                placeholder="【产品名】现在下单立享8折优惠，还有神秘赠品等你来拿！"
                rows={4}
              />
              {errors.adScriptContent && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.adScriptContent}
                </p>
              )}
            </div>
          )}

          {formData.sourceType === 'audio_track' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-850 mb-1.5">
                  变更前内容（可选，如已有则自动填充）
                </label>
                <textarea
                  className="textarea-field"
                  value={formData.audioTrackBefore}
                  onChange={e => setFormData({ ...formData, audioTrackBefore: e.target.value })}
                  placeholder="原始版本的内容描述..."
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-850 mb-1.5">
                  变更后内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  className={`textarea-field ${errors.audioTrackAfter ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                  value={formData.audioTrackAfter}
                  onChange={e => setFormData({ ...formData, audioTrackAfter: e.target.value })}
                  placeholder="修改后的内容描述..."
                  rows={3}
                />
                {errors.audioTrackAfter && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.audioTrackAfter}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-700 flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    音轨改动属于「改结论」类型，系统将自动保留前后版本对比，
                    确保上线清单和明细一致。请在变更说明中注明改动原因。
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/clip/${id}` : '/')}
            className="btn-ghost"
          >
            取消
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center gap-2"
            disabled={loading}
          >
            <Save className="w-4 h-4" />
            {loading ? '保存中...' : isEdit ? '保存变更' : '创建记录'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClipForm;
