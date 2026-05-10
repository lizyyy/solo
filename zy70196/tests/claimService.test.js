const { 
  validateClaimItem, 
  calculateClaimAmount, 
  determineResponsibility,
  validateClaimQuantities,
  calculateClaimSummary,
  hasClaimableItems,
  checkForMissingResponsibilities,
  ResponsibilityType,
  ClaimStatus
} = require('../src/services/claimService')
const { InspectionResult } = require('../src/services/inspectionService')

describe('Claim Service - validateClaimItem', () => {
  it('should return no errors for valid item', () => {
    const item = {
      deliveryItemId: 'test-delivery-item-1',
      shortageQty: 5,
      defectQty: 2,
      responsibility: ResponsibilityType.SUPPLIER,
      unitPrice: 10
    }
    const errors = validateClaimItem(item)
    expect(errors).toHaveLength(0)
  })

  it('should return error when deliveryItemId is missing', () => {
    const item = {
      shortageQty: 5,
      defectQty: 2,
      responsibility: ResponsibilityType.SUPPLIER,
      unitPrice: 10
    }
    const errors = validateClaimItem(item)
    expect(errors).toContain('Delivery item ID is required')
  })

  it('should return error when shortageQty is negative', () => {
    const item = {
      deliveryItemId: 'test-delivery-item-1',
      shortageQty: -5,
      defectQty: 2,
      responsibility: ResponsibilityType.SUPPLIER,
      unitPrice: 10
    }
    const errors = validateClaimItem(item)
    expect(errors).toContain('Shortage quantity cannot be negative')
  })

  it('should return error when defectQty is negative', () => {
    const item = {
      deliveryItemId: 'test-delivery-item-1',
      shortageQty: 5,
      defectQty: -2,
      responsibility: ResponsibilityType.SUPPLIER,
      unitPrice: 10
    }
    const errors = validateClaimItem(item)
    expect(errors).toContain('Defect quantity cannot be negative')
  })

  it('should return error when responsibility is missing', () => {
    const item = {
      deliveryItemId: 'test-delivery-item-1',
      shortageQty: 5,
      defectQty: 2,
      unitPrice: 10
    }
    const errors = validateClaimItem(item)
    expect(errors).toContain('Responsibility type is required')
  })

  it('should return error when responsibility is invalid', () => {
    const item = {
      deliveryItemId: 'test-delivery-item-1',
      shortageQty: 5,
      defectQty: 2,
      responsibility: 'INVALID_TYPE',
      unitPrice: 10
    }
    const errors = validateClaimItem(item)
    expect(errors).toContain('Invalid responsibility type: INVALID_TYPE')
  })

  it('should return error when unitPrice is negative', () => {
    const item = {
      deliveryItemId: 'test-delivery-item-1',
      shortageQty: 5,
      defectQty: 2,
      responsibility: ResponsibilityType.SUPPLIER,
      unitPrice: -10
    }
    const errors = validateClaimItem(item)
    expect(errors).toContain('Unit price cannot be negative')
  })
})

describe('Claim Service - calculateClaimAmount', () => {
  it('should calculate claim amount correctly for shortage only', () => {
    const item = { shortageQty: 10, defectQty: 0, unitPrice: 5 }
    const result = calculateClaimAmount(item)
    expect(result.totalClaimQty).toBe(10)
    expect(result.claimAmount).toBe(50)
  })

  it('should calculate claim amount correctly for defect only', () => {
    const item = { shortageQty: 0, defectQty: 5, unitPrice: 10 }
    const result = calculateClaimAmount(item)
    expect(result.totalClaimQty).toBe(5)
    expect(result.claimAmount).toBe(50)
  })

  it('should calculate claim amount correctly for both shortage and defect', () => {
    const item = { shortageQty: 10, defectQty: 5, unitPrice: 5 }
    const result = calculateClaimAmount(item)
    expect(result.totalClaimQty).toBe(15)
    expect(result.claimAmount).toBe(75)
  })

  it('should handle string inputs', () => {
    const item = { shortageQty: '10', defectQty: '5', unitPrice: '5.5' }
    const result = calculateClaimAmount(item)
    expect(result.totalClaimQty).toBe(15)
    expect(result.claimAmount).toBe(82.5)
  })

  it('should return zero when no shortage and no defect', () => {
    const item = { shortageQty: 0, defectQty: 0, unitPrice: 10 }
    const result = calculateClaimAmount(item)
    expect(result.totalClaimQty).toBe(0)
    expect(result.claimAmount).toBe(0)
  })

  it('should handle null/undefined values gracefully', () => {
    const item = { shortageQty: null, defectQty: undefined, unitPrice: null }
    const result = calculateClaimAmount(item)
    expect(result.totalClaimQty).toBe(0)
    expect(result.claimAmount).toBe(0)
  })
})

