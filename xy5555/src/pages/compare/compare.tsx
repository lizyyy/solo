import { Component } from 'react'
import { View, Text, Image, ScrollView, Button, Swiper, SwiperItem, Toast } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { connect } from 'react-redux'
import { RootState } from '../../store'
import { removeFromComparison, clearComparison } from '../../store/reducers/comparisonReducer'
import { DesignPlan, DesignStyle, BudgetRange } from '../../data/types'
import { styleNames, budgetRangeNames, spaceTypeNames } from '../../data/mockData'
import './compare.scss'

interface CompareProps {
  comparisonItems: DesignPlan[];
  removeFromComparison: (planId: string) => void;
  clearComparison: () => void;
}

interface CompareState {
  activeTab: 'overview' | 'furniture' | 'budget';
}

class Compare extends Component<CompareProps, CompareState> {
  state: CompareState = {
    activeTab: 'overview'
  };

  // 切换标签
  switchTab = (tab: 'overview' | 'furniture' | 'budget') => {
    this.setState({ activeTab: tab });
  };

  // 移除方案
  handleRemovePlan = (planId: string) => {
    this.props.removeFromComparison(planId);
    Taro.showToast({
      title: '已从对比中移除',
      icon: 'success'
    });
  };

  // 清空对比
  handleClearComparison = () => {
    Taro.showModal({
      title: '确认清空',
      content: '确定要清空所有对比方案吗？',
      success: (res) => {
        if (res.confirm) {
          this.props.clearComparison();
          Taro.showToast({
            title: '已清空对比列表',
            icon: 'success'
          });
        }
      }
    });
  };

  // 跳转到方案详情
  goToDetail = (planId: string) => {
    Taro.navigateTo({
      url: `/pages/detail/detail?id=${planId}`
    });
  };

  // 渲染空状态
  renderEmptyState = () => {
    return (
      <View className="empty-container">
        <View className="empty-icon">
          <Text>📋</Text>
        </View>
        <Text className="empty-title">暂无对比方案</Text>
        <Text className="empty-desc">您可以在方案详情页添加方案到对比列表</Text>
        <View className="empty-btn" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
          <Text>去浏览方案</Text>
        </View>
      </View>
    );
  };

