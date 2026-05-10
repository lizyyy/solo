import {
  TemperatureUnit,
  WeightUnit,
  TicketType,
  TemperatureCheckItem,
  WeightCheckItem,
  TicketItem,
  RejectionReason,
  InspectionType,
  validateTemperatureCheck,
  validateWeightCheck,
  validateTicketCheck,
  validateRejectionReasons,
  calculateWeightDeviationPercent,
  convertTemperature
} from './';

describe('业务规则测试', () => {
  describe('温度校验 validateTemperatureCheck', () => {
    const defaultRule = {
      min: -18,
      max: 5,
      unit: TemperatureUnit.CELSIUS
    };

    it('空数组应返回失败', () => {
      const result = validateTemperatureCheck([], defaultRule);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('温度检查项不能为空');
    });

    it('测量位置为空应返回失败', () => {
      const items: TemperatureCheckItem[] = [
        {
          location: '',
          value: 2,
          unit: TemperatureUnit.CELSIUS,
          measuredAt: new Date(),
          operatorId: 'OP001'
        }
      ];
      const result = validateTemperatureCheck(items, defaultRule);
      expect(result.valid).toBe(false);
    });

    it('温度超出范围应返回失败', () => {
      const items: TemperatureCheckItem[] = [
        {
          location: '车厢内部',
          value: 10,
          unit: TemperatureUnit.CELSIUS,
          measuredAt: new Date(),
          operatorId: 'OP001'
        }
      ];
      const result = validateTemperatureCheck(items, defaultRule);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('超出允许范围');
    });

    it('温度在范围内应返回成功', () => {
      const items: TemperatureCheckItem[] = [
        {
          location: '车厢内部',
          value: -2,
          unit: TemperatureUnit.CELSIUS,
          measuredAt: new Date(),
          operatorId: 'OP001'
        },
        {
          location: '货物中心',
          value: 3,
          unit: TemperatureUnit.CELSIUS,
          measuredAt: new Date(),
          operatorId: 'OP001'
        }
      ];
      const result = validateTemperatureCheck(items, defaultRule);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('重量校验 validateWeightCheck', () => {
    const defaultRule = {
      maxDeviationPercent: 5
    };

    it('空数组应返回失败', () => {
      const result = validateWeightCheck([], defaultRule);
      expect(result.valid).toBe(false);
    });

    it('期望重量为 0 应返回失败', () => {
      const items: WeightCheckItem[] = [
        { expected: 0, actual: 100, unit: WeightUnit.KILOGRAM }
      ];
      const result = validateWeightCheck(items, defaultRule);
      expect(result.valid).toBe(false);
    });

    it('实际重量为负数应返回失败', () => {
      const items: WeightCheckItem[] = [
        { expected: 100, actual: -10, unit: WeightUnit.KILOGRAM }
      ];
      const result = validateWeightCheck(items, defaultRule);
      expect(result.valid).toBe(false);
    });

    it('偏差 3% 在允许范围内应返回成功', () => {
      const items: WeightCheckItem[] = [
        { expected: 100, actual: 103, unit: WeightUnit.KILOGRAM }
      ];
      const result = validateWeightCheck(items, defaultRule);
      expect(result.valid).toBe(true);
    });

    it('偏差 6% 超出范围应返回失败', () => {
      const items: WeightCheckItem[] = [
        { expected: 100, actual: 106, unit: WeightUnit.KILOGRAM }
      ];
      const result = validateWeightCheck(items, defaultRule);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('超出最大允许偏差');
    });
  });

  describe('票证校验 validateTicketCheck', () => {
    const defaultRule = {
      requiredTypes: [TicketType.QUALIFICATION_CERT, TicketType.DELIVER_NOTE]
    };

    it('空数组应返回失败', () => {
      const result = validateTicketCheck([], defaultRule);
      expect(result.valid).toBe(false);
    });

    it('缺少必需票证类型应返回失败', () => {
      const items: TicketItem[] = [
        { type: TicketType.INVOICE, provided: true, valid: true }
      ];
      const result = validateTicketCheck(items, defaultRule);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('缺少必需的票证类型');
    });

    it('票证标记为无效应返回失败', () => {
      const items: TicketItem[] = [
        { type: TicketType.QUALIFICATION_CERT, provided: true, valid: false },
        { type: TicketType.DELIVER_NOTE, provided: true, valid: true }
      ];
      const result = validateTicketCheck(items, defaultRule);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('验证不通过');
    });

    it('票证已过期应返回失败', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const items: TicketItem[] = [
        { type: TicketType.QUALIFICATION_CERT, provided: true, valid: true, expiryDate: pastDate },
        { type: TicketType.DELIVER_NOTE, provided: true, valid: true }
      ];
      const result = validateTicketCheck(items, defaultRule);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('已过期');
    });

    it('所有必需票证齐全且有效应返回成功', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 365);

      const items: TicketItem[] = [
        {
          type: TicketType.QUALIFICATION_CERT,
          provided: true,
          valid: true,
          ticketNumber: 'QC-2024-001',
          expiryDate: futureDate
        },
        {
          type: TicketType.DELIVER_NOTE,
          provided: true,
          valid: true,
          ticketNumber: 'DN-2024-001'
        },
        {
          type: TicketType.INVOICE,
          provided: true,
          valid: true,
          ticketNumber: 'INV-2024-001'
        }
      ];
      const result = validateTicketCheck(items, defaultRule);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('拒收原因校验 validateRejectionReasons', () => {
    it('空数组应返回失败', () => {
      const result = validateRejectionReasons([]);
      expect(result.valid).toBe(false);
    });

    it('类型为空应返回失败', () => {
      const reasons: RejectionReason[] = [
        {
          type: null as any,
          code: 'T001',
          description: '温度超标',
          detail: '车厢温度达到 15°C，远超允许范围'
        }
      ];
      const result = validateRejectionReasons(reasons);
      expect(result.valid).toBe(false);
    });

    it('详情为空应返回失败', () => {
      const reasons: RejectionReason[] = [
        {
          type: InspectionType.TEMPERATURE,
          code: 'T001',
          description: '温度超标',
          detail: ''
        }
      ];
      const result = validateRejectionReasons(reasons);
      expect(result.valid).toBe(false);
    });

    it('完整的拒收原因应返回成功', () => {
      const reasons: RejectionReason[] = [
        {
          type: InspectionType.TEMPERATURE,
          code: 'T001',
          description: '温度超标',
          detail: '车厢温度达到 15°C，远超允许范围 -18°C 至 5°C'
        },
        {
          type: InspectionType.WEIGHT,
          code: 'W001',
          description: '重量不足',
          detail: '实际重量 90kg，与期望 100kg 偏差超过 5%'
        }
      ];
      const result = validateRejectionReasons(reasons);
      expect(result.valid).toBe(true);
    });
  });

  describe('工具函数', () => {
    describe('calculateWeightDeviationPercent', () => {
      it('期望值为 0 应返回 0', () => {
        expect(calculateWeightDeviationPercent(0, 100)).toBe(0);
      });

      it('期望值为负数应返回 0', () => {
        expect(calculateWeightDeviationPercent(-10, 100)).toBe(0);
      });

      it('实际值比期望值多 3% 应返回 3', () => {
        expect(calculateWeightDeviationPercent(100, 103)).toBeCloseTo(3);
      });

      it('实际值比期望值少 5% 应返回 -5', () => {
        expect(calculateWeightDeviationPercent(100, 95)).toBeCloseTo(-5);
      });
    });

    describe('convertTemperature', () => {
      it('相同单位不应转换', () => {
        expect(convertTemperature(10, TemperatureUnit.CELSIUS, TemperatureUnit.CELSIUS)).toBe(10);
      });

      it('0°C 应转换为 32°F', () => {
        expect(convertTemperature(0, TemperatureUnit.CELSIUS, TemperatureUnit.FAHRENHEIT)).toBe(32);
      });

      it('32°F 应转换为 0°C', () => {
        expect(convertTemperature(32, TemperatureUnit.FAHRENHEIT, TemperatureUnit.CELSIUS)).toBe(0);
      });

      it('100°C 应转换为 212°F', () => {
        expect(convertTemperature(100, TemperatureUnit.CELSIUS, TemperatureUnit.FAHRENHEIT)).toBe(212);
      });

      it('212°F 应转换为 100°C', () => {
        expect(convertTemperature(212, TemperatureUnit.FAHRENHEIT, TemperatureUnit.CELSIUS)).toBe(100);
      });
    });
  });
});
