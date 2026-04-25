import { Component } from 'react'
import { View, Text, Image, ScrollView, Swiper, SwiperItem, Button, Toast } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { connect } from 'react-redux'
import { RootState } from '../../store'
import { fetchPlanById, incrementLikeCount } from '../../store/reducers/plansReducer'
import { addToComparison, removeFromComparison } from '../../store/reducers/comparisonReducer'
import { toggleFavorite } from '../../store/reducers/favoritesReducer'
import { DesignPlan, DesignStyle, BudgetRange } from '../../data/types'
import { styleNames, budgetRangeNames, spaceTypeNames } from '../../data/mockData'
import './detail.scss'

interface DetailProps {
  currentPlan: DesignPlan | null;
  comparisonItems: DesignPlan[];
  favoriteItems: { plan: DesignPlan; addedAt: number; note?: string }[];
  loading: boolean;
  fetchPlanById: (id: string) => void;
  incrementLikeCount: (planId: string) => void;
  addToComparison: (planId: string) => void;
  removeFromComparison: (planId: string) => void;
  toggleFavorite: (plan: DesignPlan, note?: string) => void;
}

interface DetailState {
  planId: string | null;
  showShareModal: boolean;
  showBudgetModal: boolean;
  activeTab: 'info' | 'furniture' | 'designer';
  isInComparison: boolean;
  isFavorite: boolean;
}

class Detail extends Component<DetailProps, DetailState> {
  state: DetailState = {
    planId: null,
    showShareModal: false,
    showBudgetModal: false,
    activeTab: 'info',
    isInComparison: false,
    isFavorite: false
  };

  componentDidMount () {
    let id: string | null = null;
    
    // 尝试从 Taro router 获取参数
    const currentInstance = Taro.getCurrentInstance();
    if (currentInstance?.router?.params?.id) {
      id = currentInstance.router.params.id;
    } else if (this.$router?.params?.id) {
      id = this.$router.params.id;
    } else {
      // 从 URL hash 中解析参数（H5 环境）
      const hash = window.location.hash;
      const urlParams = new URLSearchParams(hash.split('?')[1] || '');
      id = urlParams.get('id');
      
      // 如果还是没有，从 URL path 中尝试获取
      if (!id) {
        const match = hash.match(/[?&]id=([^&]+)/);
        if (match) {
          id = match[1];
        }
      }
    }
    
    if (id) {
      this.setState({ planId: id });
      this.props.fetchPlanById(id);
    }
  }

  componentDidUpdate (prevProps: DetailProps) {
    // 检查对比状态
    if (this.props.comparisonItems !== prevProps.comparisonItems && this.props.currentPlan) {
      const isInComparison = this.props.comparisonItems.some(
        item => item.id === this.props.currentPlan?.id
      );
      if (isInComparison !== this.state.isInComparison) {
        this.setState({ isInComparison });
      }
    }

    // 检查收藏状态
    if (this.props.favoriteItems !== prevProps.favoriteItems && this.props.currentPlan) {
      const isFavorite = this.props.favoriteItems.some(
        item => item.plan.id === this.props.currentPlan?.id
      );
      if (isFavorite !== this.state.isFavorite) {
        this.setState({ isFavorite });
      }
    }
  }

  // 处理点赞
  handleLike = () => {
    const { currentPlan, incrementLikeCount } = this.props;
    if (currentPlan) {
      incrementLikeCount(currentPlan.id);
      Taro.showToast({
        title: '点赞成功',
        icon: 'success'
      });
    }
  };

  // 处理收藏切换
  handleToggleFavorite = () => {
    const { currentPlan, toggleFavorite } = this.props;
    if (currentPlan) {
      toggleFavorite(currentPlan);
      Taro.showToast({
        title: this.state.isFavorite ? '已取消收藏' : '已添加收藏',
        icon: 'success'
      });
    }
  };

  // 处理添加到对比
  handleAddToComparison = () => {
    const { currentPlan, addToComparison, comparisonItems } = this.props;
    
    if (!currentPlan) return;
    
    if (this.state.isInComparison) {
      // 从对比中移除
      this.props.removeFromComparison(currentPlan.id);
      Taro.showToast({
        title: '已从对比中移除',
        icon: 'success'
      });
    } else {
      // 检查对比列表是否已满
      if (comparisonItems.length >= 2) {
        Taro.showToast({
          title: '对比列表已满，最多对比2个方案',
          icon: 'none'
        });
        return;
      }
      
      // 添加到对比
      addToComparison(currentPlan.id);
      Taro.showToast({
        title: '已添加到对比',
        icon: 'success'
      });
    }
  };

  // 处理分享
  handleShare = () => {
    this.setState({ showShareModal: true });
  };

