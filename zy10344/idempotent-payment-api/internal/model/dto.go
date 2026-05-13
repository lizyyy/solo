package model

type CreatePaymentRequest struct {
	IdempotentKey string          `json:"idempotent_key" binding:"required"`
	MerchantID    string          `json:"merchant_id" binding:"required"`
	Amount        int64           `json:"amount" binding:"required,gt=0"`
	Currency      string          `json:"currency" binding:"required"`
	Receiver      ReceiverRequest `json:"receiver" binding:"required"`
	Channel       string          `json:"channel" binding:"required"`
	Remark        string          `json:"remark,omitempty"`
	NotifyURL     string          `json:"notify_url,omitempty"`
	Operator      string          `json:"operator,omitempty"`
	IPAddress     string          `json:"ip_address,omitempty"`
}

type ReceiverRequest struct {
	BankName    string `json:"bank_name" binding:"required"`
	AccountNo   string `json:"account_no" binding:"required"`
	AccountName string `json:"account_name" binding:"required"`
	BankBranch  string `json:"bank_branch,omitempty"`
	Province    string `json:"province,omitempty"`
	City        string `json:"city,omitempty"`
}

type CreatePaymentResponse struct {
	PaymentNo     string        `json:"payment_no"`
	IdempotentKey string        `json:"idempotent_key"`
	Status        PaymentStatus `json:"status"`
	IsDuplicate   bool          `json:"is_duplicate"`
	CreatedAt     string        `json:"created_at"`
}

type QueryPaymentRequest struct {
	PaymentNo     string `json:"payment_no,omitempty"`
	IdempotentKey string `json:"idempotent_key,omitempty"`
}

type QueryPaymentResponse struct {
	PaymentNo        string           `json:"payment_no"`
	IdempotentKey    string           `json:"idempotent_key"`
	MerchantID       string           `json:"merchant_id"`
	Amount           int64            `json:"amount"`
	Currency         string           `json:"currency"`
	ReceiverAccount  *ReceiverAccount `json:"receiver_account"`
	Status           PaymentStatus    `json:"status"`
	Channel          string           `json:"channel"`
	ChannelOrderNo   string           `json:"channel_order_no,omitempty"`
	Remark           string           `json:"remark,omitempty"`
	CreatedAt        string           `json:"created_at"`
	UpdatedAt        string           `json:"updated_at"`
	Timeline         []*TimelineEvent `json:"timeline,omitempty"`
}

type CancelPaymentRequest struct {
	PaymentNo  string `json:"payment_no" binding:"required"`
	Reason     string `json:"reason" binding:"required"`
	Operator   string `json:"operator,omitempty"`
	IPAddress  string `json:"ip_address,omitempty"`
}

type CancelPaymentResponse struct {
	PaymentNo    string        `json:"payment_no"`
	CancelStatus PaymentStatus `json:"cancel_status"`
	CreatedAt    string        `json:"created_at"`
}

type ChannelCallbackRequest struct {
	PaymentNo      string `json:"payment_no" binding:"required"`
	ChannelOrderNo string `json:"channel_order_no" binding:"required"`
	ChannelStatus  string `json:"channel_status" binding:"required"`
	IsSuccess      bool   `json:"is_success"`
	ReceiptContent string `json:"receipt_content,omitempty"`
}

type ChannelCallbackResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type HistoryQueryRequest struct {
	PaymentNo    string `json:"payment_no,omitempty"`
	IdempotentKey string `json:"idempotent_key,omitempty"`
	StartTime    string `json:"start_time,omitempty"`
	EndTime      string `json:"end_time,omitempty"`
	EventType    string `json:"event_type,omitempty"`
}

type HistoryQueryResponse struct {
	Total  int64           `json:"total"`
	Events []*TimelineEvent `json:"events"`
}

type ProblemSummaryRequest struct {
	StartTime string `json:"start_time,omitempty"`
	EndTime   string `json:"end_time,omitempty"`
	Status    string `json:"status,omitempty"`
	Channel   string `json:"channel,omitempty"`
}

type ProblemSummaryResponse struct {
	Total    int               `json:"total"`
	Summaries []*ProblemSummary `json:"summaries"`
	ExportURL string            `json:"export_url,omitempty"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}
