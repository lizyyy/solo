import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const HomePage: React.FC = () => {
  const { historyRecords, currentRecommendation } = useAppContext();
  const recentRecords = historyRecords.slice(0, 3);

  const features = [
    {
      icon: '📏',
      title: '科学测量',
      description: '详细的测量向导，教你如何准确测量宠物的胸围、背长、颈围等关键数据。',
    },
    {
      icon: '👕',
      title: '尺码推荐',
      description: '基于品种体型规则表和衣服尺码表，为你的宠物推荐最合适的服装尺码。',
    },
    {
      icon: '🧵',
      title: '材质推荐',
      description: '根据季节、毛发类型和穿着场景，推荐最适合的服装材质和面料。',
    },
    {
      icon: '📋',
      title: '历史记录',
      description: '保存每只宠物的测量数据和推荐结果，方便下次选购时快速查看。',
    },
    {
      icon: '🎨',
      title: '分享卡片',
      description: '生成精美的推荐结果卡片，一键分享给好友或保存到相册。',
    },
    {
      icon: '⚙️',
      title: '灵活配置',
      description: '内置丰富的品种体型规则和尺码表，也可根据实际情况调整。',
    },
  ];

  const howItWorks = [
    {
      step: '第一步',
      icon: '🐕',
      title: '选择宠物类型',
      description: '选择是狗狗还是猫咪，然后选择品种或体型分类。',
    },
    {
      step: '第二步',
      icon: '📏',
      title: '输入测量数据',
      description: '按照测量向导的提示，输入胸围、背长、颈围等关键数据。',
    },
    {
      step: '第三步',
      icon: '🎯',
      title: '获取推荐结果',
      description: '系统根据数据智能分析，给出尺码和材质的专业推荐。',
    },
    {
      step: '第四步',
      icon: '📦',
      title: '保存并分享',
      description: '保存记录方便下次使用，还可以生成分享卡片与好友分享。',
    },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-500 to-accent-500 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative px-6 py-12 md:px-12 md:py-16">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-4xl">🐾</span>
              <span className="text-xl font-medium opacity-90">宠物服装导购助手</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              为你的毛孩子
              <br />
              找到最合适的衣服
            </h1>
            <p className="text-lg opacity-90 mb-8 max-w-lg">
              根据体型、毛发、季节和穿着场景，智能推荐有依据的服装尺码与材质。
              让第一次给宠物买衣服的你也能轻松选对。
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/measure"
                className="inline-flex items-center gap-2 bg-white text-primary-600 font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
              >
                <span>开始测量</span>
                <span>→</span>
              </Link>
              {currentRecommendation && (
                <Link
                  to="/result"
                  className="inline-flex items-center gap-2 bg-white bg-opacity-20 backdrop-blur text-white font-semibold py-3 px-8 rounded-xl border border-white border-opacity-30 hover:bg-opacity-30 transition-all duration-200"
                >
                  <span>查看上次结果</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <div
            key={index}
            className="card hover:shadow-md transition-shadow duration-200"
          >
            <div className="text-4xl mb-3">{feature.icon}</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{feature.title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">如何使用</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {howItWorks.map((item, index) => (
            <div key={index} className="relative">
              <div className="absolute -top-2 -left-2 bg-primary-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {item.step}
              </div>
              <div className="pt-6">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {recentRecords.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">最近记录</h2>
            <Link
              to="/history"
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              查看全部 →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentRecords.map((record) => (
              <Link
                key={record.id}
                to={`/history/${record.id}`}
                className="block p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{record.measurement.petType === 'dog' ? '🐕' : '🐱'}</span>
                  <div>
                    <h3 className="font-semibold text-gray-800">{record.petName}</h3>
                    <p className="text-xs text-gray-500">
                      {new Date(record.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="badge bg-primary-100 text-primary-700">
                    推荐尺码: {record.recommendation.recommendedSize}
                  </span>
                  <span className="badge bg-gray-200 text-gray-700">
                    {record.measurement.chest}cm / {record.measurement.length}cm
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="text-center py-8">
        <div className="card inline-block">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">准备好开始了吗？</h3>
          <Link
            to="/measure"
            className="btn-primary inline-flex items-center gap-2"
          >
            <span>开始为我的宠物测量</span>
            <span>→</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
