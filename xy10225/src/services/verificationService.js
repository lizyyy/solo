const { v4: uuidv4 } = require('uuid');
const { loadStore, saveStore } = require('../storage/dataStore');

const SIGNATURE_TYPES = {
  PHOTO: 'photo',
  SIGNATURE: 'signature',
  WITNESS: 'witness',
  NONE: 'none'
};

const VERIFICATION_STATUS = {
  MATCHED: 'matched',
  PARTIAL_MATCH: 'partial_match',
  MISMATCHED: 'mismatched',
  NEEDS_REVIEW: 'needs_review'
};

const EXCEPTION_TYPES = {
  MISSING_ITEM: 'missing',
  DAMAGED: 'damaged',
  WRONG_ITEM: 'wrong_item',
  EXTRA_ITEM: 'extra',
  SIGNATURE_ISSUE: 'signature_issue',
  OTHER: 'other'
};

const validateSignature = (data) => {
  const errors = [];
  
  if (!data.deliveryId || data.deliveryId.trim() === '') {
    errors.push('投递记录ID不能为空');
  }

  if (!data.verifiedBy || data.verifiedBy.trim() === '') {
    errors.push('核对人ID不能为空');
  }

  if (!data.signatureType || !Object.values(SIGNATURE_TYPES).includes(data.signatureType)) {
    errors.push(`签收类型无效，必须是: ${Object.values(SIGNATURE_TYPES).join(', ')}`);
  }

  if (data.signatureType === SIGNATURE_TYPES.PHOTO && !data.photoEvidence) {
    errors.push('照片签收必须提供照片证据ID');
  }

  return errors;
};

const createSignature = (data) => {
  const store = loadStore();
  const validationErrors = validateSignature(data);
  
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  const delivery = store.deliveries.find(d => d.id === data.deliveryId);
  if (!delivery) {
    return { success: false, errors: ['投递记录不存在'] };
  }

  const volunteer = store.volunteers.find(v => v.id === data.verifiedBy);
  if (!volunteer) {
    return { success: false, errors: ['核对人不存在'] };
  }

  const signature = {
    id: uuidv4(),
    deliveryId: data.deliveryId,
    verifiedBy: data.verifiedBy,
    verifiedByName: volunteer.name,
    signatureType: data.signatureType,
    photoEvidence: data.photoEvidence || null,
    witnessName: data.witnessName || null,
    signatureText: data.signatureText || null,
    signatureDate: data.signatureDate || new Date().toISOString(),
    notes: data.notes || '',
    receivedItems: data.receivedItems || [],
    createdAt: new Date().toISOString()
  };

  store.signatures.push(signature);

  delivery.signatureId = signature.id;
  delivery.status = 'verifying';

  saveStore(store);
  return { success: true, signature };
};

const verifyDelivery = (deliveryId) => {
  const store = loadStore();
  const delivery = store.deliveries.find(d => d.id === deliveryId);
  
  if (!delivery) {
    return { success: false, errors: ['投递记录不存在'] };
  }

  if (!delivery.signatureId) {
    return { success: false, errors: ['投递记录尚未签收'] };
  }

  const signature = store.signatures.find(s => s.id === delivery.signatureId);
  
  if (!signature) {
    return { success: false, errors: ['签收记录不存在'] };
  }

  const verificationResult = compareItems(delivery.items, signature.receivedItems);
  
  const exceptions = [];
  
  verificationResult.missingItems.forEach(item => {
    const exception = createException({
      type: EXCEPTION_TYPES.MISSING_ITEM,
      deliveryId: deliveryId,
      relatedVolunteerId: delivery.volunteerId,
      itemName: item.itemName,
      expectedQuantity: item.quantity,
      receivedQuantity: 0,
      description: `缺少物资: ${item.itemName} (应发: ${item.quantity} ${item.unit}, 实发: 0)`
    }, store);
    exceptions.push(exception);
  });

  verificationResult.extraItems.forEach(item => {
    const exception = createException({
      type: EXCEPTION_TYPES.EXTRA_ITEM,
      deliveryId: deliveryId,
      relatedVolunteerId: delivery.volunteerId,
      itemName: item.itemName,
      expectedQuantity: 0,
      receivedQuantity: item.quantity,
      description: `额外物资: ${item.itemName} (应发: 0, 实发: ${item.quantity} ${item.unit})`
    }, store);
    exceptions.push(exception);
  });

  verificationResult.quantityMismatch.forEach(item => {
    const exception = createException({
      type: EXCEPTION_TYPES.MISSING_ITEM,
      deliveryId: deliveryId,
      relatedVolunteerId: delivery.volunteerId,
      itemName: item.itemName,
      expectedQuantity: item.expected,
      receivedQuantity: item.received,
      description: `数量不符: ${item.itemName} (应发: ${item.expected} ${item.unit}, 实发: ${item.received} ${item.unit})`
    }, store);
    exceptions.push(exception);
  });

  if (signature.signatureType === SIGNATURE_TYPES.NONE) {
    const exception = createException({
      type: EXCEPTION_TYPES.SIGNATURE_ISSUE,
      deliveryId: deliveryId,
      relatedVolunteerId: delivery.volunteerId,
      description: '无有效签收证据'
    }, store);
    exceptions.push(exception);
  }

  const exceptionIds = exceptions.map(e => e.id);
  delivery.exceptionIds = exceptionIds;

  let finalStatus;
  if (verificationResult.matchedItems.length === delivery.items.length && 
      verificationResult.missingItems.length === 0 &&
      verificationResult.extraItems.length === 0 &&
      verificationResult.quantityMismatch.length === 0 &&
      signature.signatureType !== SIGNATURE_TYPES.NONE) {
    finalStatus = VERIFICATION_STATUS.MATCHED;
    delivery.status = 'completed';
  } else if (verificationResult.missingItems.length > 0 || verificationResult.quantityMismatch.length > 0) {
    finalStatus = VERIFICATION_STATUS.MISMATCHED;
    delivery.status = 'exception';
  } else if (verificationResult.extraItems.length > 0 || signature.signatureType === SIGNATURE_TYPES.NONE) {
    finalStatus = VERIFICATION_STATUS.NEEDS_REVIEW;
    delivery.status = 'needs_review';
  } else {
    finalStatus = VERIFICATION_STATUS.PARTIAL_MATCH;
    delivery.status = 'completed_with_notes';
  }

  saveStore(store);

  return {
    success: true,
    deliveryId: deliveryId,
    status: finalStatus,
    verificationResult: verificationResult,
    exceptions: exceptions,
    needsManualReview: finalStatus === VERIFICATION_STATUS.NEEDS_REVIEW || 
                       finalStatus === VERIFICATION_STATUS.MISMATCHED
  };
};

