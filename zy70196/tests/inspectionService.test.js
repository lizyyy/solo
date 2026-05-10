const { 
  validateInspectionItem, 
  determineInspectionItemResult, 
  determineOverallInspectionResult,
  validateInspectionQuantity,
  InspectionResult 
} = require('../src/services/inspectionService')

describe('Inspection Service - validateInspectionItem', () => {
  it('should return no errors for valid item', () => {
    const item = {
      deliveryItemId: 'test-delivery-item-1',
      inspectedQty: 100,
      qualifiedQty: 95,
      defectQty: 5
    }
    const errors = validateInspectionItem(item)
    expect(errors).toHaveLength(0)
  })

  it('should return error when deliveryItemId is missing', () => {
    const item = {
      inspectedQty: 100,
      qualifiedQty: 95,
      defectQty: 5
    }
    const errors = validateInspectionItem(item)
    expect(errors).toContain('Delivery item ID is required')
  })

  it('should return error when inspectedQty is negative', () => {
    const item = {
      deliveryItemId: 'test-delivery-item-1',
      inspectedQty: -10,
      qualifiedQty: 95,
      defectQty: 5
    }
    const errors = validateInspectionItem(item)
    expect(errors).toContain('Inspected quantity cannot be negative')
  })

  it('should return error when qualifiedQty is negative', () => {
    const item = {
      deliveryItemId: 'test-delivery-item-1',
      inspectedQty: 100,
      qualifiedQty: -5,
      defectQty: 5
    }
    const errors = validateInspectionItem(item)
    expect(errors).toContain('Qualified quantity cannot be negative')
  })

  it('should return error when defectQty is negative', () => {
    const item = {
      deliveryItemId: 'test-delivery-item-1',
      inspectedQty: 100,
      qualifiedQty: 95,
      defectQty: -5
    }
    const errors = validateInspectionItem(item)
    expect(errors).toContain('Defect quantity cannot be negative')
  })
})

describe('Inspection Service - determineInspectionItemResult', () => {
  it('should return PENDING when inspected quantity is zero', () => {
    const item = { inspectedQty: 0, qualifiedQty: 0, defectQty: 0 }
    const result = determineInspectionItemResult(item)
    expect(result).toBe(InspectionResult.PENDING)
  })

  it('should return PASS when no defects', () => {
    const item = { inspectedQty: 100, qualifiedQty: 100, defectQty: 0 }
    const result = determineInspectionItemResult(item)
    expect(result).toBe(InspectionResult.PASS)
  })

  it('should return PARTIAL_PASS when there are some defects', () => {
    const item = { inspectedQty: 100, qualifiedQty: 95, defectQty: 5 }
    const result = determineInspectionItemResult(item)
    expect(result).toBe(InspectionResult.PARTIAL_PASS)
  })

  it('should return FAIL when defects exceed qualified', () => {
    const item = { inspectedQty: 100, qualifiedQty: 40, defectQty: 60 }
    const result = determineInspectionItemResult(item)
    expect(result).toBe(InspectionResult.FAIL)
  })

  it('should handle string inputs', () => {
    const item = { inspectedQty: '100', qualifiedQty: '95', defectQty: '5' }
    const result = determineInspectionItemResult(item)
    expect(result).toBe(InspectionResult.PARTIAL_PASS)
  })
})

describe('Inspection Service - determineOverallInspectionResult', () => {
  it('should return PENDING when all items are pending', () => {
    const items = [
      { inspectedQty: 0, qualifiedQty: 0, defectQty: 0 },
      { inspectedQty: 0, qualifiedQty: 0, defectQty: 0 }
    ]
    const result = determineOverallInspectionResult(items)
    expect(result).toBe(InspectionResult.PENDING)
  })

  it('should return FAIL when any item fails', () => {
    const items = [
      { inspectedQty: 100, qualifiedQty: 40, defectQty: 60 },
      { inspectedQty: 50, qualifiedQty: 50, defectQty: 0 }
    ]
    const result = determineOverallInspectionResult(items)
    expect(result).toBe(InspectionResult.FAIL)
  })

  it('should return PARTIAL_PASS when no failures but some defects', () => {
    const items = [
      { inspectedQty: 100, qualifiedQty: 95, defectQty: 5 },
      { inspectedQty: 50, qualifiedQty: 50, defectQty: 0 }
    ]
    const result = determineOverallInspectionResult(items)
    expect(result).toBe(InspectionResult.PARTIAL_PASS)
  })

  it('should return PASS when all items pass', () => {
    const items = [
      { inspectedQty: 100, qualifiedQty: 100, defectQty: 0 },
      { inspectedQty: 50, qualifiedQty: 50, defectQty: 0 }
    ]
    const result = determineOverallInspectionResult(items)
    expect(result).toBe(InspectionResult.PASS)
  })
})

describe('Inspection Service - validateInspectionQuantity', () => {
  it('should return no errors when quantities are valid', () => {
    const deliveryItem = { receivedQty: 100 }
    const inspectionItem = { inspectedQty: 100, qualifiedQty: 95, defectQty: 5 }
    const errors = validateInspectionQuantity(deliveryItem, inspectionItem)
    expect(errors).toHaveLength(0)
  })

  it('should return error when inspected exceeds received', () => {
    const deliveryItem = { receivedQty: 100 }
    const inspectionItem = { inspectedQty: 110, qualifiedQty: 95, defectQty: 5 }
    const errors = validateInspectionQuantity(deliveryItem, inspectionItem)
    expect(errors).toContain('Inspected quantity (110) cannot exceed received quantity (100)')
  })

  it('should return error when qualified + defect exceeds inspected', () => {
    const deliveryItem = { receivedQty: 100 }
    const inspectionItem = { inspectedQty: 100, qualifiedQty: 60, defectQty: 50 }
    const errors = validateInspectionQuantity(deliveryItem, inspectionItem)
    expect(errors).toContain('Sum of qualified (60) and defect (50) cannot exceed inspected quantity (100)')
  })

  it('should return multiple errors for multiple issues', () => {
    const deliveryItem = { receivedQty: 100 }
    const inspectionItem = { inspectedQty: 110, qualifiedQty: 60, defectQty: 60 }
    const errors = validateInspectionQuantity(deliveryItem, inspectionItem)
    expect(errors.length).toBeGreaterThan(1)
  })

  it('should handle partial inspection', () => {
    const deliveryItem = { receivedQty: 100 }
    const inspectionItem = { inspectedQty: 50, qualifiedQty: 45, defectQty: 5 }
    const errors = validateInspectionQuantity(deliveryItem, inspectionItem)
    expect(errors).toHaveLength(0)
  })

  it('should handle zero defect quantity', () => {
    const deliveryItem = { receivedQty: 100 }
    const inspectionItem = { inspectedQty: 100, qualifiedQty: 100, defectQty: 0 }
    const errors = validateInspectionQuantity(deliveryItem, inspectionItem)
    expect(errors).toHaveLength(0)
  })
})
