export class BusinessError extends Error {
  public severity: 'warning' | 'error' | 'fatal'
  public sourceFile?: string
  public sourceLine?: number
  public objectKey?: string

  constructor(
    message: string,
    options?: {
      severity?: 'warning' | 'error' | 'fatal'
      sourceFile?: string
      sourceLine?: number
      objectKey?: string
    }
  ) {
    super(message)
    this.name = 'BusinessError'
    this.severity = options?.severity ?? 'error'
    this.sourceFile = options?.sourceFile
    this.sourceLine = options?.sourceLine
    this.objectKey = options?.objectKey
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      severity: this.severity,
      ...(this.sourceFile ? { sourceFile: this.sourceFile } : {}),
      ...(this.sourceLine != null ? { sourceLine: this.sourceLine } : {}),
      ...(this.objectKey ? { objectKey: this.objectKey } : {}),
    }
  }
}

export class ImportRowError {
  public sourceFile: string
  public rowNumber: number
  public reason: string
  public objectKey?: string

  constructor(sourceFile: string, rowNumber: number, reason: string, objectKey?: string) {
    this.sourceFile = sourceFile
    this.rowNumber = rowNumber
    this.reason = reason
    this.objectKey = objectKey
  }

  toJSON() {
    return {
      sourceFile: this.sourceFile,
      rowNumber: this.rowNumber,
      reason: this.reason,
      ...(this.objectKey ? { objectKey: this.objectKey } : {}),
    }
  }
}
