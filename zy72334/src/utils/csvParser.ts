export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line =>
    line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
  )

  return { headers, rows }
}

export function parseJSON(text: string): { headers: string[]; rows: string[][] } {
  const data = JSON.parse(text)
  const arr = Array.isArray(data) ? data : data.data ?? []
  if (arr.length === 0) return { headers: [], rows: [] }

  const headers = Object.keys(arr[0])
  const rows = arr.map(obj => headers.map(h => String(obj[h] ?? '')))

  return { headers, rows }
}

export function toNumericMatrix(rows: string[][], colCount: number): number[][] {
  return rows.map(row => {
    const nums: number[] = []
    for (let i = 0; i < colCount; i++) {
      const val = row[i]
      const num = val === '' || val === undefined || val === null ? NaN : Number(val)
      nums.push(isNaN(num) ? 0 : num)
    }
    return nums
  })
}
