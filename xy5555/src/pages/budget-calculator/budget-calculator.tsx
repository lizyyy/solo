import { Component } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Slider, Switch } from '@tarojs/components';
import { connect } from 'react-redux';
import { RootState } from '../../store';
import { DesignStyle, BudgetRange } from '../../data/types';
import { styleNames, budgetRangeNames, calculateBudgetEstimate } from '../../data/mockData';
import './budget-calculator.scss';

interface BudgetCalculatorState {
  selectedStyle: DesignStyle;
  selectedBudgetRange: BudgetRange;
  area: number;
  hasSmartHome: boolean;
  hasCustomCabinets: boolean;
  hasHighEndMaterials: boolean;
  showResult: boolean;
  result: {
    totalBudget: number;
    breakdown: { category: string; amount: number; percentage: number }[];
    tips: string[];
  } | null;
}

interface BudgetCalculatorProps {
  user: any;
}

class BudgetCalculator extends Component<BudgetCalculatorProps, BudgetCalculatorState> {
  constructor(props: BudgetCalculatorProps) {
    super(props);
    this.state = {
      selectedStyle: DesignStyle.MODERN,
      selectedBudgetRange: BudgetRange.MEDIUM,
      area: 25,
      hasSmartHome: false,
      hasCustomCabinets: true,
      hasHighEndMaterials: false,
      showResult: false,
      result: null
    };
  }

  componentDidMount() {
    if (this.props.user?.preferences) {
      const { preferredStyles, budgetRange } = this.props.user.preferences;
      if (preferredStyles && preferredStyles.length > 0) {
        this.setState({
          selectedStyle: preferredStyles[0],
          selectedBudgetRange: budgetRange || BudgetRange.MEDIUM
        });
      }
    }
  }

  calculateBudget = () => {
    const { selectedStyle, area, selectedBudgetRange, hasSmartHome, hasCustomCabinets, hasHighEndMaterials } = this.state;
    
    const result = calculateBudgetEstimate({
      style: selectedStyle,
      area: area,
      budgetRange: selectedBudgetRange,
      hasSmartHome,
      hasCustomCabinets,
      hasHighEndMaterials
    });
    
    this.setState({
      result,
      showResult: true
    });
  };

  resetCalculator = () => {
    this.setState({
      showResult: false,
      result: null
    });
  };

