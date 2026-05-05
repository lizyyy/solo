package simulator

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/gmp-simulator/backend/internal/model"
	"gorm.io/gorm"
)

// GState G 的状态
type GState string

const (
	GIdle      GState = "idle"
	GRunnable  GState = "runnable"
	GRunning   GState = "running"
	GBlocked   GState = "blocked"
	GDead      GState = "dead"
	GPreempted GState = "preempted"
)

// PState P 的状态
type PState string

const (
	PIdle    PState = "idle"
	PRunning PState = "running"
	PSyscall PState = "syscall"
	PGC      PState = "gc"
)

// MState M 的状态
type MState string

const (
	MIdle     MState = "idle"
	MRunning  MState = "running"
	MParked   MState = "parked"
	MSpinning MState = "spinning"
)

// G Goroutine 模拟
type G struct {
	ID          int64
	State       GState
	CreatedTime time.Time
	StartTime   *time.Time
	EndTime     *time.Time
	Priority    int
	CPUQuota    int64
	CPUUsed     int64
	BlockReason string
	WaitTime    int64

	// 执行参数
	WorkUnits    int  // 需要执行的工作量单位
	WorkDone     int  // 已完成的工作量
	MakeSyscalls bool // 是否会进行系统调用
	NetIO        bool // 是否有网络 IO

	// 关联
	MID *int64
	PID *int64
}

// P 处理器模拟
type P struct {
	ID          int64
	State       PState
	CreatedTime time.Time

	// 本地运行队列
	LocalRunQueue []int64 // G 的 ID 列表
	LocalQueueCap int     // 本地队列容量

	// 当前运行
	CurrentG *int64
	MID      *int64

	// GC 状态
	InGCAssist bool
}

// M 机器线程模拟
type M struct {
	ID          int64
	State       MState
	CreatedTime time.Time

	// 关联
	PID *int64
	GID *int64

	// 系统调用
	InSyscall      bool
	SyscallEndTime *time.Time
}

// Simulator GMP 调度仿真器
type Simulator struct {
	ExperimentID uint
	DB           *gorm.DB
	Config       *model.Experiment

	// 虚拟时间
	VirtualTime int64
	StartTime   time.Time

	// 实体
	Gs map[int64]*G
	Ps map[int64]*P
	Ms map[int64]*M

	// 全局运行队列
	GlobalRunQueue []int64

	// 网络轮询器
	NetpollQueue []int64

	// 锁
	mu sync.RWMutex

	// 控制
	running bool
	paused  bool

	// GC 状态
	GCActive bool
	GCPhase  string

	// 统计
	stats *model.StatisticsResponse

	// 随机数生成器
	rng *rand.Rand

	// 事件通道（用于通知）
	eventChan chan *model.Event
}

// NewSimulator 创建新的仿真器
func NewSimulator(exp *model.Experiment, db *gorm.DB) (*Simulator, error) {
	s := &Simulator{
		ExperimentID: exp.ID,
		DB:           db,
		Config:       exp,
		VirtualTime:  0,
		StartTime:    time.Now(),
		Gs:           make(map[int64]*G),
		Ps:           make(map[int64]*P),
		Ms:           make(map[int64]*M),
		rng:          rand.New(rand.NewSource(time.Now().UnixNano())),
		eventChan:    make(chan *model.Event, 1000),
		stats: &model.StatisticsResponse{
			ExperimentID: exp.ID,
		},
	}

	// 初始化实体
	s.initEntities()

	return s, nil
}

