import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

const isElectron = window.electronAPI !== undefined

const mockData = {
  shows: [
    {
      id: 'show-001',
      name: '《茶馆》社区版演出',
      date: '2026-05-10',
      venue: '阳光社区小剧场',
      description: '经典话剧《茶馆》社区公益演出'
    }
  ],
  programs: [
    { id: 'prog-001', show_id: 'show-001', name: '第一幕：戊戌变法后', order: 1, duration: 1800 },
    { id: 'prog-002', show_id: 'show-001', name: '第二幕：民国初年', order: 2, duration: 1500 },
    { id: 'prog-003', show_id: 'show-001', name: '第三幕：抗战胜利后', order: 3, duration: 1600 }
  ],
  scenes: [
    { id: 'scene-001', program_id: 'prog-001', name: '开场 - 茶馆热闹', start_time: 0, duration: 300, order: 1 },
    { id: 'scene-002', program_id: 'prog-001', name: '秦仲义出场', start_time: 300, duration: 240, order: 2 },
    { id: 'scene-003', program_id: 'prog-001', name: '常四爷与二德子冲突', start_time: 540, duration: 180, order: 3 },
    { id: 'scene-004', program_id: 'prog-002', name: '茶馆衰落 - 军阀混战', start_time: 0, duration: 240, order: 1 },
    { id: 'scene-005', program_id: 'prog-003', name: '王利发的晚年', start_time: 0, duration: 300, order: 1 }
  ],
  actors: [
    { id: 'actor-001', show_id: 'show-001', name: '张三', role: '王利发', status: 'available' },
    { id: 'actor-002', show_id: 'show-001', name: '李四', role: '常四爷', status: 'available' },
    { id: 'actor-003', show_id: 'show-001', name: '王五', role: '秦仲义', status: 'available' },
    { id: 'actor-004', show_id: 'show-001', name: '赵六', role: '二德子', status: 'available' },
    { id: 'actor-005', show_id: 'show-001', name: '钱七', role: '松二爷', status: 'available' }
  ],
  props: [
    { id: 'prop-001', show_id: 'show-001', name: '茶壶A', location: '道具间1', status: 'stored' },
    { id: 'prop-002', show_id: 'show-001', name: '茶碗套装', location: '道具间1', status: 'stored' },
    { id: 'prop-003', show_id: 'show-001', name: '鸟笼', location: '道具间2', status: 'stored' },
    { id: 'prop-004', show_id: 'show-001', name: '拐杖-秦仲义', location: '道具间2', status: 'stored' },
    { id: 'prop-005', show_id: 'show-001', name: '纸钱', location: '后台', status: 'stored' }
  ],
  microphones: [
    { id: 'mic-001', show_id: 'show-001', name: '胸麦-01', channel: 1, battery_level: 85, status: 'available' },
    { id: 'mic-002', show_id: 'show-001', name: '胸麦-02', channel: 2, battery_level: 90, status: 'available' },
    { id: 'mic-003', show_id: 'show-001', name: '胸麦-03', channel: 3, battery_level: 75, status: 'available' },
    { id: 'mic-004', show_id: 'show-001', name: '手持麦-01', channel: 4, battery_level: 100, status: 'available' },
    { id: 'mic-005', show_id: 'show-001', name: '胸麦-05', channel: 5, battery_level: 20, status: 'available' }
  ],
  cues: [
    { id: 'cue-001', scene_id: 'scene-001', type: 'lighting', name: '开场灯光', start_time: 0, duration: 10, order: 1, status: 'pending' },
    { id: 'cue-002', scene_id: 'scene-001', type: 'sound', name: '背景音-茶馆热闹', start_time: 0, duration: 300, order: 2, status: 'pending' },
    { id: 'cue-003', scene_id: 'scene-001', type: 'prop', name: '茶壶茶碗上场', start_time: 10, duration: 20, order: 3, status: 'pending' },
    { id: 'cue-004', scene_id: 'scene-001', type: 'actor', name: '王利发出场', start_time: 30, duration: 5, order: 4, status: 'pending' },
    { id: 'cue-005', scene_id: 'scene-002', type: 'lighting', name: '聚光-秦仲义', start_time: 0, duration: 240, order: 1, status: 'pending' },
    { id: 'cue-006', scene_id: 'scene-002', type: 'actor', name: '秦仲义上场', start_time: 5, duration: 5, order: 2, status: 'pending' },
    { id: 'cue-007', scene_id: 'scene-003', type: 'sound', name: '冲突音效', start_time: 60, duration: 10, order: 1, status: 'pending' },
    { id: 'cue-008', scene_id: 'scene-003', type: 'lighting', name: '闪烁效果', start_time: 60, duration: 10, order: 2, status: 'pending' },
    { id: 'cue-009', scene_id: 'scene-005', type: 'prop', name: '纸钱上场', start_time: 200, duration: 10, order: 1, status: 'pending' }
  ],
  cueActors: [
    { cue_id: 'cue-004', actor_id: 'actor-001', action: 'enter' },
    { cue_id: 'cue-006', actor_id: 'actor-003', action: 'enter' }
  ],
  cueProps: [
    { cue_id: 'cue-003', prop_id: 'prop-001', action: 'enter' },
    { cue_id: 'cue-003', prop_id: 'prop-002', action: 'enter' },
    { cue_id: 'cue-009', prop_id: 'prop-005', action: 'enter' }
  ],
  cueMicrophones: [
    { cue_id: 'cue-004', microphone_id: 'mic-001', action: 'activate' },
    { cue_id: 'cue-006', microphone_id: 'mic-002', action: 'activate' },
    { cue_id: 'cue-007', microphone_id: 'mic-001', action: 'activate' }
  ]
}

