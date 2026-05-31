package model

import (
	"time"
)

type RecordStatus string

const (
	StatusImported   RecordStatus = "imported"
	StatusPending    RecordStatus = "pending"
	StatusReviewed   RecordStatus = "reviewed"
	StatusCorrected  RecordStatus = "corrected"
	StatusApproved   RecordStatus = "approved"
	StatusRejected   RecordStatus = "rejected"
	StatusExported   RecordStatus = "exported"
)

type RecordSource string

const (
	SourceSensorLog RecordSource = "sensor_log"
	SourceManual    RecordSource = "manual"
	SourceBatch     RecordSource = "batch"
)

type ExperimentRecord struct {
	ID             int64        `json:"id"`
	StudentID      string       `json:"student_id"`
	StudentName    string       `json:"student_name"`
	ExperimentNo   string       `json:"experiment_no"`
	GroupNo        string       `json:"group_no"`
	Source         RecordSource `json:"source"`
	SourceFile     string       `json:"source_file"`
	Status         RecordStatus `json:"status"`
	SamplingRate   float64      `json:"sampling_rate"`
	DataPoints     int          `json:"data_points"`
	ZeroDrift      float64      `json:"zero_drift"`
	HasGap         bool         `json:"has_gap"`
	GapCount       int          `json:"gap_count"`
	PendingReason  string       `json:"pending_reason"`
	FinalGravity   float64      `json:"final_gravity"`
	GravityUnit    string       `json:"gravity_unit"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
	LastModifiedBy string       `json:"last_modified_by"`
	Remark         string       `json:"remark"`
}

type StatusHistory struct {
	ID            int64        `json:"id"`
	RecordID      int64        `json:"record_id"`
	FromStatus    RecordStatus `json:"from_status"`
	ToStatus      RecordStatus `json:"to_status"`
	ModifiedBy    string       `json:"modified_by"`
	Reason        string       `json:"reason"`
	ChangeDetails string       `json:"change_details"`
	CreatedAt     time.Time    `json:"created_at"`
}

type Calibration struct {
	ID           int64     `json:"id"`
	SensorID     string    `json:"sensor_id"`
	CalibratedAt time.Time `json:"calibrated_at"`
	ZeroPoint    float64   `json:"zero_point"`
	Sensitivity  float64   `json:"sensitivity"`
	Temperature  float64   `json:"temperature"`
	Operator     string    `json:"operator"`
	CreatedAt    time.Time `json:"created_at"`
}

type RawSensorData struct {
	ID        int64     `json:"id"`
	RecordID  int64     `json:"record_id"`
	Timestamp float64   `json:"timestamp"`
	AccelX    float64   `json:"accel_x"`
	AccelY    float64   `json:"accel_y"`
	AccelZ    float64   `json:"accel_z"`
	CreatedAt time.Time `json:"created_at"`
}

type ReviewConfig struct {
	MaxZeroDrift      float64 `json:"max_zero_drift"`
	MaxAllowedGapMs   float64 `json:"max_allowed_gap_ms"`
	MinDataPoints     int     `json:"min_data_points"`
	GravityLowerBound float64 `json:"gravity_lower_bound"`
	GravityUpperBound float64 `json:"gravity_upper_bound"`
}

func DefaultReviewConfig() *ReviewConfig {
	return &ReviewConfig{
		MaxZeroDrift:      0.05,
		MaxAllowedGapMs:   50.0,
		MinDataPoints:     100,
		GravityLowerBound: 9.5,
		GravityUpperBound: 10.0,
	}
}
