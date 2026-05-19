import React, { useState } from 'react'

function EndpointManager({ oldEndpoints, newEndpoints, callingSystems, compatibilityLayers, onOpenModal, onRefresh }) {
  const [activeTab, setActiveTab] = useState('old')

  const updateEndpointStatus = async (id, status, type) => {
    try {
      await fetch(`/api/${type}-endpoints/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      onRefresh()
    } catch (error) {
      console.error('更新失败:', error)
    }
  }

  const updateLayerStatus = async (id, status) => {
    try {
      await fetch(`/api/compatibility-layers/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      onRefresh()
    } catch (error) {
      console.error('更新失败:', error)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>端点管理</h2>
      </div>
      
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'old' ? 'active' : ''}`}
          onClick={() => setActiveTab('old')}
        >
          旧端点 ({oldEndpoints.length})
        </button>
        <button 
          className={`tab ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          新端点 ({newEndpoints.length})
        </button>
        <button 
          className={`tab ${activeTab === 'systems' ? 'active' : ''}`}
          onClick={() => setActiveTab('systems')}
        >
          调用系统 ({callingSystems.length})
        </button>
        <button 
          className={`tab ${activeTab === 'layers' ? 'active' : ''}`}
          onClick={() => setActiveTab('layers')}
        >
          兼容层 ({compatibilityLayers.length})
        </button>
      </div>

      {activeTab === 'old' && (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <button className="btn btn-primary btn-sm" onClick={() => onOpenModal('old-endpoint')}>
              + 登记旧端点
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>URL</th>
                <th>方法</th>
                <th>描述</th>
                <th>状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {oldEndpoints.map(ep => (
                <tr key={ep.id}>
                  <td>{ep.name}</td>
                  <td>{ep.url}</td>
                  <td>{ep.method}</td>
                  <td>{ep.description || '-'}</td>
                  <td>
                    <span className={`status-badge status-${ep.status}`}>
                      {ep.status}
                    </span>
                  </td>
                  <td>{new Date(ep.created_at).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'new' && (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <button className="btn btn-primary btn-sm" onClick={() => onOpenModal('new-endpoint')}>
              + 登记新端点
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>URL</th>
                <th>方法</th>
                <th>对应旧端点</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {newEndpoints.map(ep => (
                <tr key={ep.id}>
                  <td>{ep.name}</td>
                  <td>{ep.url}</td>
                  <td>{ep.method}</td>
                  <td>{ep.old_name || '-'}</td>
                  <td>
                    <span className={`status-badge status-${ep.status}`}>
                      {ep.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {ep.status === 'pending' && (
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => updateEndpointStatus(ep.id, 'ready', 'new')}
                        >
                          标记就绪
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'systems' && (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <button className="btn btn-primary btn-sm" onClick={() => onOpenModal('calling-system')}>
              + 登记调用系统
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>系统名称</th>
                <th>负责人</th>
                <th>联系方式</th>
                <th>状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {callingSystems.map(sys => (
                <tr key={sys.id}>
                  <td>{sys.name}</td>
                  <td>{sys.owner || '-'}</td>
                  <td>{sys.contact_info || '-'}</td>
                  <td>
                    <span className={`status-badge status-${sys.status}`}>
                      {sys.status}
                    </span>
                  </td>
                  <td>{new Date(sys.created_at).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'layers' && (
        <div>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <button className="btn btn-primary btn-sm" onClick={() => onOpenModal('compatibility-layer')}>
              + 配置兼容层
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>旧端点</th>
                <th>新端点</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {compatibilityLayers.map(layer => (
                <tr key={layer.id}>
                  <td>{layer.name}</td>
                  <td>{layer.old_name || '-'}</td>
                  <td>{layer.new_name || '-'}</td>
                  <td>
                    <span className={`status-badge status-${layer.status}`}>
                      {layer.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {layer.status === 'pending' && (
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => updateLayerStatus(layer.id, 'active')}
                        >
                          激活
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default EndpointManager
