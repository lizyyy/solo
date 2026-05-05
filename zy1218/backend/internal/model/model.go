package model

import (
	"time"

	"gorm.io/gorm"
)

// Experiment 实验配置和元数据
type Experiment struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"index;not null" json:"name"`
	Description  string         `json:"description"`
	
	// GMP 配置参数
	GOMAXPROCS   int            `gorm:"not null;default:1" json:"gomaxprocs"`
	NumP         int            `gorm:"not null;default:1" json:"num_p"`
	NumM         int            `gorm:"not null;default:1" json:"num_m"`
	NumG         int            `gorm:"not null;default:10" json:"num_g"`
	
	// 事件配置
	EnableSyscall       bool `gorm:"default:false" json:"enable_syscall"`
	EnableNetpoll       bool `gorm:"default:false" json:"enable_netpoll"`
	EnableGCAssist      bool `gorm:"default:false" json:"enable_gc_assist"`
	EnablePreemption    bool `gorm:"default:true" json:"enable_preemption"`
	
	// 实验状态
	Status       string         `gorm:"not null;default:'created'" json:"status"` // created, running, paused, completed, failed
	StartTime    *time.Time     `json:"start_time"`
	EndTime      *time.Time     `json:"end_time"`
	
	// 元数据
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	
	// 关联
	Events       []Event        `gorm:"foreignKey:ExperimentID" json:"-"`
	Snapshots    []QueueSnapshot `gorm:"foreignKey:ExperimentID" json:"-"`
	Reports      []Report       `gorm:"foreignKey:ExperimentID" json:"-"`
}

// EventType 调度事件类型
type EventType string

const (
	// G 相关事件
	EventGCreate       EventType = "G_CREATE"
	EventGStart        EventType = "G_START"
	EventGEnd          EventType = "G_END"
	EventGBlock        EventType = "G_BLOCK"
	EventGUnblock      EventType = "G_UNBLOCK"
	EventGPreempt      EventType = "G_PREEMPT"
	
	// P 相关事件
	EventPAcquire      EventType = "P_ACQUIRE"
	EventPRelease      EventType = "P_RELEASE"
	EventPSteal        EventType = "P_STEAL"
	EventPGCAssist     EventType = "P_GC_ASSIST"
	
	// M 相关事件
	EventMAcquireP     EventType = "M_ACQUIRE_P"
	EventMReleaseP     EventType = "M_RELEASE_P"
	EventMPark         EventType = "M_PARK"
	EventMUnpark       EventType = "M_UNPARK"
	
	// 系统调用
	EventSyscallEnter  EventType = "SYSCALL_ENTER"
	EventSyscallExit   EventType = "SYSCALL_EXIT"
	
	// 网络轮询
	EventNetpollWait   EventType = "NETPOLL_WAIT"
	EventNetpollWakeup EventType = "NETPOLL_WAKEUP"
	
	// GC
	EventGCStart       EventType = "GC_START"
	EventGCEnd         EventType = "GC_END"
	EventGCMarkStart   EventType = "GC_MARK_START"
	EventGCMarkEnd     EventType = "GC_MARK_END"
	EventGCSweepStart  EventType = "GC_SWEEP_START"
	EventGCSweepEnd    EventType = "GC_SWEEP_END"
	
	// 抢占
	EventPreemptStart  EventType = "PREEMPT_START"
	EventPreemptEnd    EventType = "PREEMPT_END"
	EventSysmonPreempt EventType = "SYSMON_PREEMPT"
	
	// Work Stealing
	EventWorkStealStart EventType = "WORK_STEAL_START"
	EventWorkStealEnd   EventType = "WORK_STEAL_END"
)

// Event 调度事件
type Event struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	ExperimentID uint          `gorm:"not null;index" json:"experiment_id"`
	
	// 事件基本信息
	EventType    EventType      `gorm:"not null;index" json:"event_type"`
	Timestamp    time.Time      `gorm:"not null;index" json:"timestamp"`
	VirtualTime  int64          `gorm:"not null" json:"virtual_time"` // 仿真虚拟时间
	
	// 涉及的实体
	GID          *int64         `gorm:"index" json:"gid,omitempty"`
	PID          *int64         `gorm:"index" json:"pid,omitempty"`
	MID          *int64         `gorm:"index" json:"mid,omitempty"`
	
	// 事件详情
	Reason       string         `json:"reason"`       // 事件原因（如抢占原因）
	Details      string         `gorm:"type:text" json:"details"` // 详细信息（JSON 格式）
	Duration     *int64         `json:"duration,omitempty"` // 事件持续时间（纳秒）
	
	// 队列信息（用于 work stealing 等）
	SourceQueue  *string        `json:"source_queue,omitempty"` // 源队列类型（local/global）
	TargetQueue  *string        `json:"target_queue,omitempty"` // 目标队列类型
	QueueSize    *int           `json:"queue_size,omitempty"`   // 队列大小
	StolenCount  *int           `json:"stolen_count,omitempty"` // 窃取数量
	
	// 元数据
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	
	// 关联
	Experiment   Experiment     `gorm:"foreignKey:ExperimentID" json:"-"`
}

// QueueSnapshot 队列快照
type QueueSnapshot struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	ExperimentID uint          `gorm:"not null;index" json:"experiment_id"`
	
	// 快照时间
	Timestamp    time.Time      `gorm:"not null;index" json:"timestamp"`
	VirtualTime  int64          `gorm:"not null" json:"virtual_time"`
	
	// 全局运行队列
	GlobalQueueSize    int      `gorm:"not null;default:0" json:"global_queue_size"`
	GlobalQueueGIDs    string   `gorm:"type:text" json:"global_queue_gids"` // JSON 数组格式
	
	// 本地运行队列（每个 P 的本地队列）
	LocalQueues        string   `gorm:"type:text" json:"local_queues"` // JSON 对象：{ "pid1": { "size": N, "gids": [...] }, ... }
	
	// 网络轮询器队列
	NetpollQueueSize   int      `gorm:"default:0" json:"netpoll_queue_size"`
	NetpollQueueGIDs   string   `gorm:"type:text" json:"netpoll_queue_gids"`
	
	// 空闲 P
	IdlePIDs           string   `gorm:"type:text" json:"idle_pids"` // JSON 数组
	
	// 运行中状态
	RunningGIDs        string   `gorm:"type:text" json:"running_gids"` // JSON 数组：正在运行的 G
	RunningMPIDs       string   `gorm:"type:text" json:"running_mpids"` // JSON 数组：M-P 绑定状态
	
	// GC 状态
	GCPhase            string   `json:"gc_phase"`
	GCAssistCount      int      `gorm:"default:0" json:"gc_assist_count"`
	
	// 元数据
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	
	// 关联
	Experiment   Experiment     `gorm:"foreignKey:ExperimentID" json:"-"`
}

// TraceImport 导入的 trace 记录
type TraceImport struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	ExperimentID *uint          `gorm:"index" json:"experiment_id,omitempty"`
	
	// 导入信息
	FileName     string         `gorm:"not null" json:"file_name"`
	FileSize     int64          `gorm:"not null" json:"file_size"`
	RecordCount  int            `gorm:"not null" json:"record_count"`
	
	// 导入状态
	Status       string         `gorm:"not null;default:'pending'" json:"status"` // pending, processing, completed, failed
	ErrorMessage string        `json:"error_message,omitempty"`
	
	// 元数据
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	
	// 关联
	Experiment   *Experiment    `gorm:"foreignKey:ExperimentID" json:"-"`
}

// ReportType 报告类型
type ReportType string

const (
	ReportTypeMarkdown ReportType = "markdown"
	ReportTypeJSON     ReportType = "json"
)

// Report 导出的复盘报告
type Report struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	ExperimentID uint          `gorm:"not null;index" json:"experiment_id"`
	
	// 报告信息
	ReportType   ReportType     `gorm:"not null" json:"report_type"`
	Title        string         `gorm:"not null" json:"title"`
	Description  string         `json:"description"`
	
	// 报告内容
	Content      string         `gorm:"type:text;not null" json:"content"`
	
	// 统计数据（JSON 格式）
	Statistics   string         `gorm:"type:text" json:"statistics"`
	
	// 元数据
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	
	// 关联
	Experiment   Experiment     `gorm:"foreignKey:ExperimentID" json:"-"`
}

// SimulationConfig 仿真配置（用于 API 请求）
type SimulationConfig struct {
	Name            string `json:"name" binding:"required"`
	Description     string `json:"description"`
	
	GOMAXPROCS      int    `json:"gomaxprocs" binding:"min=1"`
	NumP            int    `json:"num_p" binding:"min=1"`
	NumM            int    `json:"num_m" binding:"min=1"`
	NumG            int    `json:"num_g" binding:"min=1"`
	
	EnableSyscall    bool `json:"enable_syscall"`
	EnableNetpoll    bool `json:"enable_netpoll"`
	EnableGCAssist   bool `json:"enable_gc_assist"`
	EnablePreemption bool `json:"enable_preemption"`
}

// TimelineResponse 时间线响应
type TimelineResponse struct {
	ExperimentID uint          `json:"experiment_id"`
	Events       []Event       `json:"events"`
	Snapshots    []QueueSnapshot `json:"snapshots"`
	StartTime    time.Time     `json:"start_time"`
	EndTime      *time.Time    `json:"end_time"`
}

// StatisticsResponse 统计数据
type StatisticsResponse struct {
	ExperimentID      uint        `json:"experiment_id"`
	TotalEvents       int64       `json:"total_events"`
	TotalSnapshots    int64       `json:"total_snapshots"`
	
	// G 统计
	GCreated          int64       `json:"g_created"`
	GCompleted        int64       `json:"g_completed"`
	GBlocked          int64       `json:"g_blocked"`
	GPreempted        int64       `json:"g_preempted"`
	
	// Work Stealing 统计
	WorkStealAttempts int64       `json:"work_steal_attempts"`
	WorkStealSuccess  int64       `json:"work_steal_success"`
	TotalStolen       int64       `json:"total_stolen"`
	
	// 系统调用统计
	SyscallCount      int64       `json:"syscall_count"`
	
	// GC 统计
	GCRuns            int64       `json:"gc_runs"`
	GCAssistCount     int64       `json:"gc_assist_count"`
	
	// 抢占统计
	PreemptionCount   int64       `json:"preemption_count"`
	SysmonPreemptions int64       `json:"sysmon_preemptions"`
}
