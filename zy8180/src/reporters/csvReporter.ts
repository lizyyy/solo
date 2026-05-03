import { Issue } from '../types';
import { formatHex } from '../utils';

export function generateIssuesCsv(issues: Issue[]): string {
  const headers = ['ID', 'Type', 'Severity', 'Title', 'Description', 'Affected Region', 'Address', 'Size'];
  
  const rows = issues.map(issue => [
    issue.id,
    issue.type,
    issue.severity,
    issue.title,
    issue.description,
    issue.affectedRegion || '',
    issue.address !== undefined ? formatHex(issue.address) : '',
    issue.size !== undefined ? issue.size.toString() : ''
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(cell => {
      const escaped = cell.toString().replace(/"/g, '""');
      return escaped.includes(',') || escaped.includes('\n') ? `"${escaped}"` : escaped;
    }).join(',')
  ).join('\n');
}
