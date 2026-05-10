const { compareItems, VERIFICATION_STATUS, SIGNATURE_TYPES, EXCEPTION_TYPES } = require('../src/services/verificationService');

describe('物资核对逻辑测试', () => {
  test('完全匹配的物资列表应返回全部匹配', () => {
    const expected = [
      { itemName: '大米', quantity: 2, unit: '袋' },
      { itemName: '食用油', quantity: 1, unit: '桶' }
    ];
    const received = [
      { itemName: '大米', quantity: 2, unit: '袋' },
      { itemName: '食用油', quantity: 1, unit: '桶' }
    ];

    const result = compareItems(expected, received);

    expect(result.matchedItems.length).toBe(2);
    expect(result.missingItems.length).toBe(0);
    expect(result.extraItems.length).toBe(0);
    expect(result.quantityMismatch.length).toBe(0);
  });

  test('缺少物资应返回缺失列表', () => {
    const expected = [
      { itemName: '大米', quantity: 2, unit: '袋' },
      { itemName: '食用油', quantity: 1, unit: '桶' }
    ];
    const received = [
      { itemName: '大米', quantity: 2, unit: '袋' }
    ];

    const result = compareItems(expected, received);

    expect(result.matchedItems.length).toBe(1);
    expect(result.missingItems.length).toBe(1);
    expect(result.missingItems[0].itemName).toBe('食用油');
    expect(result.missingItems[0].quantity).toBe(1);
  });

  test('数量不符应返回数量差异', () => {
    const expected = [
      { itemName: '大米', quantity: 3, unit: '袋' }
    ];
    const received = [
      { itemName: '大米', quantity: 2, unit: '袋' }
    ];

    const result = compareItems(expected, received);

    expect(result.quantityMismatch.length).toBe(1);
    expect(result.quantityMismatch[0].expected).toBe(3);
    expect(result.quantityMismatch[0].received).toBe(2);
  });

  test('多收到物资应返回额外列表', () => {
    const expected = [
      { itemName: '大米', quantity: 2, unit: '袋' }
    ];
    const received = [
      { itemName: '大米', quantity: 2, unit: '袋' },
      { itemName: '面粉', quantity: 1, unit: '袋' }
    ];

    const result = compareItems(expected, received);

    expect(result.extraItems.length).toBe(1);
    expect(result.extraItems[0].itemName).toBe('面粉');
  });

  test('多收部分数量应返回数量差异和额外列表', () => {
    const expected = [
      { itemName: '大米', quantity: 2, unit: '袋' }
    ];
    const received = [
      { itemName: '大米', quantity: 3, unit: '袋' }
    ];

    const result = compareItems(expected, received);

    expect(result.quantityMismatch.length).toBe(1);
    expect(result.extraItems.length).toBe(1);
    expect(result.extraItems[0].quantity).toBe(1);
  });
});

describe('常量定义测试', () => {
  test('签收类型应包含所有有效值', () => {
    expect(SIGNATURE_TYPES.PHOTO).toBe('photo');
    expect(SIGNATURE_TYPES.SIGNATURE).toBe('signature');
    expect(SIGNATURE_TYPES.WITNESS).toBe('witness');
    expect(SIGNATURE_TYPES.NONE).toBe('none');
  });

  test('核对状态应包含所有有效值', () => {
    expect(VERIFICATION_STATUS.MATCHED).toBe('matched');
    expect(VERIFICATION_STATUS.PARTIAL_MATCH).toBe('partial_match');
    expect(VERIFICATION_STATUS.MISMATCHED).toBe('mismatched');
    expect(VERIFICATION_STATUS.NEEDS_REVIEW).toBe('needs_review');
  });

  test('异常类型应包含所有有效值', () => {
    expect(EXCEPTION_TYPES.MISSING_ITEM).toBe('missing');
    expect(EXCEPTION_TYPES.DAMAGED).toBe('damaged');
    expect(EXCEPTION_TYPES.WRONG_ITEM).toBe('wrong_item');
    expect(EXCEPTION_TYPES.EXTRA_ITEM).toBe('extra');
    expect(EXCEPTION_TYPES.SIGNATURE_ISSUE).toBe('signature_issue');
    expect(EXCEPTION_TYPES.OTHER).toBe('other');
  });
});
