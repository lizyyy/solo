package engine

import (
	"encoding/json"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"

	"strategy-explainer/models"
)

type Engine struct{}

func New() *Engine {
	return &Engine{}
}

func (e *Engine) Decide(strategy *models.Strategy, req *models.DecisionRequest) (*models.DecisionResult, error) {
	pubVer := strategy.PublishedVersion
	var ver *models.StrategyVersion
	for i := range strategy.Versions {
		if strategy.Versions[i].Version == pubVer {
			v := strategy.Versions[i]
			ver = &v
			break
		}
	}
	if ver == nil {
		return nil, fmt.Errorf("strategy %s has no published version", strategy.ID)
	}
	if ver.Status == models.StatusFrozen {
		return nil, fmt.Errorf("strategy %s version %d is frozen", strategy.ID, pubVer)
	}

	ruleResults := make([]models.RuleResult, 0)
	var finalDecision models.Decision
	var matchedRule *models.Rule
	var matchedRuleResult *models.RuleResult

	for _, rule := range ver.Rules {
		rr, err := e.evaluateRule(&rule, req.Context)
		if err != nil {
			return nil, err
		}
		ruleResults = append(ruleResults, rr)
		if rr.Matched {
			matchedRule = &rule
			finalDecision = rr.Decision
			matchedRuleResult = &rr
			break
		}
	}

	if matchedRuleResult == nil {
		return nil, fmt.Errorf("no rule matched in strategy %s version %d", strategy.ID, pubVer)
	}

	simple, detailed := buildExplanations(strategy.Type, matchedRule, matchedRuleResult, ver.Version)

	return &models.DecisionResult{
		StrategyID:          strategy.ID,
		StrategyType:        strategy.Type,
		StrategyVersion:     pubVer,
		Decision:            finalDecision,
		RequestID:           req.RequestID,
		Context:             req.Context,
		RuleResults:         ruleResults,
		SimpleExplanation:   simple,
		DetailedExplanation: detailed,
		DecidedAt:           time.Now(),
	}, nil
}

func (e *Engine) evaluateRule(rule *models.Rule, ctx map[string]interface{}) (models.RuleResult, error) {
	rr := models.RuleResult{
		RuleID:         rule.ID,
		RuleName:       rule.Name,
		Decision:       rule.Decision,
		ConditionCount: len(rule.Conditions),
		ConditionPath:  []string{},
	}
	if len(rule.Conditions) == 0 {
		rr.Matched = true
		rr.MatchedCount = 0
		rr.ConditionPath = append(rr.ConditionPath, "default")
		return rr, nil
	}

	results := make([]models.ConditionResult, 0)
	matchedAll := rule.MatchAll
	anyMatched := false
	matchedCount := 0
	shortCircuited := false

	for _, cond := range rule.Conditions {
		if shortCircuited {
			break
		}
		cr, err := e.evaluateCondition(&cond, ctx)
		if err != nil {
			return rr, err
		}
		results = append(results, cr)
		rr.ConditionPath = append(rr.ConditionPath, cond.ID)

		if cr.Match {
			matchedCount++
			anyMatched = true
		}

		if cond.ShortCircuit {
			if matchedAll && !cr.Match {
				cr.ShortCircuitReason = "match_all=true, condition failed, short-circuit"
				shortCircuited = true
			}
			if !matchedAll && cr.Match {
				cr.ShortCircuitReason = "match_all=false, condition passed, short-circuit"
				shortCircuited = true
			}
		}
	}

	rr.ConditionResults = results
	rr.MatchedCount = matchedCount
	if matchedAll {
		rr.Matched = matchedCount == len(rule.Conditions)
	} else {
		rr.Matched = anyMatched
	}
	return rr, nil
}

func (e *Engine) evaluateCondition(cond *models.Condition, ctx map[string]interface{}) (models.ConditionResult, error) {
	cr := models.ConditionResult{
		ConditionID:   cond.ID,
		Field:         cond.Field,
		InputValue:    nil,
		ExpectedValue: cond.Expected,
		Operator:      cond.Operator,
		Match:         false,
		ShortCircuit:  cond.ShortCircuit,
	}

	val, ok := ctx[cond.Field]
	cr.InputValue = val
	if !ok {
		return cr, fmt.Errorf("missing required field: %s", cond.Field)
	}

	match, err := compare(val, cond.Expected, cond.Operator)
	if err != nil {
		return cr, err
	}
	cr.Match = match
	return cr, nil
}

