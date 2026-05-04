const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

const DATA_DIR = path.join(__dirname, '../data')
const LEVELS_DIR = path.join(DATA_DIR, 'levels')
const GAMES_DIR = path.join(DATA_DIR, 'games')
const REPORTS_DIR = path.join(DATA_DIR, 'reports')

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
if (!fs.existsSync(LEVELS_DIR)) fs.mkdirSync(LEVELS_DIR, { recursive: true })
if (!fs.existsSync(GAMES_DIR)) fs.mkdirSync(GAMES_DIR, { recursive: true })
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true })

const defaultLevels = [
  {
    id: 'level-1',
    name: '新手训练',
    description: '滑雪场初级区域，游客在初级道附近迷路',
    difficulty: 1,
    timeLimit: 180,
    map: {
      width: 20,
      height: 15,
      tiles: [],
      startPosition: { x: 2, y: 2 }
    },
    tourists: [
      { id: 't1', position: { x: 15, y: 10 }, temperature: 36.5, status: 'lost' }
    ],
    resources: {
      snowmobiles: 2,
      drones: 1,
      hotDrinks: 3
    },
    hazards: []
  },
  {
    id: 'level-2',
    name: '中级挑战',
    description: '游客在中级道区域，存在雪崩风险区',
    difficulty: 2,
    timeLimit: 240,
    map: {
      width: 25,
      height: 20,
      tiles: [],
      startPosition: { x: 3, y: 3 }
    },
    tourists: [
      { id: 't1', position: { x: 18, y: 14 }, temperature: 35.8, status: 'lost' },
      { id: 't2', position: { x: 20, y: 8 }, temperature: 35.2, status: 'lost' }
    ],
    resources: {
      snowmobiles: 3,
      drones: 2,
      hotDrinks: 5
    },
    hazards: [
      { id: 'h1', type: 'avalanche', area: { x: 12, y: 10, width: 4, height: 4 }, risk: 0.3 }
    ]
  },
  {
    id: 'level-3',
    name: '高级营救',
    description: '夜间复杂地形，多名游客分散在高级区域',
    difficulty: 3,
    timeLimit: 300,
    map: {
      width: 30,
      height: 25,
      tiles: [],
      startPosition: { x: 5, y: 5 }
    },
    tourists: [
      { id: 't1', position: { x: 22, y: 18 }, temperature: 34.8, status: 'lost' },
      { id: 't2', position: { x: 25, y: 10 }, temperature: 35.0, status: 'lost' },
      { id: 't3', position: { x: 10, y: 20 }, temperature: 34.5, status: 'lost' }
    ],
    resources: {
      snowmobiles: 4,
      drones: 3,
      hotDrinks: 8
    },
    hazards: [
      { id: 'h1', type: 'avalanche', area: { x: 15, y: 12, width: 5, height: 5 }, risk: 0.5 },
      { id: 'h2', type: 'avalanche', area: { x: 20, y: 5, width: 4, height: 4 }, risk: 0.4 }
    ]
  }
]

function ensureDefaultLevels() {
  defaultLevels.forEach(level => {
    const filePath = path.join(LEVELS_DIR, `${level.id}.json`)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(level, null, 2))
    }
  })
}

function generateMapTiles(width, height) {
  const tiles = []
  for (let y = 0; y < height; y++) {
    const row = []
    for (let x = 0; x < width; x++) {
      const rand = Math.random()
      let terrain = 'snow'
      if (rand < 0.1) terrain = 'forest'
      else if (rand < 0.15) terrain = 'rock'
      else if (rand < 0.2) terrain = 'trail'
      row.push({ x, y, terrain, explored: false, visible: false })
    }
    tiles.push(row)
  }
  return tiles
}

app.get('/api/levels', (req, res) => {
  ensureDefaultLevels()
  const files = fs.readdirSync(LEVELS_DIR)
  const levels = files.map(file => {
    const content = fs.readFileSync(path.join(LEVELS_DIR, file), 'utf8')
    return JSON.parse(content)
  })
  res.json(levels)
})

app.get('/api/levels/:id', (req, res) => {
  const filePath = path.join(LEVELS_DIR, `${req.params.id}.json`)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '关卡不存在' })
  }
  const content = fs.readFileSync(filePath, 'utf8')
  res.json(JSON.parse(content))
})

