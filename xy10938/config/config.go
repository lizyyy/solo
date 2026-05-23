package config

import "time"

type Config struct {
	Port        string
	ServiceTypes     []string
	QueueStatuses    []string
	AppointmentStatuses []string
	StationStatuses  []string
	MaxQueueNumber   int
	OvernumberWaitCount int
	DatabasePath     string
}

func GetConfig() *Config {
	return &Config{
		Port:        "3000",
		ServiceTypes:     []string{"标准洗", "精洗", "打蜡", "内饰清洁", "镀膜"},
		QueueStatuses:    []string{"等待中", "服务中", "已完成", "已过号", "已取消"},
		AppointmentStatuses: []string{"待确认", "已确认", "已取消", "已完成"},
		StationStatuses:  []string{"空闲", "忙碌", "维护中"},
		MaxQueueNumber:   999,
		OvernumberWaitCount: 3,
		DatabasePath:     "./data/car-wash.db",
	}
}

func Contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func FormatTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

func FormatDate(t time.Time) string {
	return t.Format("2006-01-02")
}
