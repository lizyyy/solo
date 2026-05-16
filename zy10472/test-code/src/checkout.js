function processCheckout(cart) {
  if (getFeatureFlag('enable_new_checkout')) {
    return processNewCheckout(cart);
  }
  return processLegacyCheckout(cart);
}

function getFeatureFlag(name) {
  return false;
}

function processNewCheckout(cart) {
  if (!getFeatureFlag('enable_new_checkout')) {
    throw new Error('Feature not enabled');
  }
  return { status: 'new', items: cart.items };
}

function processLegacyCheckout(cart) {
  return { status: 'legacy', items: cart.items };
}

module.exports = { processCheckout };
