import { create } from 'zustand';
import type { GameState, GameActions, Card, PartyState, Game, NegotiationRecord } from '../types';
import cardsData from '../data/cards.json';
import levelsData from '../data/levels.json';
import { calculateSettlement } from '../utils/settlementEngine';
import { generateNegotiationRecord } from '../utils/reportGenerator';

const initialState: GameState = {
  currentPage: 'home',
  currentLevel: null,
  game: null,
  settlement: null,
  completedLevels: {},
  selectedCard: null,
  showCardDetail: false,
};

type GameStore = GameState & GameActions & {
  negotiationRecords: NegotiationRecord[];
  addNegotiationRecord: (record: NegotiationRecord) => void;
  clearNegotiationRecords: () => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  negotiationRecords: [],

  setCurrentPage: (page) => set({ currentPage: page }),

  setCurrentLevel: (levelId) => set({ currentLevel: levelId }),

  startGame: (levelId) => {
    const level = levelsData.find(l => l.id === levelId);
    if (!level) return;

    const initialCards: Card[] = level.initialCards.map(cardId => {
      const card = cardsData.find(c => c.id === cardId);
      return card as Card;
    }).filter(Boolean);

    const initialParties: PartyState[] = level.initialParties.map(p => ({
      ...p,
      splitPercentage: 0,
      rawSplitPercentage: 0,
      rights: [...p.rawRights],
      rawRights: [...p.rawRights],
    }));

    initialCards.forEach(card => {
      if (card.effect.isRaw && card.effect.type === 'split_modifier') {
        const targetParty = initialParties.find(p => p.type === card.effect.target);
        if (targetParty) {
          targetParty.rawSplitPercentage += card.effect.value;
          targetParty.splitPercentage += card.effect.value;
        }
      }
    });

    const game: Game = {
      id: `game-${Date.now()}`,
      levelId,
      playerHand: initialCards.filter(c => !c.effect.isRaw),
      tableCards: initialCards.filter(c => c.effect.isRaw),
      partyStates: initialParties,
      currentRound: 1,
      maxRounds: 5,
      status: 'playing',
      totalRevenue: level.totalRevenue,
      playedCardIds: [],
    };

    set({
      game,
      currentLevel: levelId,
      currentPage: 'game',
      negotiationRecords: [],
      settlement: null,
    });
  },

  addNegotiationRecord: (record) => {
    set(state => ({
      negotiationRecords: [...state.negotiationRecords, record],
    }));
  },

  clearNegotiationRecords: () => set({ negotiationRecords: [] }),

  playCard: (cardId) => {
    const { game, addNegotiationRecord, negotiationRecords } = get();
    if (!game || game.status !== 'playing') return;

    const card = game.playerHand.find(c => c.id === cardId);
    if (!card) return;

    const updatedParties = game.partyStates.map(party => {
      const updatedParty = { ...party };
      
      if (card.effect.type === 'split_modifier') {
        if (card.effect.target === 'all' || party.type === card.effect.target) {
          updatedParty.splitPercentage += card.effect.value;
        }
      }
      
      if (card.effect.type === 'right_add' && card.effect.right) {
        if (card.effect.target === 'all' || party.type === card.effect.target) {
          if (!updatedParty.rights.includes(card.effect.right) && card.effect.right !== 'missing_mechanical') {
            updatedParty.rights.push(card.effect.right);
          }
        }
      }
      
      if (card.effect.type === 'reputation_mod') {
        if (card.effect.target === 'all' || party.type === card.effect.target) {
          updatedParty.reputation += card.effect.value;
        }
      }

      return updatedParty;
    });

    const record = generateNegotiationRecord(game.currentRound, card);
    addNegotiationRecord(record);

    set({
      game: {
        ...game,
        playerHand: game.playerHand.filter(c => c.id !== cardId),
        tableCards: [...game.tableCards, card],
        partyStates: updatedParties,
        playedCardIds: [...game.playedCardIds, cardId],
      },
    });
  },

  drawCard: () => {
    const { game } = get();
    if (!game) return;

    const availableCards = cardsData.filter(
      c => !game.playerHand.find(h => h.id === c.id) && 
           !game.tableCards.find(t => t.id === c.id)
    );

    if (availableCards.length > 0) {
      const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
      set({
        game: {
          ...game,
          playerHand: [...game.playerHand, randomCard as Card],
        },
      });
    }
  },

  endRound: () => {
    const { game } = get();
    if (!game) return;

    if (game.currentRound >= game.maxRounds) {
      get().endGame();
    } else {
      set({
        game: {
          ...game,
          currentRound: game.currentRound + 1,
        },
      });
      get().drawCard();
    }
  },

  pauseGame: () => {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, status: 'paused' } });
  },

  resumeGame: () => {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, status: 'playing' } });
  },

  restartGame: () => {
    const { currentLevel } = get();
    if (currentLevel) {
      get().startGame(currentLevel);
    }
  },

  endGame: () => {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, status: 'settled' } });
    get().calculateSettlement();
  },

  calculateSettlement: () => {
    const { game, negotiationRecords } = get();
    if (!game) return;

    const settlement = calculateSettlement(
      game.id,
      game.totalRevenue,
      game.partyStates,
      game.tableCards
    );

    set({
      settlement,
      currentPage: 'settlement',
    });
  },

  setSelectedCard: (card) => set({ selectedCard: card }),

  setShowCardDetail: (show) => set({ showCardDetail: show }),

  exportReport: () => {
    set({ currentPage: 'report' });
  },

  resetGame: () => set(initialState),
}));
