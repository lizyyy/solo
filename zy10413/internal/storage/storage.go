package storage

import (
	"push-token-lifecycle/internal/model"
	"time"
)

type Storage interface {
	DeviceStorage
	TokenStorage
	BindEventStorage
	UnsubscribeEventStorage
	PushReceiptStorage
	ReportStorage
	Close() error
}

type DeviceStorage interface {
	CreateDevice(device *model.Device) error
	GetDevice(id string) (*model.Device, error)
	GetDeviceByDeviceID(deviceID string) (*model.Device, error)
	UpdateDevice(device *model.Device) error
	ListDevicesByUser(userID string) ([]*model.Device, error)
}

type TokenStorage interface {
	CreateToken(token *model.PushToken) error
	GetToken(id string) (*model.PushToken, error)
	GetTokenByToken(token string) (*model.PushToken, error)
	UpdateToken(token *model.PushToken) error
	ListTokensByUser(userID string) ([]*model.PushToken, error)
	ListTokensByStatus(status model.TokenStatus) ([]*model.PushToken, error)
}

type BindEventStorage interface {
	CreateBindEvent(event *model.BindEvent) error
	GetBindEvent(id string) (*model.BindEvent, error)
	ListBindEventsByToken(tokenID string) ([]*model.BindEvent, error)
	ListBindEventsByUser(userID string) ([]*model.BindEvent, error)
}

type UnsubscribeEventStorage interface {
	CreateUnsubscribeEvent(event *model.UnsubscribeEvent) error
	GetUnsubscribeEvent(id string) (*model.UnsubscribeEvent, error)
	GetLatestUnsubscribeByToken(tokenID string) (*model.UnsubscribeEvent, error)
	ListUnsubscribeEventsByToken(tokenID string) ([]*model.UnsubscribeEvent, error)
}

type PushReceiptStorage interface {
	CreatePushReceipt(receipt *model.PushReceipt) error
	GetPushReceipt(id string) (*model.PushReceipt, error)
	ListReceiptsByToken(tokenID string) ([]*model.PushReceipt, error)
	ListReceiptsByPushID(pushID string) ([]*model.PushReceipt, error)
	GetFailureStatsByToken(tokenID string) (total, success, failed int, lastFailureAt *time.Time, lastFailureReason model.FailureReason, err error)
}

type ReportStorage interface {
	CreateReport(report *model.LifecycleReport) error
	GetReport(tokenID string) (*model.LifecycleReport, error)
	ListReports(startTime, endTime time.Time) ([]*model.LifecycleReport, error)
}
