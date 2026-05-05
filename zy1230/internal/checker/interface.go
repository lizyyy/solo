package checker

import "go-policy-scanner/pkg/model"

type Checker interface {
	Check() ([]model.Violation, error)
}

type BaseChecker struct {
	violations []model.Violation
}

func (bc *BaseChecker) AddViolation(severity, message, file, detail string, line int) {
	bc.violations = append(bc.violations, model.Violation{
		Severity: severity,
		Message:  message,
		File:     file,
		Line:     line,
		Detail:   detail,
	})
}

func (bc *BaseChecker) GetViolations() []model.Violation {
	return bc.violations
}

func (bc *BaseChecker) Reset() {
	bc.violations = []model.Violation{}
}
