import type {
  Order,
  DogInfo,
  Address,
  Coupon,
} from '../types';
import { sampleOrders } from '../data/mockOrders';

const STORAGE_KEYS = {
  ORDERS: 'dogwalker_orders',
  DOGS: 'dogwalker_dogs',
  ADDRESSES: 'dogwalker_addresses',
  COUPONS: 'dogwalker_coupons',
  WALLET: 'dogwalker_wallet',
  FAVORITES: 'dogwalker_favorites',
};

const getStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage error:', e);
  }
};

export const orderApi = {
  getOrders: (): Order[] => {
    return getStorage(STORAGE_KEYS.ORDERS, sampleOrders);
  },

  getOrderById: (id: string): Order | undefined => {
    const orders = orderApi.getOrders();
    return orders.find((o) => o.id === id);
  },

  getOrdersByStatus: (status: Order['status'] | 'all'): Order[] => {
    const orders = orderApi.getOrders();
    if (status === 'all') return orders;
    return orders.filter((o) => o.status === status);
  },

  createOrder: (order: Omit<Order, 'id' | 'orderNo' | 'createTime' | 'status'>): Order => {
    const orders = orderApi.getOrders();
    const newOrder: Order = {
      ...order,
      id: Date.now().toString(),
      orderNo: generateOrderNo(),
      createTime: new Date().toISOString(),
      status: 'pending_payment',
      videos: [],
      photos: [],
    };
    orders.unshift(newOrder);
    setStorage(STORAGE_KEYS.ORDERS, orders);
    return newOrder;
  },

  updateOrderStatus: (orderId: string, status: Order['status']): Order | undefined => {
    const orders = orderApi.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index !== -1) {
      orders[index].status = status;
      if (status === 'in_progress') {
        orders[index].checkInTime = new Date().toISOString();
      } else if (status === 'completed') {
        orders[index].checkOutTime = new Date().toISOString();
      }
      setStorage(STORAGE_KEYS.ORDERS, orders);
      return orders[index];
    }
    return undefined;
  },

  addOrderMedia: (orderId: string, type: 'video' | 'photo', url: string): Order | undefined => {
    const orders = orderApi.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index !== -1) {
      if (type === 'video') {
        orders[index].videos.push(url);
      } else {
        orders[index].photos.push(url);
      }
      setStorage(STORAGE_KEYS.ORDERS, orders);
      return orders[index];
    }
    return undefined;
  },

  replicateOrder: (orderId: string): Order | undefined => {
    const originalOrder = orderApi.getOrderById(orderId);
    if (!originalOrder) return undefined;
    const { id, orderNo, createTime, status, checkInTime, checkOutTime, review, ...rest } = originalOrder;
    return orderApi.createOrder({
      ...rest,
      appointmentTime: new Date().toISOString(),
    });
  },

  addOrderReview: (
    orderId: string,
    reviewData: { rating: number; content: string; feederId: string }
  ): Order | undefined => {
    const orders = orderApi.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index !== -1) {
      const review = {
        id: Date.now().toString(),
        rating: reviewData.rating,
        content: reviewData.content,
        photos: [],
        createTime: new Date().toISOString(),
        feederId: reviewData.feederId,
        orderId: orderId,
      };
      orders[index].review = review;
      setStorage(STORAGE_KEYS.ORDERS, orders);
      return orders[index];
    }
    return undefined;
  },
};

export const dogApi = {
  getDogs: (): DogInfo[] => {
    return getStorage(STORAGE_KEYS.DOGS, []);
  },

  getDogById: (id: string): DogInfo | undefined => {
    const dogs = dogApi.getDogs();
    return dogs.find((d) => d.id === id);
  },

  addDog: (dog: Omit<DogInfo, 'id'>): DogInfo => {
    const dogs = dogApi.getDogs();
    const newDog: DogInfo = {
      ...dog,
      id: Date.now().toString(),
    };
    dogs.push(newDog);
    setStorage(STORAGE_KEYS.DOGS, dogs);
    return newDog;
  },

  updateDog: (dog: DogInfo): DogInfo | undefined => {
    const dogs = dogApi.getDogs();
    const index = dogs.findIndex((d) => d.id === dog.id);
    if (index !== -1) {
      dogs[index] = dog;
      setStorage(STORAGE_KEYS.DOGS, dogs);
      return dogs[index];
    }
    return undefined;
  },

  deleteDog: (id: string): boolean => {
    const dogs = dogApi.getDogs();
    const index = dogs.findIndex((d) => d.id === id);
    if (index !== -1) {
      dogs.splice(index, 1);
      setStorage(STORAGE_KEYS.DOGS, dogs);
      return true;
    }
    return false;
  },
};

