
import { Wallet, Transaction } from '../types';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

const walletAddresses = [
  '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  '0xA0b86a33E6441c7502C511Cf28183D1c03e08A3e',
  '0x3fC91392a619199727914c0d098dEb3Ce7dE25c4',
  '0x2C84e19eB2FCc87F46b94c0bB6d068E2dA1e6a54',
  '0x9D5C5E421121dB7978b4f66E7dA54d6b8c4e2F1a',
  '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
  '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2',
  '0x514910771AF9Ca656af840dff83E8264EcF986CA',
  '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
  '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
  '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
];

const labels = [
  '交易所钱包 A',
  'DEX 流动性池',
  '鲸鱼地址 #1',
  '智能合约',
  '散户投资者',
  '混币器入口',
  '鲸鱼地址 #2',
  'NFT 交易平台',
  'Wrapped ETH',
  'Uniswap V3',
  'SushiSwap',
  'Chainlink 节点',
  'Maker DAO',
  'Polygon 桥',
  'Synthetix',
];

export const mockWallets: Wallet[] = walletAddresses.map((addr, i) => ({
  id: `wallet-${i}`,
  address: addr,
  label: labels[i],
  balance: Math.random() * 10000000 + 100000,
  tokens: [
    { symbol: 'ETH', amount: Math.random() * 1000 + 10, value: Math.random() * 3000000 + 30000 },
    { symbol: 'USDC', amount: Math.random() * 5000000 + 500000, value: Math.random() * 5000000 + 500000 },
  ],
  tags: i === 5 ? ['高风险', '混币可疑'] : i === 3 ? ['智能合约'] : i % 3 === 0 ? ['交易所'] : ['普通地址'],
  status: i === 5 ? 'anomaly' : i === 3 ? 'warning' : i === 10 ? 'pending' : 'normal',
  notes: i === 5 ? '疑似与混币服务有关，需进一步调查' : '',
  firstSeen: now - Math.random() * 365 * day,
  lastActive: now - Math.random() * 7 * day,
  metadata: {
    transactionCount: Math.floor(Math.random() * 1000) + 100,
    uniqueInteractions: Math.floor(Math.random() * 200) + 20,
  },
}));

const tokens = ['ETH', 'USDC', 'USDT', 'WBTC', 'LINK'];

export const mockTransactions: Transaction[] = [
  ...Array.from({ length: 35 }, (_, i) => {
    const fromIdx = Math.floor(Math.random() * mockWallets.length);
    let toIdx = Math.floor(Math.random() * mockWallets.length);
    while (toIdx === fromIdx) {
      toIdx = Math.floor(Math.random() * mockWallets.length);
    }
    const isAnomaly = i < 5;
    const anomalyTypes = ['merge_error', 'time_mismatch', 'cycle_transfer', 'suspicious', 'suspicious'] as const;
    const workflowStatus = isAnomaly ? (i < 2 ? 'returned' : 'submitted') : 'approved';
    
    return {
      id: `tx-${i}`,
      txHash: `0x${Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`,
      from: mockWallets[fromIdx].id,
      to: mockWallets[toIdx].id,
      amount: Math.random() * 500000 + 10000,
      token: tokens[Math.floor(Math.random() * tokens.length)],
      timestamp: now - Math.random() * 30 * day,
      status: 'confirmed' as const,
      isAnomaly,
      anomalyType: isAnomaly ? anomalyTypes[i] : undefined,
      notes: isAnomaly ? `异常类型: ${anomalyTypes[i]} - 需要人工审核` : '',
      workflowStatus: workflowStatus as 'draft' | 'submitted' | 'returned' | 'approved',
    };
  }),
  {
    id: 'tx-cycle-1',
    txHash: '0xcycle1examplehash1111111111111111111111111111111111111111111111',
    from: 'wallet-0',
    to: 'wallet-1',
    amount: 150000,
    token: 'USDC',
    timestamp: now - 5 * day,
    status: 'confirmed' as const,
    isAnomaly: true,
    anomalyType: 'cycle_transfer' as const,
    notes: '检测到循环转账模式 wallet-0 -> wallet-1 -> wallet-2 -> wallet-0',
    workflowStatus: 'returned' as const,
  },
  {
    id: 'tx-cycle-2',
    txHash: '0xcycle2examplehash2222222222222222222222222222222222222222222222',
    from: 'wallet-1',
    to: 'wallet-2',
    amount: 149500,
    token: 'USDC',
    timestamp: now - 4.9 * day,
    status: 'confirmed' as const,
    isAnomaly: true,
    anomalyType: 'cycle_transfer' as const,
    notes: '检测到循环转账模式',
    workflowStatus: 'returned' as const,
  },
  {
    id: 'tx-cycle-3',
    txHash: '0xcycle3examplehash3333333333333333333333333333333333333333333333',
    from: 'wallet-2',
    to: 'wallet-0',
    amount: 149000,
    token: 'USDC',
    timestamp: now - 4.8 * day,
    status: 'confirmed' as const,
    isAnomaly: true,
    anomalyType: 'cycle_transfer' as const,
    notes: '检测到循环转账模式',
    workflowStatus: 'returned' as const,
  },
];

export const getTimeRange = (): [number, number] => {
  const timestamps = mockTransactions.map(t => t.timestamp);
  return [Math.min(...timestamps), Math.max(...timestamps)];
};
