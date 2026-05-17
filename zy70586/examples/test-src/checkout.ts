// 结账流程示例代码
export function processCheckout(cart: any, user: any) {
  let total = cart.items.reduce((sum: number, item: any) => sum + item.price, 0);

  if (FEATURE_NEW_CHECKOUT) {
    total = applyNewCheckoutLogic(total, user);
    console.log('使用新结账流程');
  } else {
    total = applyLegacyCheckoutLogic(total, user);
    console.log('使用旧结账流程 - 这是死代码！');
  }

  if (FEATURE_VIP_DISCOUNT && user.isVip) {
    total = applyVipDiscount(total);
    console.log('应用VIP折扣');
  }

  return total;
}

function applyNewCheckoutLogic(total: number, user: any) {
  return total * 0.95;
}

function applyLegacyCheckoutLogic(total: number, user: any) {
  return total;
}

function applyVipDiscount(total: number) {
  return total * 0.9;
}
