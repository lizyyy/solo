import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { PrecheckResult, Issue } from '../types';

interface CsvIssueRow {
  id: string;
  severity: string;
  category: string;
  message: string;
  relatedFiles: string;
  relatedWaypoints: string;
  details: string;
  timestamp: string;
}

export class CsvReporter {
  static async generate(result: PrecheckResult, outputDir: string): Promise<string> {
    const outputPath = path.join(outputDir, 'issues.csv');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const rows = result.issues.map(issue => this.convertToRow(issue));
    
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'severity', title: 'Severity' },
        { id: 'category', title: 'Category' },
        { id: 'message', title: 'Message' },
        { id: 'relatedFiles', title: 'Related Files' },
        { id: 'relatedWaypoints', title: 'Related Waypoints' },
        { id: 'details', title: 'Details' },
        { id: 'timestamp', title: 'Timestamp' },
      ],
    });
    
    await csvWriter.writeRecords(rows);
    return outputPath;
  }

  private static convertToRow(issue: Issue): CsvIssueRow {
    return {
      id: issue.id,
      severity: issue.severity,
      category: issue.category,
      message: issue.message,
      relatedFiles: issue.relatedFiles?.join('; ') || '',
      relatedWaypoints: issue.relatedWaypoints?.join('; ') || '',
      details: issue.details ? JSON.stringify(issue.details, null, 2) : '',
      timestamp: issue.timestamp || '',
    };
  }
}