// initEntities 初始化所有实体
func (s *Simulator) initEntities() {
	// 创建 P
	for i := 0; i < s.Config.NumP; i++ {
		p := &P{
			ID:            int64(i + 1),
			State:         PIdle,
			CreatedTime:   time.Now(),
			LocalRunQueue: make([]int64, 0),
			LocalQueueCap: 256,
		}
		s.Ps[p.ID] = p
	}

	// 创建 M
	for i := 0; i < s.Config.NumM; i++ {
		m := &M{
			ID:          int64(i + 1),
			State:       MIdle,
			CreatedTime: time.Now(),
		}
		s.Ms[m.ID] = m
	}

	// 创建 G
	for i := 0; i < s.Config.NumG; i++ {
		g := &G{
			ID:           int64(i + 1),
			State:        GIdle,
			CreatedTime:  time.Now(),
			Priority:     s.rng.Intn(5) + 1,
			CPUQuota:     int64(s.rng.Intn(1000) + 100),
			WorkUnits:    s.rng.Intn(100) + 10,
			MakeSyscalls: s.Config.EnableSyscall && s.rng.Float64() < 0.3,
			NetIO:        s.Config.EnableNetpoll && s.rng.Float64() < 0.2,
		}
		s.Gs[g.ID] = g
	}
}

// Run 运行仿真
func (s *Simulator) Run() {
	s.running = true

	// 启动事件持久化 goroutine
	go s.persistEvents()

	// 记录开始事件
	s.recordEvent(model.EventGCStart, nil, nil, nil, "Simulation started", nil)

	// 初始化：将 G 放入运行队列
	s.initializeRunQueue()

	// 主调度循环
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()

	snapshotInterval := int64(100) // 每 100 虚拟时间单位拍一次照
	lastSnapshot := int64(0)

	for s.running {
		if s.paused {
			time.Sleep(100 * time.Millisecond)
			continue
		}

		select {
		case <-ticker.C:
			// 执行一个调度周期
			s.runSchedulerCycle()

			// 检查是否应该拍照
			if s.VirtualTime-lastSnapshot >= snapshotInterval {
				s.takeSnapshot()
				lastSnapshot = s.VirtualTime
			}

			// 检查是否所有 G 都完成了
			if s.allGCompleted() {
				s.running = false
			}
		default:
			// 防止过热
			time.Sleep(1 * time.Millisecond)
		}
	}

	// 记录结束事件
	s.recordEvent(model.EventGCEnd, nil, nil, nil, "Simulation completed", nil)

	// 更新实验状态
	now := time.Now()
	s.DB.Model(&model.Experiment{}).Where("id = ?", s.ExperimentID).
		Updates(map[string]interface{}{
			"status":   "completed",
			"end_time": now,
		})

	// 关闭事件通道
	close(s.eventChan)
}

// persistEvents 持久化事件
func (s *Simulator) persistEvents() {
	for event := range s.eventChan {
		if err := s.DB.Create(event).Error; err != nil {
			fmt.Printf("Failed to persist event: %v\n", err)
		}
	}
}

// initializeRunQueue 初始化运行队列
func (s *Simulator) initializeRunQueue() {
	s.mu.Lock()
	defer s.mu.Unlock()

	for gid, g := range s.Gs {
		g.State = GRunnable
		s.addToRunQueue(gid)
		s.recordEvent(model.EventGCreate, &gid, nil, nil, "G created and added to run queue", nil)
		s.stats.GCreated++
	}
}

// addToRunQueue 添加到运行队列
func (s *Simulator) addToRunQueue(gid int64) {
	// 优先尝试放入空闲 P 的本地队列
	for _, p := range s.Ps {
		if p.State == PIdle && len(p.LocalRunQueue) < p.LocalQueueCap {
			p.LocalRunQueue = append(p.LocalRunQueue, gid)
			return
		}
	}

	// 放入全局运行队列
	s.GlobalRunQueue = append(s.GlobalRunQueue, gid)
}

