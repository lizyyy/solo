import Papa from 'papaparse'

export class DataLoader {
  constructor() {
    this.loadedData = {
      athletes: null,
      judgeScores: null,
      difficultyDeclarations: null,
      videoTimecodes: null,
      appeals: null
    }
  }

  async loadFromFiles(files) {
    const results = {}
    for (const file of files) {
      const data = await this.parseFile(file)
      const type = this.detectDataType(file.name, data)
      if (type) {
        results[type] = data
      }
    }
    return results
  }

  async parseFile(file) {
    const extension = file.name.split('.').pop().toLowerCase()
    
    if (extension === 'csv') {
      return this.parseCSV(file)
    } else if (extension === 'json') {
      return this.parseJSON(file)
    }
    throw new Error(`不支持的文件格式: ${extension}`)
  }

  parseCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV解析错误: ${results.errors[0].message}`))
          } else {
            resolve(results.data)
          }
        },
        error: reject
      })
    })
  }

  parseJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          resolve(data)
        } catch (error) {
          reject(new Error(`JSON解析错误: ${error.message}`))
        }
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  detectDataType(filename, data) {
    const lowerName = filename.toLowerCase()
    
    if (lowerName.includes('athlete') || lowerName.includes('运动员')) {
      return 'athletes'
    }
    if (lowerName.includes('score') || lowerName.includes('裁判') || lowerName.includes('分数')) {
      return 'judgeScores'
    }
    if (lowerName.includes('difficult') || lowerName.includes('难度')) {
      return 'difficultyDeclarations'
    }
    if (lowerName.includes('video') || lowerName.includes('time') || lowerName.includes('视频') || lowerName.includes('时间码')) {
      return 'videoTimecodes'
    }
    if (lowerName.includes('appeal') || lowerName.includes('申诉')) {
      return 'appeals'
    }
    
    if (Array.isArray(data)) {
      if (data.length > 0) {
        const first = data[0]
        if (first.athlete_id && first.judge_id) return 'judgeScores'
        if (first.id && first.name) return 'athletes'
      }
    }
    
    if (data && typeof data === 'object') {
      if (data.athletes) return 'athletes'
      if (data.declarations) return 'difficultyDeclarations'
      if (data.videos) return 'videoTimecodes'
      if (data.appeals) return 'appeals'
    }
    
    return null
  }

  async loadSampleData() {
    try {
      const [athletesModule, diffModule, videoModule, appealsModule] = await Promise.all([
        import('@/data/athletes.json?raw'),
        import('@/data/difficulty_declaration.json?raw'),
        import('@/data/video_timecodes.json?raw'),
        import('@/data/appeals.json?raw')
      ])
      
      const scoresCsv = await import('@/data/judge_scores.csv?raw')
      const scoresData = Papa.parse(scoresCsv.default, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      }).data

      return {
        athletes: JSON.parse(athletesModule.default),
        judgeScores: scoresData,
        difficultyDeclarations: JSON.parse(diffModule.default),
        videoTimecodes: JSON.parse(videoModule.default),
        appeals: JSON.parse(appealsModule.default)
      }
    } catch (error) {
      console.warn('加载示例数据失败:', error)
      return null
    }
  }
}

export default DataLoader
