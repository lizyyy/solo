import React, { useState } from 'react';
import { Project, ContainerType, StoredContainer, StorageSlot } from '@shared/types';
import { Icons } from '../components/Icons';

interface StoragePageProps {
  projects: Project[];
  containerTypes: ContainerType[];
  onRefresh: () => void;
}

const StoragePage: React.FC<StoragePageProps> = ({ projects, containerTypes, onRefresh }) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const getAllContainers = (): StoredContainer[] => {
    if (selectedProject) {
      return selectedProject.storedContainers;
    }
    return projects.flatMap(p => p.storedContainers);
  };

  const getAllSlots = (): StorageSlot[] => {
    if (selectedProject) {
      return selectedProject.storageSlots;
    }
    const allSlots: StorageSlot[] = [];
    projects.forEach(p => {
      p.storageSlots.forEach(slot => {
        const existingSlot = allSlots.find(
          as => as.name === slot.name && as.storageType === slot.storageType
        );
        if (!existingSlot) {
          allSlots.push({ ...slot, currentContainers: [] });
        }
      });
    });
    return allSlots;
  };

  const containers = getAllContainers();
  const slots = getAllSlots();

  const expiringContainers = containers.filter(c => {
    const expiryDate = new Date(c.expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 3;
  });

  const frozenContainers = containers.filter(c => {
    const slot = slots.find(s => s.id === c.slotId);
    return slot?.storageType === 'frozen';
  });

  const refrigeratedContainers = containers.filter(c => {
    const slot = slots.find(s => s.id === c.slotId);
    return slot?.storageType === 'refrigerated';
  });

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>存储管理</h2>
            <p>管理冷藏和冷冻格位，跟踪分装容器的存储位置和保质期</p>
          </div>
          <div className="btn-group">
            <select 
              style={{ padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}
              value={selectedProject?.id || ''}
              onChange={e => {
                if (e.target.value === '') {
                  setSelectedProject(null);
                } else {
                  const project = projects.find(p => p.id === e.target.value);
                  setSelectedProject(project || null);
                }
              }}
            >
              <option value="">全部项目</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={onRefresh}>
              <Icons.Refresh />
              刷新
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-title">总容器数</div>
            <div className="stat-card-value">{containers.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">冷藏</div>
            <div className="stat-card-value success">{refrigeratedContainers.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">冷冻</div>
            <div className="stat-card-value primary">{frozenContainers.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">临期提醒</div>
            <div className={`stat-card-value ${expiringContainers.length > 0 ? 'warning' : 'success'}`}>
              {expiringContainers.length}
            </div>
          </div>
        </div>

        {expiringContainers.length > 0 && (
          <div className="alert alert-warning">
            <div className="alert-title">⚠️ 临期提醒</div>
            <div className="alert-message">
              有 {expiringContainers.length} 个容器即将过期，请尽快食用：
              {expiringContainers.map(c => c.recipeName).join('、')}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2" style={{ gap: '24px' }}>
          <div className="card">
            <div className="card-header">
              <h3>
                <Icons.Thermometer /> 冷藏格位
              </h3>
            </div>
            <div className="card-body">
              <div className="storage-grid">
                {slots.filter(s => s.storageType === 'refrigerated').map(slot => {
                  const used = slot.currentContainers.length;
                  const total = slot.maxCapacity;
                  const percentage = (used / total) * 100;

                  return (
                    <div key={slot.id} className="storage-slot refrigerated">
                      <div className="storage-slot-header">
                        <span>{slot.name}</span>
                        <span className="storage-slot-capacity">
                          {used}/{total}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-bar-fill" 
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: percentage > 80 ? 'var(--warning-color)' : 'var(--success-color)'
                          }}
                        />
                      </div>
                      {slot.currentContainers.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {slot.currentContainers.map(container => (
                            <div 
                              key={container.id} 
                              className={`storage-container ${
                                expiringContainers.some(c => c.id === container.id) ? 'expiring' : ''
                              }`}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 500 }}>{container.recipeName}</span>
                                <span className="badge badge-secondary">{container.portionCount}份</span>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                有效期至: {container.expiryDate}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'var(--text-muted)',
                          textAlign: 'center',
                          padding: '16px'
                        }}>
                          空位可用
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>
                <Icons.Snowflake /> 冷冻格位
              </h3>
            </div>
            <div className="card-body">
              <div className="storage-grid">
                {slots.filter(s => s.storageType === 'frozen').map(slot => {
                  const used = slot.currentContainers.length;
                  const total = slot.maxCapacity;
                  const percentage = (used / total) * 100;

                  return (
                    <div key={slot.id} className="storage-slot frozen">
                      <div className="storage-slot-header">
                        <span>{slot.name}</span>
                        <span className="storage-slot-capacity">
                          {used}/{total}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-bar-fill" 
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: percentage > 80 ? 'var(--warning-color)' : 'var(--primary-color)'
                          }}
                        />
                      </div>
                      {slot.currentContainers.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {slot.currentContainers.map(container => (
                            <div 
                              key={container.id} 
                              className={`storage-container ${
                                expiringContainers.some(c => c.id === container.id) ? 'expiring' : ''
                              }`}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 500 }}>{container.recipeName}</span>
                                <span className="badge badge-secondary">{container.portionCount}份</span>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                有效期至: {container.expiryDate}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'var(--text-muted)',
                          textAlign: 'center',
                          padding: '16px'
                        }}>
                          空位可用
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {containerTypes.length > 0 && (
          <div className="card" style={{ marginTop: '24px' }}>
            <div className="card-header">
              <h3>可用容器类型</h3>
            </div>
            <div className="card-body">
              <table className="table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>容量</th>
                    <th>是否可堆叠</th>
                    <th>最大堆叠高度</th>
                  </tr>
                </thead>
                <tbody>
                  {containerTypes.map(type => (
                    <tr key={type.id}>
                      <td style={{ fontWeight: 500 }}>{type.name}</td>
                      <td>{type.capacity} {type.capacityUnit}</td>
                      <td>
                        {type.isStackable ? (
                          <span className="badge badge-success">是</span>
                        ) : (
                          <span className="badge badge-secondary">否</span>
                        )}
                      </td>
                      <td>{type.isStackable ? `${type.maxStackHeight} 层` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoragePage;