func compare(actual, expected interface{}, op models.Operator) (bool, error) {
	switch op {
	case models.OpEqual:
		return reflect.DeepEqual(normalize(actual), normalize(expected)), nil
	case models.OpNotEqual:
		return !reflect.DeepEqual(normalize(actual), normalize(expected)), nil
	case models.OpGreaterThan:
		a, b, err := toFloat64s(actual, expected)
		if err != nil {
			return false, err
		}
		return a > b, nil
	case models.OpGreaterOrEqual:
		a, b, err := toFloat64s(actual, expected)
		if err != nil {
			return false, err
		}
		return a >= b, nil
	case models.OpLessThan:
		a, b, err := toFloat64s(actual, expected)
		if err != nil {
			return false, err
		}
		return a < b, nil
	case models.OpLessOrEqual:
		a, b, err := toFloat64s(actual, expected)
		if err != nil {
			return false, err
		}
		return a <= b, nil
	case models.OpContains:
		aStr, ok1 := toString(actual)
		bStr, ok2 := toString(expected)
		if !ok1 || !ok2 {
			return false, fmt.Errorf("contains requires string operands")
		}
		return strings.Contains(aStr, bStr), nil
	case models.OpIn:
		expSlice, ok := toInterfaceSlice(expected)
		if !ok {
			return false, fmt.Errorf("in operator expects array as expected")
		}
		norm := normalize(actual)
		for _, item := range expSlice {
			if reflect.DeepEqual(norm, normalize(item)) {
				return true, nil
			}
		}
		return false, nil
	case models.OpRegex:
		aStr, ok := toString(actual)
		if !ok {
			return false, fmt.Errorf("regex requires string input")
		}
		pattern, ok := toString(expected)
		if !ok {
			return false, fmt.Errorf("regex pattern must be string")
		}
		re, err := regexp.Compile(pattern)
		if err != nil {
			return false, fmt.Errorf("invalid regex: %w", err)
		}
		return re.MatchString(aStr), nil
	default:
		return false, fmt.Errorf("unsupported operator: %s", op)
	}
}

func normalize(v interface{}) interface{} {
	switch val := v.(type) {
	case float64:
		if val == float64(int64(val)) {
			return int64(val)
		}
		return val
	case json.Number:
		if i, err := val.Int64(); err == nil {
			return i
		}
		if f, err := val.Float64(); err == nil {
			return f
		}
		return val
	default:
		return v
	}
}

func toString(v interface{}) (string, bool) {
	switch val := v.(type) {
	case string:
		return val, true
	case fmt.Stringer:
		return val.String(), true
	default:
		return "", false
	}
}

func toFloat64s(a, b interface{}) (float64, float64, error) {
	fa, ok1 := toFloat64(a)
	fb, ok2 := toFloat64(b)
	if !ok1 || !ok2 {
		return 0, 0, fmt.Errorf("numeric comparison requires numeric operands")
	}
	return fa, fb, nil
}

func toFloat64(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case int:
		return float64(val), true
	case int8:
		return float64(val), true
	case int16:
		return float64(val), true
	case int32:
		return float64(val), true
	case int64:
		return float64(val), true
	case uint:
		return float64(val), true
	case uint8:
		return float64(val), true
	case uint16:
		return float64(val), true
	case uint32:
		return float64(val), true
	case uint64:
		return float64(val), true
	case float32:
		return float64(val), true
	case float64:
		return val, true
	case json.Number:
		if f, err := val.Float64(); err == nil {
			return f, true
		}
		return 0, false
	default:
		return 0, false
	}
}

func toInterfaceSlice(v interface{}) ([]interface{}, bool) {
	val := reflect.ValueOf(v)
	if val.Kind() != reflect.Slice {
		return nil, false
	}
	out := make([]interface{}, val.Len())
	for i := 0; i < val.Len(); i++ {
		out[i] = val.Index(i).Interface()
	}
	return out, true
}



func buildExplanations(stype models.StrategyType, rule *models.Rule, rr *models.RuleResult, ver int) (string, string) {
	decision := rr.Decision

	simple := fmt.Sprintf("策略版本v%d | %s | 命中规则: %s", ver, decision, rule.Name)
	if decision == models.DecisionReject {
		simple = fmt.Sprintf("系统规则限制: %s (策略版本v%d)", rule.Name, ver)
	} else if decision == models.DecisionPass {
		simple = fmt.Sprintf("通过: %s (策略版本v%d)", rule.Name, ver)
	}

	detailed := fmt.Sprintf("策略类型: %s | 版本: v%d | 最终决策: %s\n", stype, ver, decision)
	detailed += fmt.Sprintf("命中规则: %s (%s)\n", rule.ID, rule.Name)
	if len(rr.ConditionPath) > 0 {
		detailed += fmt.Sprintf("条件路径: %s\n", strings.Join(rr.ConditionPath, " -> "))
	}
	detailed += fmt.Sprintf("条件明细(%d/%d):\n", rr.MatchedCount, rr.ConditionCount)
	for i, cr := range rr.ConditionResults {
		status := "FAIL"
		if cr.Match {
			status = "PASS"
		}
		line := fmt.Sprintf("  [%d] %s: %v %s %v => %s", i+1, cr.ConditionID, cr.InputValue, cr.Operator, cr.ExpectedValue, status)
		if cr.ShortCircuitReason != "" {
			line += fmt.Sprintf(" | 短路原因: %s", cr.ShortCircuitReason)
		}
		detailed += line + "\n"
	}

	return simple, detailed
}
