import { useNavigate } from 'react-router-dom';
import { Header, EmptyState, Rating } from '../components/UI';
import { useAppStore } from '../store/appStore';
import { sampleReviews, feeders } from '../data/mockData';

const ReviewsPage = () => {
  const navigate = useNavigate();
  const { orders } = useAppStore();

  const allReviews = [
    ...sampleReviews,
    ...orders
      .filter((o) => o.review)
      .map((o) => o.review!),
  ];

  return (
    <div className="page-container" style={{ paddingBottom: 100 }}>
      <Header title="我的评价" />

      {allReviews.length === 0 ? (
        <EmptyState
          icon="📝"
          title="暂无评价"
          desc="完成服务后可以对喂养师进行评价"
          action={
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/orders')}
            >
              查看订单
            </button>
          }
        />
      ) : (
        allReviews.map((review) => {
          const feeder = feeders.find((f) => f.id === review.feederId);
          return (
            <div key={review.id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={
                    feeder?.avatar ||
                    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=pet%20care%20worker%20portrait&image_size=square'
                  }
                  alt={feeder?.name || '喂养师'}
                  className="avatar avatar-sm"
                />
                <div className="flex-1">
                  <p className="font-medium">{feeder?.name || '喂养师'}</p>
                  <p className="text-xs text-tertiary">{review.createTime}</p>
                </div>
              </div>

              <Rating value={review.rating} />

              <p className="text-sm mt-2">{review.content}</p>

              {review.photos.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {review.photos.slice(0, 3).map((photo, index) => (
                    <img
                      key={index}
                      src={photo}
                      alt={`评价图片${index + 1}`}
                      style={{ width: 80, height: 80, borderRadius: 8 }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default ReviewsPage;
