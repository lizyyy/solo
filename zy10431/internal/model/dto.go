package model

type RegisterConsumerRequest struct {
	QueueName     string `json:"queue_name" binding:"required"`
	ConsumerGroup string `json:"consumer_group" binding:"required"`
	ProcessScope  string `json:"process_scope" binding:"required"`
	Owner         string `json:"owner" binding:"required"`
	OwnerEmail    string `json:"owner_email"`
}

type TransferOwnerRequest struct {
	ConsumerID     uint   `json:"consumer_id" binding:"required"`
	ToOwner        string `json:"to_owner" binding:"required"`
	ToEmail        string `json:"to_email"`
	TransferReason string `json:"transfer_reason"`
}

type UpdateStatusRequest struct {
	ConsumerID uint   `json:"consumer_id" binding:"required"`
	Status     Status `json:"status" binding:"required"`
}

type ManualFixRequest struct {
	ConsumerID    uint   `json:"consumer_id" binding:"required"`
	QueueName     string `json:"queue_name"`
	ConsumerGroup string `json:"consumer_group"`
	ProcessScope  string `json:"process_scope"`
	Owner         string `json:"owner"`
	OwnerEmail    string `json:"owner_email"`
	Status        Status `json:"status"`
	FixReason     string `json:"fix_reason" binding:"required"`
}

type QueryConsumerRequest struct {
	QueueName     string `form:"queue_name"`
	ConsumerGroup string `form:"consumer_group"`
	Owner         string `form:"owner"`
	Status        Status `form:"status"`
	Page          int    `form:"page,default=1"`
	PageSize      int    `form:"page_size,default=20"`
}

type GenerateReportRequest struct {
	QueueName string `json:"queue_name"`
}

type ErrorRecordResolveRequest struct {
	ErrorRecordID uint   `json:"error_record_id" binding:"required"`
	Conclusion    string `json:"conclusion" binding:"required"`
	Handled       bool   `json:"handled"`
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
