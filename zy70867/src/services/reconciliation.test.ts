import { generateExportData, submitReconciliation, findByBatchId } from './reconciliation';
import { LinenType, RoomType, ProcessingStatus } from '../types';
import * as database from '../database';

jest.mock('../database', () => ({
  runQuery: jest.fn().mockResolvedValue(undefined),
  getOne: jest.fn(),
  getAll: jest.fn().mockResolvedValue([])
}));

describe('Reconciliation Service - Export Allocation', () => {
  const mockRecordBase = {
    id: 'test-id-123',
    batch_id: 'TEST-BATCH-001',
    hotel_id: 'HOTEL-001',
    hotel_name: '测试酒店',
    submit_date: '2024-01-15T00:00:00.000Z',
    wash_date: '2024-01-14T00:00:00.000Z',
    return_date: '2024-01-15T00:00:00.000Z',
    handler: '测试人',
    processing_status: 'normal',
    status_reason: '正常',
    error_details: '[]',
    created_at: '2024-01-15T00:00:00.000Z',
    updated_at: '2024-01-15T00:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('极端分摊场景：两个房型各送洗1，账单数量1时合计应保持一致', async () => {
    const roomStandards = [
      {
        roomType: RoomType.STANDARD,
        roomCount: 1,
        linenItems: [
          {
            linenType: LinenType.BED_SHEET,
            sendQuantity: 1,
            returnQuantity: 1,
            damagedQuantity: 0,
            damageCompensation: 0
          }
        ]
      },
      {
        roomType: RoomType.DELUXE,
        roomCount: 1,
        linenItems: [
          {
            linenType: LinenType.BED_SHEET,
            sendQuantity: 1,
            returnQuantity: 1,
            damagedQuantity: 0,
            damageCompensation: 0
          }
        ]
      }
    ];

    const billingItems = [
      {
        linenType: LinenType.BED_SHEET,
        billedQuantity: 1,
        billedAmount: 10.0
      }
    ];

    (database.getOne as jest.Mock).mockResolvedValue({
      ...mockRecordBase,
      room_standards: JSON.stringify(roomStandards),
      billing_items: JSON.stringify(billingItems)
    });

    const exportData = await generateExportData('test-id-123');
    expect(exportData).not.toBeNull();
    expect(exportData!.length).toBe(2);

    const totalBilledQuantity = exportData!.reduce((sum, r) => sum + r.billedQuantity, 0);
    const totalBilledAmount = exportData!.reduce((sum, r) => sum + r.billedAmount, 0);

    expect(totalBilledQuantity).toBe(1);
    expect(totalBilledAmount).toBe(10.0);
  });

  test('多房型分摊：合计账单数量应与统计接口一致', async () => {
    const roomStandards = [
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
          },
          {
            linenType: LinenType.TOWEL,
            sendQuantity: 100,
            returnQuantity: 98,
            damagedQuantity: 2,
            damageCompensation: 30
          }
        ]
      },
      {
        roomType: RoomType.DELUXE,
        roomCount: 20,
        linenItems: [
          {
            linenType: LinenType.BED_SHEET,
            sendQuantity: 40,
            returnQuantity: 38,
            damagedQuantity: 2,
            damageCompensation: 40
          }
        ]
      }
    ];

    const billingItems = [
      {
        linenType: LinenType.BED_SHEET,
        billedQuantity: 140,
        billedAmount: 700.0
      },
      {
        linenType: LinenType.TOWEL,
        billedQuantity: 100,
        billedAmount: 300.0
      }
    ];

    (database.getOne as jest.Mock).mockResolvedValue({
      ...mockRecordBase,
      room_standards: JSON.stringify(roomStandards),
      billing_items: JSON.stringify(billingItems)
    });

    const exportData = await generateExportData('test-id-123');
    expect(exportData).not.toBeNull();

    const totalBilledQuantity = exportData!.reduce((sum, r) => sum + r.billedQuantity, 0);
    const totalBilledAmount = exportData!.reduce((sum, r) => sum + r.billedAmount, 0);

    expect(totalBilledQuantity).toBe(240);
    expect(totalBilledAmount).toBe(1000.0);
  });
});