  render() {
    const { selectedStyle, selectedBudgetRange, area, hasSmartHome, hasCustomCabinets, hasHighEndMaterials, showResult, result } = this.state;

    return (
      <View className='budget-calculator-page'>
        {!showResult ? (
          <View className='calculator-form'>
            <View className='section'>
              <View className='section-header'>
                <Text className='section-title'>选择设计风格</Text>
              </View>
              <View className='section-body'>
                <View className='style-grid'>
                  {Object.values(DesignStyle).map((style) => (
                    <View
                      key={style}
                      className={`style-item ${selectedStyle === style ? 'selected' : ''}`}
                      onClick={() => this.setState({ selectedStyle: style })}
                    >
                      <Text className='style-name'>{styleNames[style as DesignStyle]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className='section'>
              <View className='section-header'>
                <Text className='section-title'>选择预算范围</Text>
              </View>
              <View className='section-body'>
                <View className='option-list'>
                  {Object.values(BudgetRange).map((range) => (
                    <View
                      key={range}
                      className={`option-item ${selectedBudgetRange === range ? 'active' : ''}`}
                      onClick={() => this.setState({ selectedBudgetRange: range })}
                    >
                      <View className='option-left'>
                        <Text className='option-title'>{budgetRangeNames[range as BudgetRange]}</Text>
                      </View>
                      <View className={`option-radio ${selectedBudgetRange === range ? 'active' : ''}`}>
                        {selectedBudgetRange === range && <View className='radio-inner' />}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className='section'>
              <View className='section-header'>
                <Text className='section-title'>设置房屋面积</Text>
              </View>
              <View className='section-body'>
                <View className='slider-section'>
                  <View className='slider-label'>
                    <Text className='label-text'>房屋面积</Text>
                    <Text className='value-text'>{area} 平米</Text>
                  </View>
                  <Slider
                    min={10}
                    max={50}
                    step={1}
                    value={area}
                    activeColor='#10b981'
                    backgroundColor='#e5e7eb'
                    blockSize={24}
                    onChange={(e) => this.setState({ area: e.detail.value })}
                  />
                  <View className='slider-ticks'>
                    <Text className='tick-item'>10㎡</Text>
                    <Text className='tick-item'>25㎡</Text>
                    <Text className='tick-item'>40㎡</Text>
                    <Text className='tick-item'>50㎡</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className='section'>
              <View className='section-header'>
                <Text className='section-title'>额外配置</Text>
              </View>
              <View className='section-body'>
                <View className='toggle-list'>
                  <View className='toggle-item'>
                    <View className='toggle-left'>
                      <Text className='toggle-title'>智能家居系统</Text>
                      <Text className='toggle-desc'>智能灯光、窗帘、安防等 (+¥15,000)</Text>
                    </View>
                    <Switch
                      checked={hasSmartHome}
                      color='#10b981'
                      onChange={(e) => this.setState({ hasSmartHome: e.detail.value })}
                    />
                  </View>
                  <View className='toggle-item'>
                    <View className='toggle-left'>
                      <Text className='toggle-title'>定制橱柜</Text>
                      <Text className='toggle-desc'>厨房整体橱柜定制 (+¥8,000)</Text>
                    </View>
                    <Switch
                      checked={hasCustomCabinets}
                      color='#10b981'
                      onChange={(e) => this.setState({ hasCustomCabinets: e.detail.value })}
                    />
                  </View>
                  <View className='toggle-item'>
                    <View className='toggle-left'>
                      <Text className='toggle-title'>高端材料</Text>
                      <Text className='toggle-desc'>进口主材、高端饰面 (+¥20,000)</Text>
                    </View>
                    <Switch
                      checked={hasHighEndMaterials}
                      color='#10b981'
                      onChange={(e) => this.setState({ hasHighEndMaterials: e.detail.value })}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View className='calculator-result'>
            <View className='result-header'>
              <Text className='result-label'>预估总预算</Text>
              <Text className='result-amount'>¥{(result?.totalBudget || 0).toLocaleString()}</Text>
              <Text className='result-subtitle'>
                {styleNames[selectedStyle]} · {area}平米 · {budgetRangeNames[selectedBudgetRange]}
              </Text>
            </View>

            <View className='section'>
              <View className='section-header'>
                <Text className='section-title'>费用明细</Text>
              </View>
              <View className='section-body'>
                <View className='breakdown-list'>
                  {result?.breakdown.map((item, index) => (
                    <View key={index} className='breakdown-item'>
                      <View className='breakdown-left'>
                        <Text className='breakdown-category'>{item.category}</Text>
                        <View className='progress-bar'>
                          <View 
                            className='progress-fill' 
                            style={{ width: `${item.percentage}%` }}
                          />
                        </View>
                      </View>
                      <View className='breakdown-right'>
                        <Text className='breakdown-amount'>¥{item.amount.toLocaleString()}</Text>
                        <Text className='breakdown-percent'>{item.percentage}%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className='section'>
              <View className='section-header'>
                <Text className='section-title'>预算建议</Text>
              </View>
              <View className='section-body'>
                <View className='tips-list'>
                  {result?.tips.map((tip, index) => (
                    <View key={index} className='tip-item'>
                      <View className='tip-dot' />
                      <Text className='tip-text'>{tip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className='result-actions'>
              <View className='action-btn secondary' onClick={this.resetCalculator}>
                <Text className='btn-text'>重新计算</Text>
              </View>
              <View className='action-btn primary' onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
                <Text className='btn-text'>查看推荐方案</Text>
              </View>
            </View>
          </View>
        )}

        {!showResult && (
          <View className='fixed-bottom'>
            <View className='calculate-btn' onClick={this.calculateBudget}>
              <Text className='btn-text'>开始计算预算</Text>
            </View>
          </View>
        )}
      </View>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  user: state.user.user
});

export default connect(mapStateToProps)(BudgetCalculator);
