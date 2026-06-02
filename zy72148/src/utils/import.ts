import type { RoomAllocation, PersonType, RecordStatus } from '@/types';
import { generateId } from './storage';

export const parseCSV = (content: string): Partial<RoomAllocation>[] => {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const records: Partial<RoomAllocation>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const record: Partial<RoomAllocation> = {};
    
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || '';
      
      switch (header) {
        case '巡演名称':
        case 'tourname':
        case 'tour_name':
          record.tourName = value;
          break;
        case '酒店名称':
        case 'hotelname':
        case 'hotel_name':
          record.hotelName = value;
          break;
        case '房型':
        case 'roomtype':
        case 'room_type':
          record.roomType = value;
          break;
        case '入住人':
        case 'personname':
        case 'person_name':
          record.personName = value;
          break;
        case '人员类型':
        case 'persontype':
        case 'person_type':
          record.personType = value as PersonType;
          break;
        case '入住日期':
        case 'checkindate':
        case 'check_in_date':
          record.checkInDate = value;
          break;
        case '退房日期':
        case 'checkoutdate':
        case 'check_out_date':
          record.checkOutDate = value;
          break;
        case '备注':
        case 'remarks':
          record.remarks = value;
          break;
        case '状态':
        case 'status':
          record.status = value as RecordStatus;
          break;
      }
    });
    
    if (record.tourName || record.hotelName || record.personName) {
      records.push(record);
    }
  }
  
  return records;
};

export const parseJSON = (content: string): Partial<RoomAllocation>[] => {
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      return data;
    }
    return [data];
  } catch {
    return [];
  }
};

export const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

export const parseImportFile = async (file: File): Promise<Partial<RoomAllocation>[]> => {
  const content = await readFileContent(file);
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return parseCSV(content);
  } else if (fileName.endsWith('.json')) {
    return parseJSON(content);
  }
  
  throw new Error('不支持的文件格式，请上传 CSV 或 JSON 文件');
};

export const completeRecord = (
  partial: Partial<RoomAllocation>,
  versionId: string,
  source: string
): RoomAllocation => {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    tourName: partial.tourName || '',
    hotelName: partial.hotelName || '',
    roomType: partial.roomType || '',
    personName: partial.personName || '',
    personType: partial.personType || 'staff',
    checkInDate: partial.checkInDate || '',
    checkOutDate: partial.checkOutDate || '',
    remarks: partial.remarks || '',
    source: source || partial.source || '导入',
    status: partial.status || 'pending',
    manualTag: partial.manualTag,
    createdAt: now,
    updatedAt: now,
    versionId,
  };
};