export const useShowStore = defineStore('show', () => {
  const sampleDataLoaded = ref(false)

  const init = async () => {
    console.log('Store initialized')
  }

  const loadSampleData = async () => {
    if (sampleDataLoaded.value) return
    
    if (!isElectron) {
      sampleDataLoaded.value = true
      return
    }

    try {
      const existingShows = await window.electronAPI.dbQuery(
        'SELECT * FROM shows WHERE id = ?',
        ['show-001']
      )

      if (existingShows.length > 0) {
        sampleDataLoaded.value = true
        return
      }

      for (const show of mockData.shows) {
        await window.electronAPI.dbRun(
          'INSERT INTO shows (id, name, date, venue, description) VALUES (?, ?, ?, ?, ?)',
          [show.id, show.name, show.date, show.venue, show.description]
        )
      }

      for (const prog of mockData.programs) {
        await window.electronAPI.dbRun(
          'INSERT INTO programs (id, show_id, name, "order", duration) VALUES (?, ?, ?, ?, ?)',
          [prog.id, prog.show_id, prog.name, prog.order, prog.duration]
        )
      }

      for (const scene of mockData.scenes) {
        await window.electronAPI.dbRun(
          'INSERT INTO scenes (id, program_id, name, start_time, duration, "order") VALUES (?, ?, ?, ?, ?, ?)',
          [scene.id, scene.program_id, scene.name, scene.start_time, scene.duration, scene.order]
        )
      }

      for (const actor of mockData.actors) {
        await window.electronAPI.dbRun(
          'INSERT INTO actors (id, show_id, name, role, status) VALUES (?, ?, ?, ?, ?)',
          [actor.id, actor.show_id, actor.name, actor.role, actor.status]
        )
      }

      for (const prop of mockData.props) {
        await window.electronAPI.dbRun(
          'INSERT INTO props (id, show_id, name, location, status) VALUES (?, ?, ?, ?, ?)',
          [prop.id, prop.show_id, prop.name, prop.location, prop.status]
        )
      }

      for (const mic of mockData.microphones) {
        await window.electronAPI.dbRun(
          'INSERT INTO microphones (id, show_id, name, channel, battery_level, status) VALUES (?, ?, ?, ?, ?, ?)',
          [mic.id, mic.show_id, mic.name, mic.channel, mic.battery_level, mic.status]
        )
      }

      for (const cue of mockData.cues) {
        await window.electronAPI.dbRun(
          'INSERT INTO cues (id, scene_id, type, name, start_time, duration, "order", status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [cue.id, cue.scene_id, cue.type, cue.name, cue.start_time, cue.duration, cue.order, cue.status]
        )
      }

      for (const ca of mockData.cueActors) {
        await window.electronAPI.dbRun(
          'INSERT INTO cue_actors (cue_id, actor_id, action) VALUES (?, ?, ?)',
          [ca.cue_id, ca.actor_id, ca.action]
        )
      }

      for (const cp of mockData.cueProps) {
        await window.electronAPI.dbRun(
          'INSERT INTO cue_props (cue_id, prop_id, action) VALUES (?, ?, ?)',
          [cp.cue_id, cp.prop_id, cp.action]
        )
      }

      for (const cm of mockData.cueMicrophones) {
        await window.electronAPI.dbRun(
          'INSERT INTO cue_microphones (cue_id, microphone_id, action) VALUES (?, ?, ?)',
          [cm.cue_id, cm.microphone_id, cm.action]
        )
      }

      sampleDataLoaded.value = true
      console.log('Sample data loaded')
    } catch (error) {
      console.error('Error loading sample data:', error)
    }
  }

  const getAllShows = async () => {
    if (!isElectron) {
      return mockData.shows
    }
    return await window.electronAPI.dbQuery('SELECT * FROM shows ORDER BY date DESC')
  }

  const createShow = async (show) => {
    if (!isElectron) {
      mockData.shows.push(show)
      return show
    }
    await window.electronAPI.dbRun(
      'INSERT INTO shows (id, name, date, venue, description) VALUES (?, ?, ?, ?, ?)',
      [show.id, show.name, show.date, show.venue, show.description]
    )
    return show
  }

  const getProgramsByShow = async (showId) => {
    if (!isElectron) {
      return mockData.programs.filter(p => p.show_id === showId)
    }
    return await window.electronAPI.dbQuery(
      'SELECT * FROM programs WHERE show_id = ? ORDER BY "order"',
      [showId]
    )
  }

  const getScenesByProgram = async (programId) => {
    if (!isElectron) {
      return mockData.scenes.filter(s => s.program_id === programId)
    }
    return await window.electronAPI.dbQuery(
      'SELECT * FROM scenes WHERE program_id = ? ORDER BY "order"',
      [programId]
    )
  }

  const getCuesByScene = async (sceneId) => {
    if (!isElectron) {
      return mockData.cues.filter(c => c.scene_id === sceneId)
    }
    return await window.electronAPI.dbQuery(
      'SELECT * FROM cues WHERE scene_id = ? ORDER BY start_time, "order"',
      [sceneId]
    )
  }

  const getCueById = async (cueId) => {
    if (!isElectron) {
      const cue = mockData.cues.find(c => c.id === cueId)
      if (!cue) return null
      
      const actors = mockData.cueActors
        .filter(ca => ca.cue_id === cueId)
        .map(ca => {
          const actor = mockData.actors.find(a => a.id === ca.actor_id)
          return { ...actor, action: ca.action }
        })
      
      const props = mockData.cueProps
        .filter(cp => cp.cue_id === cueId)
        .map(cp => {
          const prop = mockData.props.find(p => p.id === cp.prop_id)
          return { ...prop, action: cp.action }
        })
      
      const microphones = mockData.cueMicrophones
        .filter(cm => cm.cue_id === cueId)
        .map(cm => {
          const mic = mockData.microphones.find(m => m.id === cm.microphone_id)
          return { ...mic, action: cm.action }
        })

      return { ...cue, actors, props, microphones }
    }

    const cue = await window.electronAPI.dbGet(
      'SELECT * FROM cues WHERE id = ?',
      [cueId]
    )

    if (!cue) return null

    const actors = await window.electronAPI.dbQuery(`
      SELECT a.*, ca.action 
      FROM cue_actors ca 
      JOIN actors a ON ca.actor_id = a.id 
      WHERE ca.cue_id = ?
    `, [cueId])

    const props = await window.electronAPI.dbQuery(`
      SELECT p.*, cp.action 
      FROM cue_props cp 
      JOIN props p ON cp.prop_id = p.id 
      WHERE cp.cue_id = ?
    `, [cueId])

    const microphones = await window.electronAPI.dbQuery(`
      SELECT m.*, cm.action 
      FROM cue_microphones cm 
      JOIN microphones m ON cm.microphone_id = m.id 
      WHERE cm.cue_id = ?
    `, [cueId])

    return { ...cue, actors, props, microphones }
  }

  const getActorsByShow = async (showId) => {
    if (!isElectron) {
      return mockData.actors.filter(a => a.show_id === showId)
    }
    return await window.electronAPI.dbQuery(
      'SELECT * FROM actors WHERE show_id = ? ORDER BY name',
      [showId]
    )
  }

  const getPropsByShow = async (showId) => {
    if (!isElectron) {
      return mockData.props.filter(p => p.show_id === showId)
    }
    return await window.electronAPI.dbQuery(
      'SELECT * FROM props WHERE show_id = ? ORDER BY name',
      [showId]
    )
  }

  const getMicrophonesByShow = async (showId) => {
    if (!isElectron) {
      return mockData.microphones.filter(m => m.show_id === showId)
    }
    return await window.electronAPI.dbQuery(
      'SELECT * FROM microphones WHERE show_id = ? ORDER BY channel',
      [showId]
    )
  }

  const updateCueStatus = async (cueId, status, delayReason = '', delaySeconds = 0) => {
    if (!isElectron) {
      const cue = mockData.cues.find(c => c.id === cueId)
      if (cue) {
        cue.status = status
        if (delayReason) cue.delay_reason = delayReason
        if (delaySeconds > 0) cue.delay_seconds = delaySeconds
        if (status === 'executing') cue.actual_start_time = Date.now() / 1000
        if (status === 'completed') cue.actual_end_time = Date.now() / 1000
      }
      return
    }

    const updates = []
    const values = []

    updates.push('status = ?')
    values.push(status)

    if (delayReason) {
      updates.push('delay_reason = ?')
      values.push(delayReason)
    }

    if (delaySeconds > 0) {
      updates.push('delay_seconds = ?')
      values.push(delaySeconds)
    }

    if (status === 'executing') {
      updates.push('actual_start_time = ?')
      values.push(Math.floor(Date.now() / 1000))
    }

    if (status === 'completed') {
      updates.push('actual_end_time = ?')
      values.push(Math.floor(Date.now() / 1000))
    }

    values.push(cueId)

    await window.electronAPI.dbRun(
      `UPDATE cues SET ${updates.join(', ')} WHERE id = ?`,
      values
    )
  }

  const addCueNote = async (cueId, notes) => {
    if (!isElectron) {
      const cue = mockData.cues.find(c => c.id === cueId)
      if (cue) {
        cue.notes = notes
      }
      return
    }

    await window.electronAPI.dbRun(
      'UPDATE cues SET notes = ? WHERE id = ?',
      [notes, cueId]
    )
  }

  const checkConflicts = async (showId) => {
    const conflicts = []

    const programs = await getProgramsByShow(showId)
    
    for (const prog of programs) {
      const scenes = await getScenesByProgram(prog.id)
      
      for (let i = 0; i < scenes.length - 1; i++) {
        const currentScene = scenes[i]
        const nextScene = scenes[i + 1]
        
        const currentEnd = currentScene.start_time + currentScene.duration
        const nextStart = nextScene.start_time
        
        if (nextStart - currentEnd < 30) {
          conflicts.push({
            id: uuidv4(),
            type: 'transition_time',
            severity: 'warning',
            description: `场景 "${currentScene.name}" 到 "${nextScene.name}" 换场时间不足 (${nextStart - currentEnd}秒，建议至少30秒)`,
            affectedCueIds: []
          })
        }
      }

      for (const scene of scenes) {
        const cues = await getCuesByScene(scene.id)
        
        const micUsage = {}
        for (const cue of cues) {
          const cueDetail = await getCueById(cue.id)
          if (cueDetail.microphones && cueDetail.microphones.length > 0) {
            for (const mic of cueDetail.microphones) {
              if (!micUsage[mic.id]) {
                micUsage[mic.id] = []
              }
              micUsage[mic.id].push({
                cue: cue,
                start: scene.start_time + cue.start_time,
                end: scene.start_time + cue.start_time + cue.duration
              })
            }
          }
        }

        for (const [micId, usages] of Object.entries(micUsage)) {
          for (let i = 0; i < usages.length; i++) {
            for (let j = i + 1; j < usages.length; j++) {
              const usage1 = usages[i]
              const usage2 = usages[j]
              
              if (usage1.start < usage2.end && usage2.start < usage1.end) {
                conflicts.push({
                  id: uuidv4(),
                  type: 'device_conflict',
                  severity: 'critical',
                  description: `麦克风 ${micId} 在 CUE "${usage1.cue.name}" 和 "${usage2.cue.name}" 中时间重叠`,
                  affectedCueIds: [usage1.cue.id, usage2.cue.id]
                })
              }
            }
          }
        }
      }
    }

    const mics = await getMicrophonesByShow(showId)
    for (const mic of mics) {
      if (mic.battery_level < 30) {
        conflicts.push({
          id: uuidv4(),
          type: 'mic_battery',
          severity: mic.battery_level < 15 ? 'critical' : 'warning',
          description: `麦克风 "${mic.name}" (通道${mic.channel}) 电量低: ${mic.battery_level}%`,
          affectedCueIds: []
        })
      }
    }

    return conflicts
  }

  const exportData = async (showId, exportType) => {
    const shows = await getAllShows()
    const show = shows.find(s => s.id === showId)
    
    if (!show) {
      throw new Error('演出不存在')
    }

    const programs = await getProgramsByShow(showId)
    const allScenes = []
    const allCues = []

    for (const prog of programs) {
      const scenes = await getScenesByProgram(prog.id)
      for (const scene of scenes) {
        allScenes.push({ ...scene, program_name: prog.name })
        const cues = await getCuesByScene(scene.id)
        for (const cue of cues) {
          const cueDetail = await getCueById(cue.id)
          allCues.push({ ...cueDetail, scene_name: scene.name, program_name: prog.name })
        }
      }
    }

    const actors = await getActorsByShow(showId)
    const props = await getPropsByShow(showId)
    const microphones = await getMicrophonesByShow(showId)
    const conflicts = await checkConflicts(showId)

    const exportData = {
      show,
      exportTime: new Date().toISOString(),
      exportType,
      programs,
      scenes: allScenes,
      cues: allCues,
      actors,
      props,
      microphones,
      conflicts
    }

    let markdown = ''
    
    if (exportType === 'execution') {
      markdown = generateExecutionSheet(exportData)
    } else if (exportType === 'conflicts') {
      markdown = generateConflictList(exportData)
    } else {
      markdown = generateReport(exportData)
    }

    const fs = require('fs')
    const path = require('path')
    const os = require('os')
    
    const exportDir = path.join(os.homedir(), 'Documents', 'TheaterExports')
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true })
    }

    const timestamp = dayjs().format('YYYYMMDD_HHmmss')
    const baseName = `${show.name}_${exportType}_${timestamp}`
    
    const jsonPath = path.join(exportDir, `${baseName}.json`)
    const mdPath = path.join(exportDir, `${baseName}.md`)

    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2), 'utf-8')
    fs.writeFileSync(mdPath, markdown, 'utf-8')

    return {
      jsonPath,
      mdPath,
      filePath: exportDir
    }
  }

  const generateExecutionSheet = (data) => {
    let md = `# ${data.show.name} - 当日执行单\n\n`
    md += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`
    md += `## 演出信息\n\n`
    md += `- **日期**: ${data.show.date}\n`
    md += `- **地点**: ${data.show.venue || '待定'}\n`
    md += `- **描述**: ${data.show.description || '-'}\n\n`

    md += `---\n\n`
    md += `## CUE 执行清单\n\n`

    for (const prog of data.programs) {
      md += `### ${prog.name}\n\n`
      
      const progScenes = data.scenes.filter(s => s.program_id === prog.id)
      
      for (const scene of progScenes) {
        md += `#### ${scene.name}\n\n`
        md += `| 序号 | 类型 | CUE名称 | 开始时间 | 持续时间 | 状态 | 延误 | 备注 |\n`
        md += `|------|------|---------|---------|---------|------|------|------|\n`
        
        const sceneCues = data.cues.filter(c => c.scene_name === scene.name)
        sceneCues.sort((a, b) => a.start_time - b.start_time)
        
        for (const cue of sceneCues) {
          const typeLabel = {
            lighting: '灯光',
            sound: '音响',
            prop: '道具',
            actor: '演员'
          }[cue.type] || cue.type
          
          const statusLabel = {
            pending: '⏳ 待执行',
            executing: '▶️ 执行中',
            completed: '✅ 已完成',
            delayed: '⏰ 延误'
          }[cue.status] || cue.status

          const startTime = formatTime(cue.start_time)
          const duration = formatDuration(cue.duration)
          const delay = cue.delay_seconds > 0 ? `${cue.delay_seconds}秒` : '-'

          md += `| ${cue.order} | ${typeLabel} | ${cue.name} | ${startTime} | ${duration} | ${statusLabel} | ${delay} | ${cue.notes || '-'} |\n`
        }
        md += `\n`
      }
    }

    md += `---\n\n`
    md += `## 人员清单\n\n`
    md += `| 姓名 | 角色 | 状态 |\n`
    md += `|------|------|------|\n`
    for (const actor of data.actors) {
      md += `| ${actor.name} | ${actor.role || '-'} | ${actor.status === 'available' ? '可用' : '忙'} |\n`
    }

    md += `\n---\n\n`
    md += `## 麦克风状态\n\n`
    md += `| 名称 | 通道 | 电量 | 状态 |\n`
    md += `|------|------|------|------|\n`
    for (const mic of data.microphones) {
      const batteryIcon = mic.battery_level < 20 ? '🔴' : mic.battery_level < 50 ? '🟡' : '🟢'
      md += `| ${mic.name} | ${mic.channel} | ${batteryIcon} ${mic.battery_level}% | ${mic.status === 'available' ? '可用' : '使用中'} |\n`
    }

    return md
  }

  const generateConflictList = (data) => {
    let md = `# ${data.show.name} - 冲突清单\n\n`
    md += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`

    if (data.conflicts.length === 0) {
      md += `✅ **未检测到冲突**\n\n`
      return md
    }

    const critical = data.conflicts.filter(c => c.severity === 'critical')
    const warnings = data.conflicts.filter(c => c.severity === 'warning')

    if (critical.length > 0) {
      md += `## 🔴 严重冲突 (${critical.length})\n\n`
      md += `| 类型 | 描述 | 关联CUE |\n`
      md += `|------|------|---------|\n`
      for (const c of critical) {
        const typeLabel = {
          device_conflict: '设备冲突',
          transition_time: '换场时间',
          actor_waiting: '演员候场',
          prop_status: '道具状态',
          mic_battery: '麦克风电量'
        }[c.type] || c.type
        md += `| ${typeLabel} | ${c.description} | ${c.affectedCueIds?.join(', ') || '-'} |\n`
      }
      md += `\n`
    }

    if (warnings.length > 0) {
      md += `## 🟡 警告 (${warnings.length})\n\n`
      md += `| 类型 | 描述 | 关联CUE |\n`
      md += `|------|------|---------|\n`
      for (const c of warnings) {
        const typeLabel = {
          device_conflict: '设备冲突',
          transition_time: '换场时间',
          actor_waiting: '演员候场',
          prop_status: '道具状态',
          mic_battery: '麦克风电量'
        }[c.type] || c.type
        md += `| ${typeLabel} | ${c.description} | ${c.affectedCueIds?.join(', ') || '-'} |\n`
      }
    }

    return md
  }

  const generateReport = (data) => {
    let md = `# ${data.show.name} - 复盘报告\n\n`
    md += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`

    const completed = data.cues.filter(c => c.status === 'completed').length
    const delayed = data.cues.filter(c => c.delay_seconds > 0).length
    const totalDelay = data.cues.reduce((sum, c) => sum + (c.delay_seconds || 0), 0)

    md += `## 执行概览\n\n`
    md += `- **总CUE数**: ${data.cues.length}\n`
    md += `- **已完成**: ${completed}\n`
    md += `- **延误数**: ${delayed}\n`
    md += `- **总延误时间**: ${formatDuration(totalDelay)}\n\n`

    if (delayed > 0) {
      md += `## 延误详情\n\n`
      const delayedCues = data.cues.filter(c => c.delay_seconds > 0)
      for (const cue of delayedCues) {
        md += `### ${cue.program_name} > ${cue.scene_name} > ${cue.name}\n`
        md += `- **延误时间**: ${cue.delay_seconds}秒\n`
        md += `- **延误原因**: ${cue.delay_reason || '未记录'}\n`
        md += `- **备注**: ${cue.notes || '-'}\n\n`
      }
    }

    if (data.conflicts.length > 0) {
      md += `## 冲突回顾\n\n`
      for (const c of data.conflicts) {
        const severity = c.severity === 'critical' ? '🔴 严重' : '🟡 警告'
        md += `- ${severity}: ${c.description}\n`
      }
      md += `\n`
    }

    md += `## 设备状态\n\n`
    md += `### 麦克风电量检查\n\n`
    const lowBattery = data.microphones.filter(m => m.battery_level < 50)
    if (lowBattery.length > 0) {
      for (const mic of lowBattery) {
        const level = mic.battery_level < 20 ? '🔴 极低' : '🟡 较低'
        md += `- ${level}: ${mic.name} (${mic.battery_level}%)\n`
      }
    } else {
      md += `✅ 所有麦克风电量正常\n`
    }

    return md
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}秒`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (secs === 0) return `${mins}分`
    return `${mins}分${secs}秒`
  }

  return {
    init,
    loadSampleData,
    sampleDataLoaded,
    getAllShows,
    createShow,
    getProgramsByShow,
    getScenesByProgram,
    getCuesByScene,
    getCueById,
    getActorsByShow,
    getPropsByShow,
    getMicrophonesByShow,
    updateCueStatus,
    addCueNote,
    checkConflicts,
    exportData
  }
})
