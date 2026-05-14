import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function FavoritesList() {
  const [favorites, setFavorites] = useState([]);
  const [documents, setDocuments] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [favRes, docRes] = await Promise.all([
      axios.get('/api/favorites'),
      axios.get('/api/documents')
    ]);
    setFavorites(favRes.data.data);
    
    const docMap = {};
    docRes.data.data.forEach(doc => {
      docMap[doc.id] = doc;
    });
    setDocuments(docMap);
  };

  const handleDelete = async (favoriteId) => {
    await axios.delete(`/api/favorites/${favoriteId}`);
    fetchData();
  };

  return (
    <div>
      <div className="card">
        <h2>示例收藏列表</h2>
        <div className="alert alert-info">
          收藏的参数示例可作为标准用例，从详情页可追溯到原始接口文档。
        </div>
      </div>

      <div className="card">
        {favorites.length === 0 ? (
          <div className="empty-state">暂无收藏，请在文档详情页添加收藏</div>
        ) : (
          favorites.map(fav => (
            <div key={fav.id} className="favorite-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4>{fav.note || documents[fav.document_id]?.name || '未命名收藏'}</h4>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                    <Link to={`/documents/${fav.document_id}`} className="back-link" style={{ fontSize: '0.875rem' }}>
                      🔗 查看关联文档
                    </Link>
                    <span className="execution-time">
                      收藏时间: {new Date(fav.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(fav.id)}
                >
                  删除
                </button>
              </div>
              <div className="favorite-params">
                <strong>示例参数:</strong><br />
                <pre style={{ marginTop: '0.5rem' }}>{JSON.stringify(fav.example_params, null, 2)}</pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FavoritesList;
