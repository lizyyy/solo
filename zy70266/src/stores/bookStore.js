import { defineStore } from 'pinia'

export const useBookStore = defineStore('book', {
  state: () => ({
    books: [],
    budget: {
      total: 5000,
      used: 0
    },
    residents: [],
    ageGroups: ['儿童', '青少年', '成人', '老年'],
    issues: [],
    history: []
  }),
  
  getters: {
    availableBudget: (state) => state.budget.total - state.budget.used,
    
    booksByAgeGroup: (state) => {
      const grouped = {}
      state.ageGroups.forEach(group => {
        grouped[group] = state.books.filter(book => book.ageGroup === group)
      })
      return grouped
    },
    
    approvedBooks: (state) => state.books.filter(book => book.status === 'approved'),
    
    pendingBooks: (state) => state.books.filter(book => book.status === 'pending'),
    
    totalVotes: (state) => state.books.reduce((sum, book) => sum + book.votes, 0),
    
    budgetUsage: (state) => ({
      percentage: Math.round((state.budget.used / state.budget.total) * 100),
      remaining: state.budget.total - state.budget.used
    }),
    
    activeIssues: (state) => state.issues.filter(issue => issue.resolved === false)
  },
  
  actions: {
    initializeStore() {
      const saved = localStorage.getItem('communityBookStore')
      if (saved) {
        try {
          const data = JSON.parse(saved)
          this.books = data.books || []
          this.budget = data.budget || { total: 5000, used: 0 }
          this.residents = data.residents || []
          this.issues = data.issues || []
          this.history = data.history || []
        } catch (e) {
          this.addIssue('store_load_error', '无法加载保存的工作区数据', { error: e.message })
        }
      }
    },
    
    saveStore() {
      const data = {
        books: this.books,
        budget: this.budget,
        residents: this.residents,
        issues: this.issues,
        history: this.history
      }
      localStorage.setItem('communityBookStore', JSON.stringify(data))
    },
    
    addBook(bookData) {
      const { title, author, price, ageGroup, recommendedBy, isbn } = bookData
      
      const validation = this.validateBook(bookData)
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        }
      }
      
      const duplicate = this.checkDuplicate(title, author, isbn)
      if (duplicate) {
        return {
          success: false,
          errors: [{
            type: 'duplicate_book',
            message: `发现重复图书: "${title}" - ${author}`,
            duplicateBook: duplicate
          }]
        }
      }
      
      const book = {
        id: Date.now().toString(),
        title,
        author,
        price: parseFloat(price),
        ageGroup,
        recommendedBy,
        isbn: isbn || null,
        votes: 0,
        voters: [],
        status: 'pending',
        createdAt: new Date().toISOString(),
        budgetAllocated: false
      }
      
      this.books.push(book)
      this.addHistory('add_book', `添加推荐图书: "${title}"`, { bookId: book.id })
      this.saveStore()
      
      return {
        success: true,
        book
      }
    },
    
    validateBook(bookData) {
      const errors = []
      
      if (!bookData.title || bookData.title.trim() === '') {
        errors.push({
          type: 'missing_title',
          message: '图书名称不能为空'
        })
      }
      
      if (!bookData.author || bookData.author.trim() === '') {
        errors.push({
          type: 'missing_author',
          message: '作者名称不能为空'
        })
      }
      
      if (!bookData.price || isNaN(parseFloat(bookData.price)) || parseFloat(bookData.price) <= 0) {
        errors.push({
          type: 'invalid_price',
          message: '价格必须是大于0的数字'
        })
      }
      
      if (!bookData.ageGroup || !this.ageGroups.includes(bookData.ageGroup)) {
        errors.push({
          type: 'invalid_age_group',
          message: '请选择有效的年龄分层'
        })
      }
      
      if (!bookData.recommendedBy || bookData.recommendedBy.trim() === '') {
        errors.push({
          type: 'missing_recommender',
          message: '推荐人不能为空'
        })
      }
      
      return {
        valid: errors.length === 0,
        errors
      }
    },
    
    checkDuplicate(title, author, isbn) {
      const normalizedTitle = title.trim().toLowerCase()
      const normalizedAuthor = author.trim().toLowerCase()
      
      return this.books.find(book => {
        const matchTitle = book.title.trim().toLowerCase() === normalizedTitle
        const matchAuthor = book.author.trim().toLowerCase() === normalizedAuthor
        const matchIsbn = isbn && book.isbn && book.isbn.trim() === isbn.trim()
        
        return (matchTitle && matchAuthor) || matchIsbn
      })
    },
    
    voteForBook(bookId, residentName) {
      const book = this.books.find(b => b.id === bookId)
      
      if (!book) {
        return {
          success: false,
          error: '图书不存在'
        }
      }
      
      if (book.status !== 'pending') {
        return {
          success: false,
          error: '只能对待审核的图书投票'
        }
      }
      
      if (book.voters.includes(residentName)) {
        return {
          success: false,
          error: '您已经投过票了'
        }
      }
      
      book.votes++
      book.voters.push(residentName)
      
      if (!this.residents.includes(residentName)) {
        this.residents.push(residentName)
      }
      
      this.addHistory('vote', `${residentName} 投票支持 "${book.title}"`, { bookId, residentName })
      this.saveStore()
      
      return {
        success: true,
        votes: book.votes
      }
    },
    
    approveBook(bookId) {
      const book = this.books.find(b => b.id === bookId)
      
      if (!book) {
        return {
          success: false,
          error: '图书不存在'
        }
      }
      
      if (book.status === 'approved') {
        return {
          success: false,
          error: '图书已经被批准'
        }
      }
      
      if (book.price > this.availableBudget) {
        return {
          success: false,
          error: `预算不足: 需要 ¥${book.price}, 剩余 ¥${this.availableBudget}`
        }
      }
      
      book.status = 'approved'
      book.budgetAllocated = true
      book.approvedAt = new Date().toISOString()
      this.budget.used += book.price
      
      this.addHistory('approve', `批准购买 "${book.title}"`, { bookId, price: book.price })
      this.saveStore()
      
      return {
        success: true,
        remainingBudget: this.availableBudget
      }
    },
    
    rejectBook(bookId, reason) {
      const book = this.books.find(b => b.id === bookId)
      
      if (!book) {
        return {
          success: false,
          error: '图书不存在'
        }
      }
      
      book.status = 'rejected'
      book.rejectReason = reason
      book.rejectedAt = new Date().toISOString()
      
      this.addHistory('reject', `拒绝 "${book.title}": ${reason}`, { bookId, reason })
      this.saveStore()
      
      return {
        success: true
      }
    },
    
    removeBook(bookId, reason) {
      const index = this.books.findIndex(b => b.id === bookId)
      
      if (index === -1) {
        return {
          success: false,
          error: '图书不存在'
        }
      }
      
      const book = this.books[index]
      
      if (book.budgetAllocated) {
        this.budget.used -= book.price
      }
      
      this.books.splice(index, 1)
      this.addHistory('remove', `删除图书 "${book.title}": ${reason}`, { bookId, reason })
      this.saveStore()
      
      return {
        success: true
      }
    },
    
    updateBudget(newTotal) {
      if (newTotal < this.budget.used) {
        return {
          success: false,
          error: `新预算 (¥${newTotal}) 不能小于已使用的预算 (¥${this.budget.used})`
        }
      }
      
      const oldTotal = this.budget.total
      this.budget.total = newTotal
      
      this.addHistory('budget_update', `更新预算: ¥${oldTotal} → ¥${newTotal}`, { oldTotal, newTotal })
      this.saveStore()
      
      return {
        success: true
      }
    },
    
    addIssue(type, message, details = {}) {
      const issue = {
        id: Date.now().toString(),
        type,
        message,
        details,
        createdAt: new Date().toISOString(),
        resolved: false
      }
      
      this.issues.unshift(issue)
      this.saveStore()
      
      return issue
    },
    
    resolveIssue(issueId) {
      const issue = this.issues.find(i => i.id === issueId)
      
      if (issue) {
        issue.resolved = true
        issue.resolvedAt = new Date().toISOString()
        this.saveStore()
      }
    },
    
    addHistory(action, description, details = {}) {
      const entry = {
        id: Date.now().toString(),
        action,
        description,
        details,
        timestamp: new Date().toISOString()
      }
      
      this.history.unshift(entry)
      
      if (this.history.length > 100) {
        this.history = this.history.slice(0, 100)
      }
    },
    
    resetStore() {
      this.books = []
      this.budget = { total: 5000, used: 0 }
      this.residents = []
      this.issues = []
      this.history = []
      localStorage.removeItem('communityBookStore')
    }
  }
})
