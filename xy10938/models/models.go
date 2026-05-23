package models

import "time"

type Member struct {
	ID        int       `json:"id" db:"id"`
	MemberNo  string    `json:"member_no" db:"member_no"`
	Name      string    `json:"name" db:"name"`
	Phone     string    `json:"phone" db:"phone"`
	Level     string    `json:"level" db:"level"`
	Balance   float64   `json:"balance" db:"balance"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type Station struct {
	ID             int       `json:"id" db:"id"`
	StationNo      string    `json:"station_no" db:"station_no"`
	Name           string    `json:"name" db:"name"`
	Status         string    `json:"status" db:"status"`
	CurrentQueueID *int      `json:"current_queue_id" db:"current_queue_id"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

type Appointment struct {
	ID              int        `json:"id" db:"id"`
	AppointmentNo   string     `json:"appointment_no" db:"appointment_no"`
	MemberID        int        `json:"member_id" db:"member_id"`
	ServiceType     string     `json:"service_type" db:"service_type"`
	AppointmentDate string     `json:"appointment_date" db:"appointment_date"`
	AppointmentTime string     `json:"appointment_time" db:"appointment_time"`
	Status          string     `json:"status" db:"status"`
	StationID       *int       `json:"station_id" db:"station_id"`
	LockedUntil     *time.Time `json:"locked_until" db:"locked_until"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
	MemberName      *string    `json:"member_name,omitempty" db:"-"`
	MemberPhone     *string    `json:"member_phone,omitempty" db:"-"`
	StationName     *string    `json:"station_name,omitempty" db:"-"`
}

type QueueNumber struct {
	ID            int        `json:"id" db:"id"`
	QueueNo       string     `json:"queue_no" db:"queue_no"`
	MemberID      *int       `json:"member_id" db:"member_id"`
	AppointmentID *int       `json:"appointment_id" db:"appointment_id"`
	ServiceType   string     `json:"service_type" db:"service_type"`
	Status        string     `json:"status" db:"status"`
	StationID     *int       `json:"station_id" db:"station_id"`
	Position      int        `json:"position" db:"position"`
	CalledAt      *time.Time `json:"called_at" db:"called_at"`
	StartedAt     *time.Time `json:"started_at" db:"started_at"`
	CompletedAt   *time.Time `json:"completed_at" db:"completed_at"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
	MemberName    *string    `json:"member_name,omitempty" db:"-"`
	MemberPhone   *string    `json:"member_phone,omitempty" db:"-"`
	StationName   *string    `json:"station_name,omitempty" db:"-"`
}

type OvernumberRecord struct {
	ID              int       `json:"id" db:"id"`
	QueueID         int       `json:"queue_id" db:"queue_id"`
	OriginalQueueNo string    `json:"original_queue_no" db:"original_queue_no"`
	NewQueueID      *int      `json:"new_queue_id" db:"new_queue_id"`
	Reason          string    `json:"reason" db:"reason"`
	RequeueCount    int       `json:"requeue_count" db:"requeue_count"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	QueueNo         *string   `json:"queue_no,omitempty" db:"-"`
	ServiceType     *string   `json:"service_type,omitempty" db:"-"`
	MemberName      *string   `json:"member_name,omitempty" db:"-"`
}

type ExceptionLog struct {
	ID                int       `json:"id" db:"id"`
	APIPath           string    `json:"api_path" db:"api_path"`
	RequestMethod     string    `json:"request_method" db:"request_method"`
	RawInput          string    `json:"raw_input" db:"raw_input"`
	ErrorMessage      string    `json:"error_message" db:"error_message"`
	HandlingConclusion string   `json:"handling_conclusion" db:"handling_conclusion"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}

type QueueReport struct {
	ID             int       `json:"id" db:"id"`
	ReportDate     string    `json:"report_date" db:"report_date"`
	TotalQueue     int       `json:"total_queue" db:"total_queue"`
	CompletedCount int       `json:"completed_count" db:"completed_count"`
	OvernumberCount int      `json:"overnumber_count" db:"overnumber_count"`
	AvgWaitTime    float64   `json:"avg_wait_time" db:"avg_wait_time"`
	AvgServiceTime float64   `json:"avg_service_time" db:"avg_service_time"`
	PeakHour       *string   `json:"peak_hour" db:"peak_hour"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

type APIResponse struct {
	Success    bool        `json:"success"`
	Message    string      `json:"message,omitempty"`
	Data       interface{} `json:"data,omitempty"`
	Conclusion string      `json:"conclusion,omitempty"`
}

type ErrorResponse struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	Conclusion string `json:"conclusion"`
}