const compareItems = (expectedItems, receivedItems) => {
  const result = {
    matchedItems: [],
    missingItems: [],
    extraItems: [],
    quantityMismatch: []
  };

  const expectedMap = new Map();
  expectedItems.forEach(item => {
    expectedMap.set(item.itemName, { ...item });
  });

  const receivedMap = new Map();
  receivedItems.forEach(item => {
    receivedMap.set(item.itemName, { ...item });
  });

  expectedMap.forEach((expected, name) => {
    if (receivedMap.has(name)) {
      const received = receivedMap.get(name);
      if (received.quantity === expected.quantity) {
        result.matchedItems.push({
          itemName: name,
          quantity: expected.quantity,
          unit: expected.unit
        });
      } else if (received.quantity < expected.quantity) {
        result.quantityMismatch.push({
          itemName: name,
          expected: expected.quantity,
          received: received.quantity,
          unit: expected.unit
        });
        result.matchedItems.push({
          itemName: name,
          quantity: received.quantity,
          unit: expected.unit
        });
      } else {
        result.quantityMismatch.push({
          itemName: name,
          expected: expected.quantity,
          received: received.quantity,
          unit: expected.unit
        });
        result.matchedItems.push({
          itemName: name,
          quantity: expected.quantity,
          unit: expected.unit
        });
        result.extraItems.push({
          itemName: name,
          quantity: received.quantity - expected.quantity,
          unit: expected.unit
        });
      }
      receivedMap.delete(name);
    } else {
      result.missingItems.push(expected);
    }
  });

  receivedMap.forEach((received, name) => {
    result.extraItems.push(received);
  });

  return result;
};

const createException = (data, existingStore = null) => {
  const store = existingStore || loadStore();
  
  const exception = {
    id: uuidv4(),
    type: data.type,
    deliveryId: data.deliveryId,
    relatedVolunteerId: data.relatedVolunteerId,
    itemName: data.itemName || null,
    expectedQuantity: data.expectedQuantity || null,
    receivedQuantity: data.receivedQuantity || null,
    description: data.description,
    status: 'open',
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: null,
    createdAt: new Date().toISOString()
  };

  store.exceptions.push(exception);
  
  if (!existingStore) {
    saveStore(store);
  }
  
  return exception;
};

const listExceptions = (options = {}) => {
  const store = loadStore();
  let exceptions = [...store.exceptions];

  if (options.status) {
    exceptions = exceptions.filter(e => e.status === options.status);
  }

  if (options.type) {
    exceptions = exceptions.filter(e => e.type === options.type);
  }

  if (options.volunteerId) {
    exceptions = exceptions.filter(e => e.relatedVolunteerId === options.volunteerId);
  }

  return exceptions;
};

const getVerificationReport = () => {
  const store = loadStore();
  const report = {
    summary: {
      totalDeliveries: store.deliveries.length,
      completed: store.deliveries.filter(d => d.status === 'completed').length,
      pending: store.deliveries.filter(d => d.status === 'pending_verification').length,
      verifying: store.deliveries.filter(d => d.status === 'verifying').length,
      exception: store.deliveries.filter(d => d.status === 'exception').length,
      needsReview: store.deliveries.filter(d => d.status === 'needs_review').length,
      totalExceptions: store.exceptions.length,
      openExceptions: store.exceptions.filter(e => e.status === 'open').length,
      resolvedExceptions: store.exceptions.filter(e => e.status === 'resolved').length
    },
    needsManualReview: store.deliveries.filter(d => 
      d.status === 'exception' || d.status === 'needs_review'
    ).map(d => ({
      deliveryId: d.id,
      householdName: d.householdName,
      volunteerName: d.volunteerName,
      status: d.status,
      exceptionCount: d.exceptionIds.length,
      deliveryDate: d.deliveryDate
    }))
  };

  return report;
};

module.exports = {
  SIGNATURE_TYPES,
  VERIFICATION_STATUS,
  EXCEPTION_TYPES,
  validateSignature,
  createSignature,
  verifyDelivery,
  compareItems,
  createException,
  listExceptions,
  getVerificationReport
};
