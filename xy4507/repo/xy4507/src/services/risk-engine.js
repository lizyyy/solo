const moment = require('moment');

class RiskEngine {
  constructor(db) {
    this.db = db;
  }

  analyzeOrder(orderId) {
    this.db.clearOrderRisks(orderId);
    const order = this.db.getOrderById(orderId);
    if (!order) return;

    this.analyzeAxisError(order);
    this.analyzeLensDiameter(order);
    this.analyzeEyeSwap(order);
    this.analyzePickupTime(order);
  }

  analyzeAxisError(order) {
    const prescriptions = order.prescriptions || [];
    const grindingLogs = order.grinding_logs || [];

    const axisChecks = [
      { from: 'prescription', items: prescriptions },
      { from: 'grinding', items: grindingLogs }
    ];

    for (const check of axisChecks) {
      const leftItem = check.items.find(i => i.eye_type === 'left' || (check.from === 'grinding' && i));
      const rightItem = check.items.find(i => i.eye_type === 'right');

      if (leftItem && rightItem) {
        const leftAxis = this.getAxis(leftItem);
        const rightAxis = this.getAxis(rightItem);

        if (leftAxis !== null && rightAxis !== null) {
          if (leftAxis === rightAxis && leftAxis === 0) {
            this.db.createRisk(
              order.id,
              'axis_error',
              'high',
              `双眼轴位均为0°，可能存在录入错误`,
              JSON.stringify({
                source: check.from,
                left_axis: leftAxis,
                right_axis: rightAxis,
                hint: '如果均为近视或远视无散光，轴位应留空而非填0'
              })
            );
          }

          const axisDiff = Math.abs(leftAxis - rightAxis);
          if (axisDiff === 0 && leftAxis > 0) {
            this.db.createRisk(
              order.id,
              'axis_error',
              'medium',
              `双眼轴位完全相同（${leftAxis}°），需确认是否正确`,
              JSON.stringify({
                source: check.from,
                left_axis: leftAxis,
                right_axis: rightAxis,
                hint: '轴位完全相同的情况较少见，建议复核原始处方'
              })
            );
          }

          if (axisDiff === 90 || axisDiff === 270) {
            this.db.createRisk(
              order.id,
              'axis_error',
              'high',
              `轴位相差恰好90°，可能存在轴位抄错（横/竖混淆）`,
              JSON.stringify({
                source: check.from,
                left_axis: leftAxis,
                right_axis: rightAxis,
                hint: '轴位相差90°是典型的录入错误模式，请检查原始数据'
              })
            );
          }

          if (leftAxis > 180 || rightAxis > 180) {
            this.db.createRisk(
              order.id,
              'axis_error',
              'high',
              `轴位数值超出正常范围（0-180°）`,
              JSON.stringify({
                source: check.from,
                left_axis: leftAxis,
                right_axis: rightAxis,
                hint: '轴位有效范围为0-180°，请检查数值是否正确'
              })
            );
          }
        }
      }
    }

    if (prescriptions.length > 0 && grindingLogs.length > 0) {
      const prescLeft = prescriptions.find(p => p.eye_type === 'left');
      const prescRight = prescriptions.find(p => p.eye_type === 'right');
      const grindingFirst = grindingLogs[0];

      if (prescLeft && prescRight && grindingFirst) {
        if (grindingFirst.axis_verification) {
          const axisVerification = grindingFirst.axis_verification;
          if (axisVerification === 'failed' || axisVerification === '不通过') {
            this.db.createRisk(
              order.id,
              'axis_error',
              'high',
              `质检记录显示轴位验证不通过`,
              JSON.stringify({
                verification: axisVerification,
                hint: '请复核磨边机加工日志中的轴位数据'
              })
            );
          }
        }
      }
    }
  }

  getAxis(item) {
    if (!item) return null;
    if (item.axis !== undefined && item.axis !== null) {
      const axis = Number(item.axis);
      return isNaN(axis) ? null : axis;
    }
    return null;
  }

