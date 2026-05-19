import React, { useState, useEffect } from 'react'

function CreateModal({ type, onClose, onCreate, callingSystems, oldEndpoints, newEndpoints }) {
  const [formData, setFormData] = useState({})

  useEffect(() => {
    const defaults = {
      'old-endpoint': { name: '', url: '', method: 'GET', description: '' },
      'new-endpoint': { name: '', url: '', method: 'GET', description: '', old_endpoint_id: '' },
      'calling-system': { name: '', owner: '', contact_info: '' },
      'compatibility-layer': { name: '', old_endpoint_id: '', new_endpoint_id: '', transformation_rules: '' },
      'traffic-batch': { name: '', calling_system_id: '', new_endpoint_id: '', traffic_percentage: 10 }
    }
    setFormData(defaults[type] || {})
  }, [type])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = () => {
    onCreate(type, formData)
  }

  const titles = {
    'old-endpoint': '登记旧端点',
    'new-endpoint': '登记新端点',
    'calling-system': '登记调用系统',
    'compatibility-layer': '配置兼容层',
    'traffic-batch': '创建切流批次'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{titles[type] || '创建'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {(type === 'old-endpoint' || type === 'new-endpoint') && (
          <>
            <div className="form-group">
              <label>名称</label>
              <input type="text" name="name" value={formData.name || ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>URL</label>
              <input type="text" name="url" value={formData.url || ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>方法</label>
              <select name="method" value={formData.method || 'GET'} onChange={handleChange}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea name="description" value={formData.description || ''} onChange={handleChange} />
            </div>
            {type === 'new-endpoint' && (
              <div className="form-group">
                <label>对应旧端点</label>
                <select name="old_endpoint_id" value={formData.old_endpoint_id || ''} onChange={handleChange}>
                  <option value="">请选择</option>
                  {oldEndpoints.map(ep => (
                    <option key={ep.id} value={ep.id}>{ep.name}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {type === 'calling-system' && (
          <>
            <div className="form-group">
              <label>系统名称</label>
              <input type="text" name="name" value={formData.name || ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>负责人</label>
              <input type="text" name="owner" value={formData.owner || ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>联系方式</label>
              <input type="text" name="contact_info" value={formData.contact_info || ''} onChange={handleChange} />
            </div>
          </>
        )}

        {type === 'compatibility-layer' && (
          <>
            <div className="form-group">
              <label>名称</label>
              <input type="text" name="name" value={formData.name || ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>旧端点</label>
              <select name="old_endpoint_id" value={formData.old_endpoint_id || ''} onChange={handleChange}>
                <option value="">请选择</option>
                {oldEndpoints.map(ep => (
                  <option key={ep.id} value={ep.id}>{ep.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>新端点</label>
              <select name="new_endpoint_id" value={formData.new_endpoint_id || ''} onChange={handleChange}>
                <option value="">请选择</option>
                {newEndpoints.map(ep => (
                  <option key={ep.id} value={ep.id}>{ep.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>转换规则（JSON）</label>
              <textarea name="transformation_rules" value={formData.transformation_rules || ''} onChange={handleChange} rows={4} />
            </div>
          </>
        )}

        {type === 'traffic-batch' && (
          <>
            <div className="form-group">
              <label>批次名称</label>
              <input type="text" name="name" value={formData.name || ''} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>调用系统</label>
              <select name="calling_system_id" value={formData.calling_system_id || ''} onChange={handleChange}>
                <option value="">请选择</option>
                {callingSystems.map(sys => (
                  <option key={sys.id} value={sys.id}>{sys.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>新端点</label>
              <select name="new_endpoint_id" value={formData.new_endpoint_id || ''} onChange={handleChange}>
                <option value="">请选择</option>
                {newEndpoints.map(ep => (
                  <option key={ep.id} value={ep.id}>{ep.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>切流比例 (%)</label>
              <input type="number" name="traffic_percentage" value={formData.traffic_percentage || 10} onChange={handleChange} min="0" max="100" />
            </div>
          </>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit}>确认创建</button>
        </div>
      </div>
    </div>
  )
}

export default CreateModal