app.post('/api/games', (req, res) => {
  const { levelId } = req.body
  const levelPath = path.join(LEVELS_DIR, `${levelId}.json`)
  
  if (!fs.existsSync(levelPath)) {
    return res.status(404).json({ error: '关卡不存在' })
  }
  
  const level = JSON.parse(fs.readFileSync(levelPath, 'utf8'))
  const gameId = uuidv4()
  
  const gameState = {
    id: gameId,
    levelId,
    levelName: level.name,
    status: 'active',
    startTime: Date.now(),
    currentTime: 0,
    timeLimit: level.timeLimit,
    map: {
      ...level.map,
      tiles: generateMapTiles(level.map.width, level.map.height)
    },
    units: [
      ...(level.resources.snowmobiles || 0).fill(null).map((_, i) => ({
        id: `snowmobile-${i}`,
        type: 'snowmobile',
        position: { ...level.map.startPosition },
        battery: 100,
        status: 'idle',
        path: [],
        speed: 2
      })),
      ...(level.resources.drones || 0).fill(null).map((_, i) => ({
        id: `drone-${i}`,
        type: 'drone',
        position: { ...level.map.startPosition },
        battery: 100,
        status: 'idle',
        path: [],
        speed: 4,
        scanRadius: 3
      }))
    ],
    hotDrinks: level.resources.hotDrinks || 0,
    tourists: level.tourists.map(t => ({
      ...t,
      found: false,
      rescued: false
    })),
    hazards: level.hazards || [],
    events: [],
    score: 0
  }
  
  const gamePath = path.join(GAMES_DIR, `${gameId}.json`)
  fs.writeFileSync(gamePath, JSON.stringify(gameState, null, 2))
  
  const metaPath = path.join(DATA_DIR, 'current-game.json')
  fs.writeFileSync(metaPath, JSON.stringify({ gameId }, null, 2))
  
  res.json(gameState)
})

app.get('/api/games/current', (req, res) => {
  const metaPath = path.join(DATA_DIR, 'current-game.json')
  if (!fs.existsSync(metaPath)) {
    return res.status(404).json({ error: '没有进行中的游戏' })
  }
  
  const { gameId } = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
  const gamePath = path.join(GAMES_DIR, `${gameId}.json`)
  
  if (!fs.existsSync(gamePath)) {
    return res.status(404).json({ error: '游戏文件不存在' })
  }
  
  const gameState = JSON.parse(fs.readFileSync(gamePath, 'utf8'))
  res.json(gameState)
})

app.put('/api/games/:id', (req, res) => {
  const gamePath = path.join(GAMES_DIR, `${req.params.id}.json`)
  if (!fs.existsSync(gamePath)) {
    return res.status(404).json({ error: '游戏不存在' })
  }
  
  const gameState = req.body
  fs.writeFileSync(gamePath, JSON.stringify(gameState, null, 2))
  
  res.json({ success: true })
})

app.post('/api/games/:id/actions', (req, res) => {
  const { action, payload } = req.body
  const gamePath = path.join(GAMES_DIR, `${req.params.id}.json`)
  
  if (!fs.existsSync(gamePath)) {
    return res.status(404).json({ error: '游戏不存在' })
  }
  
  const gameState = JSON.parse(fs.readFileSync(gamePath, 'utf8'))
  const result = processAction(gameState, action, payload)
  
  fs.writeFileSync(gamePath, JSON.stringify(result.gameState, null, 2))
  res.json(result)
})

