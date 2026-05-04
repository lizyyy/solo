package models

type ErrorCode struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

var (
	Success = ErrorCode{Code: "0000", Message: "成功"}

	InvalidRequest     = ErrorCode{Code: "1001", Message: "请求参数无效"}
	IdempotentConflict = ErrorCode{Code: "1002", Message: "幂等请求冲突"}
	ResourceNotFound   = ErrorCode{Code: "1003", Message: "资源不存在"}
	ResourceConflict   = ErrorCode{Code: "1004", Message: "资源冲突"}

	ZeroConfDisabled   = ErrorCode{Code: "2001", Message: "0 确认入账已禁用"}
	RbfRiskDetected    = ErrorCode{Code: "2002", Message: "检测到 RBF 风险"}
	DoubleSpendRisk    = ErrorCode{Code: "2003", Message: "检测到双花风险"}
	InsufficientConfirmations = ErrorCode{Code: "2004", Message: "确认数不足"}
	ChainReorgRollback = ErrorCode{Code: "2005", Message: "链重组回滚"}
	DustOutput         = ErrorCode{Code: "2006", Message: "Dust 输出被过滤"}
	InsufficientFee    = ErrorCode{Code: "2007", Message: "手续费不足"}
	HotWalletLimit     = ErrorCode{Code: "2008", Message: "热钱包限额超限"}
	ColdWalletLimit    = ErrorCode{Code: "2009", Message: "冷钱包限额不足"}
	AddressAlreadyUsed = ErrorCode{Code: "2010", Message: "地址已被使用"}
	TransactionPending = ErrorCode{Code: "2011", Message: "交易处理中"}
	TransactionConfirmed = ErrorCode{Code: "2012", Message: "交易已确认"}
	RequiresAudit      = ErrorCode{Code: "2013", Message: "需要人工审核"}

	DatabaseError       = ErrorCode{Code: "3001", Message: "数据库错误"}
	ConfigurationError  = ErrorCode{Code: "3002", Message: "配置错误"}
	InternalError       = ErrorCode{Code: "3003", Message: "内部错误"}
)