export const addressApi = {
  getAddresses: (): Address[] => {
    return getStorage(STORAGE_KEYS.ADDRESSES, []);
  },

  getDefaultAddress: (): Address | undefined => {
    const addresses = addressApi.getAddresses();
    return addresses.find((a) => a.isDefault);
  },

  addAddress: (address: Omit<Address, 'id'>): Address => {
    const addresses = addressApi.getAddresses();
    if (address.isDefault) {
      addresses.forEach((a) => (a.isDefault = false));
    }
    const newAddress: Address = {
      ...address,
      id: Date.now().toString(),
    };
    addresses.push(newAddress);
    setStorage(STORAGE_KEYS.ADDRESSES, addresses);
    return newAddress;
  },

  updateAddress: (address: Address): Address | undefined => {
    const addresses = addressApi.getAddresses();
    if (address.isDefault) {
      addresses.forEach((a) => {
        if (a.id !== address.id) a.isDefault = false;
      });
    }
    const index = addresses.findIndex((a) => a.id === address.id);
    if (index !== -1) {
      addresses[index] = address;
      setStorage(STORAGE_KEYS.ADDRESSES, addresses);
      return addresses[index];
    }
    return undefined;
  },

  deleteAddress: (id: string): boolean => {
    const addresses = addressApi.getAddresses();
    const index = addresses.findIndex((a) => a.id === id);
    if (index !== -1) {
      addresses.splice(index, 1);
      setStorage(STORAGE_KEYS.ADDRESSES, addresses);
      return true;
    }
    return false;
  },
};

export const couponApi = {
  getCoupons: (): Coupon[] => {
    return getStorage(STORAGE_KEYS.COUPONS, []);
  },

  getAvailableCoupons: (): Coupon[] => {
    const coupons = couponApi.getCoupons();
    return coupons.filter((c) => !c.isUsed && new Date(c.expireTime) > new Date());
  },

  useCoupon: (couponId: string): boolean => {
    const coupons = couponApi.getCoupons();
    const index = coupons.findIndex((c) => c.id === couponId);
    if (index !== -1 && !coupons[index].isUsed) {
      coupons[index].isUsed = true;
      setStorage(STORAGE_KEYS.COUPONS, coupons);
      return true;
    }
    return false;
  },
};

export const walletApi = {
  getWallet: () => {
    return getStorage(STORAGE_KEYS.WALLET, {
      balance: 500.0,
      frozen: 0,
      points: 1280,
    });
  },

  recharge: (amount: number): number => {
    const wallet = walletApi.getWallet();
    wallet.balance += amount;
    wallet.points += Math.floor(amount * 10);
    setStorage(STORAGE_KEYS.WALLET, wallet);
    return wallet.balance;
  },

  pay: (amount: number): boolean => {
    const wallet = walletApi.getWallet();
    if (wallet.balance >= amount) {
      wallet.balance -= amount;
      setStorage(STORAGE_KEYS.WALLET, wallet);
      return true;
    }
    return false;
  },
};

export const favoriteApi = {
  getFavorites: (): string[] => {
    return getStorage(STORAGE_KEYS.FAVORITES, []);
  },

  toggleFavorite: (feederId: string): boolean => {
    const favorites = favoriteApi.getFavorites();
    const index = favorites.indexOf(feederId);
    if (index !== -1) {
      favorites.splice(index, 1);
      setStorage(STORAGE_KEYS.FAVORITES, favorites);
      return false;
    } else {
      favorites.push(feederId);
      setStorage(STORAGE_KEYS.FAVORITES, favorites);
      return true;
    }
  },

  isFavorite: (feederId: string): boolean => {
    return favoriteApi.getFavorites().includes(feederId);
  },
};

const generateOrderNo = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${year}${month}${day}${random}`;
};

export const priceCalculator = {
  calculateBasePrice: (serviceType: string, duration: number = 1): number => {
    const priceMap: Record<string, number> = {
      feeding: 35,
      walking: 45,
      boarding: 120,
      bathing: 68,
    };
    return (priceMap[serviceType] || 0) * duration;
  },

  calculateDistanceFee: (distance: number): number => {
    if (distance <= 1) return 0;
    return Math.ceil((distance - 1) / 1) * 5;
  },

  calculateUrgentFee: (isUrgent: boolean): number => {
    return isUrgent ? 25 : 0;
  },

  calculateServiceItemFee: (items: { price: number }[]): number => {
    return items.reduce((sum, item) => sum + item.price, 0);
  },

  calculateTotal: (
    serviceType: string,
    duration: number,
    distance: number,
    isUrgent: boolean,
    serviceItems: { price: number }[],
    additionalServices: { price: number }[]
  ): {
    basePrice: number;
    distanceFee: number;
    urgentFee: number;
    serviceFee: number;
    additionalFee: number;
    total: number;
  } => {
    const basePrice = priceCalculator.calculateBasePrice(serviceType, duration);
    const distanceFee = priceCalculator.calculateDistanceFee(distance);
    const urgentFee = priceCalculator.calculateUrgentFee(isUrgent);
    const serviceFee = priceCalculator.calculateServiceItemFee(serviceItems);
    const additionalFee = priceCalculator.calculateServiceItemFee(additionalServices);

    return {
      basePrice,
      distanceFee,
      urgentFee,
      serviceFee,
      additionalFee,
      total: basePrice + distanceFee + urgentFee + serviceFee + additionalFee,
    };
  },
};
