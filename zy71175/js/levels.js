import { generateBooks } from './book.js';

export const levels = [
    {
        id: 1,
        name: '新手入门',
        description: '学习基本的索书号排序',
        timeLimit: 90,
        bookCount: 5,
        includeReserved: false,
        includeDamaged: false,
        targetScore: 400,
        hints: [
            '先看分类号的字母部分',
            'A类图书应该在最前面'
        ]
    },
    {
        id: 2,
        name: '数字排序',
        description: '掌握同一分类号下的数字排序',
        timeLimit: 80,
        bookCount: 6,
        includeReserved: false,
        includeDamaged: false,
        targetScore: 500,
        hints: [
            'A10 < A20 < A100',
            '注意小数的排序：A20.5 在 A20 之后'
        ]
    },
    {
        id: 3,
        name: '预约单处理',
        description: '学习识别和处理预约图书',
        timeLimit: 100,
        bookCount: 7,
        includeReserved: true,
        includeDamaged: false,
        targetScore: 550,
        hints: [
            '带有"预约"标记的图书不能上架',
            '预约图书需要先放到预约台'
        ]
    },
    {
        id: 4,
        name: '破损图书',
        description: '学习识别和登记破损图书',
        timeLimit: 100,
        bookCount: 7,
        includeReserved: false,
        includeDamaged: true,
        targetScore: 550,
        hints: [
            '带有"破损"标记的图书需要登记',
            '破损图书不能直接上架'
        ]
    },
    {
        id: 5,
        name: '综合挑战',
        description: '同时处理预约和破损图书',
        timeLimit: 120,
        bookCount: 8,
        includeReserved: true,
        includeDamaged: true,
        targetScore: 700,
        hints: [
            '先筛选出需要特殊处理的图书',
            '剩余图书按索书号排序'
        ]
    },
    {
        id: 6,
        name: '高级排序',
        description: '处理复杂的著者号排序',
        timeLimit: 120,
        bookCount: 9,
        includeReserved: true,
        includeDamaged: true,
        targetScore: 800,
        hints: [
            '分类号相同的图书按著者号排序',
            'D23.F45 按 F45 进行二次排序'
        ]
    }
];

export function getLevel(id) {
    return levels.find(l => l.id === id) || levels[0];
}

export function initLevel(levelId) {
    const level = getLevel(levelId);
    const books = generateBooks(
        level.bookCount,
        level.includeReserved,
        level.includeDamaged
    );
    
    return {
        level,
        books,
        reservations: books.filter(b => b.isReserved),
        damagedBooks: books.filter(b => b.isDamaged)
    };
}
