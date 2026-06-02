export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJSON(data: any, filename: string): void {
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

export function downloadCSV(rows: Record<string, any>[], filename: string): void {
  if (rows.length === 0) {
    downloadFile('', filename, 'text/csv;charset=utf-8;');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      headers.map(header => {
        const cell = String(row[header] ?? '');
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
  ].join('\n');

  downloadFile('\uFEFF' + csvContent, filename, 'text/csv;charset=utf-8;');
}

export function downloadMarkdown(content: string, filename: string): void {
  downloadFile(content, filename, 'text/markdown;charset=utf-8;');
}
