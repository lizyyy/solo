package model

import "errors"

var (
	ErrPartnerNotFound      = errors.New("partner not found")
	ErrCertNotFound         = errors.New("certificate not found")
	ErrVerificationNotFound = errors.New("verification request not found")
	ErrRenewalWindowNotFound = errors.New("renewal window not found")
	ErrDuplicateRequest     = errors.New("duplicate request")
	ErrInvalidStatus        = errors.New("invalid status")
	ErrCertAlreadyExists    = errors.New("certificate already exists")
	ErrPartnerAlreadyExists = errors.New("partner already exists")
	ErrInvalidCertStatus    = errors.New("invalid certificate status for this operation")
	ErrNoRollbackCert       = errors.New("no rollback certificate available")
	ErrInvalidGrayPercent   = errors.New("invalid gray percent")
	ErrVerificationFailed   = errors.New("verification failed")
)

type ErrorCode int

const (
	CodeSuccess ErrorCode = 0
	CodeParamError ErrorCode = 40001
	CodeNotFound ErrorCode = 40401
	CodeDuplicate ErrorCode = 40901
	CodeInvalidStatus ErrorCode = 40902
	CodeInternalError ErrorCode = 50001
)

func (e ErrorCode) Int() int {
	return int(e)
}

func GetErrorCode(err error) ErrorCode {
	switch err {
	case ErrPartnerNotFound, ErrCertNotFound, ErrVerificationNotFound, ErrRenewalWindowNotFound:
		return CodeNotFound
	case ErrDuplicateRequest, ErrCertAlreadyExists, ErrPartnerAlreadyExists:
		return CodeDuplicate
	case ErrInvalidStatus, ErrInvalidCertStatus, ErrInvalidGrayPercent:
		return CodeInvalidStatus
	default:
		return CodeInternalError
	}
}