// runSchedulerCycle 运行一个调度周期
func (s *Simulator) runSchedulerCycle() {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 增加虚拟时间
	s.VirtualTime++

	// 处理系统调用返回
	s.handleSyscallReturns()

	// 处理网络轮询
	if s.Config.EnableNetpoll {
		s.handleNetpoll()
	}

	// 可能触发 GC
	if s.Config.EnableGCAssist && s.rng.Float64() < 0.01 {
		s.triggerGC()
	}

	// 可能触发 sysmon 抢占
	if s.Config.EnablePreemption && s.rng.Float64() < 0.05 {
		s.triggerSysmonPreemption()
	}

	// 调度每个 M
	for _, m := range s.Ms {
		s.scheduleM(m)
	}

	// Work Stealing
	s.tryWorkStealing()
}

// scheduleM 调度 M
func (s *Simulator) scheduleM(m *M) {
	switch m.State {
	case MIdle:
		// 尝试获取 P
		for _, p := range s.Ps {
			if p.State == PIdle && (len(p.LocalRunQueue) > 0 || len(s.GlobalRunQueue) > 0) {
				s.acquireP(m, p)
				break
			}
		}

	case MRunning:
		// 如果有绑定的 P，运行 G
		if m.PID != nil {
			p := s.Ps[*m.PID]
			s.runGOnP(m, p)
		}
	}
}

// acquireP M 获取 P
func (s *Simulator) acquireP(m *M, p *P) {
	m.State = MRunning
	m.PID = &p.ID

	p.State = PRunning
	p.MID = &m.ID

	pid := p.ID
	mid := m.ID
	s.recordEvent(model.EventMAcquireP, nil, &pid, &mid, "M acquired P", nil)
	s.recordEvent(model.EventPAcquire, nil, &pid, &mid, "P acquired by M", nil)
}

// releaseP M 释放 P
func (s *Simulator) releaseP(m *M, p *P) {
	m.State = MIdle
	m.PID = nil
	m.GID = nil

	p.State = PIdle
	p.MID = nil
	p.CurrentG = nil

	pid := p.ID
	mid := m.ID
	s.recordEvent(model.EventMReleaseP, nil, &pid, &mid, "M released P", nil)
	s.recordEvent(model.EventPRelease, nil, &pid, &mid, "P released", nil)
}

// runGOnP 在 P 上运行 G
func (s *Simulator) runGOnP(m *M, p *P) {
	// 如果当前有 G 在运行，继续执行
	if p.CurrentG != nil {
		g := s.Gs[*p.CurrentG]
		if g == nil {
			return
		}

		// 执行一些工作
		g.WorkDone++
		g.CPUUsed++
		s.VirtualTime++

		// 检查是否完成
		if g.WorkDone >= g.WorkUnits {
			s.completeG(g, m, p)
			return
		}

		// 检查是否需要系统调用
		if g.MakeSyscalls && s.rng.Float64() < 0.1 {
			s.enterSyscall(g, m, p)
			return
		}

		// 检查是否需要网络 IO
		if g.NetIO && s.rng.Float64() < 0.05 {
			s.enterNetpollWait(g, m, p)
			return
		}

		// 检查是否应该被抢占（时间片用完）
		if s.Config.EnablePreemption && g.CPUUsed >= g.CPUQuota {
			s.preemptG(g, m, p, "time_slice_exhausted")
			return
		}

		return
	}

	// 尝试从本地队列获取 G
	if len(p.LocalRunQueue) > 0 {
		gid := p.LocalRunQueue[0]
		p.LocalRunQueue = p.LocalRunQueue[1:]
		s.startG(gid, m, p)
		return
	}

	// 尝试从全局队列获取 G
	if len(s.GlobalRunQueue) > 0 {
		gid := s.GlobalRunQueue[0]
		s.GlobalRunQueue = s.GlobalRunQueue[1:]
		s.startG(gid, m, p)
		return
	}

	// 没有 G 可运行，释放 P
	s.releaseP(m, p)
}

// startG 开始运行 G
func (s *Simulator) startG(gid int64, m *M, p *P) {
	g := s.Gs[gid]
	if g == nil {
		return
	}

	now := time.Now()
	g.State = GRunning
	g.StartTime = &now
	g.MID = &m.ID
	g.PID = &p.ID

	p.CurrentG = &gid
	m.GID = &gid
	m.PID = &p.ID
	m.State = MRunning
	p.State = PRunning

	s.recordEvent(model.EventGStart, &gid, &p.ID, &m.ID, "G started running", nil)
}

