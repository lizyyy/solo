package models

import (
	"time"
)

type BatchStatus string

const (
	BatchStatusPending    BatchStatus = "pending"
	BatchStatusProcessing BatchStatus = "processing"
	BatchStatusApproved   BatchStatus = "approved"
	BatchStatusRejected   BatchStatus = "rejected"
	BatchStatusReturned   BatchStatus = "returned"
)

type Batch struct {
	ID          uint        `gorm:"primaryKey" json:"id"`
	BatchNo     string      `gorm:"size:100;uniqueIndex;not null" json:"batch_no"`
	ProductName string      `gorm:"size:200;not null" json:"product_name"`
	Status      BatchStatus `gorm:"size:50;not null" json:"status"`
	CreatedBy   string      `gorm:"size:100;not null" json:"created_by"`
	Handler     *string     `gorm:"size:100" json:"handler"`
	Remark      *string     `gorm:"type:text" json:"remark"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`

	Samples       []Sample        `gorm:"foreignKey:BatchID" json:"samples,omitempty"`
	TestProtocols []TestProtocol  `gorm:"foreignKey:BatchID" json:"test_protocols,omitempty"`
	TrackingLogs  []TrackingLog   `gorm:"foreignKey:BatchID" json:"tracking_logs,omitempty"`
}

type Sample struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	BatchID       uint      `gorm:"not null;index" json:"batch_id"`
	SampleID      string    `gorm:"size:100;not null" json:"sample_id"`
	SampleName    string    `gorm:"size:200;not null" json:"sample_name"`
	SamplingPoint string    `gorm:"size:200;not null" json:"sampling_point"`
	SamplingTime  time.Time `json:"sampling_time"`
	Sampler       string    `gorm:"size:100;not null" json:"sampler"`
	Description   *string   `gorm:"type:text" json:"description"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	ChamberRecords []ChamberRecord `gorm:"foreignKey:SampleID" json:"chamber_records,omitempty"`
	SampleNodes    []SampleNode    `gorm:"foreignKey:SampleID" json:"sample_nodes,omitempty"`
}

type TestProtocol struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	BatchID      uint      `gorm:"not null;index" json:"batch_id"`
	ProtocolID   string    `gorm:"size:100;not null" json:"protocol_id"`
	ProtocolName string    `gorm:"size:200;not null" json:"protocol_name"`
	Version      string    `gorm:"size:50;not null" json:"version"`
	Content      string    `gorm:"type:json;not null" json:"content"`
	CreatedBy    string    `gorm:"size:100;not null" json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type ChamberRecord struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SampleID    uint      `gorm:"not null;index" json:"sample_id"`
	ChamberID   string    `gorm:"size:100;not null;index" json:"chamber_id"`
	ChamberName string    `gorm:"size:200;not null" json:"chamber_name"`
	Timestamp   time.Time `gorm:"not null;index" json:"timestamp"`
	Temperature float64   `gorm:"not null" json:"temperature"`
	Humidity    float64   `json:"humidity"`
	Pressure    *float64  `json:"pressure"`
	CreatedAt   time.Time `json:"created_at"`
}

type SampleNode struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	SampleID      uint      `gorm:"not null;index" json:"sample_id"`
	NodeID        string    `gorm:"size:100;uniqueIndex;not null" json:"node_id"`
	ParentNodeID  *string   `gorm:"size:100;index" json:"parent_node_id"`
	NodeName      string    `gorm:"size:200;not null" json:"node_name"`
	NodeType      string    `gorm:"size:50;not null" json:"node_type"`
	SamplingWindow *time.Time `gorm:"index" json:"sampling_window"`
	ActualTime    *time.Time `json:"actual_time"`
	Status        string    `gorm:"size:50;not null" json:"status"`
	Operator      string    `gorm:"size:100;not null" json:"operator"`
	Remark        *string   `gorm:"type:text" json:"remark"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	Children []SampleNode `gorm:"foreignKey:ParentNodeID;references:NodeID" json:"children,omitempty"`
}

type TrackingLog struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	BatchID     uint      `gorm:"not null;index" json:"batch_id"`
	Action      string    `gorm:"size:100;not null" json:"action"`
	FromStatus  *string   `gorm:"size:50" json:"from_status"`
	ToStatus    string    `gorm:"size:50;not null" json:"to_status"`
	Operator    string    `gorm:"size:100;not null" json:"operator"`
	Reason      *string   `gorm:"type:text" json:"reason"`
	CreatedAt   time.Time `json:"created_at"`
}

type ExceptionType string

const (
	ExceptionSamplingWindow ExceptionType = "sampling_window"
	ExceptionOverTemp       ExceptionType = "over_temperature"
	ExceptionDelayApproval  ExceptionType = "delay_approval"
)

type ExceptionEvent struct {
	ID           uint          `gorm:"primaryKey" json:"id"`
	ExceptionID  string        `gorm:"size:100;uniqueIndex;not null" json:"exception_id"`
	BatchID      *uint         `gorm:"index" json:"batch_id"`
	SampleID     *uint         `gorm:"index" json:"sample_id"`
	ChamberID    *string       `gorm:"size:100;index" json:"chamber_id"`
	SampleNodeID *string       `gorm:"size:100;index" json:"sample_node_id"`
	EventType    ExceptionType `gorm:"size:50;not null;index" json:"event_type"`
	Severity     string        `gorm:"size:50;not null" json:"severity"`
	Description  string        `gorm:"type:text;not null" json:"description"`
	Reason       string        `gorm:"type:text;not null" json:"reason"`
	Handler      string        `gorm:"size:100;not null" json:"handler"`
	HandledAt    time.Time     `json:"handled_at"`
	Resolution   *string       `gorm:"type:text" json:"resolution"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}
