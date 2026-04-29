import { Component } from 'react'
import { View, Text, Image, ScrollView, Swiper, SwiperItem, Navigator, Button, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { connect } from 'react-redux'
import { RootState } from '../../store'
import { fetchAllPlans, setFilterStyle, setFilterBudget } from '../../store/reducers/plansReducer'
import { DesignPlan, DesignStyle, BudgetRange } from '../../data/types'
import { styleNames, budgetRangeNames } from '../../data/mockData'
import './index.scss'

interface IndexProps {
  plans: DesignPlan[];
  filteredPlans: DesignPlan[];
  filterStyle: DesignStyle | null;
  filterBudget: BudgetRange | null;
  loading: boolean;
  error: string | null;
  fetchAllPlans: () => void;
  setFilterStyle: (style: DesignStyle | null) => void;
  setFilterBudget: (budget: BudgetRange | null) => void;
}

interface IndexState {
  activeFilter: 'style' | 'budget' | 'all';
  searchText: string;
  showAllPlans: boolean;
}

class Index extends Component<IndexProps, IndexState> {
  state: IndexState = {
    activeFilter: 'all',
    searchText: '',
    showAllPlans: false
  };

  componentDidMount () {
    this.props.fetchAllPlans();
  }

  // 处理风格筛选
  handleStyleFilter = (style: DesignStyle | null) => {
    this.props.setFilterStyle(style);
    this.setState({ activeFilter: style ? 'style' : 'all' });
  };

  // 处理预算筛选
  handleBudgetFilter = (budget: BudgetRange | null) => {
    this.props.setFilterBudget(budget);
    this.setState({ activeFilter: budget ? 'budget' : 'all' });
  };

  // 处理搜索
  handleSearch = (e: any) => {
    this.setState({ searchText: e.detail.value });
  };

  // 跳转到方案详情
  goToDetail = (planId: string) => {
    Taro.navigateTo({
      url: `/pages/detail/detail?id=${planId}`
    });
  };

  // 跳转到预算计算器
  goToBudgetCalculator = () => {
    Taro.navigateTo({
      url: '/pages/budget-calculator/budget-calculator'
    }).catch((err) => {
      console.error('跳转失败:', err);
    });
  };

  // 查看更多/收起
  handleViewMore = () => {
    const { showAllPlans } = this.state;
    this.setState({ 
      showAllPlans: !showAllPlans
    });
    // 重置筛选条件
    this.props.setFilterStyle(null);
    this.props.setFilterBudget(null);
  };

  // 渲染轮播图
  renderSwiper = () => {
    const { filteredPlans } = this.props;
    const featuredPlans = filteredPlans.slice(0, 3);

    if (featuredPlans.length === 0) {
      return null;
    }

    return (
      <View className="swiper-container">
        <Swiper
          className="swiper"
          indicatorDots
          autoplay
          interval={3000}
          duration={500}
        >
          {featuredPlans.map(plan => (
            <SwiperItem key={plan.id}>
              <View className="swiper-item" onClick={() => this.goToDetail(plan.id)}>
                <Image className="swiper-image" src={plan.mainImage} mode="aspectFill" />
                <View className="swiper-overlay">
                  <Text className="swiper-title">{plan.name}</Text>
                  <Text className="swiper-subtitle">
                    {styleNames[plan.style]} · ¥{plan.totalBudget.toLocaleString()}
                  </Text>
                </View>
              </View>
            </SwiperItem>
          ))}
        </Swiper>
      </View>
    );
  };

  // 渲染筛选栏
  renderFilterBar = () => {
    const styles = Object.values(DesignStyle);
    const budgets = Object.values(BudgetRange);

    return (
      <View className="filter-section">
        <View className="filter-header">
          <Text className="filter-title">风格筛选</Text>
        </View>
        <ScrollView className="style-scroll" scrollX>
          <View className="style-list">
            <View
              className={`style-item ${!this.props.filterStyle ? 'active' : ''}`}
              onClick={() => this.handleStyleFilter(null)}
            >
              <Text>全部</Text>
            </View>
            {styles.map(style => (
              <View
                key={style}
                className={`style-item ${this.props.filterStyle === style ? 'active' : ''}`}
                onClick={() => this.handleStyleFilter(style)}
              >
                <Text>{styleNames[style]}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View className="filter-header mt-20">
          <Text className="filter-title">预算筛选</Text>
        </View>
        <ScrollView className="budget-scroll" scrollX>
          <View className="budget-list">
            <View
              className={`budget-item ${!this.props.filterBudget ? 'active' : ''}`}
              onClick={() => this.handleBudgetFilter(null)}
            >
              <Text>全部</Text>
            </View>
            {budgets.map(budget => (
              <View
                key={budget}
                className={`budget-item ${this.props.filterBudget === budget ? 'active' : ''}`}
                onClick={() => this.handleBudgetFilter(budget)}
              >
                <Text>{budgetRangeNames[budget]}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  // 渲染方案列表
  renderPlanList = () => {
    const { filteredPlans, loading, plans } = this.props;
    const { searchText, showAllPlans } = this.state;

    // 如果 showAllPlans 为 true，则显示所有方案
    let displayPlans = showAllPlans ? plans : filteredPlans;
    
    // 应用搜索过滤
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      displayPlans = displayPlans.filter(plan => {
        const styleName = styleNames[plan.style];
        const budgetName = budgetRangeNames[plan.budgetRange];
        return (
          plan.name.toLowerCase().includes(searchLower) || 
          plan.description.toLowerCase().includes(searchLower) ||
          plan.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
          styleName.toLowerCase().includes(searchLower) ||
          budgetName.toLowerCase().includes(searchLower)
        );
      });
    }

    if (loading) {
      return (
        <View className="loading-container">
          <Text className="loading-text">加载中...</Text>
        </View>
      );
    }

    if (displayPlans.length === 0) {
      return (
        <View className="empty-container">
          <Text className="empty-text">暂无符合条件的设计方案</Text>
        </View>
      );
    }

    return (
      <View className="plans-section">
        <View className="section-header">
        <Text className="section-title">设计方案 ({displayPlans.length})</Text>
      </View>
      <View className="plans-grid">
        {displayPlans.map(plan => (
          <View
            key={plan.id}
            className="plan-card"
            onClick={() => this.goToDetail(plan.id)}
          >
            <View className="plan-image-container">
              <Image className="plan-image" src={plan.mainImage} mode="aspectFill" />
              {plan.isFavorite && (
                <View className="favorite-badge">
                  <Text>❤️</Text>
                </View>
              )}
            </View>
            <View className="plan-info">
              <Text className="plan-name">{plan.name}</Text>
              <View className="plan-tags">
                {plan.tags.slice(0, 3).map((tag, index) => (
                  <Text key={index} className="plan-tag">{tag}</Text>
                ))}
              </View>
              <View className="plan-meta">
                <Text className="plan-style">{styleNames[plan.style]}</Text>
                <Text className="plan-area">{plan.area}㎡</Text>
                <Text className="plan-budget">¥{plan.totalBudget.toLocaleString()}</Text>
              </View>
              <View className="plan-stats">
                <Text className="stat-item">👁 {plan.viewCount}</Text>
                <Text className="stat-item">❤️ {plan.likeCount}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
    );
  };

  render () {
    return (
      <View className="index-page">
        {/* 顶部搜索栏 */}
        <View className="search-bar">
          <View className="search-input-container">
            <Text className="search-icon">🔍</Text>
            <Input
              className="search-input"
              placeholder="搜索设计方案、风格、预算..."
              value={this.state.searchText}
              onInput={this.handleSearch}
            />
          </View>
          <View className="budget-btn" onClick={this.goToBudgetCalculator}>
            <Text>预算</Text>
          </View>
        </View>

        <ScrollView className="content-scroll" scrollY>
          {/* 轮播图 */}
          {this.renderSwiper()}

          {/* 推荐标题 */}
          <View className="section-header">
            <Text className="section-title">{this.state.showAllPlans ? '全部方案' : '推荐方案'}</Text>
            <Text className="section-more" onClick={this.handleViewMore}>
              {this.state.showAllPlans ? '收起' : '查看更多'}
            </Text>
          </View>

          {/* 筛选栏 */}
          {this.renderFilterBar()}

          {/* 方案列表 */}
          {this.renderPlanList()}

          {/* 底部留白 */}
          <View className="bottom-space" />
        </ScrollView>
      </View>
    )
  }
}

const mapStateToProps = (state: RootState) => ({
  plans: state.plans.plans,
  filteredPlans: state.plans.filteredPlans,
  filterStyle: state.plans.filterStyle,
  filterBudget: state.plans.filterBudget,
  loading: state.plans.loading,
  error: state.plans.error
});

const mapDispatchToProps = {
  fetchAllPlans,
  setFilterStyle,
  setFilterBudget
};

export default connect(mapStateToProps, mapDispatchToProps)(Index)
