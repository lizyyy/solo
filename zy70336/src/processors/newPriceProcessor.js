async function newPriceProcessor(requestData) {
  const { body } = requestData;
  const { productId, quantity, tenantId, triggerScenario } = body;

  let basePrice = 0;
  switch (productId) {
    case 'prod-001':
      basePrice = 100;
      break;
    case 'prod-002':
      basePrice = 200.50;
      break;
    case 'prod-003':
      basePrice = 50;
      break;
    default:
      basePrice = 99;
  }

  const totalPrice = basePrice * quantity;
  let tax;
  let finalPrice;
  let extraFields = {};
  let missingFields = [];

  if (triggerScenario === 'rounding_diff') {
    tax = Math.ceil(totalPrice * 0.1);
    finalPrice = totalPrice + tax;
  } else if (triggerScenario === 'missing_field') {
    tax = Math.round(totalPrice * 0.1);
    finalPrice = totalPrice + tax;
    missingFields = ['currency'];
  } else if (triggerScenario === 'side_effect') {
    tax = Math.round(totalPrice * 0.1);
    finalPrice = totalPrice + tax;
    extraFields = {
      inventoryUpdated: true,
      inventoryChange: -quantity
    };
  } else {
    tax = Math.round(totalPrice * 0.1);
    finalPrice = totalPrice + tax;
  }

  const response = {
    productId,
    quantity,
    basePrice,
    totalPrice,
    tax,
    finalPrice,
    processedAt: new Date().toISOString(),
    tenantId,
    ...extraFields
  };

  if (!missingFields.includes('currency')) {
    response.currency = 'CNY';
  }

  return response;
}

module.exports = newPriceProcessor;
