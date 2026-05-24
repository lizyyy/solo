package models

import "time"

type CreateArbitrationRequest struct {
	OrderID     string    `json:"order_id" binding:"required"`
	VehicleID   string    `json:"vehicle_id" binding:"required"`
	UserID      string    `json:"user_id" binding:"required"`
	PickupTime  time.Time `json:"pickup_time"`
	ReturnTime  time.Time `json:"return_time"`
	PickupPhotos []PhotoInfo `json:"pickup_photos"`
	ReturnPhotos []PhotoInfo `json:"return_photos"`
	Damages     []DamageInfo `json:"damages"`
	OperatorID   string `json:"operator_id"`
	OperatorName string `json:"operator_name"`
}

type PhotoInfo struct {
	PhotoURL  string    `json:"photo_url" binding:"required"`
	PhotoTime  time.Time `json:"photo_time" binding:"required"`
	Remark     string    `json:"remark"`
}

type DamageInfo struct {
	DamageType   DamageType `json:"damage_type" binding:"required"`
	Location   string     `json:"location" binding:"required"`
	Severity   string     `json:"severity"`
	Description string    `json:"description"`
	DeductAmount float64  `json:"deduct_amount"`
	PhotoURLs  []string   `json:"photo_urls"`
}

type SubmitAppealRequest struct {
	ArbitrationID int64    `json:"arbitration_id" binding:"required"`
	UserID         string   `json:"user_id" binding:"required"`
	Content        string   `json:"content" binding:"required"`
	EvidenceURLs   []string `json:"evidence_urls"`
}

type HandleAppealRequest struct {
	ArbitrationID int64  `json:"arbitration_id" binding:"required"`
	HandlerID     string `json:"handler_id" binding:"required"`
	HandlerName   string `json:"handler_name" binding:"required"`
	HandlerRemark string `json:"handler_remark"`
	Approve       bool   `json:"approve"`
	RefundAmount  float64 `json:"refund_amount"`
}

type BlockRequest struct {
	ArbitrationID int64  `json:"arbitration_id" binding:"required"`
	OperatorID    string `json:"operator_id" binding:"required"`
	OperatorName  string `json:"operator_name" binding:"required"`
	Reason        string `json:"reason" binding:"required"`
}

type ReleaseRequest struct {
	ArbitrationID int64  `json:"arbitration_id" binding:"required"`
	OperatorID    string `json:"operator_id" binding:"required"`
	OperatorName  string `json:"operator_name" binding:"required"`
	Reason        string `json:"reason"`
}

type SupplementRequest struct {
	ArbitrationID int64         `json:"arbitration_id" binding:"required"`
	OperatorID    string        `json:"operator_id" binding:"required"`
	OperatorName  string        `json:"operator_name" binding:"required"`
	Damages       []DamageInfo  `json:"damages"`
	Photos         []PhotoEntry  `json:"photos"`
	Remark         string        `json:"remark"`
}

type PhotoEntry struct {
	PhotoType string    `json:"photo_type" binding:"required"`
	PhotoURL  string    `json:"photo_url" binding:"required"`
	PhotoTime  time.Time `json:"photo_time" binding:"required"`
	Remark     string    `json:"remark"`
}

type CloseRequest struct {
	ArbitrationID int64   `json:"arbitration_id" binding:"required"`
	HandlerID     string  `json:"handler_id" binding:"required"`
	HandlerName   string  `json:"handler_name" binding:"required"`
	FinalResult   string  `json:"final_result" binding:"required"`
	FinalRemark   string  `json:"final_remark"`
	RefundAmount  float64 `json:"refund_amount"`
}

type QueryRequest struct {
	OrderID    string `form:"order_id"`
	VehicleID  string `form:"vehicle_id"`
	UserID     string `form:"user_id"`
	Status     string `form:"status"`
	StartDate  string `form:"start_date"`
	EndDate    string `form:"end_date"`
	Page       int    `form:"page"`
	PageSize   int    `form:"page_size"`
}

type ArbitrationDetailResponse struct {
	Arbitration *Arbitration   `json:"arbitration"`
	Damages     []DamageDetail `json:"damages"`
	Photos      []Photo        `json:"photos"`
	Appeal      *Appeal       `json:"appeal,omitempty"`
	Logs        []ProcessingLog `json:"logs"`
	Conclusion  *Conclusion    `json:"conclusion,omitempty"`
}

type ListResponse struct {
	Total int64         `json:"total"`
	List  []Arbitration   `json:"list"`
	Page  int           `json:"page"`
	PageSize int         `json:"page_size"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}
