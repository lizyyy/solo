export class Book {
    constructor(id, callNumber, title, author, isReserved = false, isDamaged = false) {
        this.id = id;
        this.callNumber = callNumber;
        this.title = title;
        this.author = author;
        this.isReserved = isReserved;
        this.isDamaged = isDamaged;
        this.isProcessed = false;
    }

    static parseCallNumber(callNumber) {
        const match = callNumber.match(/^([A-Z]+)(\d+(?:\.\d+)?)(?:\.([A-Za-z]+)(\d+)?)?$/);
        if (!match) {
            return { letters: callNumber, number: 0, authorLetter: '', authorNumber: 0 };
        }
        return {
            letters: match[1] || '',
            number: parseFloat(match[2]) || 0,
            authorLetter: match[3] || '',
            authorNumber: parseInt(match[4]) || 0
        };
    }

    static compareCallNumbers(cn1, cn2) {
        const parsed1 = Book.parseCallNumber(cn1);
        const parsed2 = Book.parseCallNumber(cn2);

        const letterCompare = parsed1.letters.localeCompare(parsed2.letters);
        if (letterCompare !== 0) return letterCompare;

        if (parsed1.number !== parsed2.number) {
            return parsed1.number - parsed2.number;
        }

        const authorLetterCompare = parsed1.authorLetter.localeCompare(parsed2.authorLetter);
        if (authorLetterCompare !== 0) return authorLetterCompare;

        return parsed1.authorNumber - parsed2.authorNumber;
    }

    static sortBooks(books) {
        return [...books].sort((a, b) => Book.compareCallNumbers(a.callNumber, b.callNumber));
    }

    static isSorted(books) {
        for (let i = 0; i < books.length - 1; i++) {
            if (Book.compareCallNumbers(books[i].callNumber, books[i + 1].callNumber) > 0) {
                return false;
            }
        }
        return true;
    }

    static findSortErrors(books) {
        const errors = [];
        for (let i = 0; i < books.length - 1; i++) {
            if (Book.compareCallNumbers(books[i].callNumber, books[i + 1].callNumber) > 0) {
                errors.push({
                    index: i,
                    book1: books[i],
                    book2: books[i + 1],
                    reason: `"${books[i].callNumber}" 应该在 "${books[i + 1].callNumber}" 之后`
                });
            }
        }
        return errors;
    }
}

export const bookDatabase = [
    { callNumber: 'A01', title: '图书馆学导论', author: '张三' },
    { callNumber: 'A10', title: '信息组织原理', author: '李四' },
    { callNumber: 'A20.5', title: '文献分类法', author: '王五' },
    { callNumber: 'B05', title: '中国哲学简史', author: '冯友兰' },
    { callNumber: 'B15', title: '西方哲学史', author: '罗素' },
    { callNumber: 'B30.C56', title: '论语译注', author: '杨伯峻' },
    { callNumber: 'C03', title: '社会学概论', author: '郑杭生' },
    { callNumber: 'C12', title: '社会研究方法', author: '风笑天' },
    { callNumber: 'D01', title: '法学基础', author: '张文显' },
    { callNumber: 'D10', title: '宪法学', author: '张千帆' },
    { callNumber: 'D23.F45', title: '民法总论', author: '王利明' },
    { callNumber: 'E05', title: '经济学原理', author: '曼昆' },
    { callNumber: 'E18', title: '宏观经济学', author: '多恩布什' },
    { callNumber: 'E32.G78', title: '计量经济学', author: '伍德里奇' },
    { callNumber: 'F02', title: '计算机科学导论', author: '唐纳德' },
    { callNumber: 'F15', title: '数据结构与算法', author: '严蔚敏' },
    { callNumber: 'F28', title: '操作系统概念', author: '西尔伯沙茨' },
    { callNumber: 'F40.H23', title: '计算机网络', author: '谢希仁' },
    { callNumber: 'G08', title: '文学理论教程', author: '童庆炳' },
    { callNumber: 'G22', title: '中国文学史', author: '袁行霈' },
    { callNumber: 'G35.K89', title: '红楼梦研究', author: '周汝昌' },
    { callNumber: 'H03', title: '数学分析', author: '华东师大' },
    { callNumber: 'H12', title: '高等代数', author: '北京大学' },
    { callNumber: 'H25.L34', title: '概率论与数理统计', author: '盛骤' },
    { callNumber: 'I07', title: '物理学基础', author: '哈里德' },
    { callNumber: 'I20', title: '量子力学导论', author: '曾谨言' },
    { callNumber: 'I33.M56', title: '电磁学', author: '赵凯华' },
    { callNumber: 'J04', title: '普通化学', author: '浙江大学' },
    { callNumber: 'J18', title: '有机化学', author: '邢其毅' },
    { callNumber: 'K09', title: '生物学导论', author: '吴相钰' },
    { callNumber: 'K22', title: '遗传学基础', author: '刘祖洞' },
];

export function generateBooks(count, includeReserved = false, includeDamaged = false) {
    const shuffled = [...bookDatabase].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);
    
    return selected.map((book, index) => {
        const isReserved = includeReserved && Math.random() < 0.2;
        const isDamaged = includeDamaged && Math.random() < 0.15;
        return new Book(
            `book-${Date.now()}-${index}`,
            book.callNumber,
            book.title,
            book.author,
            isReserved,
            isDamaged
        );
    });
}
