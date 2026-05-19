package model

import (
	"time"
)

type Store struct {
	ID           int64     `json:"id"`
	StoreID      string    `json:"store_id"`
	Name         string    `json:"name"`
	Address      string    `json:"address,omitempty"`
	ManagerName  string    `json:"manager_name,omitempty"`
	ManagerPhone string    `json:"manager_phone,omitempty"`
	Status       int       `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type FoodSample struct {
	ID              int64      `json:"id"`
	SampleNo        string     `json:"sample_no"`
	StoreID         string     `json:"store_id"`
	DishName        string     `json:"dish_name"`
	DishBatch       string     `json:"dish_batch"`
	SampleWeight    float64    `json:"sample_weight,omitempty"`
	SampleTime      time.Time  `json:"sample_time"`
	Keeper          string     `json:"keeper,omitempty"`
	KeeperPhone     string     `json:"keeper_phone,omitempty"`
	StorageLocation  string     `json:"storage_location,omitempty"`
	ExpireTime      time.Time  `json:"expire_time"`
	Status          string     `json:"status"`
	IsDestroyed     int        `json:"is_destroyed"`
	DestroyTime     *time.Time `json:"destroy_time,omitempty"`
	DestroyOperator  string     `json:"destroy_operator,omitempty"`
	DestroyReason    string     `json:"destroy_reason,omitempty"`
	IdempotentKey   string     `json:"-"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type TemperatureRecord struct {
	ID            int64      `json:"id"`
	RecordNo      string     `json:"record_no"`
	StoreID       string     `json:"store_id"`
	FridgeID      string     `json:"fridge_id"`
	FridgeName    string     `json:"fridge_name,omitempty"`
	Temperature   float64    `json:"temperature"`
	CheckTime     time.Time  `json:"check_time"`
	Checker       string     `json:"checker,omitempty"`
	CheckerPhone  string     `json:"checker_phone,omitempty"`
	IsNormal      int        `json:"is_normal"`
	AnomalyReason string     `json:"anomaly_reason,omitempty"`
	IdempotentKey string     `json:"-"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type WasteRecord struct {
	ID            int64     `json:"id"`
	WasteNo       string    `json:"waste_no"`
	StoreID       string    `json:"store_id"`
	DishName      string    `json:"dish_name"`
	DishBatch     string    `json:"dish_batch"`
	WasteType     string    `json:"waste_type,omitempty"`
	WasteWeight   float64   `json:"waste_weight,omitempty"`
	WasteTime     time.Time `json:"waste_time"`
	WasteReason   string    `json:"waste_reason,omitempty"`
	Operator      string    `json:"operator,omitempty"`
	OperatorPhone string    `json:"operator_phone,omitempty"`
	Witness       string    `json:"witness,omitempty"`
	IdempotentKey string    `json:"-"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Inspection struct {
	ID                 int64      `json:"id"`
	InspectionNo       string     `json:"inspection_no"`
	StoreID            string     `json:"store_id"`
	InspectionType     string     `json:"inspection_type"`
	Inspector          string     `json:"inspector,omitempty"`
	InspectorPhone     string     `json:"inspector_phone,omitempty"`
	InspectionTime     time.Time  `json:"inspection_time"`
	InspectionResult   string     `json:"inspection_result"`
	IssuesFound       string     `json:"issues_found,omitempty"`
	CorrectiveActions string     `json:"corrective_actions,omitempty"`
	IdempotentKey     string     `json:"-"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type InspectionItem struct {
	ID          int64     `json:"id"`
	InspectionID int64     `json:"inspection_id"`
	ItemType    string    `json:"item_type"`
	ItemRefID   int64     `json:"item_ref_id,omitempty"`
	ItemRefNo   string    `json:"item_ref_no,omitempty"`
	CheckResult string    `json:"check_result"`
	CheckNotes  string    `json:"check_notes,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type RuleExecutionLog struct {
	ID           int64     `json:"id"`
	RuleName     string    `json:"rule_name"`
	RecordType   string    `json:"record_type"`
	RecordRefNo  string    `json:"record_ref_no"`
	StoreID      string    `json:"store_id,omitempty"`
	ExecutionTime time.Time `json:"execution_time"`
	ActionTaken  string    `json:"action_taken"`
	Reason       string    `json:"reason"`
	Details      string    `json:"details,omitempty"`
	Operator     string    `json:"operator,omitempty"`
}

type Reminder struct {
	ID              int64      `json:"id"`
	ReminderNo      string     `json:"reminder_no"`
	StoreID         string     `json:"store_id"`
	ReminderType    string     `json:"reminder_type"`
	RelatedRefNo    string     `json:"related_ref_no,omitempty"`
	Message         string     `json:"message"`
	RemindTime      time.Time  `json:"remind_time"`
	IsAcknowledged  int        `json:"is_acknowledged"`
	AcknowledgeTime *time.Time `json:"acknowledge_time,omitempty"`
	AcknowledgedBy  string     `json:"acknowledged_by,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

type OperationLog struct {
	ID           int64     `json:"id"`
	OperationID  string    `json:"operation_id"`
	Operator     string    `json:"operator,omitempty"`
	OperationType string    `json:"operation_type"`
	ResourceType  string    `json:"resource_type,omitempty"`
	ResourceRefNo string    `json:"resource_ref_no,omitempty"`
	RequestData   string    `json:"request_data,omitempty"`
	ResponseData  string    `json:"response_data,omitempty"`
	IPAddress    string    `json:"ip_address,omitempty"`
	UserAgent    string    `json:"user_agent,omitempty"`
	Status       string    `json:"status"`
	ErrorMessage string    `json:"error_message,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type ApiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type RuleResult struct {
	Passed      bool   `json:"passed"`
	RuleName    string `json:"rule_name"`
	Action      string `json:"action"`
	Reason      string `json:"reason"`
	Details     string `json:"details,omitempty"`
}
