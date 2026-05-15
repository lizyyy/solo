package model

type CreateRuleRequest struct {
	PartyID     string   `json:"party_id" binding:"required"`
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	SourceRules []string `json:"source_rules"`
	PathRules   []string `json:"path_rules"`
	MethodRules []string `json:"method_rules"`
	HeaderRules []string `json:"header_rules"`
	IdempotencyKey string `json:"idempotency_key"`
}

type UpdateRuleStatusRequest struct {
	Status  RuleStatus `json:"status" binding:"required"`
	Comment string     `json:"comment"`
}

type VerifyCallbackRequest struct {
	RuleID        string            `json:"rule_id" binding:"required"`
	PartyID       string            `json:"party_id" binding:"required"`
	SourceIP      string            `json:"source_ip" binding:"required"`
	RequestPath   string            `json:"request_path" binding:"required"`
	RequestMethod string            `json:"request_method" binding:"required"`
	Headers       map[string]string `json:"headers"`
	IsDryRun      bool              `json:"is_dry_run"`
	IdempotencyKey string          `json:"idempotency_key"`
}

type CreatePartyRequest struct {
	Name  string `json:"name" binding:"required"`
	AppID string `json:"app_id" binding:"required"`
}

type AddSourceAddressRequest struct {
	PartyID     string `json:"party_id" binding:"required"`
	AddressType string `json:"address_type" binding:"required"`
	Value       string `json:"value" binding:"required"`
}

type QueryHistoryRequest struct {
	PartyID   string `json:"party_id"`
	RuleID    string `json:"rule_id"`
	StartTime int64  `json:"start_time"`
	EndTime   int64  `json:"end_time"`
	Page      int    `json:"page"`
	PageSize  int    `json:"page_size"`
}