describe('Claim Service - determineResponsibility', () => {
  it('should return SUPPLIER for shortage only', () => {
    const result = determineResponsibility(10, 0, null, 10)
    expect(result).toBe(ResponsibilityType.SUPPLIER)
  })

  it('should return SUPPLIER for defect only with FAIL inspection', () => {
    const result = determineResponsibility(0, 5, InspectionResult.FAIL, 0)
    expect(result).toBe(ResponsibilityType.SUPPLIER)
  })

  it('should return SUPPLIER for defect only', () => {
    const result = determineResponsibility(0, 5, InspectionResult.PARTIAL_PASS, 0)
    expect(result).toBe(ResponsibilityType.SUPPLIER)
  })

  it('should return SUPPLIER for both shortage and defect', () => {
    const result = determineResponsibility(10, 5, InspectionResult.PARTIAL_PASS, 10)
    expect(result).toBe(ResponsibilityType.SUPPLIER)
  })

  it('should return SUPPLIER when delivery difference is positive', () => {
    const result = determineResponsibility(0, 0, null, 10)
    expect(result).toBe(ResponsibilityType.SUPPLIER)
  })

  it('should return UNDEFINED when no claimable issues', () => {
    const result = determineResponsibility(0, 0, InspectionResult.PASS, 0)
    expect(result).toBe(ResponsibilityType.UNDEFINED)
  })
})

describe('Claim Service - validateClaimQuantities', () => {
  it('should return no errors when quantities are valid', () => {
    const claimItem = { shortageQty: 5, defectQty: 2 }
    const deliveryItem = { differenceQty: 10 }
    const inspectionItem = { defectQty: 5 }
    const errors = validateClaimQuantities(claimItem, deliveryItem, inspectionItem)
    expect(errors).toHaveLength(0)
  })

  it('should return error when shortage exceeds delivery difference', () => {
    const claimItem = { shortageQty: 15, defectQty: 2 }
    const deliveryItem = { differenceQty: 10 }
    const inspectionItem = { defectQty: 5 }
    const errors = validateClaimQuantities(claimItem, deliveryItem, inspectionItem)
    expect(errors).toContain('Shortage quantity (15) cannot exceed delivery difference (10)')
  })

  it('should return error when defect exceeds inspection defect', () => {
    const claimItem = { shortageQty: 5, defectQty: 10 }
    const deliveryItem = { differenceQty: 10 }
    const inspectionItem = { defectQty: 5 }
    const errors = validateClaimQuantities(claimItem, deliveryItem, inspectionItem)
    expect(errors).toContain('Defect quantity (10) cannot exceed inspection defect quantity (5)')
  })

  it('should return multiple errors for multiple issues', () => {
    const claimItem = { shortageQty: 20, defectQty: 10 }
    const deliveryItem = { differenceQty: 10 }
    const inspectionItem = { defectQty: 5 }
    const errors = validateClaimQuantities(claimItem, deliveryItem, inspectionItem)
    expect(errors.length).toBeGreaterThan(1)
  })

  it('should handle no inspection item', () => {
    const claimItem = { shortageQty: 5, defectQty: 0 }
    const deliveryItem = { differenceQty: 10 }
    const errors = validateClaimQuantities(claimItem, deliveryItem, null)
    expect(errors).toHaveLength(0)
  })

  it('should not allow defect when no inspection item', () => {
    const claimItem = { shortageQty: 5, defectQty: 5 }
    const deliveryItem = { differenceQty: 10 }
    const errors = validateClaimQuantities(claimItem, deliveryItem, null)
    expect(errors).toContain('Defect quantity (5) cannot exceed inspection defect quantity (0)')
  })
})

