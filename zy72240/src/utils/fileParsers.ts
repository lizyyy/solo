export interface CustodianConfirmRow {
  securityCode: string
  securityName: string
  amountHKD: number | null
  amountCNY: number | null
  exDividendDate: string
  custodianConfirmRef: string
}

export function parseCsv(text: string): CustodianConfirmRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim())
  const rows: CustodianConfirmRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim())
    if (values.length < headers.length) continue

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ""
    })

    const amountHKD = row.amountHKD ? Number(row.amountHKD) : null
    const amountCNY = row.amountCNY ? Number(row.amountCNY) : null

    rows.push({
      securityCode: row.securityCode || "",
      securityName: row.securityName || "",
      amountHKD: amountHKD && !isNaN(amountHKD) ? amountHKD : null,
      amountCNY: amountCNY && !isNaN(amountCNY) ? amountCNY : null,
      exDividendDate: row.exDividendDate || "",
      custodianConfirmRef: row.custodianConfirmRef || "",
    })
  }

  return rows
}

export interface ExDividendScreenshot {
  securityCode: string
  securityName: string
  correctedExDividendDate: string
  source: string
  note: string
}

export function parseExDividendJson(text: string): ExDividendScreenshot | null {
  try {
    const obj = JSON.parse(text)
    if (!obj.securityCode || !obj.correctedExDividendDate) return null
    return {
      securityCode: obj.securityCode,
      securityName: obj.securityName || "",
      correctedExDividendDate: obj.correctedExDividendDate,
      source: obj.source || "除权日截图",
      note: obj.note || "",
    }
  } catch {
    return null
  }
}

export function exportToCsv(headers: string[], rows: string[][], filename: string) {
  const bom = "\uFEFF"
  const headerLine = headers.join(",")
  const dataLines = rows.map((r) => r.join(",")).join("\n")
  const csvContent = bom + headerLine + "\n" + dataLines

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
