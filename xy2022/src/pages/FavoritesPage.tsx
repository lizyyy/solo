import { useNavigate } from 'react-router-dom';
import { Header, EmptyState, Rating, Tag } from '../components/UI';
import { useAppStore } from '../store/appStore';
import { feeders } from '../data/mockData';

const FavoritesPage = () => {
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useAppStore();

  const favoriteFeeders = feeders.filter((f) => favorites.includes(f.id));

  const serviceTypeNameMap: Record<string, string> = {
    feeding: '上门喂狗',
    walking: '上门遛狗',
    boarding: '寄养服务',
    bathing: '洗澡服务',
  };

  return (
    <div className="page-container" style={{ paddingBottom: 100 }}>
      <Header title="我的收藏" />

      {favoriteFeeders.length === 0 ? (
        <EmptyState
          icon="❤️"
          title="暂无收藏的喂养师"
          desc="收藏喜欢的喂养师，方便下次预约"
          action={
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/')}
            >
              去发现
            </button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-secondary px-5 py-3">
            共收藏 {favoriteFeeders.length} 位喂养师
          </p>
          {favoriteFeeders.map((feeder) => (
            <div key={feeder.id} className="card" style={{ cursor: 'pointer' }}>
              <div className="flex gap-3">
                <div className="avatar-wrap relative">
                  <img
                    src={feeder.avatar}
                    alt={feeder.name}
                    className="avatar avatar-lg"
                  />
                  <span
                    className={`status-dot ${feeder.available ? '' : 'offline'}`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{feeder.name}</span>
                      <span className="text-xs text-secondary">
                        {feeder.experience}年经验
                      </span>
                    </div>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(feeder.id);
                      }}
                      style={{ fontSize: 20, cursor: 'pointer' }}
                    >
                      ❤️
                    </span>
                  </div>

                  <Rating value={feeder.rating} count={feeder.reviewCount} />

                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-sm text-secondary">
                      📍 {feeder.distance}km
                    </span>
                    <span className="text-sm text-secondary">
                      ✅ 完成{feeder.completedOrders}单
                    </span>
                  </div>

                  <div className="flex gap-2 mt-2">
                    {feeder.services.map((sid) => (
                      <Tag key={sid} variant="primary">
                        {serviceTypeNameMap[sid] || sid}
                      </Tag>
                    ))}
                    {!feeder.available && <Tag variant="default">休息中</Tag>}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  className="btn btn-secondary btn-sm flex-1"
                  onClick={() => navigate('/booking')}
                >
                  立即预约
                </button>
                <button
                  className="btn btn-outline btn-sm flex-1"
                  onClick={() => toggleFavorite(feeder.id)}
                >
                  取消收藏
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default FavoritesPage;
