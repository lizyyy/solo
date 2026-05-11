import { useEffect, useState } from 'react';
import { AppState } from '../types';
import { appStateStorage } from '../storage';

interface Props {
  isFrozen: boolean;
  onToggle: (reason?: string) => void;
}

export default function FreezeControl({ isFrozen, onToggle }: Props) {
  const [state, setState] = useState<AppState>({ isFrozen: false });
  const [freezeReason, setFreezeReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setState(appStateStorage.get());
  }, [isFrozen]);

  const handleFreeze = () => {
    if (!freezeReason.trim()) {
      alert('请输入冻结原因');
      return;
    }
    onToggle(freezeReason);
    setShowConfirm(false);
    setFreezeReason('');
  };

  const handleUnfreeze = () => {
    if (!confirm('确定要解除发布冻结吗？解除后所有排期操作将恢复正常。')) return;
    onToggle();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>发布冻结控制</h1>
      </div>

      <div className={`freeze-panel ${state.isFrozen ? 'frozen' : ''}`}>
        <div className="freeze-status">
          <div className={`freeze-indicator ${state.isFrozen ? 'frozen' : ''}`}>
            {state.isFrozen ? '🔒 已冻结' : '🔓 未冻结'}
          </div>
        </div>

        {state.isFrozen ? (
          <div className="freeze-info">
            <h3>系统当前处于发布冻结状态</h3>
            <div className="freeze-details">
              <div><strong>冻结人：</strong>{state.frozenBy}</div>
              <div><strong>冻结时间：</strong>{state.frozenAt ? new Date(state.frozenAt).toLocaleString() : '-'}</div>
              <div><strong>冻结原因：</strong>{state.frozenReason}</div>
            </div>
            <div className="freeze-impact">
              <h4>📋 冻结期间的操作限制</h4>
              <ul>
                <li>✅ <strong>可以</strong>：查看屏幕、内容、排期列表和详情</li>
                <li>✅ <strong>可以</strong>：创建和发布<strong>紧急插播</strong>排期</li>
                <li>❌ <strong>禁止</strong>：新建/编辑/删除普通排期</li>
                <li>❌ <strong>禁止</strong>：审核通过/发布普通排期</li>
                <li>❌ <strong>禁止</strong>：新建/编辑/删除屏幕和内容档案</li>
                <li>❌ <strong>禁止</strong>：修改优先级规则</li>
              </ul>
            </div>
            <button className="primary" onClick={handleUnfreeze}>
              解除发布冻结
            </button>
          </div>
        ) : (
          <div className="freeze-info">
            <h3>设置发布冻结</h3>
            <p className="freeze-desc">
              发布冻结用于重要时刻（如节假日、重大活动）锁定排期，防止误操作。
              冻结期间仅允许创建紧急插播排期。
            </p>
            
            {!showConfirm ? (
              <button className="danger" onClick={() => setShowConfirm(true)}>
                🔒 开启发布冻结
              </button>
            ) : (
              <div className="freeze-confirm">
                <div className="form-row">
                  <label>冻结原因 *</label>
                  <input
                    value={freezeReason}
                    onChange={e => setFreezeReason(e.target.value)}
                    placeholder="如：春节期间发布锁定、重大活动保障等"
                  />
                </div>
                <div className="modal-actions">
                  <button onClick={() => setShowConfirm(false)}>取消</button>
                  <button className="danger" onClick={handleFreeze}>
                    确认冻结
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="info-box" style={{ marginTop: '24px' }}>
        <h3>典型使用场景</h3>
        <ol>
          <li><strong>节假日保障</strong>：春节、国庆等长假前冻结，避免假期出现排期混乱</li>
          <li><strong>重大活动</strong>：店庆、明星活动等重要活动期间锁定排期</li>
          <li><strong>版本发布</strong>：现场导视屏版本更新时，冻结排期避免同步混乱</li>
          <li><strong>问题排查</strong>：发现排期异常时临时冻结，定位问题后再恢复</li>
        </ol>
      </div>
    </div>
  );
}
