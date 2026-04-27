import { Component } from 'react'
import { View, Text, Image, ScrollView, Switch, Toast } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { connect } from 'react-redux'
import { RootState } from '../../store'
import { updatePreferences } from '../../store/reducers/userReducer'
import { clearComparison } from '../../store/reducers/comparisonReducer'
import { User, UserPreferences, DesignStyle, BudgetRange, SpaceType } from '../../data/types'
import { styleNames, budgetRangeNames, spaceTypeNames } from '../../data/mockData'
import './profile.scss'

interface ProfileProps {
  user: User | null;
  favoriteItems: { plan: any; addedAt: number; note?: string }[];
  comparisonItems: any[];
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  clearComparison: () => void;
}

interface ProfileState {
  showStyleModal: boolean;
  showBudgetModal: boolean;
  showSpaceModal: boolean;
  selectedStyles: DesignStyle[];
  selectedBudget: BudgetRange;
  selectedSpaces: SpaceType[];
  notificationsEnabled: boolean;
  darkModeEnabled: boolean;
}

class Profile extends Component<ProfileProps, ProfileState> {
  state: ProfileState = {
    showStyleModal: false,
    showBudgetModal: false,
    showSpaceModal: false,
    selectedStyles: [],
    selectedBudget: BudgetRange.MEDIUM,
    selectedSpaces: [],
    notificationsEnabled: true,
    darkModeEnabled: false
  };

  componentDidMount () {
    const { user } = this.props;
    
    // 从 localStorage 读取设置
    const savedNotifications = localStorage.getItem('notificationsEnabled');
    const savedDarkMode = localStorage.getItem('darkModeEnabled');
    
    const initialState: Partial<ProfileState> = {};
    
    if (savedNotifications !== null) {
      initialState.notificationsEnabled = savedNotifications === 'true';
    }
    
    if (savedDarkMode !== null) {
      initialState.darkModeEnabled = savedDarkMode === 'true';
      // 应用深色模式
      if (initialState.darkModeEnabled) {
        this.applyDarkMode(true);
      }
    }
    
    if (user) {
      initialState.selectedStyles = [...user.preferences.preferredStyles];
      initialState.selectedBudget = user.preferences.budgetRange;
      initialState.selectedSpaces = [...user.preferences.spacePriorities];
    }
    
    if (Object.keys(initialState).length > 0) {
      this.setState(initialState as ProfileState);
    }
  }

  componentDidUpdate (prevProps: ProfileProps) {
    const { user } = this.props;
    if (user && !prevProps.user) {
      this.setState({
        selectedStyles: [...user.preferences.preferredStyles],
        selectedBudget: user.preferences.budgetRange,
        selectedSpaces: [...user.preferences.spacePriorities]
      });
    }
  }

  // 切换消息通知
  toggleNotifications = (e: any) => {
    const enabled = e.detail.value;
    this.setState({ notificationsEnabled: enabled });
    localStorage.setItem('notificationsEnabled', String(enabled));
    
    Taro.showToast({
      title: enabled ? '消息通知已开启' : '消息通知已关闭',
      icon: 'success'
    });
  };

  // 切换深色模式
  toggleDarkMode = (e: any) => {
    const enabled = e.detail.value;
    this.setState({ darkModeEnabled: enabled });
    localStorage.setItem('darkModeEnabled', String(enabled));
    
    // 应用深色模式
    this.applyDarkMode(enabled);
    
    Taro.showToast({
      title: enabled ? '深色模式已开启' : '深色模式已关闭',
      icon: 'success'
    });
  };

  // 应用深色模式
  applyDarkMode = (enabled: boolean) => {
    if (enabled) {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark-mode');
    }
  };

  goToFavorites = () => {
    Taro.switchTab({
      url: '/pages/favorites/favorites'
    });
  };

  goToComparison = () => {
    Taro.navigateTo({
      url: '/pages/compare/compare'
    });
  };

  goToBudgetCalculator = () => {
    Taro.navigateTo({
      url: '/pages/budget-calculator/budget-calculator'
    });
  };