  // 渲染方案概览对比
  renderOverviewComparison = () => {
    const { comparisonItems } = this.props;
    
    if (comparisonItems.length === 0) {
      return null;
    }

    return (
      <View className="comparison-section">
        {/* 方案卡片头部 */}
        <View className="plan-headers">
          {comparisonItems.map(plan => (
            <View key={plan.id} className="plan-header">
              <View className="plan-header-image" onClick={() => this.goToDetail(plan.id)}>
                <Image className="header-image" src={plan.mainImage} mode="aspectFill" />
              </View>
              <View className="plan-header-info">
                <Text className="plan-name">{plan.name}</Text>
                <View className="plan-tags">
                  {plan.tags.slice(0, 2).map((tag, index) => (
                    <Text key={index} className="plan-tag">{tag}</Text>
                  ))}
                </View>
              </View>
              <View className="remove-btn" onClick={() => this.handleRemovePlan(plan.id)}>
                <Text>✕</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 对比详情 */}
        <View className="comparison-details">
          {/* 设计风格 */}
          <View className="comparison-row">
            <View className="comparison-label">
              <Text>设计风格</Text>
            </View>
            {comparisonItems.map(plan => (
              <View key={plan.id} className="comparison-value">
                <Text className="value-text">{styleNames[plan.style]}</Text>
              </View>
            ))}
          </View>

          {/* 预算范围 */}
          <View className="comparison-row">
            <View className="comparison-label">
              <Text>预算范围</Text>
            </View>
            {comparisonItems.map(plan => (
              <View key={plan.id} className="comparison-value">
                <Text className="value-text">{budgetRangeNames[plan.budgetRange]}</Text>
              </View>
            ))}
          </View>

          {/* 总预算 */}
          <View className="comparison-row highlight">
            <View className="comparison-label">
              <Text>总预算</Text>
            </View>
            {comparisonItems.map(plan => (
              <View key={plan.id} className="comparison-value">
                <Text className="value-text highlight">¥{plan.totalBudget.toLocaleString()}</Text>
              </View>
            ))}
          </View>

          {/* 房屋面积 */}
          <View className="comparison-row">
            <View className="comparison-label">
              <Text>房屋面积</Text>
            </View>
            {comparisonItems.map(plan => (
              <View key={plan.id} className="comparison-value">
                <Text className="value-text">{plan.area} 平米</Text>
              </View>
            ))}
          </View>

          {/* 家具数量 */}
          <View className="comparison-row">
            <View className="comparison-label">
              <Text>家具数量</Text>
            </View>
            {comparisonItems.map(plan => (
              <View key={plan.id} className="comparison-value">
                <Text className="value-text">{plan.furnitureItems.length} 件</Text>
              </View>
            ))}
          </View>

          {/* 浏览量 */}
          <View className="comparison-row">
            <View className="comparison-label">
              <Text>浏览量</Text>
            </View>
            {comparisonItems.map(plan => (
              <View key={plan.id} className="comparison-value">
                <Text className="value-text">{plan.viewCount}</Text>
              </View>
            ))}
          </View>

          {/* 点赞数 */}
          <View className="comparison-row">
            <View className="comparison-label">
              <Text>点赞数</Text>
            </View>
            {comparisonItems.map(plan => (
              <View key={plan.id} className="comparison-value">
                <Text className="value-text">{plan.likeCount}</Text>
              </View>
            ))}
          </View>

          {/* 设计师 */}
          {comparisonItems.some(plan => plan.designer) && (
            <View className="comparison-row">
              <View className="comparison-label">
                <Text>设计师</Text>
              </View>
              {comparisonItems.map(plan => (
                <View key={plan.id} className="comparison-value">
                  <Text className="value-text">
                    {plan.designer ? plan.designer.name : '暂无'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  // 渲染家具对比
  renderFurnitureComparison = () => {
    const { comparisonItems } = this.props;
    
    if (comparisonItems.length === 0) {
      return null;
    }

    // 获取所有家具类型
    const allSpaceTypes = new Set<string>();
    comparisonItems.forEach(plan => {
      plan.furnitureItems.forEach(item => {
        allSpaceTypes.add(item.spaceType);
      });
    });

    return (
      <View className="furniture-section">
        {Array.from(allSpaceTypes).map(spaceType => (
          <View key={spaceType} className="space-group">
            <View className="space-header">
              <Text className="space-title">{spaceTypeNames[spaceType as keyof typeof spaceTypeNames] || spaceType}</Text>
            </View>
            
            {/* 按空间类型对比家具 */}
            <View className="furniture-comparison">
              {comparisonItems.map((plan, planIndex) => {
                const spaceFurniture = plan.furnitureItems.filter(
                  item => item.spaceType === spaceType
                );
                
                return (
                  <View key={plan.id} className="plan-furniture">
                    {spaceFurniture.length > 0 ? (
                      spaceFurniture.map((item, itemIndex) => (
                        <View key={itemIndex} className="furniture-item">
                          <Image className="furniture-image" src={item.image} mode="aspectFill" />
                          <View className="furniture-info">
                            <Text className="furniture-name">{item.name}</Text>
                            <Text className="furniture-price">¥{item.price.toLocaleString()}</Text>
                            {item.material && (
                              <Text className="furniture-material">{item.material}</Text>
                            )}
                          </View>
                        </View>
                      ))
                    ) : (
                      <View className="no-furniture">
                        <Text className="no-furniture-text">无此空间家具</Text>
                      </View>
                    )}
                    
                    {/* 汇总该方案在此空间的家具总价 */}
                    <View className="space-summary">
                      <Text className="summary-label">此空间总价:</Text>
                      <Text className="summary-value">
                        ¥{spaceFurniture.reduce((sum, item) => sum + item.price, 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* 所有家具汇总 */}
        <View className="total-summary">
          <View className="summary-row">
            <View className="summary-label">
              <Text>家具总价</Text>
            </View>
            {comparisonItems.map(plan => (
              <View key={plan.id} className="summary-value">
                <Text className="highlight">
                  ¥{plan.furnitureItems.reduce((sum, item) => sum + item.price, 0).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
          
          <View className="summary-row">
            <View className="summary-label">
              <Text>家具数量</Text>
            </View>
            {comparisonItems.map(plan => (
              <View key={plan.id} className="summary-value">
                <Text>{plan.furnitureItems.length} 件</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // 渲染预算对比
  renderBudgetComparison = () => {
    const { comparisonItems } = this.props;
    
    if (comparisonItems.length === 0) {
      return null;
    }

    // 计算预算明细比例
    const getBudgetBreakdown = (plan: DesignPlan) => {
      const total = plan.totalBudget;
      const furnitureTotal = plan.furnitureItems.reduce((sum, item) => sum + item.price, 0);
      const designFee = total * 0.1;
      const construction = total * 0.35;
      const materials = total * 0.25;
      const customFurniture = total * 0.2;
      const softDecoration = total * 0.1;

      return {
        designFee,
        construction,
        materials,
        customFurniture,
        softDecoration,
        furnitureTotal
      };
    };

    return (
      <View className="budget-section">
        {/* 总预算对比 */}
        <View className="total-budget-comparison">
          <View className="comparison-title">
            <Text>总预算对比</Text>
          </View>
          <View className="budget-bars">
            {comparisonItems.map(plan => (
              <View key={plan.id} className="budget-bar-container">
                <View className="bar-label">
                  <Text className="bar-name">{plan.name}</Text>
                </View>
                <View className="bar-wrapper">
                  <View 
                    className="bar-fill"
                    style={{ 
                      width: `${(plan.totalBudget / Math.max(...comparisonItems.map(p => p.totalBudget))) * 100}%` 
                    }}
                  />
                </View>
                <View className="bar-value">
                  <Text>¥{plan.totalBudget.toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 预算明细对比 */}
        <View className="budget-breakdown">
          <View className="comparison-title">
            <Text>预算明细对比</Text>
          </View>
          
          <View className="breakdown-table">
            <View className="breakdown-header">
              <View className="header-cell">
                <Text>费用类别</Text>
              </View>
              {comparisonItems.map(plan => (
                <View key={plan.id} className="header-cell">
                  <Text className="short-name">{plan.name.slice(0, 4)}</Text>
                </View>
              ))}
            </View>

            {[
              { key: 'designFee', label: '设计费', percentage: 10 },
              { key: 'construction', label: '硬装工程', percentage: 35 },
              { key: 'materials', label: '主材', percentage: 25 },
              { key: 'customFurniture', label: '定制家具', percentage: 20 },
              { key: 'softDecoration', label: '软装配饰', percentage: 10 }
            ].map(item => {
              return (
                <View key={item.key} className="breakdown-row">
                  <View className="breakdown-cell">
                    <Text className="cell-label">{item.label}</Text>
                    <Text className="cell-percentage">({item.percentage}%)</Text>
                  </View>
                  {comparisonItems.map(plan => {
                    const breakdown = getBudgetBreakdown(plan);
                    const amount = breakdown[item.key as keyof typeof breakdown];
                    return (
                      <View key={plan.id} className="breakdown-cell">
                        <Text className="cell-value">¥{Math.round(amount).toLocaleString()}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </View>

        {/* 性价比分析 */}
        <View className="value-analysis">
          <View className="comparison-title">
            <Text>性价比分析</Text>
          </View>
          
          <View className="analysis-items">
            <View className="analysis-item">
              <View className="analysis-label">
                <Text>每平米单价</Text>
              </View>
              {comparisonItems.map(plan => {
                const pricePerSqm = Math.round(plan.totalBudget / plan.area);
                return (
                  <View key={plan.id} className="analysis-value">
                    <Text>¥{pricePerSqm.toLocaleString()}/㎡</Text>
                  </View>
                );
              })}
            </View>

            <View className="analysis-item">
              <View className="analysis-label">
                <Text>每件家具均价</Text>
              </View>
              {comparisonItems.map(plan => {
                const avgFurniturePrice = plan.furnitureItems.length > 0 
                  ? Math.round(plan.furnitureItems.reduce((sum, item) => sum + item.price, 0) / plan.furnitureItems.length)
                  : 0;
                return (
                  <View key={plan.id} className="analysis-value">
                    <Text>¥{avgFurniturePrice.toLocaleString()}</Text>
                  </View>
                );
              })}
            </View>

            <View className="analysis-item">
              <View className="analysis-label">
                <Text>人气指数</Text>
              </View>
              {comparisonItems.map(plan => {
                const popularity = plan.viewCount + plan.likeCount * 10;
                return (
                  <View key={plan.id} className="analysis-value">
                    <Text>{popularity.toLocaleString()}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    );
  };

  render () {
    const { comparisonItems } = this.props;
    const { activeTab } = this.state;

    if (comparisonItems.length === 0) {
      return (
        <View className="compare-page">
          {this.renderEmptyState()}
        </View>
      );
    }

    return (
      <View className="compare-page">
        {/* 页面头部 */}
        <View className="page-header">
          <View className="header-info">
            <Text className="header-title">方案对比</Text>
            <Text className="header-count">({comparisonItems.length}/2)</Text>
          </View>
          <View className="clear-btn" onClick={this.handleClearComparison}>
            <Text>清空</Text>
          </View>
        </View>

        {/* 标签切换 */}
        <View className="tabs-container">
          <View
            className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => this.switchTab('overview')}
          >
            <Text>概览</Text>
          </View>
          <View
            className={`tab-item ${activeTab === 'furniture' ? 'active' : ''}`}
            onClick={() => this.switchTab('furniture')}
          >
            <Text>家具</Text>
          </View>
          <View
            className={`tab-item ${activeTab === 'budget' ? 'active' : ''}`}
            onClick={() => this.switchTab('budget')}
          >
            <Text>预算</Text>
          </View>
        </View>

        {/* 内容区域 */}
        <ScrollView className="content-scroll" scrollY>
          {activeTab === 'overview' && this.renderOverviewComparison()}
          {activeTab === 'furniture' && this.renderFurnitureComparison()}
          {activeTab === 'budget' && this.renderBudgetComparison()}
          <View className="bottom-space" />
        </ScrollView>
      </View>
    )
  }
}

const mapStateToProps = (state: RootState) => ({
  comparisonItems: state.comparison.items
});

const mapDispatchToProps = {
  removeFromComparison,
  clearComparison
};

export default connect(mapStateToProps, mapDispatchToProps)(Compare)