function processAction(gameState, action, payload) {
  const events = []
  
  switch (action) {
    case 'MOVE_UNIT': {
      const { unitId, targetPosition, path } = payload
      const unit = gameState.units.find(u => u.id === unitId)
      if (unit) {
        unit.status = 'moving'
        unit.path = path || [targetPosition]
        events.push({
          id: uuidv4(),
          type: 'unit_move',
          unitId,
          unitType: unit.type,
          targetPosition,
          timestamp: gameState.currentTime
        })
      }
      break
    }
    
    case 'SCAN_AREA': {
      const { unitId, position } = payload
      const unit = gameState.units.find(u => u.id === unitId)
      if (unit && unit.type === 'drone') {
        const scanRadius = unit.scanRadius || 3
        
        gameState.map.tiles.forEach((row, y) => {
          row.forEach((tile, x) => {
            const dist = Math.sqrt(
              Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2)
            )
            if (dist <= scanRadius) {
              tile.visible = true
              tile.explored = true
            }
          })
        })
        
        gameState.tourists.forEach(tourist => {
          if (!tourist.found) {
            const dist = Math.sqrt(
              Math.pow(tourist.position.x - position.x, 2) +
              Math.pow(tourist.position.y - position.y, 2)
            )
            if (dist <= scanRadius) {
              tourist.found = true
              events.push({
                id: uuidv4(),
                type: 'tourist_found',
                touristId: tourist.id,
                position: tourist.position,
                timestamp: gameState.currentTime
              })
            }
          }
        })
      }
      break
    }
    
    case 'RESCUE_TOURIST': {
      const { unitId, touristId } = payload
      const unit = gameState.units.find(u => u.id === unitId)
      const tourist = gameState.tourists.find(t => t.id === touristId)
      
      if (unit && tourist && tourist.found && !tourist.rescued) {
        const dist = Math.sqrt(
          Math.pow(unit.position.x - tourist.position.x, 2) +
          Math.pow(unit.position.y - tourist.position.y, 2)
        )
        
        if (dist < 2) {
          tourist.rescued = true
          tourist.rescueTime = gameState.currentTime
          gameState.score += 100
          
          events.push({
            id: uuidv4(),
            type: 'tourist_rescued',
            touristId,
            unitId,
            timestamp: gameState.currentTime
          })
        }
      }
      break
    }
    
    case 'PROVIDE_HOT_DRINK': {
      const { touristId } = payload
      const tourist = gameState.tourists.find(t => t.id === touristId)
      
      if (tourist && tourist.found && gameState.hotDrinks > 0) {
        tourist.temperature = Math.min(37.0, tourist.temperature + 2)
        gameState.hotDrinks--
        
        events.push({
          id: uuidv4(),
          type: 'hot_drink_provided',
          touristId,
          newTemperature: tourist.temperature,
          timestamp: gameState.currentTime
        })
      }
      break
    }
    
    case 'ADVANCE_TIME': {
      const { duration } = payload
      gameState.currentTime += duration
      
      gameState.units.forEach(unit => {
        if (unit.status === 'moving' && unit.path.length > 0) {
          const target = unit.path[0]
          const dist = Math.sqrt(
            Math.pow(target.x - unit.position.x, 2) +
            Math.pow(target.y - unit.position.y, 2)
          )
          
          const moveDistance = unit.speed * duration / 60
          
          if (dist <= moveDistance) {
            unit.position = { ...target }
            unit.path.shift()
            
            if (unit.path.length === 0) {
              unit.status = 'idle'
            }
            
            if (unit.type === 'drone') {
              const scanRadius = unit.scanRadius || 3
              gameState.map.tiles.forEach((row, y) => {
                row.forEach((tile, x) => {
                  const tileDist = Math.sqrt(
                    Math.pow(x - unit.position.x, 2) +
                    Math.pow(y - unit.position.y, 2)
                  )
                  if (tileDist <= scanRadius) {
                    tile.visible = true
                    tile.explored = true
                  }
                })
              })
            }
          } else {
            const ratio = moveDistance / dist
            unit.position.x += (target.x - unit.position.x) * ratio
            unit.position.y += (target.y - unit.position.y) * ratio
          }
        }
        
        if (unit.status === 'moving') {
          unit.battery = Math.max(0, unit.battery - duration * 0.1)
        }
      })
      
      gameState.tourists.forEach(tourist => {
        if (!tourist.rescued) {
          tourist.temperature -= duration * 0.05
          
          gameState.hazards.forEach(hazard => {
            if (hazard.type === 'avalanche') {
              const inArea = 
                tourist.position.x >= hazard.area.x &&
                tourist.position.x < hazard.area.x + hazard.area.width &&
                tourist.position.y >= hazard.area.y &&
                tourist.position.y < hazard.area.y + hazard.area.height
              
              if (inArea && Math.random() < hazard.risk * duration / 60) {
                tourist.status = 'trapped'
                events.push({
                  id: uuidv4(),
                  type: 'avalanche_occurred',
                  touristId: tourist.id,
                  position: tourist.position,
                  timestamp: gameState.currentTime
                })
              }
            }
          })
        }
      })
      
      const allRescued = gameState.tourists.every(t => t.rescued)
      const timeUp = gameState.currentTime >= gameState.timeLimit
      const anyHypothermic = gameState.tourists.some(t => t.temperature < 32 && !t.rescued)
      
      if (allRescued) {
        gameState.status = 'won'
        gameState.endTime = Date.now()
        events.push({
          id: uuidv4(),
          type: 'game_won',
          timestamp: gameState.currentTime
        })
      } else if (timeUp || anyHypothermic) {
        gameState.status = 'lost'
        gameState.endTime = Date.now()
        events.push({
          id: uuidv4(),
          type: 'game_lost',
          reason: timeUp ? 'time_limit' : 'hypothermia',
          timestamp: gameState.currentTime
        })
      }
      
      break
    }
  }
  
  gameState.events = [...(gameState.events || []), ...events]
  
  return { gameState, events }
}

