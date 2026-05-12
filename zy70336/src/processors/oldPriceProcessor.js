async function oldPriceProcessor(requestData) {
  const { body } = requestData;
  const { productId, quantity, tenantId } = body;

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
  const tax = Math.round(totalPrice * 0.1);

  return {
    productId,
    quantity,
    basePrice,
    totalPrice,
    tax,
    finalPrice: totalPrice + tax,
    currency: 'CNY',
    processedAt: new Date().toISOString(),
    tenantId
  };
}

module.exports = oldPriceProcessor;