// completeG 完成 G
func (s *Simulator) completeG(g *G, m *M, p *P) {
	now := time.Now()
	g.State = GDead
	g.EndTime = &now

	p.CurrentG = nil
	m.GID = nil

	s.recordEvent(model.EventGEnd, &g.ID, &p.ID, &m.ID, "G completed", nil)
	s.stats.GCompleted++
}

// enterSyscall 进入系统调用
func (s *Simulator) enterSyscall(g *G, m *M, p *P) {
	g.State = GBlocked
	g.BlockReason = "syscall"
	m.InSyscall = true

	// 系统调用结束时间（虚拟时间）
	endTime := s.VirtualTime + int64(s.rng.Intn(50)+10)
	ts := time.Now().Add(time.Duration(endTime) * time.Millisecond)
	m.SyscallEndTime = &ts

	// P 进入系统调用状态
	p.State = PSyscall

	s.recordEvent(model.EventSyscallEnter, &g.ID, &p.ID, &m.ID, "Entered syscall", nil)
	s.stats.SyscallCount++
}

// handleSyscallReturns 处理系统调用返回
func (s *Simulator) handleSyscallReturns() {
	now := time.Now()

	for _, m := range s.Ms {
		if m.InSyscall && m.SyscallEndTime != nil && now.After(*m.SyscallEndTime) {
			// 系统调用完成
			m.InSyscall = false
			m.SyscallEndTime = nil

			if m.GID != nil {
				g := s.Gs[*m.GID]
				if g != nil && g.State == GBlocked {
					// 尝试重新获取 P
					if m.PID != nil {
						p := s.Ps[*m.PID]
						if p != nil {
							g.State = GRunning
							p.State = PRunning
							m.State = MRunning

							s.recordEvent(model.EventSyscallExit, &g.ID, &p.ID, &m.ID, "Exited syscall", nil)
						}
					} else {
						// P 被偷走了，放入运行队列
						g.State = GRunnable
						s.addToRunQueue(g.ID)
						m.GID = nil
						m.State = MIdle
					}
				}
			}
		}
	}
}

// enterNetpollWait 进入网络轮询等待
func (s *Simulator) enterNetpollWait(g *G, m *M, p *P) {
	g.State = GBlocked
	g.BlockReason = "netpoll"

	// 放入网络轮询队列
	s.NetpollQueue = append(s.NetpollQueue, g.ID)

	// 释放 P
	p.CurrentG = nil
	p.State = PIdle
	m.GID = nil
	m.PID = nil
	m.State = MIdle

	s.recordEvent(model.EventNetpollWait, &g.ID, &p.ID, &m.ID, "Waiting for netpoll", nil)
}

// handleNetpoll 处理网络轮询
func (s *Simulator) handleNetpoll() {
	if len(s.NetpollQueue) == 0 {
		return
	}

	// 随机唤醒一些 G
	if s.rng.Float64() < 0.3 {
		// 唤醒第一个 G
		if len(s.NetpollQueue) > 0 {
			gid := s.NetpollQueue[0]
			s.NetpollQueue = s.NetpollQueue[1:]

			g := s.Gs[gid]
			if g != nil && g.State == GBlocked {
				g.State = GRunnable
				s.addToRunQueue(gid)
				s.recordEvent(model.EventNetpollWakeup, &gid, nil, nil, "Woken up by netpoll", nil)
			}
		}
	}
}

// preemptG 抢占 G
func (s *Simulator) preemptG(g *G, m *M, p *P, reason string) {
	g.State = GPreempted
	g.CPUUsed = 0 // 重置 CPU 使用

	// 放回运行队列
	s.addToRunQueue(g.ID)

	p.CurrentG = nil
	m.GID = nil

	s.recordEvent(model.EventGPreempt, &g.ID, &p.ID, &m.ID, "G preempted: "+reason, nil)
	s.stats.PreemptionCount++
	s.stats.GPreempted++
}