  // 关闭分享模态框
  closeShareModal = () => {
    this.setState({ showShareModal: false });
  };

  // 复制链接
  handleCopyLink = () => {
    const { currentPlan } = this.props;
    if (!currentPlan) return;

    const shareUrl = `${window.location.origin}/#/pages/detail/detail?id=${currentPlan.id}`;
    const shareText = `【${currentPlan.name}】25平米全屋定制方案，预算¥${currentPlan.totalBudget.toLocaleString()}`;
    
    // 尝试使用 Clipboard API
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          Taro.showToast({
            title: '链接已复制',
            icon: 'success'
          });
          this.closeShareModal();
        })
        .catch(() => {
          this.fallbackCopy(shareUrl);
        });
    } else {
      this.fallbackCopy(shareUrl);
    }
  };

  // 备用复制方法
  fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      Taro.showToast({
        title: '链接已复制',
        icon: 'success'
      });
      this.closeShareModal();
    } catch (err) {
      Taro.showToast({
        title: '复制失败，请手动复制',
        icon: 'none'
      });
    }
    document.body.removeChild(textArea);
  };

  // 生成海报
  handleGeneratePoster = () => {
    const { currentPlan } = this.props;
    if (!currentPlan) return;

    Taro.showLoading({
      title: '生成海报中...'
    });

    // 模拟生成海报的延迟
    setTimeout(() => {
      Taro.hideLoading();
      Taro.showModal({
        title: '海报已生成',
        content: `海报内容：\n\n【${currentPlan.name}】\n${styleNames[currentPlan.style]} · ${currentPlan.area}平米\n预算：¥${currentPlan.totalBudget.toLocaleString()}\n\n在实际项目中，这里会生成真实的海报图片。`,
        showCancel: false,
        confirmText: '确定'
      });
      this.closeShareModal();
    }, 1500);
  };

  // 分享到微信好友（H5 环境提示）
  handleShareToWechat = () => {
    Taro.showModal({
      title: '分享到微信',
      content: '请点击右上角菜单按钮，选择"发送给朋友"或"分享到朋友圈"',
      showCancel: false,
      confirmText: '知道了'
    });
  };

  // 预览图片
  handlePreviewImage = (current: string, urls: string[]) => {
    Taro.previewImage({
      current: current,
      urls: urls
    }).catch((err) => {
      console.log('预览图片失败，尝试使用浏览器原生方式:', err);
      // H5 环境下的备用方案
      window.open(current, '_blank');
    });
  };

  // 跳转到对比页面
  goToComparison = () => {
    Taro.navigateTo({
      url: '/pages/compare/compare'
    });
  };

  // 跳转到预算计算器
  goToBudgetCalculator = () => {
    Taro.navigateTo({
      url: '/pages/budget-calculator/budget-calculator'
    });
  };

  // 切换标签
  switchTab = (tab: 'info' | 'furniture' | 'designer') => {
    this.setState({ activeTab: tab });
  };

  // 渲染图片轮播
  renderImageSwiper = () => {
    const { currentPlan } = this.props;
    
    if (!currentPlan || currentPlan.images.length === 0) {
      return null;
    }

    return (
      <View className="image-swiper-container">
        <Swiper
          className="image-swiper"
          indicatorDots
          autoplay
          interval={3000}
          duration={500}
        >
          {currentPlan.images.map((image, index) => (
            <SwiperItem key={index}>
              <View 
                className="swiper-image-wrapper"
                onClick={() => this.handlePreviewImage(image, currentPlan.images)}
              >
                <Image className="swiper-image" src={image} mode="aspectFill" />
                <View className="preview-hint">
                  <Text>🔍 点击放大</Text>
                </View>
              </View>
            </SwiperItem>
          ))}
        </Swiper>
      </View>
    );
  };

  // 渲染基本信息
  renderInfoTab = () => {
    const { currentPlan } = this.props;
    
    if (!currentPlan) {
      return null;
    }

    return (
      <View className="tab-content">
        <View className="info-section">
          <View className="info-item">
            <Text className="info-label">设计风格</Text>
            <Text className="info-value">{styleNames[currentPlan.style]}</Text>
          </View>
          <View className="info-item">
            <Text className="info-label">预算范围</Text>
            <Text className="info-value">{budgetRangeNames[currentPlan.budgetRange]}</Text>
          </View>
          <View className="info-item">
            <Text className="info-label">房屋面积</Text>
            <Text className="info-value">{currentPlan.area} 平米</Text>
          </View>
          <View className="info-item">
            <Text className="info-label">总预算</Text>
            <Text className="info-value highlight">¥{currentPlan.totalBudget.toLocaleString()}</Text>
          </View>
        </View>

        <View className="description-section">
          <Text className="section-subtitle">方案描述</Text>
          <Text className="description-text">{currentPlan.description}</Text>
        </View>

        <View className="tags-section">
          <Text className="section-subtitle">方案标签</Text>
          <View className="tags-list">
            {currentPlan.tags.map((tag, index) => (
              <View key={index} className="tag-item">
                <Text>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="stats-section">
          <View className="stat-item">
            <Text className="stat-icon">👁</Text>
            <Text className="stat-value">{currentPlan.viewCount}</Text>
            <Text className="stat-label">浏览量</Text>
          </View>
          <View className="stat-item" onClick={this.handleLike}>
            <Text className="stat-icon">❤️</Text>
            <Text className="stat-value">{currentPlan.likeCount}</Text>
            <Text className="stat-label">点赞数</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-icon">💾</Text>
            <Text className="stat-value">{currentPlan.furnitureItems.length}</Text>
            <Text className="stat-label">家具项</Text>
          </View>
        </View>
      </View>
    );
  };

  // 渲染家具列表
  renderFurnitureTab = () => {
    const { currentPlan } = this.props;
    
    if (!currentPlan || currentPlan.furnitureItems.length === 0) {
      return (
        <View className="empty-tab">
          <Text className="empty-text">暂无家具信息</Text>
        </View>
      );
    }

    return (
      <View className="tab-content">
        {currentPlan.furnitureItems.map((item, index) => (
          <View key={index} className="furniture-card">
            <Image className="furniture-image" src={item.image} mode="aspectFill" />
            <View className="furniture-info">
              <Text className="furniture-name">{item.name}</Text>
              <Text className="furniture-desc">{item.description}</Text>
              <View className="furniture-meta">
                <View className="meta-item">
                  <Text className="meta-label">空间:</Text>
                  <Text className="meta-value">{spaceTypeNames[item.spaceType]}</Text>
                </View>
                {item.material && (
                  <View className="meta-item">
                    <Text className="meta-label">材质:</Text>
                    <Text className="meta-value">{item.material}</Text>
                  </View>
                )}
                {item.brand && (
                  <View className="meta-item">
                    <Text className="meta-label">品牌:</Text>
                    <Text className="meta-value">{item.brand}</Text>
                  </View>
                )}
              </View>
              <View className="furniture-price">
                <Text className="price-label">价格:</Text>
                <Text className="price-value">¥{item.price.toLocaleString()}</Text>
              </View>
              {item.dimensions && (
                <View className="dimensions">
                  <Text className="dimensions-label">尺寸:</Text>
                  <Text className="dimensions-value">
                    {item.dimensions.width}cm × {item.dimensions.height}cm × {item.dimensions.depth}cm
                  </Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  // 渲染设计师信息
  renderDesignerTab = () => {
    const { currentPlan } = this.props;
    
    if (!currentPlan || !currentPlan.designer) {
      return (
        <View className="empty-tab">
          <Text className="empty-text">暂无设计师信息</Text>
        </View>
      );
    }

    const { designer } = currentPlan;

    return (
      <View className="tab-content">
        <View className="designer-card">
          <View className="designer-header">
            <Image className="designer-avatar" src={designer.avatar} mode="aspectFill" />
            <View className="designer-info">
              <Text className="designer-name">{designer.name}</Text>
              <View className="designer-rating">
                <Text className="rating-star">⭐</Text>
                <Text className="rating-value">{designer.rating.toFixed(1)}</Text>
              </View>
            </View>
          </View>
          <View className="designer-actions">
            <View className="action-btn">
              <Text>咨询设计师</Text>
            </View>
            <View className="action-btn primary">
              <Text>查看更多作品</Text>
            </View>
          </View>
        </View>

        <View className="designer-about">
          <Text className="section-subtitle">设计师简介</Text>
          <Text className="about-text">
            {designer.name} 是一位资深室内设计师，拥有丰富的小户型设计经验。擅长将有限空间最大化利用，创造出既美观又实用的家居环境。设计作品曾多次获得行业奖项，深受客户好评。
          </Text>
        </View>

        <View className="designer-specialties">
          <Text className="section-subtitle">擅长风格</Text>
          <View className="specialties-list">
            <View className="specialty-item">
              <Text>极简风格</Text>
            </View>
            <View className="specialty-item">
              <Text>北欧风格</Text>
            </View>
            <View className="specialty-item">
              <Text>现代风格</Text>
            </View>
            <View className="specialty-item">
              <Text>日式风格</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  render () {
    const { currentPlan, loading } = this.props;
    const { showShareModal, activeTab, isInComparison, isFavorite } = this.state;

    if (loading && !currentPlan) {
      return (
        <View className="loading-container">
          <Text className="loading-text">加载中...</Text>
        </View>
      );
    }

    if (!currentPlan) {
      return (
        <View className="error-container">
          <Text className="error-text">方案不存在</Text>
        </View>
      );
    }

    return (
      <View className="detail-page">
        {/* 图片轮播 */}
        {this.renderImageSwiper()}

        {/* 方案标题 */}
        <View className="plan-header">
          <Text className="plan-name">{currentPlan.name}</Text>
          <View className="plan-meta">
            <Text className="meta-text">{styleNames[currentPlan.style]}</Text>
            <Text className="meta-text">·</Text>
            <Text className="meta-text">{currentPlan.area}平米</Text>
            <Text className="meta-text">·</Text>
            <Text className="meta-text highlight">¥{currentPlan.totalBudget.toLocaleString()}</Text>
          </View>
        </View>

        {/* 标签切换 */}
        <View className="tabs-container">
          <View
            className={`tab-item ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => this.switchTab('info')}
          >
            <Text>方案信息</Text>
          </View>
          <View
            className={`tab-item ${activeTab === 'furniture' ? 'active' : ''}`}
            onClick={() => this.switchTab('furniture')}
          >
            <Text>家具清单</Text>
          </View>
          <View
            className={`tab-item ${activeTab === 'designer' ? 'active' : ''}`}
            onClick={() => this.switchTab('designer')}
          >
            <Text>设计师</Text>
          </View>
        </View>

        {/* 标签内容 */}
        <ScrollView className="content-scroll" scrollY>
          {activeTab === 'info' && this.renderInfoTab()}
          {activeTab === 'furniture' && this.renderFurnitureTab()}
          {activeTab === 'designer' && this.renderDesignerTab()}
          <View className="bottom-space" />
        </ScrollView>

        {/* 底部操作栏 */}
        <View className="bottom-actions">
          <View className="action-group">
            <View className="action-icon" onClick={this.handleToggleFavorite}>
              <Text className={isFavorite ? 'active' : ''}>{isFavorite ? '❤️' : '🤍'}</Text>
              <Text className="action-label">收藏</Text>
            </View>
            <View className="action-icon" onClick={this.handleAddToComparison}>
              <Text className={isInComparison ? 'active' : ''}>{isInComparison ? '📊' : '📋'}</Text>
              <Text className="action-label">{isInComparison ? '已对比' : '对比'}</Text>
            </View>
            <View className="action-icon" onClick={this.handleShare}>
              <Text>📤</Text>
              <Text className="action-label">分享</Text>
            </View>
          </View>
          <View className="btn-group">
            <View className="btn-secondary" onClick={this.goToBudgetCalculator}>
              <Text>预算估算</Text>
            </View>
            <View className="btn-primary">
              <Text>立即咨询</Text>
            </View>
          </View>
        </View>

        {/* 分享模态框 */}
        {showShareModal && (
          <View className="modal-overlay" onClick={this.closeShareModal}>
            <View className="modal-content" onClick={(e) => e.stopPropagation()}>
              <View className="modal-header">
                <Text className="modal-title">分享方案</Text>
              </View>
              <View className="share-modal">
                <View className="share-options">
                  <View className="share-option" onClick={this.handleShareToWechat}>
                    <View className="share-icon">
                      <Text>💬</Text>
                    </View>
                    <Text className="share-label">微信好友</Text>
                  </View>
                  <View className="share-option" onClick={this.handleShareToWechat}>
                    <View className="share-icon">
                      <Text>🌐</Text>
                    </View>
                    <Text className="share-label">朋友圈</Text>
                  </View>
                  <View className="share-option" onClick={this.handleCopyLink}>
                    <View className="share-icon">
                      <Text>🔗</Text>
                    </View>
                    <Text className="share-label">复制链接</Text>
                  </View>
                  <View className="share-option" onClick={this.handleGeneratePoster}>
                    <View className="share-icon">
                      <Text>📷</Text>
                    </View>
                    <Text className="share-label">生成海报</Text>
                  </View>
                </View>
                <View className="cancel-btn" onClick={this.closeShareModal}>
                  <Text>取消</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }
}

const mapStateToProps = (state: RootState) => ({
  currentPlan: state.plans.currentPlan,
  comparisonItems: state.comparison.items,
  favoriteItems: state.favorites.items,
  loading: state.plans.loading
});

const mapDispatchToProps = {
  fetchPlanById,
  incrementLikeCount,
  addToComparison,
  removeFromComparison,
  toggleFavorite
};

export default connect(mapStateToProps, mapDispatchToProps)(Detail)
