import React, { useState } from 'react';
import { Icons } from '../components/Icons';

interface SettingsPageProps {
  settings: any;
  onRefresh: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onRefresh }) => {
  const [localSettings, setLocalSettings] = useState(settings || {
    defaultAllergens: ['花生', '坚果', '海鲜', '牛奶', '鸡蛋', '小麦', '大豆'],
    expiryWarningDays: 3,
    defaultStorageSlots: 4,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    try {
      await window.electronAPI.saveSettings(localSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onRefresh();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('保存设置失败');
    }
  };

  const handleReset = async () => {
    if (confirm('确定要重置所有数据吗？这将清除所有菜谱、项目和设置，恢复为示例数据。')) {
      await window.electronAPI.resetApp();
      onRefresh();
      alert('数据已重置为示例数据');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>设置</h2>
            <p>配置应用偏好设置和默认值</p>
          </div>
          <div className="btn-group">
            {saved && <span style={{ color: 'var(--success-color)' }}>✓ 已保存</span>}
            <button className="btn btn-primary" onClick={handleSave}>
              <Icons.Check />
              保存设置
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="grid grid-cols-2" style={{ gap: '24px' }}>
          <div className="card">
            <div className="card-header">
              <h3>通用设置</h3>
            </div>
            <div className="card-body">
              <div className="input-group">
                <label>临期提醒天数</label>
                <input
                  type="number"
                  value={localSettings.expiryWarningDays}
                  onChange={e => setLocalSettings(prev => ({
                    ...prev,
                    expiryWarningDays: parseInt(e.target.value) || 3
                  }))}
                  min="1"
                  max="14"
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  食材或容器过期前多少天开始提醒
                </p>
              </div>

              <div className="input-group">
                <label>默认存储格位数</label>
                <input
                  type="number"
                  value={localSettings.defaultStorageSlots}
                  onChange={e => setLocalSettings(prev => ({
                    ...prev,
                    defaultStorageSlots: parseInt(e.target.value) || 4
                  }))}
                  min="1"
                  max="20"
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  新建项目时默认创建的存储格位数量
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>过敏原设置</h3>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                选择需要重点提醒的常见过敏原，当菜谱中含有这些食材时会显示高优先级警告。
              </p>

              <div className="checkbox-group">
                {['花生', '坚果', '海鲜', '牛奶', '鸡蛋', '小麦', '大豆', '鱼类', '贝类'].map(allergen => (
                  <label key={allergen} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={localSettings.defaultAllergens?.includes(allergen)}
                      onChange={e => {
                        const currentAllergens = localSettings.defaultAllergens || [];
                        if (e.target.checked) {
                          setLocalSettings(prev => ({
                            ...prev,
                            defaultAllergens: [...currentAllergens, allergen]
                          }));
                        } else {
                          setLocalSettings(prev => ({
                            ...prev,
                            defaultAllergens: currentAllergens.filter(a => a !== allergen)
                          }));
                        }
                      }}
                    />
                    <span>{allergen}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <h3>数据管理</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
              <div>
                <h4 style={{ marginBottom: '8px', fontWeight: 600 }}>导出数据</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  导出所有菜谱、项目和设置为JSON文件，用于备份或迁移。
                </p>
                <button className="btn btn-secondary">
                  <Icons.Download />
                  导出全部数据
                </button>
              </div>

              <div>
                <h4 style={{ marginBottom: '8px', fontWeight: 600 }}>导入数据</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  从JSON文件导入数据。注意：这将覆盖现有数据。
                </p>
                <button className="btn btn-secondary">
                  <Icons.Upload />
                  导入数据
                </button>
              </div>
            </div>

            <div className="divider" />

            <div>
              <h4 style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--danger-color)' }}>
                重置数据
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                清除所有用户数据，恢复为初始示例数据。此操作不可撤销！
              </p>
              <button className="btn btn-danger" onClick={handleReset}>
                <Icons.Trash />
                重置为示例数据
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <h3>关于</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
              <div>
                <h4 style={{ marginBottom: '8px', fontWeight: 600 }}>备餐小助手</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  版本 1.0.0
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  一款专为周末一次性备餐设计的本地桌面工具。
                  帮助您高效规划菜谱、计算采购量、安排备料顺序、管理存储。
                </p>
              </div>

              <div>
                <h4 style={{ marginBottom: '8px', fontWeight: 600 }}>主要功能</h4>
                <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '4px' }}>📖 菜谱管理 - 保存常用菜谱和备料步骤</li>
                  <li style={{ marginBottom: '4px' }}>🛒 智能采购 - 自动换算采购量，考虑已有食材</li>
                  <li style={{ marginBottom: '4px' }}>⏱️ 备料规划 - 合并可批量处理的步骤，计算耗时</li>
                  <li style={{ marginBottom: '4px' }}>🧊 存储管理 - 跟踪冷藏冷冻格位容量和保质期</li>
                  <li style={{ marginBottom: '4px' }}>⚠️ 风险提示 - 过敏原、临期、复热方式提醒</li>
                  <li>📤 多种导出 - Markdown、CSV、HTML 标签</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