  analyzeLensDiameter(order) {
    const frames = order.frames;
    const lenses = order.lenses || [];
    const grindingLogs = order.grinding_logs || [];

    if (frames && frames.lens_width) {
      const frameLensWidth = frames.lens_width;

      for (const lens of lenses) {
        if (lens.lens_diameter) {
          const lensDiameter = lens.lens_diameter;
          const requiredMinDiameter = frameLensWidth + 2;

          if (lensDiameter < requiredMinDiameter) {
            this.db.createRisk(
              order.id,
              'lens_diameter',
              'high',
              `镜片直径可能不足：镜片${lens.eye_type === 'left' ? '左眼' : '右眼'}直径${lensDiameter}mm < 镜框所需最小${requiredMinDiameter}mm`,
              JSON.stringify({
                eye: lens.eye_type,
                lens_diameter: lensDiameter,
                frame_lens_width: frameLensWidth,
                required_min: requiredMinDiameter,
                hint: '镜片直径需要比镜框有效宽度大2mm以上以确保磨边余量'
              })
            );
          }

          if (lensDiameter < 50) {
            this.db.createRisk(
              order.id,
              'lens_diameter',
              'medium',
              `镜片直径偏小（${lensDiameter}mm），可能影响磨边操作`,
              JSON.stringify({
                eye: lens.eye_type,
                lens_diameter: lensDiameter,
                hint: '小直径镜片需要特别注意磨边参数设置'
              })
            );
          }
        }
      }

      for (const log of grindingLogs) {
        if (log.lens_size_w && log.lens_size_h) {
          const groundW = log.lens_size_w;
          const groundH = log.lens_size_h;
          const groundDiagonal = Math.sqrt(groundW * groundW + groundH * groundH);

          if (frames.lens_width > 0 && groundW > frames.lens_width + 1) {
            this.db.createRisk(
              order.id,
              'lens_diameter',
              'medium',
              `磨边后尺寸${groundW}mm与镜框尺寸${frames.lens_width}mm差异较大`,
              JSON.stringify({
                ground_width: groundW,
                ground_height: groundH,
                frame_lens_width: frames.lens_width,
                hint: '请确认磨边尺寸是否符合镜框要求'
              })
            );
          }

          if (log.edge_thickness !== null && log.edge_thickness !== undefined) {
            const edgeThickness = log.edge_thickness;
            if (edgeThickness < 0.5) {
              this.db.createRisk(
                order.id,
                'lens_diameter',
                'high',
                `镜片边缘厚度过薄（${edgeThickness}mm），可能存在安全风险`,
                JSON.stringify({
                  edge_thickness: edgeThickness,
                  hint: '边缘厚度建议至少0.8mm，太薄容易崩边'
                })
              );
            }
          }
        }
      }
    }
  }

  analyzeEyeSwap(order) {
    const prescriptions = order.prescriptions || [];
    const lenses = order.lenses || [];

    if (prescriptions.length >= 2) {
      const left = prescriptions.find(p => p.eye_type === 'left');
      const right = prescriptions.find(p => p.eye_type === 'right');

      if (left && right) {
        if (left.sphere !== null && right.sphere !== null) {
          const leftSpheresign = Math.sign(left.sphere);
          const rightSpheresign = Math.sign(right.sphere);

          if (leftSpheresign !== 0 && rightSpheresign !== 0) {
            if (leftSpheresign !== rightSpheresign) {
              this.db.createRisk(
                order.id,
                'eye_swap',
                'medium',
                `双眼球镜符号不同：左眼${left.sphere > 0 ? '+' : ''}${left.sphere}D，右眼${right.sphere > 0 ? '+' : ''}${right.sphere}D`,
                JSON.stringify({
                  left_sphere: left.sphere,
                  right_sphere: right.sphere,
                  hint: '一眼近视一眼远视的情况较少见，请确认是否左右眼录入颠倒'
                })
              );
            }
          }
        }

        if (left.sphere !== null && right.sphere !== null && left.cylinder !== null && right.cylinder !== null) {
          const leftTotal = left.sphere + (left.cylinder || 0);
          const rightTotal = right.sphere + (right.cylinder || 0);

          if (left.cylinder !== 0 && right.cylinder !== 0) {
            if (leftTotal === right.sphere && rightTotal === left.sphere) {
              this.db.createRisk(
                order.id,
                'eye_swap',
                'high',
                `检测到可能的左右眼数据互换模式`,
                JSON.stringify({
                  left_sphere: left.sphere,
                  left_cylinder: left.cylinder,
                  right_sphere: right.sphere,
                  right_cylinder: right.cylinder,
                  hint: '数据模式显示左右眼可能互换，请复核原始处方'
                })
              );
            }
          }
        }

        if (left.pd !== null && right.pd !== null && left.pd === right.pd && left.ph !== null && right.ph !== null) {
          if (left.ph === right.ph && left.ph > 0) {
            this.db.createRisk(
              order.id,
              'eye_swap',
              'low',
              `双眼瞳高相同（${left.ph}mm）且瞳距也相同，请注意`,
              JSON.stringify({
                left_pd: left.pd,
                right_pd: right.pd,
                left_ph: left.ph,
                right_ph: right.ph,
                hint: '如果单眼瞳距和瞳高都完全相同，请确认测量是否准确'
              })
            );
          }
        }
      }
    }

    if (lenses.length >= 2) {
      const leftLens = lenses.find(l => l.eye_type === 'left');
      const rightLens = lenses.find(l => l.eye_type === 'right');

      if (leftLens && rightLens) {
        if (leftLens.lens_type && rightLens.lens_type) {
          if (leftLens.lens_type.includes('近视') && rightLens.lens_type.includes('远视')) {
            this.db.createRisk(
              order.id,
              'eye_swap',
              'medium',
              `左眼配近视镜片，右眼配远视镜片，需确认是否正确`,
              JSON.stringify({
                left_lens_type: leftLens.lens_type,
                right_lens_type: rightLens.lens_type,
                hint: '这种情况不常见，请确认是否左右眼镜片类型录入错误'
              })
            );
          }
        }
      }
    }

    const qualityChecks = order.quality_checks || [];
    for (const qc of qualityChecks) {
      if (qc.prism_check === 'excessive' || qc.prism_check === '棱镜过大') {
        this.db.createRisk(
          order.id,
          'eye_swap',
          'high',
          `质检记录显示棱镜过大，可能是左右眼装反`,
          JSON.stringify({
            prism_check: qc.prism_check,
            hint: '左右眼装反会导致异常棱镜效应，请立即检查装配情况'
          })
        );
      }

      if (qc.fitting_check === 'failed' || qc.fitting_check === '不合格') {
        this.db.createRisk(
          order.id,
          'eye_swap',
          'medium',
          `质检显示配戴检查不通过，可能存在装配问题`,
          JSON.stringify({
            fitting_check: qc.fitting_check,
            hint: '配戴不通过可能由多种原因引起，包括左右眼装反'
          })
        );
      }
    }
  }