describe('Claim Service - calculateClaimSummary', () => {
  it('should calculate summary correctly', () => {
    const items = [
      { shortageQty: 10, defectQty: 5, claimAmount: 150 },
      { shortageQty: 5, defectQty: 2, claimAmount: 70 },
      { shortageQty: 0, defectQty: 0, claimAmount: 0 }
    ]
    const summary = calculateClaimSummary(items)
    expect(summary.totalShortageQty).toBe(15)
    expect(summary.totalDefectQty).toBe(7)
    expect(summary.totalClaimAmount).toBe(220)
  })

  it('should return zeros for empty array', () => {
    const summary = calculateClaimSummary([])
    expect(summary.totalShortageQty).toBe(0)
    expect(summary.totalDefectQty).toBe(0)
    expect(summary.totalClaimAmount).toBe(0)
  })

  it('should handle string and numeric values', () => {
    const items = [
      { shortageQty: '10', defectQty: '5', claimAmount: '150.5' }
    ]
    const summary = calculateClaimSummary(items)
    expect(summary.totalShortageQty).toBe(10)
    expect(summary.totalDefectQty).toBe(5)
    expect(summary.totalClaimAmount).toBe(150.5)
  })
})

describe('Claim Service - hasClaimableItems', () => {
  it('should return true when has shortage', () => {
    const delivery = {
      items: [
        { differenceQty: 5 },
        { differenceQty: 0 }
      ]
    }
    const result = hasClaimableItems(delivery, null)
    expect(result).toBe(true)
  })

  it('should return true when has defect', () => {
    const delivery = {
      items: [
        { differenceQty: 0 }
      ]
    }
    const inspection = {
      items: [
        { defectQty: 5 }
      ]
    }
    const result = hasClaimableItems(delivery, inspection)
    expect(result).toBe(true)
  })

  it('should return true when has both shortage and defect', () => {
    const delivery = {
      items: [
        { differenceQty: 5 }
      ]
    }
    const inspection = {
      items: [
        { defectQty: 5 }
      ]
    }
    const result = hasClaimableItems(delivery, inspection)
    expect(result).toBe(true)
  })

  it('should return false when no shortage and no defect', () => {
    const delivery = {
      items: [
        { differenceQty: 0 }
      ]
    }
    const inspection = {
      items: [
        { defectQty: 0 }
      ]
    }
    const result = hasClaimableItems(delivery, inspection)
    expect(result).toBe(false)
  })

  it('should return false when no inspection and no shortage', () => {
    const delivery = {
      items: [
        { differenceQty: 0 }
      ]
    }
    const result = hasClaimableItems(delivery, null)
    expect(result).toBe(false)
  })
})

describe('Claim Service - checkForMissingResponsibilities', () => {
  it('should return null when all responsibilities defined', () => {
    const items = [
      { responsibility: ResponsibilityType.SUPPLIER },
      { responsibility: ResponsibilityType.LOGISTICS }
    ]
    const result = checkForMissingResponsibilities(items)
    expect(result).toBeNull()
  })

  it('should return missing items when some are undefined', () => {
    const items = [
      { id: '1', responsibility: ResponsibilityType.SUPPLIER },
      { id: '2', responsibility: ResponsibilityType.UNDEFINED },
      { id: '3', responsibility: ResponsibilityType.INTERNAL }
    ]
    const result = checkForMissingResponsibilities(items)
    expect(result).not.toBeNull()
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('2')
  })

  it('should return all items when all are undefined', () => {
    const items = [
      { id: '1', responsibility: ResponsibilityType.UNDEFINED },
      { id: '2', responsibility: ResponsibilityType.UNDEFINED }
    ]
    const result = checkForMissingResponsibilities(items)
    expect(result).not.toBeNull()
    expect(result.length).toBe(2)
  })
})
