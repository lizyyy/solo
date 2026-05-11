const { Op } = require('sequelize');
const { Compensation, Complaint, Order, OrderItem, Delivery } = require('../models/associations');

class CompensationService {
  static async checkDuplicateComplaint(orderId, reasonCategory) {
    const existingComplaints = await Complaint.findAll({
      where: {
        orderId,
        reasonCategory,
        isDuplicate: false,
        status: { [Op.ne]: 'closed' }
      },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    if (existingComplaints.length > 0) {
      const originalComplaint = existingComplaints[0];
      return { isDuplicate: true, originalComplaint };
    }

    return { isDuplicate: false };
  }

  static async checkExistingCompensation(orderId) {
    const existingCompensations = await Compensation.findAll({
      where: {
        orderId,
        status: { [Op.in]: ['approved', 'executed'] },
        type: { [Op.ne]: 'none' }
      },
      order: [['createdAt', 'DESC']],
      limit: 3
    });

    if (existingCompensations.length > 0) {
      return { hasCompensated: true, compensations: existingCompensations };
    }

    return { hasCompensated: false };
  }

  static async analyzeDelayResponsibility(order, delivery) {
    if (!delivery || !order.expectedDeliveryTime || !order.actualDeliveryTime) {
      return { responsibility: 'unknown', delayMinutes: 0 };
    }

    const expectedTime = new Date(order.expectedDeliveryTime);
    const actualTime = new Date(order.actualDeliveryTime);
    const delayMinutes = Math.max(0, Math.floor((actualTime - expectedTime) / 60000));

    if (delayMinutes <= 0) {
      return { responsibility: 'none', delayMinutes: 0 };
    }

    let responsibility = 'unknown';
    const delayReason = delivery.delayReason;

    switch (delayReason) {
      case 'restaurant':
        responsibility = 'restaurant';
        break;
      case 'rider':
        responsibility = 'rider';
        break;
      case 'traffic':
      case 'weather':
        responsibility = 'platform';
        break;
      case 'other':
      case 'none':
      default:
        responsibility = 'platform';
        break;
    }

    return { responsibility, delayMinutes };
  }

  static async generateCompensationSuggestion(complaint, order, delivery) {
    const suggestions = [];
    let responsibility = 'unknown';

    const { hasCompensated } = await this.checkExistingCompensation(complaint.orderId);

    switch (complaint.reasonCategory) {
      case 'missing_item':
        responsibility = 'restaurant';
        if (hasCompensated) {
          suggestions.push({
            type: 'apology',
            amount: 0,
            description: '该订单已进行过补偿，建议再次联系客户道歉并提供下次消费优惠券'
          });
        } else {
          const affectedItems = complaint.affectedItems || [];
          let refundAmount = 0;
          
          if (affectedItems.length > 0) {
            for (const item of affectedItems) {
              const orderItem = await OrderItem.findOne({
                where: { orderId: order.id, dishId: item.dishId }
              });
              if (orderItem) {
                refundAmount += parseFloat(orderItem.price) * (item.quantity || 1);
              }
            }
          }

          if (refundAmount > 0) {
            suggestions.push({
              type: 'refund',
              amount: refundAmount,
              description: `漏餐菜品退款：${affectedItems.map(i => i.dishName).join('、')}`
            });
          } else {
            suggestions.push({
              type: 'refund',
              amount: parseFloat(order.totalAmount) * 0.3,
              description: '漏餐问题，建议退款订单金额的30%'
            });
          }
        }
        break;

      case 'dish_issue':
        responsibility = 'restaurant';
        if (hasCompensated) {
          suggestions.push({
            type: 'apology',
            amount: 0,
            description: '该订单已进行过补偿，建议再次联系客户道歉并了解具体问题'
          });
        } else {
          suggestions.push({
            type: 'coupon',
            amount: parseFloat(order.totalAmount) * 0.5,
            description: '菜品质量问题，建议提供50%金额的优惠券'
          });
        }
        break;

      case 'delivery_delay':
        const delayAnalysis = await this.analyzeDelayResponsibility(order, delivery);
        responsibility = delayAnalysis.responsibility;

        if (delayAnalysis.delayMinutes < 15) {
          suggestions.push({
            type: 'none',
            amount: 0,
            description: `配送延迟${delayAnalysis.delayMinutes}分钟，未达到补偿标准（15分钟以上），建议致电致歉`
          });
        } else if (hasCompensated) {
          suggestions.push({
            type: 'apology',
            amount: 0,
            description: `配送延迟${delayAnalysis.delayMinutes}分钟，该订单已进行过补偿，建议再次致歉`
          });
        } else {
          let compensationType = 'coupon';
          let amount = 0;
          let description = '';

          if (delayAnalysis.delayMinutes >= 30) {
            amount = parseFloat(order.totalAmount) * 0.5;
            description = `严重配送延迟${delayAnalysis.delayMinutes}分钟，建议提供50%金额的优惠券`;
            if (responsibility === 'rider') {
              description += '（骑手责任）';
            } else if (responsibility === 'restaurant') {
              description += '（门店出餐延迟）';
            }
          } else if (delayAnalysis.delayMinutes >= 15) {
            amount = parseFloat(order.totalAmount) * 0.2;
            description = `配送延迟${delayAnalysis.delayMinutes}分钟，建议提供20%金额的优惠券`;
            if (responsibility === 'rider') {
              description += '（骑手责任）';
            } else if (responsibility === 'restaurant') {
              description += '（门店出餐延迟）';
            }
          }

          if (amount > 0) {
            suggestions.push({
              type: compensationType,
              amount,
              description
            });
          }
        }
        break;

      case 'package_damage':
        responsibility = delivery?.packageStatus === 'damaged' ? 'rider' : 'unknown';
        if (hasCompensated) {
          suggestions.push({
            type: 'apology',
            amount: 0,
            description: '该订单已进行过补偿，建议再次联系客户道歉'
          });
        } else {
          suggestions.push({
            type: 'refund',
            amount: parseFloat(order.totalAmount) * 0.3,
            description: '包装破损问题，建议退款订单金额的30%'
          });
        }
        break;

      case 'other':
      default:
        if (hasCompensated) {
          suggestions.push({
            type: 'apology',
            amount: 0,
            description: '该订单已进行过补偿，建议再次联系客户了解情况'
          });
        } else {
          suggestions.push({
            type: 'apology',
            amount: 0,
            description: '其他问题，建议先联系客户了解具体情况后再决定补偿方案'
          });
        }
        break;
    }

    return {
      suggestions,
      responsibility,
      hasCompensated
    };
  }

  static async createCompensation(complaintId, orderId, suggestion, responsibility) {
    return await Compensation.create({
      complaintId,
      orderId,
      type: suggestion.type,
      amount: suggestion.amount,
      description: suggestion.description,
      status: 'suggested',
      suggestedBy: 'system',
      responsibility
    });
  }
}

module.exports = CompensationService;
