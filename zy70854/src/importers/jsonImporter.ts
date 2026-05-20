import { v4 as uuidv4 } from 'uuid';
import { RouteSchedule, ImageIndex, ImportResult } from '../types';

export class JsonImporter {
  importRouteSchedules(jsonContent: string): ImportResult<RouteSchedule> {
    try {
      const data = JSON.parse(jsonContent);
      const schedules: RouteSchedule[] = [];
      const errors: string[] = [];

      if (!Array.isArray(data)) {
        return {
          success: false,
          data: [],
          errors: ['线路班次数据必须是数组格式'],
          totalCount: 0,
          validCount: 0,
          invalidCount: 0
        };
      }

      data.forEach((item, index) => {
        try {
          const schedule = this.parseRouteSchedule(item, index);
          if (schedule) {
            schedules.push(schedule);
          }
        } catch (error) {
          errors.push(`第 ${index + 1} 条: ${(error as Error).message}`);
        }
      });

      return {
        success: errors.length === 0,
        data: schedules,
        errors,
        totalCount: data.length,
        validCount: schedules.length,
        invalidCount: errors.length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`JSON解析失败: ${(error as Error).message}`],
        totalCount: 0,
        validCount: 0,
        invalidCount: 0
      };
    }
  }

  importImageIndex(jsonContent: string): ImportResult<ImageIndex> {
    try {
      const data = JSON.parse(jsonContent);
      const images: ImageIndex[] = [];
      const errors: string[] = [];

      if (!Array.isArray(data)) {
        return {
          success: false,
          data: [],
          errors: ['图片索引数据必须是数组格式'],
          totalCount: 0,
          validCount: 0,
          invalidCount: 0
        };
      }

      data.forEach((item, index) => {
        try {
          const image = this.parseImageIndex(item, index);
          if (image) {
            images.push(image);
          }
        } catch (error) {
          errors.push(`第 ${index + 1} 条: ${(error as Error).message}`);
        }
      });

      return {
        success: errors.length === 0,
        data: images,
        errors,
        totalCount: data.length,
        validCount: images.length,
        invalidCount: errors.length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`JSON解析失败: ${(error as Error).message}`],
        totalCount: 0,
        validCount: 0,
        invalidCount: 0
      };
    }
  }

  private parseRouteSchedule(item: any, index: number): RouteSchedule {
    const requiredFields = ['routeNumber', 'busNumber', 'driverName', 'driverId', 'date', 'startTime', 'endTime'];
    const missingFields = requiredFields.filter(field => !item[field]);

    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }

    return {
      routeNumber: item.routeNumber,
      busNumber: item.busNumber,
      driverName: item.driverName,
      driverId: item.driverId,
      date: this.normalizeDate(item.date),
      startTime: item.startTime,
      endTime: item.endTime,
      stops: item.stops || []
    };
  }

  private parseImageIndex(item: any, index: number): ImageIndex {
    const requiredFields = ['itemId', 'fileName', 'filePath', 'uploadDate', 'uploader'];
    const missingFields = requiredFields.filter(field => !item[field]);

    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }

    return {
      id: item.id || uuidv4(),
      itemId: item.itemId,
      fileName: item.fileName,
      filePath: item.filePath,
      uploadDate: this.normalizeDate(item.uploadDate),
      uploader: item.uploader,
      thumbnailPath: item.thumbnailPath || ''
    };
  }

  private normalizeDate(dateStr: string): string {
    if (!dateStr) return '';
    const formats = [
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/,
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/,
      /^(\d{4})(\d{2})(\d{2})$/
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let year, month, day;
        if (format === formats[0]) {
          [, year, month, day] = match;
        } else if (format === formats[1]) {
          [, month, day, year] = match;
        } else {
          year = match[1];
          month = match[2];
          day = match[3];
        }
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return dateStr;
  }
}
