const { 
  validateDeliveryItem, 
  calculateDeliveryItem, 
  determineDeliveryStatus,
  DeliveryStatus 
} = require('../src/services/deliveryService')

describe('Delivery Service - validateDeliveryItem', () => {
  it('should return no errors for valid item', () => {
    const item = {
      productId: 'test-prod-1',
      expectedQty: 100,
      receivedQty: 95,
      unitPrice: 10.5
    }
    const errors = validateDeliveryItem(item)
    expect(errors).toHaveLength(0)
  })

  it('should return error when productId is missing', () => {
    const item = {
      expectedQty: 100,
      receivedQty: 95,
      unitPrice: 10.5
    }
    const errors = validateDeliveryItem(item)
    expect(errors).toContain('Product ID is required')
  })

  it('should return error when expectedQty is missing', () => {
    const item = {
      productId: 'test-prod-1',
      receivedQty: 95,
      unitPrice: 10.5
    }
    const errors = validateDeliveryItem(item)
    expect(errors).toContain('Expected quantity is required')
  })

  it('should return error when expectedQty is negative', () => {
    const item = {
      productId: 'test-prod-1',
      expectedQty: -10,
      receivedQty: 95,
      unitPrice: 10.5
    }
    const errors = validateDeliveryItem(item)
    expect(errors).toContain('Expected quantity cannot be negative')
  })

  it('should return error when receivedQty is negative', () => {
    const item = {
      productId: 'test-prod-1',
      expectedQty: 100,
      receivedQty: -5,
      unitPrice: 10.5
    }
    const errors = validateDeliveryItem(item)
    expect(errors).toContain('Received quantity cannot be negative')
  })

  it('should return error when unitPrice is negative', () => {
    const item = {
      productId: 'test-prod-1',
      expectedQty: 100,
      receivedQty: 95,
      unitPrice: -10.5
    }
    const errors = validateDeliveryItem(item)
    expect(errors).toContain('Unit price cannot be negative')
  })

  it('should return multiple errors for multiple issues', () => {
    const item = {
      expectedQty: -10,
      receivedQty: -5,
      unitPrice: -10.5
    }
    const errors = validateDeliveryItem(item)
    expect(errors.length).toBeGreaterThan(1)
  })
})

describe('Delivery Service - calculateDeliveryItem', () => {
  it('should calculate positive difference when received < expected (shortage)', () => {
    const item = {
      expectedQty: 100,
      receivedQty: 95,
      unitPrice: 10
    }
    const result = calculateDeliveryItem(item)
    expect(result.differenceQty).toBe(5)
    expect(result.amount).toBe(950)
  })

  it('should calculate negative difference when received > expected (overage)', () => {
    const item = {
      expectedQty: 100,
      receivedQty: 105,
      unitPrice: 10
    }
    const result = calculateDeliveryItem(item)
    expect(result.differenceQty).toBe(-5)
    expect(result.amount).toBe(1050)
  })

  it('should calculate zero difference when received equals expected', () => {
    const item = {
      expectedQty: 100,
      receivedQty: 100,
      unitPrice: 10
    }
    const result = calculateDeliveryItem(item)
    expect(result.differenceQty).toBe(0)
    expect(result.amount).toBe(1000)
  })

  it('should handle string inputs', () => {
    const item = {
      expectedQty: '100',
      receivedQty: '95',
      unitPrice: '10.5'
    }
    const result = calculateDeliveryItem(item)
    expect(result.differenceQty).toBe(5)
    expect(result.amount).toBe(997.5)
  })

  it('should handle null/undefined values gracefully', () => {
    const item = {
      expectedQty: null,
      receivedQty: undefined,
      unitPrice: null
    }
    const result = calculateDeliveryItem(item)
    expect(result.differenceQty).toBe(0)
    expect(result.amount).toBe(0)
  })
})

describe('Delivery Service - determineDeliveryStatus', () => {
  it('should return RECEIVED when all items have no difference', () => {
    const items = [
      { expectedQty: 100, receivedQty: 100, unitPrice: 10 },
      { expectedQty: 50, receivedQty: 50, unitPrice: 20 }
    ]
    const status = determineDeliveryStatus(items)
    expect(status).toBe(DeliveryStatus.RECEIVED)
  })

  it('should return PARTIAL when some received but with differences', () => {
    const items = [
      { expectedQty: 100, receivedQty: 95, unitPrice: 10 },
      { expectedQty: 50, receivedQty: 50, unitPrice: 20 }
    ]
    const status = determineDeliveryStatus(items)
    expect(status).toBe(DeliveryStatus.PARTIAL)
  })

  it('should return PARTIAL when has overage items', () => {
    const items = [
      { expectedQty: 100, receivedQty: 105, unitPrice: 10 }
    ]
    const status = determineDeliveryStatus(items)
    expect(status).toBe(DeliveryStatus.PARTIAL)
  })

  it('should return EXCEPTION when no items received', () => {
    const items = [
      { expectedQty: 100, receivedQty: 0, unitPrice: 10 }
    ]
    const status = determineDeliveryStatus(items)
    expect(status).toBe(DeliveryStatus.EXCEPTION)
  })

  it('should return RECEIVED when all zero but matching', () => {
    const items = [
      { expectedQty: 0, receivedQty: 0, unitPrice: 10 }
    ]
    const status = determineDeliveryStatus(items)
    expect(status).toBe(DeliveryStatus.RECEIVED)
  })
})