app.get('/api/games/:id/report', (req, res) => {
  const gamePath = path.join(GAMES_DIR, `${req.params.id}.json`)
  if (!fs.existsSync(gamePath)) {
    return res.status(404).json({ error: '游戏不存在' })
  }
  
  const gameState = JSON.parse(fs.readFileSync(gamePath, 'utf8'))
  const report = generateReport(gameState)
  
  res.setHeader('Content-Type', 'text/markdown')
  res.setHeader('Content-Disposition', `attachment; filename="rescue-report-${gameState.id}.md"`)
  res.send(report.markdown)
})

app.get('/api/games/:id/logs', (req, res) => {
  const gamePath = path.join(GAMES_DIR, `${req.params.id}.json`)
  if (!fs.existsSync(gamePath)) {
    return res.status(404).json({ error: '游戏不存在' })
  }
  
  const gameState = JSON.parse(fs.readFileSync(gamePath, 'utf8'))
  
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="event-log-${gameState.id}.json"`)
  res.json(gameState.events)
})

function generateReport(gameState) {
  const dayjs = require('dayjs')
  
  const rescuedTourists = gameState.tourists.filter(t => t.rescued)
  const lostTourists = gameState.tourists.filter(t => !t.rescued)
  
  const markdown = `# 夜间雪道搜救 - 任务简报

## 基本信息
- **任务编号**: ${gameState.id}
- **关卡**: ${gameState.levelName}
- **任务状态**: ${gameState.status === 'won' ? '成功' : gameState.status === 'lost' ? '失败' : '进行中'}
- **开始时间**: ${dayjs(gameState.startTime).format('YYYY-MM-DD HH:mm:ss')}
- **游戏时长**: ${Math.floor(gameState.currentTime / 60)}分${gameState.currentTime % 60}秒
- **时间限制**: ${Math.floor(gameState.timeLimit / 60)}分

## 营救结果
- **游客总数**: ${gameState.tourists.length}
- **成功营救**: ${rescuedTourists.length}
- **未能营救**: ${lostTourists.length}
- **最终得分**: ${gameState.score}

## 资源使用情况
- **雪地车**: ${gameState.units.filter(u => u.type === 'snowmobile').length} 辆
- **无人机**: ${gameState.units.filter(u => u.type === 'drone').length} 架
- **热饮补给**: 剩余 ${gameState.hotDrinks} 份

## 游客详情

${gameState.tourists.map((t, i) => `### 游客 ${i + 1}
- **状态**: ${t.rescued ? '已营救' : t.found ? '已发现' : '失踪'}
- **位置**: (${t.position.x}, ${t.position.y})
- **体温**: ${t.temperature.toFixed(1)}°C
${t.rescueTime ? `- **营救时间**: 第${Math.floor(t.rescueTime / 60)}分${t.rescueTime % 60}秒` : ''}
`).join('\n')}

## 关键事件

${gameState.events
  .filter(e => ['tourist_found', 'tourist_rescued', 'avalanche_occurred', 'game_won', 'game_lost'].includes(e.type))
  .map(e => {
    const time = `第${Math.floor(e.timestamp / 60)}分${e.timestamp % 60}秒`
    switch (e.type) {
      case 'tourist_found':
        return `- [${time}] 发现游客 (${e.position.x}, ${e.position.y})`
      case 'tourist_rescued':
        return `- [${time}] 成功营救游客 ${e.touristId}`
      case 'avalanche_occurred':
        return `- [${time}] ⚠️ 雪崩发生！游客被困于 (${e.position.x}, ${e.position.y})`
      case 'game_won':
        return `- [${time}] 🎉 任务成功！所有游客已营救`
      case 'game_lost':
        return `- [${time}] ❌ 任务失败：${e.reason === 'time_limit' ? '时间耗尽' : '游客体温过低'}`
      default:
        return ''
    }
  })
  .filter(Boolean)
  .join('\n')}

---
*报告生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}*
`

  return { markdown }
}

ensureDefaultLevels()

app.listen(PORT, () => {
  console.log(`雪道搜救游戏后端服务运行在 http://localhost:${PORT}`)
})
