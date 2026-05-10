import { useState } from 'react';
import { createBook } from '../api';

function AddBookModal({ locations, tags, onClose, onSuccess, onError }) {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '',
    current_location_id: '',
    tag_ids: []
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.current_location_id) {
      onError('请填写书名和选择存放位置');
      return;
    }

    try {
      await createBook({
        ...formData,
        current_location_id: parseInt(formData.current_location_id)
      });
      onSuccess();
    } catch (err) {
      onError(err.response?.data?.error || '添加失败');
    }
  };

  const toggleTag = (tagId) => {
    const tagIds = formData.tag_ids;
    if (tagIds.includes(tagId)) {
      setFormData({ ...formData, tag_ids: tagIds.filter(id => id !== tagId) });
    } else {
      setFormData({ ...formData, tag_ids: [...tagIds, tagId] });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>➕ 新增图书</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>书名 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="请输入书名"
            />
          </div>
          <div className="form-group">
            <label>作者</label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              placeholder="请输入作者"
            />
          </div>
          <div className="form-group">
            <label>ISBN</label>
            <input
              type="text"
              value={formData.isbn}
              onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
              placeholder="请输入ISBN（选填）"
            />
          </div>
          <div className="form-group">
            <label>存放位置 *</label>
            <select
              value={formData.current_location_id}
              onChange={(e) => setFormData({ ...formData, current_location_id: e.target.value })}
            >
              <option value="">请选择漂流点</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>标签</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {tags.map(tag => (
                <span
                  key={tag.id}
                  className="tag"
                  style={{
                    cursor: 'pointer',
                    background: formData.tag_ids.includes(tag.id) ? '#667eea' : '#f0f0f0',
                    color: formData.tag_ids.includes(tag.id) ? 'white' : '#666'
                  }}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">添加</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddBookModal;