  analyzePickupTime(order) {
    const now = moment();
    const orderDate = moment(order.order_date);
    const pickupDate = moment(order.pickup_date);

    if (!pickupDate.isValid()) {
      this.db.createRisk(
        order.id,
        'pickup_time',
        'medium',
        `取镜日期格式不正确`,
        JSON.stringify({
          pickup_date: order.pickup_date,
          hint: '请检查日期格式是否正确'
        })
      );
      return;
    }

    const daysUntilPickup = pickupDate.diff(now, 'days');
    const orderToPickupDays = pickupDate.diff(orderDate, 'days');

    if (daysUntilPickup < 0) {
      this.db.createRisk(
        order.id,
        'pickup_time',
        'high',
        `取镜日期已过${Math.abs(daysUntilPickup)}天，但订单仍未完成`,
        JSON.stringify({
          order_date: order.order_date,
          pickup_date: order.pickup_date,
          current_date: now.format('YYYY-MM-DD'),
          days_overdue: Math.abs(daysUntilPickup),
          hint: '请尽快确认订单状态'
        })
      );
    } else if (daysUntilPickup <= 1) {
      this.db.createRisk(
        order.id,
        'pickup_time',
        'high',
        `取镜时间紧迫：仅剩${daysUntilPickup}天`,
        JSON.stringify({
          pickup_date: order.pickup_date,
          days_remaining: daysUntilPickup,
          hint: '请加急处理所有未完成的工序'
        })
      );
    } else if (daysUntilPickup <= 3) {
      this.db.createRisk(
        order.id,
        'pickup_time',
        'medium',
        `取镜时间临近：剩余${daysUntilPickup}天`,
        JSON.stringify({
          pickup_date: order.pickup_date,
          days_remaining: daysUntilPickup,
          hint: '请检查各工序进度'
        })
      );
    }

    if (orderToPickupDays < 1) {
      this.db.createRisk(
        order.id,
        'pickup_time',
        'high',
        `取镜日期早于或等于下单日期`,
        JSON.stringify({
          order_date: order.order_date,
          pickup_date: order.pickup_date,
          hint: '日期逻辑错误，请检查数据录入'
        })
      );
    }

    if (orderToPickupDays > 30) {
      this.db.createRisk(
        order.id,
        'pickup_time',
        'low',
        `取镜周期较长（${orderToPickupDays}天），请确认是否正确`,
        JSON.stringify({
          order_date: order.order_date,
          pickup_date: order.pickup_date,
          days_total: orderToPickupDays,
          hint: '通常订单周期为3-7天，超长周期请确认是否为特殊订单'
        })
      );
    }

    const grindingLogs = order.grinding_logs || [];
    const qualityChecks = order.quality_checks || [];

    if (daysUntilPickup <= 2) {
      if (grindingLogs.length === 0) {
        this.db.createRisk(
          order.id,
          'pickup_time',
          'high',
          `取镜在即但磨边工序尚未开始`,
          JSON.stringify({
            pickup_date: order.pickup_date,
            days_remaining: daysUntilPickup,
            hint: '磨边工序尚未录入，请确认进度'
          })
        );
      }

      if (qualityChecks.length === 0) {
        this.db.createRisk(
          order.id,
          'pickup_time',
          'medium',
          `取镜在即但质检工序尚未完成`,
          JSON.stringify({
            pickup_date: order.pickup_date,
            days_remaining: daysUntilPickup,
            hint: '质检记录尚未录入'
          })
        );
      }
    }
  }
}

module.exports = RiskEngine;