// triggerSysmonPreemption 触发 sysmon 抢占
func (s *Simulator) triggerSysmonPreemption() {
	// 查找运行时间过长的 G
	for _, p := range s.Ps {
		if p.State == PRunning && p.CurrentG != nil {
			g := s.Gs[*p.CurrentG]
			if g != nil && g.CPUUsed > 100 { // 超过 100 个时间单位
				for _, m := range s.Ms {
					if m.GID != nil && *m.GID == g.ID {
						s.recordEvent(model.EventSysmonPreempt, &g.ID, &p.ID, &m.ID, "Sysmon: long running G detected", nil)
						s.stats.SysmonPreemptions++
						s.preemptG(g, m, p, "sysmon_long_running")
						return
					}
				}
			}
		}
	}
}

// tryWorkStealing 尝试 Work Stealing
func (s *Simulator) tryWorkStealing() {
	// 查找空闲的 P
	var idlePs []*P
	var busyPs []*P

	for _, p := range s.Ps {
		if p.State == PIdle {
			idlePs = append(idlePs, p)
		} else if len(p.LocalRunQueue) > 1 {
			busyPs = append(busyPs, p)
		}
	}

	for _, idleP := range idlePs {
		if len(busyPs) == 0 {
			break
		}

		// 随机选择一个忙碌的 P
		victimIdx := s.rng.Intn(len(busyPs))
		victim := busyPs[victimIdx]

		// 记录窃取开始
		pid := idleP.ID
		victimPID := victim.ID
		s.recordEvent(model.EventWorkStealStart, nil, &pid, nil,
			fmt.Sprintf("Attempting to steal from P%d", victimPID), nil)
		s.stats.WorkStealAttempts++

		// 窃取一半的 G
		stealCount := len(victim.LocalRunQueue) / 2
		if stealCount > 0 {
			// 从 victim 的队列末尾窃取
			stolen := victim.LocalRunQueue[len(victim.LocalRunQueue)-stealCount:]
			victim.LocalRunQueue = victim.LocalRunQueue[:len(victim.LocalRunQueue)-stealCount]

			// 添加到空闲 P 的队列
			idleP.LocalRunQueue = append(idleP.LocalRunQueue, stolen...)

			s.recordEvent(model.EventWorkStealEnd, nil, &pid, nil,
				fmt.Sprintf("Stole %d Gs from P%d", stealCount, victimPID),
				&stealCount)
			s.stats.WorkStealSuccess++
			s.stats.TotalStolen += int64(stealCount)
		}
	}
}

// triggerGC 触发 GC
func (s *Simulator) triggerGC() {
	if s.GCActive {
		return
	}

	s.GCActive = true
	s.GCPhase = "mark"

	s.recordEvent(model.EventGCStart, nil, nil, nil, "GC started", nil)
	s.stats.GCRuns++

	// 随机选择一些 P 进行 GC assist
	for _, p := range s.Ps {
		if s.rng.Float64() < 0.5 {
			p.InGCAssist = true
			p.State = PGC

			pid := p.ID
			s.recordEvent(model.EventPGCAssist, nil, &pid, nil, "P assisting GC", nil)
			s.stats.GCAssistCount++
		}
	}

	// 模拟 GC 进行一段时间
	go func() {
		time.Sleep(time.Duration(s.rng.Intn(100)+50) * time.Millisecond)
		s.mu.Lock()
		defer s.mu.Unlock()

		// 结束 GC
		s.GCActive = false
		s.GCPhase = ""

		for _, p := range s.Ps {
			if p.InGCAssist {
				p.InGCAssist = false
				if len(p.LocalRunQueue) > 0 {
					p.State = PRunning
				} else {
					p.State = PIdle
				}
			}
		}

		s.recordEvent(model.EventGCEnd, nil, nil, nil, "GC completed", nil)
	}()
}

