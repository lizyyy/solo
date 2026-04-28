import { create } from 'zustand';
import type {
  Order,
  DogInfo,
  Address,
  FormData,
} from '../types';
import {
  orderApi,
  dogApi,
  addressApi,
  couponApi,
  walletApi,
  favoriteApi,
} from '../services/api';

import type { Review } from '../types';

interface AppState {
  orders: Order[];
  dogs: DogInfo[];
  addresses: Address[];
  wallet: ReturnType<typeof walletApi.getWallet>;
  coupons: ReturnType<typeof couponApi.getCoupons>;
  favorites: string[];
  currentOrder: Order | null;
  formData: FormData;
  loading: boolean;
  error: string | null;

  fetchOrders: () => void;
  fetchOrderById: (id: string) => Order | undefined;
  createOrder: (order: Parameters<typeof orderApi.createOrder>[0]) => Order;
  updateOrderStatus: (orderId: string, status: Order['status']) => Order | undefined;
  replicateOrder: (orderId: string) => Order | undefined;
  addOrderReview: (orderId: string, review: Omit<Review, 'id' | 'createTime' | 'orderId' | 'photos'>) => Order | undefined;

  fetchDogs: () => void;
  addDog: (dog: Omit<DogInfo, 'id'>) => DogInfo;
  updateDog: (dog: DogInfo) => DogInfo | undefined;
  deleteDog: (id: string) => boolean;

  fetchAddresses: () => void;
  addAddress: (address: Omit<Address, 'id'>) => Address;
  updateAddress: (address: Address) => Address | undefined;
  deleteAddress: (id: string) => boolean;

  getAvailableCoupons: () => ReturnType<typeof couponApi.getAvailableCoupons>;
  useCoupon: (couponId: string) => boolean;

  rechargeWallet: (amount: number) => number;
  payWithWallet: (amount: number) => boolean;

  toggleFavorite: (feederId: string) => boolean;
  isFavorite: (feederId: string) => boolean;

  setCurrentOrder: (order: Order | null) => void;
  updateFormData: (data: Partial<FormData>) => void;
  resetFormData: () => void;
  clearError: () => void;
}

const initialFormData: FormData = {
  serviceType: '',
  serviceItems: [],
  address: null,
  appointmentTime: '',
  duration: 1,
  dogInfo: null,
  specialNotes: '',
  feederId: '',
  isUrgent: false,
  additionalServices: [],
};

export const useAppStore = create<AppState>((set, get) => ({
  orders: [],
  dogs: [],
  addresses: [],
  wallet: walletApi.getWallet(),
  coupons: couponApi.getCoupons(),
  favorites: favoriteApi.getFavorites(),
  currentOrder: null,
  formData: { ...initialFormData },
  loading: false,
  error: null,

  fetchOrders: () => {
    set({ loading: true });
    try {
      const orders = orderApi.getOrders();
      set({ orders, loading: false });
    } catch (error) {
      set({ error: '获取订单列表失败', loading: false });
    }
  },

  fetchOrderById: (id: string) => {
    return orderApi.getOrderById(id);
  },

  createOrder: (order) => {
    const newOrder = orderApi.createOrder(order);
    set((state) => ({
      orders: [newOrder, ...state.orders],
    }));
    return newOrder;
  },

  updateOrderStatus: (orderId, status) => {
    const updatedOrder = orderApi.updateOrderStatus(orderId, status);
    if (updatedOrder) {
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === orderId ? updatedOrder : o
        ),
        currentOrder:
          state.currentOrder?.id === orderId
            ? updatedOrder
            : state.currentOrder,
      }));
    }
    return updatedOrder;
  },

  replicateOrder: (orderId) => {
    const newOrder = orderApi.replicateOrder(orderId);
    if (newOrder) {
      set((state) => ({
        orders: [newOrder, ...state.orders],
      }));
    }
    return newOrder;
  },

  addOrderReview: (orderId, review) => {
    const updatedOrder = orderApi.addOrderReview(orderId, review);
    if (updatedOrder) {
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === orderId ? updatedOrder : o
        ),
      }));
    }
    return updatedOrder;
  },

  fetchDogs: () => {
    try {
      const dogs = dogApi.getDogs();
      set({ dogs });
    } catch (error) {
      set({ error: '获取狗狗档案失败' });
    }
  },

  addDog: (dog) => {
    const newDog = dogApi.addDog(dog);
    set((state) => ({
      dogs: [...state.dogs, newDog],
    }));
    return newDog;
  },

  updateDog: (dog) => {
    const updatedDog = dogApi.updateDog(dog);
    if (updatedDog) {
      set((state) => ({
        dogs: state.dogs.map((d) => (d.id === dog.id ? updatedDog : d)),
      }));
    }
    return updatedDog;
  },

  deleteDog: (id) => {
    const success = dogApi.deleteDog(id);
    if (success) {
      set((state) => ({
        dogs: state.dogs.filter((d) => d.id !== id),
      }));
    }
    return success;
  },

  fetchAddresses: () => {
    try {
      const addresses = addressApi.getAddresses();
      set({ addresses });
    } catch (error) {
      set({ error: '获取地址列表失败' });
    }
  },

  addAddress: (address) => {
    const newAddress = addressApi.addAddress(address);
    set((state) => ({
      addresses: [...state.addresses, newAddress],
    }));
    return newAddress;
  },

  updateAddress: (address) => {
    const updatedAddress = addressApi.updateAddress(address);
    if (updatedAddress) {
      set((state) => ({
        addresses: state.addresses.map((a) =>
          a.id === address.id ? updatedAddress : a
        ),
      }));
    }
    return updatedAddress;
  },

  deleteAddress: (id) => {
    const success = addressApi.deleteAddress(id);
    if (success) {
      set((state) => ({
        addresses: state.addresses.filter((a) => a.id !== id),
      }));
    }
    return success;
  },

  getAvailableCoupons: () => {
    return couponApi.getAvailableCoupons();
  },

  useCoupon: (couponId) => {
    const success = couponApi.useCoupon(couponId);
    if (success) {
      set((state) => ({
        coupons: state.coupons.map((c) =>
          c.id === couponId ? { ...c, isUsed: true } : c
        ),
      }));
    }
    return success;
  },

  rechargeWallet: (amount) => {
    const newBalance = walletApi.recharge(amount);
    set(() => ({
      wallet: walletApi.getWallet(),
    }));
    return newBalance;
  },

  payWithWallet: (amount) => {
    const success = walletApi.pay(amount);
    if (success) {
      set(() => ({
        wallet: walletApi.getWallet(),
      }));
    }
    return success;
  },

  toggleFavorite: (feederId) => {
    const isNowFavorite = favoriteApi.toggleFavorite(feederId);
    set((state) => ({
      favorites: isNowFavorite
        ? [...state.favorites, feederId]
        : state.favorites.filter((id) => id !== feederId),
    }));
    return isNowFavorite;
  },

  isFavorite: (feederId) => {
    return get().favorites.includes(feederId);
  },

  setCurrentOrder: (order) => {
    set({ currentOrder: order });
  },

  updateFormData: (data) => {
    set((state) => ({
      formData: { ...state.formData, ...data },
    }));
  },

  resetFormData: () => {
    set({ formData: { ...initialFormData } });
  },

  clearError: () => {
    set({ error: null });
  },
}));
