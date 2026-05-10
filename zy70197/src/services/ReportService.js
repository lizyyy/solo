const Agreement = require('../models/Agreement');
const Project = require('../models/Project');
const Order = require('../models/Order');
const AmountRecord = require('../models/AmountRecord');

class ReportService {
  static getAgreementReport(agreementId) {
    const agreement = Agreement.findById(agreementId);
    if (!agreement) {
      throw new Error('协议不存在');
    }
    
    const projects = Project.findByAgreementId(agreementId);
    const orders = Order.findByAgreementId(agreementId);
    const records = AmountRecord.findByAgreementId(agreementId);
    
    const reservedOrders = orders.filter(o => o.status === 'reserved');
    const confirmedOrders = orders.filter(o => o.status === 'confirmed');
    const releasedOrders = orders.filter(o => o.status === 'released');
    
    const reservedAmount = reservedOrders.reduce((sum, o) => sum + o.amount, 0);
    const confirmedAmount = confirmedOrders.reduce((sum, o) => sum + o.amount, 0);
    const releasedAmount = releasedOrders.reduce((sum, o) => sum + o.amount, 0);
    
    const projectStats = projects.map(project => {
      const projectOrders = orders.filter(o => o.project_id === project.id);
      return {
        ...project,
        order_count: projectOrders.length,
        reserved_orders: projectOrders.filter(o => o.status === 'reserved').length,
        confirmed_orders: projectOrders.filter(o => o.status === 'confirmed').length,
        released_orders: projectOrders.filter(o => o.status === 'released').length,
        available_amount: Project.getAvailableAmount(project.id)
      };
    });
    
    const available = Agreement.getAvailableAmount(agreementId);
    
    return {
      agreement: {
        id: agreement.id,
        name: agreement.name,
        year: agreement.year,
        total_amount: agreement.total_amount,
        reserved_amount: agreement.reserved_amount,
        used_amount: agreement.used_amount,
        available_amount: available,
        utilization_rate: agreement.total_amount > 0 
          ? ((agreement.used_amount + agreement.reserved_amount) / agreement.total_amount * 100).toFixed(2)
          : '0.00',
        status: agreement.status
      },
      summary: {
        total_projects: projects.length,
        total_orders: orders.length,
        reserved_orders: reservedOrders.length,
        confirmed_orders: confirmedOrders.length,
        released_orders: releasedOrders.length,
        reserved_amount: reservedAmount,
        confirmed_amount: confirmedAmount,
        released_amount: releasedAmount
      },
      projects: projectStats,
      recent_records: records.slice(0, 20)
    };
  }

  static getPrediction(agreementId, days = 30) {
    const agreement = Agreement.findById(agreementId);
    if (!agreement) {
      throw new Error('协议不存在');
    }
    
    const orders = Order.findByAgreementId(agreementId);
    const confirmedOrders = orders.filter(o => o.status === 'confirmed');
    
    if (confirmedOrders.length === 0) {
      return {
        agreement_id: agreementId,
        available_amount: Agreement.getAvailableAmount(agreementId),
        prediction: {
          daily_consumption: 0,
          projected_days_to_depletion: null,
          projected_consumption_in_period: 0,
          risk_level: 'low',
          recommendation: '暂无历史消耗数据'
        }
      };
    }
    
    const earliestOrder = confirmedOrders.reduce((earliest, order) => 
      !earliest || new Date(order.confirmed_at) < new Date(earliest.confirmed_at) ? order : earliest
    );
    
    const latestOrder = confirmedOrders.reduce((latest, order) => 
      !latest || new Date(order.confirmed_at) > new Date(latest.confirmed_at) ? order : latest
    );
    
    const startDate = new Date(earliestOrder.confirmed_at);
    const endDate = new Date(latestOrder.confirmed_at);
    const daysBetween = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    
    const totalConfirmed = confirmedOrders.reduce((sum, o) => sum + o.amount, 0);
    const dailyConsumption = totalConfirmed / daysBetween;
    
    const available = Agreement.getAvailableAmount(agreementId);
    const projectedDaysToDepletion = dailyConsumption > 0 
      ? Math.ceil(available / dailyConsumption)
      : null;
    
    const projectedConsumptionInPeriod = dailyConsumption * days;
    
    let riskLevel = 'low';
    let recommendation = '额度充足，正常使用';
    
    if (projectedDaysToDepletion !== null) {
      if (projectedDaysToDepletion < 7) {
        riskLevel = 'critical';
        recommendation = `额度即将耗尽，预计仅可用 ${projectedDaysToDepletion} 天，建议立即补充额度`;
      } else if (projectedDaysToDepletion < 30) {
        riskLevel = 'high';
        recommendation = `额度紧张，预计可用 ${projectedDaysToDepletion} 天，建议尽快补充额度`;
      } else if (projectedDaysToDepletion < 90) {
        riskLevel = 'medium';
        recommendation = `额度预计可用 ${projectedDaysToDepletion} 天，建议适时规划补充`;
      }
    }
    
    return {
      agreement_id: agreementId,
      available_amount: available,
      historical_data: {
        total_confirmed_orders: confirmedOrders.length,
        total_confirmed_amount: totalConfirmed,
        tracking_period_days: daysBetween,
        average_daily_consumption: dailyConsumption.toFixed(2)
      },
      prediction: {
        daily_consumption: dailyConsumption,
        projected_consumption_in_days: days,
        projected_consumption_in_period: projectedConsumptionInPeriod,
        projected_days_to_depletion: projectedDaysToDepletion,
        risk_level: riskLevel,
        recommendation: recommendation
      }
    };
  }

  static getAllReports() {
    const agreements = Agreement.findAll();
    return agreements.map(agreement => {
      const projects = Project.findByAgreementId(agreement.id);
      const orders = Order.findByAgreementId(agreement.id);
      const available = Agreement.getAvailableAmount(agreement.id);
      
      return {
        agreement_id: agreement.id,
        agreement_name: agreement.name,
        year: agreement.year,
        total_amount: agreement.total_amount,
        reserved_amount: agreement.reserved_amount,
        used_amount: agreement.used_amount,
        available_amount: available,
        utilization_rate: agreement.total_amount > 0 
          ? ((agreement.used_amount + agreement.reserved_amount) / agreement.total_amount * 100).toFixed(2)
          : '0.00',
        project_count: projects.length,
        order_count: orders.length,
        status: agreement.status
      };
    });
  }
}

module.exports = ReportService;