// allGCompleted 检查是否所有 G 都完成了
func (s *Simulator) allGCompleted() bool {
	for _, g := range s.Gs {
		if g.State != GDead {
			return false
		}
	}
	return true
}

// takeSnapshot 拍摄队列快照
func (s *Simulator) takeSnapshot() {
	// 收集全局队列信息
	globalGIDs, _ := json.Marshal(s.GlobalRunQueue)

	// 收集本地队列信息
	localQueues := make(map[string]interface{})
	for pid, p := range s.Ps {
		localQueues[fmt.Sprintf("%d", pid)] = map[string]interface{}{
			"size":  len(p.LocalRunQueue),
			"gids":  p.LocalRunQueue,
			"state": p.State,
		}
	}
	localQueuesJSON, _ := json.Marshal(localQueues)

	// 收集网络轮询队列
	netpollGIDs, _ := json.Marshal(s.NetpollQueue)

	// 收集空闲 P
	var idlePIDs []int64
	for pid, p := range s.Ps {
		if p.State == PIdle {
			idlePIDs = append(idlePIDs, pid)
		}
	}
	idlePIDsJSON, _ := json.Marshal(idlePIDs)

	// 收集运行中的 G
	var runningGIDs []int64
	var runningMPIDs []map[string]interface{}
	for _, m := range s.Ms {
		if m.State == MRunning && m.GID != nil && m.PID != nil {
			runningGIDs = append(runningGIDs, *m.GID)
			runningMPIDs = append(runningMPIDs, map[string]interface{}{
				"mid": m.ID,
				"pid": *m.PID,
				"gid": *m.GID,
			})
		}
	}
	runningGIDsJSON, _ := json.Marshal(runningGIDs)
	runningMPIDsJSON, _ := json.Marshal(runningMPIDs)

	snapshot := &model.QueueSnapshot{
		ExperimentID:     s.ExperimentID,
		Timestamp:        time.Now(),
		VirtualTime:      s.VirtualTime,
		GlobalQueueSize:  len(s.GlobalRunQueue),
		GlobalQueueGIDs:  string(globalGIDs),
		LocalQueues:      string(localQueuesJSON),
		NetpollQueueSize: len(s.NetpollQueue),
		NetpollQueueGIDs: string(netpollGIDs),
		IdlePIDs:         string(idlePIDsJSON),
		RunningGIDs:      string(runningGIDsJSON),
		RunningMPIDs:     string(runningMPIDsJSON),
		GCPhase:          s.GCPhase,
		GCAssistCount:    int(s.stats.GCAssistCount),
	}

	if err := s.DB.Create(snapshot).Error; err != nil {
		fmt.Printf("Failed to create snapshot: %v\n", err)
	}
}

// recordEvent 记录事件
func (s *Simulator) recordEvent(eventType model.EventType, gid, pid, mid *int64, reason string, stolenCount *int) {
	event := &model.Event{
		ExperimentID: s.ExperimentID,
		EventType:    eventType,
		Timestamp:    time.Now(),
		VirtualTime:  s.VirtualTime,
		GID:          gid,
		PID:          pid,
		MID:          mid,
		Reason:       reason,
		StolenCount:  stolenCount,
	}

	// 非阻塞发送到通道
	select {
	case s.eventChan <- event:
	default:
		// 通道满了，直接写入数据库
		if err := s.DB.Create(event).Error; err != nil {
			fmt.Printf("Failed to record event: %v\n", err)
		}
	}
}

// Stop 停止仿真
func (s *Simulator) Stop() {
	s.running = false
}

// Pause 暂停仿真
func (s *Simulator) Pause() {
	s.paused = true
}

// Resume 恢复仿真
func (s *Simulator) Resume() {
	s.paused = false
}
