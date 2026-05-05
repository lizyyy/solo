import Papa from 'papaparse'

export function parseCSV(csvContent) {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    encoding: 'UTF-8'
  })

  if (result.errors.length > 0) {
    console.warn('CSV解析警告:', result.errors)
  }

  return result.data || []
}

export function parseJSON(jsonContent) {
  try {
    const data = JSON.parse(jsonContent)
    
    if (Array.isArray(data)) {
      return data
    }
    
    if (data.samples && Array.isArray(data.samples)) {
      return data.samples
    }
    
    if (data.data && Array.isArray(data.data)) {
      return data.data
    }
    
    return [data]
  } catch (error) {
    throw new Error(`JSON解析失败: ${error.message}`)
  }
}

export function isValidSample(sample) {
  if (!sample || typeof sample !== 'object') return false
  
  const hasRequiredField = 
    sample.blindNumber || 
    sample.盲样编号 || 
    sample.匿名编号 ||
    sample.batchNumber ||
    sample.批次号 ||
    sample.茶样批次
  
  return !!hasRequiredField
}

export function cleanSampleData(sample) {
  const cleaned = { ...sample }
  
  Object.keys(cleaned).forEach(key => {
    if (typeof cleaned[key] === 'string') {
      cleaned[key] = cleaned[key].trim()
    }
  })
  
  return cleaned
}