  openStyleModal = () => {
    const { user } = this.props;
    if (user) {
      this.setState({
        showStyleModal: true,
        selectedStyles: [...user.preferences.preferredStyles]
      });
    }
  };

  closeStyleModal = () => {
    this.setState({ showStyleModal: false });
  };

  toggleStyle = (style: DesignStyle) => {
    const { selectedStyles } = this.state;
    const index = selectedStyles.indexOf(style);
    const newStyles = [...selectedStyles];
    if (index > -1) {
      newStyles.splice(index, 1);
    } else {
      newStyles.push(style);
    }
    this.setState({ selectedStyles: newStyles });
  };

  saveStylePreferences = () => {
    const { selectedStyles } = this.state;
    const { updatePreferences } = this.props;
    
    if (selectedStyles.length === 0) {
      Taro.showToast({
        title: '请至少选择一种风格',
        icon: 'none'
      });
      return;
    }
    
    updatePreferences({
      preferredStyles: selectedStyles
    });
    
    Taro.showToast({
      title: '偏好已更新',
      icon: 'success'
    });
    
    this.closeStyleModal();
  };

  openBudgetModal = () => {
    const { user } = this.props;
    if (user) {
      this.setState({
        showBudgetModal: true,
        selectedBudget: user.preferences.budgetRange
      });
    }
  };

  closeBudgetModal = () => {
    this.setState({ showBudgetModal: false });
  };

  selectBudget = (budget: BudgetRange) => {
    this.setState({ selectedBudget: budget });
  };

  saveBudgetPreferences = () => {
    const { selectedBudget } = this.state;
    const { updatePreferences } = this.props;
    
    updatePreferences({
      budgetRange: selectedBudget
    });
    
    Taro.showToast({
      title: '偏好已更新',
      icon: 'success'
    });
    
    this.closeBudgetModal();
  };

  openSpaceModal = () => {
    const { user } = this.props;
    if (user) {
      this.setState({
        showSpaceModal: true,
        selectedSpaces: [...user.preferences.spacePriorities]
      });
    }
  };

  closeSpaceModal = () => {
    this.setState({ showSpaceModal: false });
  };

  toggleSpace = (space: SpaceType) => {
    const { selectedSpaces } = this.state;
    const index = selectedSpaces.indexOf(space);
    const newSpaces = [...selectedSpaces];
    if (index > -1) {
      newSpaces.splice(index, 1);
    } else {
      newSpaces.push(space);
    }
    this.setState({ selectedSpaces: newSpaces });
  };

  saveSpacePreferences = () => {
    const { selectedSpaces } = this.state;
    const { updatePreferences } = this.props;
    
    if (selectedSpaces.length === 0) {
      Taro.showToast({
        title: '请至少选择一个空间',
        icon: 'none'
      });
      return;
    }
    
    updatePreferences({
      spacePriorities: selectedSpaces
    });
    
    Taro.showToast({
      title: '偏好已更新',
      icon: 'success'
    });
    
    this.closeSpaceModal();
  };

