import { Component } from 'react'
import { View, Text, Image, ScrollView, Input, Toast } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { connect } from 'react-redux'
import { RootState } from '../../store'
import { removeFromFavorites, toggleFavorite, updateFavoriteNote } from '../../store/reducers/favoritesReducer'
import { addToComparison } from '../../store/reducers/comparisonReducer'
import { DesignPlan, DesignStyle, BudgetRange } from '../../data/types'
import { styleNames, budgetRangeNames } from '../../data/mockData'
import './favorites.scss'

interface FavoritesProps {
  favoriteItems: { plan: DesignPlan; addedAt: number; note?: string }[];
  comparisonItems: DesignPlan[];
  removeFromFavorites: (planId: string) => void;
  toggleFavorite: (plan: DesignPlan, note?: string) => void;
  updateFavoriteNote: (planId: string, note: string) => void;
  addToComparison: (planId: string) => void;
}

interface FavoritesState {
  showNoteModal: boolean;
  currentNotePlanId: string | null;
  noteInput: string;
  currentNotePlan: DesignPlan | null;
}

class Favorites extends Component<FavoritesProps, FavoritesState> {
  state: FavoritesState = {
    showNoteModal: false,
    currentNotePlanId: null,
    noteInput: '',
    currentNotePlan: null
  };

  // 跳转到方案详情
  goToDetail = (planId: string) => {
    Taro.navigateTo({
      url: `/pages/detail/detail?id=${planId}`
    });
  };

