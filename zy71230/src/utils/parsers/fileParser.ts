import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export function detectFileType(filename: string): 'csv' | 'xlsx' | 'unknown' {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return 'unknown';
}

export async function parseCSV(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        resolve(results.data as any[]);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export async function parseExcel(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }).slice(1) as any[];
}

async function parseFile(file: File): Promise<any[]> {
  const fileType = detectFileType(file.name);
  
  if (fileType === 'csv') {
    return parseCSV(file);
  } else if (fileType === 'xlsx') {
    const rows = await parseExcel(file);
    const headers = rows[0] as string[];
    return rows.slice(1).map((row: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] ?? '';
      });
      return obj;
    });
  }
  
  throw new Error(`不支持的文件格式: ${file.name}`);
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function normalizeRow(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key);
    normalized[normalizedKey] = value;
  }
  return normalized;
}

function mapToTour(row: Record<string, any>): any {
  const r = normalizeRow(row);
  return {
    name: r.tour_name || r.name || '',
    bandName: r.band_name || r.bandname || '',
    initialBudget: r.initial_budget !== undefined && r.initial_budget !== '' ? r.initial_budget : r.budget,
    startDate: r.start_date || r.startdate || '',
    endDate: r.end_date || r.enddate || '',
    notes: r.notes || r.remark || r.comment || '',
  };
}

function mapToStop(row: Record<string, any>, index: number): any {
  const r = normalizeRow(row);
  return {
    city: r.city || '',
    venue: r.venue || r.location || '',
    date: r.date || r.performance_date || r.show_date || '',
    distanceFromPrev: r.distance_from_prev !== undefined && r.distance_from_prev !== '' 
      ? r.distance_from_prev 
      : r.distance || r.distance_from_previous,
    venueRent: r.venue_rent !== undefined && r.venue_rent !== '' 
      ? r.venue_rent 
      : r.rent || r.venue_cost,
    venueSplit: r.venue_split !== undefined && r.venue_split !== '' 
      ? r.venue_split 
      : r.split || r.commission,
    ticketPrice: r.ticket_price !== undefined && r.ticket_price !== '' 
      ? r.ticket_price 
      : r.price || r.ticket_cost,
    predictedAttendance: r.predicted_attendance !== undefined && r.predicted_attendance !== '' 
      ? r.predicted_attendance 
      : r.expected_attendance || r.attendance || r.predicted,
    transportType: r.transport_type || r.transportation || r.travel_type,
    transportCost: r.transport_cost !== undefined && r.transport_cost !== '' 
      ? r.transport_cost 
      : r.travel_cost || r.transportation_cost,
    order: index,
    status: 'pending',
    notes: r.notes || r.remark || r.comment || '',
  };
}

function mapToMerch(row: Record<string, any>): any {
  const r = normalizeRow(row);
  return {
    name: r.name || r.product_name || r.merch_name || '',
    sku: r.sku || r.product_code || r.item_code,
    costPrice: r.cost_price !== undefined && r.cost_price !== '' 
      ? r.cost_price 
      : r.cost || r.wholesale_price,
    sellingPrice: r.selling_price !== undefined && r.selling_price !== '' 
      ? r.selling_price 
      : r.price || r.retail_price,
    initialStock: r.initial_stock !== undefined && r.initial_stock !== '' 
      ? r.initial_stock 
      : r.stock || r.quantity,
    currentStock: r.current_stock !== undefined && r.current_stock !== '' 
      ? r.current_stock 
      : r.initial_stock !== undefined && r.initial_stock !== '' 
        ? r.initial_stock 
        : r.stock || r.quantity,
    notes: r.notes || r.remark || r.comment || '',
  };
}

export async function parseTourData(files: File[]): Promise<{
  tour: any;
  stops: any[];
  merch: any[];
  rawData: any;
}> {
  const results: Record<string, any[]> = {};
  
  for (const file of files) {
    const data = await parseFile(file);
    const filename = file.name.toLowerCase();
    
    if (filename.includes('tour')) {
      results.tour = data;
    } else if (filename.includes('stop')) {
      results.stops = data;
    } else if (filename.includes('merch')) {
      results.merch = data;
    }
  }
  
  if (!results.tour || results.tour.length === 0) {
    throw new Error('未找到巡演数据文件，请确保文件名包含 "tour"');
  }
  if (!results.stops || results.stops.length === 0) {
    throw new Error('未找到站点数据文件，请确保文件名包含 "stop"');
  }
  if (!results.merch || results.merch.length === 0) {
    throw new Error('未找到周边数据文件，请确保文件名包含 "merch"');
  }
  
  const rawData = {
    tour: results.tour[0],
    stops: results.stops,
    merch: results.merch,
  };
  
  const tour = mapToTour(results.tour[0]);
  const stops = results.stops.map((row, index) => mapToStop(row, index));
  const merch = results.merch.map((row) => mapToMerch(row));
  
  return { tour, stops, merch, rawData };
}
