package model

import "errors"

var (
	ErrApplicationNotFound   = errors.New("application not found")
	ErrInvalidStateTransition = errors.New("invalid state transition")
	ErrDuplicateSubmission   = errors.New("duplicate submission")
	ErrInvalidData           = errors.New("invalid data")
	ErrVersionConflict       = errors.New("version conflict")
	ErrDependencyNotRegistered = errors.New("dependency not registered")
	ErrPermissionInvalid     = errors.New("permission invalid")
	ErrQuotaExceeded         = errors.New("quota exceeded")
	ErrAlertUnresolved       = errors.New("alert unresolved")
	ErrCheckIncomplete       = errors.New("check incomplete")
)

func CanTransition(from, to Status) bool {
	transitions := map[Status][]Status{
		StatusDraft:     {StatusPending, StatusCancelled},
		StatusPending:   {StatusChecking, StatusCancelled},
		StatusChecking:  {StatusApproved, StatusRejected},
		StatusApproved:  {},
		StatusRejected:  {StatusDraft},
		StatusCancelled: {StatusDraft},
	}
	
	allowed, ok := transitions[from]
	if !ok {
		return false
	}
	
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}