  // 移除收藏
  handleRemoveFavorite = (plan: DesignPlan) => {
    Taro.showModal({
      title: '确认取消收藏',
      content: `确定要取消收藏"${plan.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          this.props.removeFromFavorites(plan.id);
          Taro.showToast({
            title: '已取消收藏',
            icon: 'success'
          });
        }
      }
    });
  };

  // 添加到对比
  handleAddToComparison = (plan: DesignPlan) => {
    const { comparisonItems, addToComparison } = this.props;
    
    const isInComparison = comparisonItems.some(item => item.id === plan.id);
    if (isInComparison) {
      Taro.showToast({
        title: '该方案已在对比列表中',
        icon: 'none'
      });
      return;
    }
    
    if (comparisonItems.length >= 2) {
      Taro.showModal({
        title: '对比列表已满',
        content: '对比列表最多只能添加2个方案，是否前往对比页面查看？',
        success: (res) => {
          if (res.confirm) {
            Taro.navigateTo({
              url: '/pages/compare/compare'
            });
          }
        }
      });
      return;
    }
    
    addToComparison(plan.id);
    Taro.showToast({
      title: '已添加到对比',
      icon: 'success'
    });
  };

  // 打开备注编辑
  handleOpenNoteModal = (plan: DesignPlan, currentNote?: string) => {
    this.setState({
      showNoteModal: true,
      currentNotePlanId: plan.id,
      currentNotePlan: plan,
      noteInput: currentNote || ''
    });
  };

  // 关闭备注编辑
  handleCloseNoteModal = () => {
    this.setState({
      showNoteModal: false,
      currentNotePlanId: null,
      currentNotePlan: null,
      noteInput: ''
    });
  };

  // 保存备注
  handleSaveNote = () => {
    const { currentNotePlanId, noteInput } = this.state;
    const { updateFavoriteNote } = this.props;
    
    if (currentNotePlanId) {
      updateFavoriteNote(currentNotePlanId, noteInput);
      Taro.showToast({
        title: '备注已保存',
        icon: 'success'
      });
    }
    
    this.handleCloseNoteModal();
  };

  // 格式化日期
  formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 渲染空状态
  renderEmptyState = () => {
    return (
      <View className="empty-container">
        <View className="empty-icon">
          <Text>❤️</Text>
        </View>
        <Text className="empty-title">暂无收藏方案</Text>
        <Text className="empty-desc">您可以在方案详情页点击收藏按钮来收藏喜欢的方案</Text>
        <View className="empty-btn" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
          <Text>去浏览方案</Text>
        </View>
      </View>
    );
  };

  // 渲染收藏列表
  renderFavoriteList = () => {
    const { favoriteItems } = this.props;
    
    const sortedItems = [...favoriteItems].sort((a, b) => b.addedAt - a.addedAt);

    return (
      <View className="favorites-list">
        {sortedItems.map((item, index) => (
          <View key={index} className="favorite-card-wrapper">
            <View className="favorite-card" onClick={() => this.goToDetail(item.plan.id)}>
              <View className="card-image">
                <Image className="plan-image" src={item.plan.mainImage} mode="aspectFill" />
                <View className="favorite-badge">
                  <Text>❤️</Text>
                </View>
              </View>
              
              <View className="card-info">
                <View className="card-header">
                  <Text className="plan-name">{item.plan.name}</Text>
                  <Text className="add-date">
                    {this.formatDate(item.addedAt)}
                  </Text>
                </View>
                
                <View className="plan-tags">
                  {item.plan.tags.slice(0, 3).map((tag, tagIndex) => (
                    <Text key={tagIndex} className="plan-tag">{tag}</Text>
                  ))}
                </View>
                
                <View className="plan-meta">
                  <Text className="meta-text">{styleNames[item.plan.style]}</Text>
                  <Text className="meta-text">·</Text>
                  <Text className="meta-text">{item.plan.area}平米</Text>
                </View>
                
                <View className="plan-budget">
                  <Text className="budget-label">预算:</Text>
                  <Text className="budget-value">¥{item.plan.totalBudget.toLocaleString()}</Text>
                </View>
                
                {item.note && (
                  <View className="plan-note">
                    <Text className="note-label">备注:</Text>
                    <Text className="note-text">{item.note}</Text>
                  </View>
                )}
              </View>
              
              <View className="card-actions">
                <View 
                  className="action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    this.handleOpenNoteModal(item.plan, item.note);
                  }}
                >
                  <Text className="action-icon">📝</Text>
                  <Text className="action-text">备注</Text>
                </View>
                <View 
                  className="action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    this.handleAddToComparison(item.plan);
                  }}
                >
                  <Text className="action-icon">📊</Text>
                  <Text className="action-text">对比</Text>
                </View>
                <View 
                  className="action-btn delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    this.handleRemoveFavorite(item.plan);
                  }}
                >
                  <Text className="action-icon">🗑️</Text>
                  <Text className="action-text">取消</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  render () {
    const { favoriteItems } = this.props;
    const { showNoteModal, noteInput } = this.state;

    return (
      <View className="favorites-page">
        {/* 页面头部 */}
        <View className="page-header">
          <View className="header-info">
            <Text className="header-title">我的收藏</Text>
            {favoriteItems.length > 0 && (
              <Text className="header-count">({favoriteItems.length})</Text>
            )}
          </View>
        </View>

        {/* 内容区域 */}
        <ScrollView className="content-scroll" scrollY>
          {favoriteItems.length === 0 ? (
            this.renderEmptyState()
          ) : (
            this.renderFavoriteList()
          )}
          <View className="bottom-space" />
        </ScrollView>

        {/* 备注编辑模态框 */}
        {showNoteModal && (
          <View className="modal-overlay" onClick={this.handleCloseNoteModal}>
            <View className="modal-content" onClick={(e) => e.stopPropagation()}>
              <View className="modal-header">
                <Text className="modal-title">编辑备注</Text>
              </View>
              <View className="note-modal">
                <View className="note-input-container">
                  <Input
                    className="note-input"
                    placeholder="请输入备注内容..."
                    value={noteInput}
                    onInput={(e) => this.setState({ noteInput: e.detail.value })}
                    maxlength={100}
                  />
                  <Text className="char-count">{noteInput.length}/100</Text>
                </View>
                <View className="modal-actions">
                  <View className="modal-btn secondary" onClick={this.handleCloseNoteModal}>
                    <Text>取消</Text>
                  </View>
                  <View className="modal-btn primary" onClick={this.handleSaveNote}>
                    <Text>保存</Text>
                  </View>
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
  favoriteItems: state.favorites.items,
  comparisonItems: state.comparison.items
});

const mapDispatchToProps = {
  removeFromFavorites,
  toggleFavorite,
  updateFavoriteNote,
  addToComparison
};

export default connect(mapStateToProps, mapDispatchToProps)(Favorites)
