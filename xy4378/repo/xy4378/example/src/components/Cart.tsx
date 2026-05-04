import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CartItem {
  id: string;
  name: string;
  price: number;
}

export const Cart: React.FC = () => {
  const { t } = useTranslation();
  const [items] = useState<CartItem[]>([
    { id: '1', name: '商品一', price: 100 },
    { id: '2', name: '商品二', price: 200 },
  ]);
  
  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  
  if (items.length === 0) {
    return (
      <div className="cart-empty">
        <p>{t('cart.empty')}</p>
        <p>请先添加商品到购物车</p>
      </div>
    );
  }
  
  return (
    <div className="cart">
      <h2>{t('cart.items', { count: items.length })}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.name}</span>
            <span>¥{item.price}</span>
          </li>
        ))}
      </ul>
      <div className="total">
        {t('cart.total', { price: `¥${totalPrice}` })}
      </div>
      <button>{t('cart.checkout')}</button>
      <p>总计 {items.length} 件商品</p>
    </div>
  );
};