  renderUserCard = () => {
    const { user } = this.props;
    
    if (!user) {
      return (
        <View className="user-card">
          <View className="user-info">
            <View className="user-avatar placeholder">
              <Text>👤</Text>
            </View>
            <View className="user-details">
              <Text className="user-name">加载中...</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View className="user-card">
        <View className="user-info">
          <Image className="user-avatar" src={user.avatar} mode="aspectFill" />
          <View className="user-details">
            <Text className="user-name">{user.name}</Text>
            <View className="user-meta">
              <Text className="meta-text">
                偏好风格: {user.preferences.preferredStyles.map(s => styleNames[s]).join('、')}
              </Text>
            </View>
          </View>
        </View>
        <View className="user-stats">
          <View className="stat-item" onClick={this.goToFavorites}>
            <Text className="stat-value">{this.props.favoriteItems.length}</Text>
            <Text className="stat-label">收藏</Text>
          </View>
          <View className="stat-item" onClick={this.goToComparison}>
            <Text className="stat-value">{this.props.comparisonItems.length}</Text>
            <Text className="stat-label">对比</Text>
          </View>
        </View>
      </View>
    );
  };

  renderPreferencesSection = () => {
    const { user } = this.props;
    const { showStyleModal, showBudgetModal, showSpaceModal, selectedStyles, selectedBudget, selectedSpaces } = this.state;

    return (
      <View className="preferences-section">
        <View className="section-header">
          <Text className="section-title">我的偏好</Text>
        </View>

        <View className="preference-item" onClick={this.openStyleModal}>
          <View className="preference-info">
            <Text className="preference-icon">🎨</Text>
            <View className="preference-details">
              <Text className="preference-label">偏好风格</Text>
              <Text className="preference-value">
                {selectedStyles.length > 0 
                  ? selectedStyles.map(s => styleNames[s]).join('、')
                  : '未设置'}
              </Text>
            </View>
          </View>
          <Text className="arrow">›</Text>
        </View>

        <View className="preference-item" onClick={this.openBudgetModal}>
          <View className="preference-info">
            <Text className="preference-icon">💰</Text>
            <View className="preference-details">
              <Text className="preference-label">预算范围</Text>
              <Text className="preference-value">{budgetRangeNames[selectedBudget]}</Text>
            </View>
          </View>
          <Text className="arrow">›</Text>
        </View>

        <View className="preference-item" onClick={this.openSpaceModal}>
          <View className="preference-info">
            <Text className="preference-icon">🏠</Text>
            <View className="preference-details">
              <Text className="preference-label">空间优先级</Text>
              <Text className="preference-value">
                {selectedSpaces.length > 0 
                  ? selectedSpaces.map(s => spaceTypeNames[s]).join('、')
                  : '未设置'}
              </Text>
            </View>
          </View>
          <Text className="arrow">›</Text>
        </View>
      </View>
    );
  };

  renderToolsSection = () => {
    return (
      <View className="tools-section">
        <View className="section-header">
          <Text className="section-title">实用工具</Text>
        </View>

        <View className="tools-grid">
          <View className="tool-item" onClick={this.goToBudgetCalculator}>
            <View className="tool-icon">
              <Text>🧮</Text>
            </View>
            <Text className="tool-label">预算计算器</Text>
          </View>

          <View className="tool-item">
            <View className="tool-icon">
              <Text>🎯</Text>
            </View>
            <Text className="tool-label">智能推荐</Text>
          </View>

          <View className="tool-item">
            <View className="tool-icon">
              <Text>📋</Text>
            </View>
            <Text className="tool-label">装修清单</Text>
          </View>

          <View className="tool-item">
            <View className="tool-icon">
              <Text>📚</Text>
            </View>
            <Text className="tool-label">装修知识</Text>
          </View>
        </View>
      </View>
    );
  };

  renderSettingsSection = () => {
    const { notificationsEnabled, darkModeEnabled } = this.state;
    
    return (
      <View className="settings-section">
        <View className="section-header">
          <Text className="section-title">其他设置</Text>
        </View>

        <View className="setting-item">
          <View className="setting-info">
            <Text className="setting-icon">🔔</Text>
            <Text className="setting-label">消息通知</Text>
          </View>
          <Switch 
            color="#10b981" 
            checked={notificationsEnabled}
            onChange={this.toggleNotifications}
          />
        </View>

        <View className="setting-item">
          <View className="setting-info">
            <Text className="setting-icon">🌙</Text>
            <Text className="setting-label">深色模式</Text>
          </View>
          <Switch 
            color="#10b981" 
            checked={darkModeEnabled}
            onChange={this.toggleDarkMode}
          />
        </View>

        <View className="setting-item">
          <View className="setting-info">
            <Text className="setting-icon">❓</Text>
            <Text className="setting-label">帮助与反馈</Text>
          </View>
          <Text className="arrow">›</Text>
        </View>

        <View className="setting-item">
          <View className="setting-info">
            <Text className="setting-icon">ℹ️</Text>
            <Text className="setting-label">关于我们</Text>
          </View>
          <Text className="arrow">›</Text>
        </View>
      </View>
    );
  };

  renderStyleModal = () => {
    const { showStyleModal, selectedStyles } = this.state;
    const allStyles = Object.values(DesignStyle);

    if (!showStyleModal) return null;

    return (
      <View className="modal-overlay" onClick={this.closeStyleModal}>
        <View className="modal-content" onClick={(e) => e.stopPropagation()}>
          <View className="modal-header">
            <Text className="modal-title">选择偏好风格</Text>
          </View>
          <View className="style-modal">
            <View className="style-list">
              {allStyles.map(style => (
                <View
                  key={style}
                  className={`style-option ${selectedStyles.includes(style) ? 'selected' : ''}`}
                  onClick={() => this.toggleStyle(style)}
                >
                  <Text className="style-name">{styleNames[style]}</Text>
                  {selectedStyles.includes(style) && (
                    <Text className="check-icon">✓</Text>
                  )}
                </View>
              ))}
            </View>
            <View className="modal-actions">
              <View className="modal-btn secondary" onClick={this.closeStyleModal}>
                <Text>取消</Text>
              </View>
              <View className="modal-btn primary" onClick={this.saveStylePreferences}>
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  renderBudgetModal = () => {
    const { showBudgetModal, selectedBudget } = this.state;
    const allBudgets = Object.values(BudgetRange);

    if (!showBudgetModal) return null;

    return (
      <View className="modal-overlay" onClick={this.closeBudgetModal}>
        <View className="modal-content" onClick={(e) => e.stopPropagation()}>
          <View className="modal-header">
            <Text className="modal-title">选择预算范围</Text>
          </View>
          <View className="budget-modal">
            <View className="budget-list">
              {allBudgets.map(budget => (
                <View
                  key={budget}
                  className={`budget-option ${selectedBudget === budget ? 'selected' : ''}`}
                  onClick={() => this.selectBudget(budget)}
                >
                  <Text className="budget-name">{budgetRangeNames[budget]}</Text>
                  {selectedBudget === budget && (
                    <Text className="check-icon">✓</Text>
                  )}
                </View>
              ))}
            </View>
            <View className="modal-actions">
              <View className="modal-btn secondary" onClick={this.closeBudgetModal}>
                <Text>取消</Text>
              </View>
              <View className="modal-btn primary" onClick={this.saveBudgetPreferences}>
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  renderSpaceModal = () => {
    const { showSpaceModal, selectedSpaces } = this.state;
    const allSpaces = Object.values(SpaceType);

    if (!showSpaceModal) return null;

    return (
      <View className="modal-overlay" onClick={this.closeSpaceModal}>
        <View className="modal-content" onClick={(e) => e.stopPropagation()}>
          <View className="modal-header">
            <Text className="modal-title">选择空间优先级</Text>
          </View>
          <View className="space-modal">
            <View className="space-tip">
              <Text>请按优先级选择您关注的空间类型</Text>
            </View>
            <View className="space-list">
              {allSpaces.map(space => (
                <View
                  key={space}
                  className={`space-option ${selectedSpaces.includes(space) ? 'selected' : ''}`}
                  onClick={() => this.toggleSpace(space)}
                >
                  <Text className="space-name">{spaceTypeNames[space]}</Text>
                  {selectedSpaces.includes(space) && (
                    <Text className="check-icon">✓</Text>
                  )}
                </View>
              ))}
            </View>
            <View className="modal-actions">
              <View className="modal-btn secondary" onClick={this.closeSpaceModal}>
                <Text>取消</Text>
              </View>
              <View className="modal-btn primary" onClick={this.saveSpacePreferences}>
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  render () {
    return (
      <View className="profile-page">
        <ScrollView className="content-scroll" scrollY>
          {this.renderUserCard()}
          {this.renderPreferencesSection()}
          {this.renderToolsSection()}
          {this.renderSettingsSection()}
          <View className="bottom-space" />
        </ScrollView>

        {this.renderStyleModal()}
        {this.renderBudgetModal()}
        {this.renderSpaceModal()}
      </View>
    )
  }
}

const mapStateToProps = (state: RootState) => ({
  user: state.user.user,
  favoriteItems: state.favorites.items,
  comparisonItems: state.comparison.items
});

const mapDispatchToProps = {
  updatePreferences,
  clearComparison
};

export default connect(mapStateToProps, mapDispatchToProps)(Profile)
