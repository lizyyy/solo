import { validateRequest } from './validator';
import { ProcessingStatus, LinenType, RoomType } from '../types';

describe('Validator Service', () => {
  const validData = {
    batchId: 'BATCH-001',
    hotelId: 'HOTEL-001',
    hotelName: '测试酒店',
    submitDate: '2024-01-15T00:00:00.000Z',
    washDate: '2024-01-14T00:00:00.000Z',
    returnDate: '2024-01-15T00:00:00.000Z',
    handler: '张三',
    roomStandards: [
      {
        roomType: RoomType.STANDARD,
        roomCount: 50,
        linenItems: [
          {
            linenType: LinenType.BED_SHEET,
            sendQuantity: 100,
            returnQuantity: 95,
            damagedQuantity: 5,
            damageCompensation: 100
          }
        ]
      }
    ],
    billingItems: [
      {
        linenType: LinenType.BED_SHEET,
        billedQuantity: 100,
        billedAmount: 500
      }
    ]
  };

  test('正常数据应该通过验证', () => {
    const result = validateRequest(validData);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.processingStatus).toBe(ProcessingStatus.NORMAL);
  });

  test('缺少必填字段应该返回待补充状态', () => {
    const data = { ...validData, batchId: '' };
    delete (data as any).batchId;
    
    const result = validateRequest(data as any);
    expect(result.isValid).toBe(false);
    expect(result.processingStatus).toBe(ProcessingStatus.PENDING_SUPPLEMENT);
  });

  test('日期逻辑错误应该返回已拦截状态', () => {
    const data = {
      ...validData,
      washDate: '2024-01-16T00:00:00.000Z',
      submitDate: '2024-01-15T00:00:00.000Z'
    };
    
    const result = validateRequest(data);
    expect(result.processingStatus).toBe(ProcessingStatus.BLOCKED);
  });

  test('回收数量+破损数量超过送洗数量应该返回待补充状态', () => {
    const data = {
      ...validData,
      roomStandards: [
        {
          roomType: RoomType.STANDARD,
          roomCount: 50,
          linenItems: [
            {
              linenType: LinenType.BED_SHEET,
              sendQuantity: 100,
              returnQuantity: 98,
              damagedQuantity: 5,
              damageCompensation: 100
            }
          ]
        }
      ]
    };
    
    const result = validateRequest(data);
    expect(result.isValid).toBe(false);
    expect(result.processingStatus).toBe(ProcessingStatus.PENDING_SUPPLEMENT);
  });

  test('错误信息应该包含rowIndex用于定位原始数据位置', () => {
    const data = {
      ...validData,
      roomStandards: [
        {
          roomType: RoomType.STANDARD,
          roomCount: 50,
          linenItems: [
            {
              linenType: LinenType.BED_SHEET,
              sendQuantity: 100,
              returnQuantity: 98,
              damagedQuantity: 5,
              damageCompensation: 100
            }
          ]
        }
      ]
    };
    
    const result = validateRequest(data);
    expect(result.errors[0].rowIndex).toBe(0);
    expect(result.errors[0].field).toContain('roomStandards');
  });
});
