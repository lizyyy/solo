package checker

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/example/api-doc-coverage/cli/pkg/models"
)

type DiffResult struct {
	UndocumentedRoutes []models.Route
	UnmatchedDocs      []models.OpenAPIRoute
	OutdatedDocs       []OutdatedDoc
}

type OutdatedDoc struct {
	CodeRoute  models.Route
	DocRoute   models.OpenAPIRoute
	Differences []string
}

type CheckResult struct {
	Blockers    []models.RouteIssue
	Warnings    []models.OpenAPIIssue
	ExampleIssues []models.ExampleIssue
	Suggestions []models.Suggestion
}

func normalizePath(path string) string {
	normalized := strings.TrimSuffix(path, "/")
	if normalized == "" {
		return "/"
	}
	return normalized
}

func pathToRegex(pattern string) *regexp.Regexp {
	regexPattern := regexp.QuoteMeta(pattern)
	regexPattern = strings.ReplaceAll(regexPattern, `\{`, `\{`)
	regexPattern = strings.ReplaceAll(regexPattern, `\}`, `\}`)
	regexPattern = regexp.MustCompile(`\{[^\}]+\}`).ReplaceAllString(regexPattern, `[^/]+`)
	return regexp.MustCompile("^" + regexPattern + "$")
}

func pathsMatch(codePath, docPath string) bool {
	normalizedCode := normalizePath(codePath)
	normalizedDoc := normalizePath(docPath)
	
	if normalizedCode == normalizedDoc {
		return true
	}
	
	docRegex := pathToRegex(normalizedDoc)
	return docRegex.MatchString(normalizedCode)
}

func DiffRoutes(routes []models.Route, openapiRoutes []models.OpenAPIRoute) DiffResult {
	result := DiffResult{
		UndocumentedRoutes: []models.Route{},
		UnmatchedDocs:      []models.OpenAPIRoute{},
		OutdatedDocs:       []OutdatedDoc{},
	}

	docMap := make(map[string][]models.OpenAPIRoute)
	for _, r := range openapiRoutes {
		key := fmt.Sprintf("%s %s", r.Method, normalizePath(r.Path))
		docMap[key] = append(docMap[key], r)
	}

	matchedDocs := make(map[string]bool)

	for _, route := range routes {
		found := false
		exactKey := fmt.Sprintf("%s %s", route.Method, normalizePath(route.Path))
		
		if docs, ok := docMap[exactKey]; ok {
			found = true
			matchedDocs[exactKey] = true
			for _, doc := range docs {
				checkOutdatedDoc(route, doc, &result)
			}
		} else {
			for key, docs := range docMap {
				parts := strings.SplitN(key, " ", 2)
				if len(parts) != 2 {
					continue
				}
				docMethod := parts[0]
				docPath := parts[1]
				
				if route.Method == docMethod && pathsMatch(route.Path, docPath) {
					found = true
					matchedDocs[key] = true
					for _, doc := range docs {
						checkOutdatedDoc(route, doc, &result)
					}
				}
			}
		}

		if !found {
			result.UndocumentedRoutes = append(result.UndocumentedRoutes, route)
		}
	}

	for key, docs := range docMap {
		if !matchedDocs[key] {
			result.UnmatchedDocs = append(result.UnmatchedDocs, docs...)
		}
	}

	return result
}

func checkOutdatedDoc(codeRoute models.Route, docRoute models.OpenAPIRoute, result *DiffResult) {
	differences := []string{}

	if codeRoute.Description != "" && docRoute.Summary == "" {
		differences = append(differences, "文档缺少摘要")
	}

	if len(differences) > 0 {
		result.OutdatedDocs = append(result.OutdatedDocs, OutdatedDoc{
			CodeRoute:   codeRoute,
			DocRoute:    docRoute,
			Differences: differences,
		})
	}
}

func CheckExamples(examples []models.ExampleRequest, openapiRoutes []models.OpenAPIRoute) []models.ExampleIssue {
	var issues []models.ExampleIssue

	for _, example := range examples {
		matchedDoc := findMatchingDoc(example, openapiRoutes)
		if matchedDoc == nil {
			issues = append(issues, models.ExampleIssue{
				Example:    example,
				Type:       "NO_MATCHING_DOC",
				Message:    "示例没有对应的 OpenAPI 文档",
				Severity:   "warning",
				RootCause:  "DOCUMENTATION_MISSING",
				Suggestion: "请为该路由添加 OpenAPI 文档，或者检查示例路径和方法是否正确",
			})
			continue
		}

		issues = append(issues, checkRequiredParams(example, matchedDoc)...)
		issues = append(issues, checkRequestBody(example, matchedDoc)...)
		issues = append(issues, checkResponseFields(example, matchedDoc)...)
	}

	return issues
}

func findMatchingDoc(example models.ExampleRequest, openapiRoutes []models.OpenAPIRoute) *models.OpenAPIRoute {
	for _, doc := range openapiRoutes {
		if example.Method == doc.Method && pathsMatch(example.Path, doc.Path) {
			return &doc
		}
	}
	return nil
}

func checkRequiredParams(example models.ExampleRequest, doc *models.OpenAPIRoute) []models.ExampleIssue {
	var issues []models.ExampleIssue
	missingParams := []string{}

	for _, param := range doc.RequestParams {
		if !param.Required {
			continue
		}

		var exists bool
		switch param.In {
		case "query":
			_, exists = example.Query[param.Name]
		case "path":
			paramRegex := regexp.MustCompile(`\{` + param.Name + `\}`)
			exists = paramRegex.MatchString(example.Path) ||
				!paramRegex.MatchString(doc.Path)
		case "header":
			_, exists = example.Headers[param.Name]
		}

		if !exists {
			missingParams = append(missingParams, param.Name)
		}
	}

	if len(missingParams) > 0 {
		issues = append(issues, models.ExampleIssue{
			Example:    example,
			Type:       "MISSING_REQUIRED_PARAM",
			Message:    fmt.Sprintf("示例缺少必填参数: %s", strings.Join(missingParams, ", ")),
			Severity:   "blocker",
			RootCause:  "EXAMPLE_OUTDATED",
			Suggestion: fmt.Sprintf("请在示例中添加这些必填参数: %s", strings.Join(missingParams, ", ")),
		})
	}

	return issues
}

func checkRequestBody(example models.ExampleRequest, doc *models.OpenAPIRoute) []models.ExampleIssue {
	var issues []models.ExampleIssue

	if doc.RequestBody == nil || !doc.RequestBody.Required {
		return issues
	}

	if len(example.Body) == 0 {
		issues = append(issues, models.ExampleIssue{
			Example:    example,
			Type:       "MISSING_REQUEST_BODY",
			Message:    "文档声明请求体为必填，但示例中没有请求体",
			Severity:   "blocker",
			RootCause:  "EXAMPLE_OUTDATED",
			Suggestion: "请为示例添加符合文档要求的请求体",
		})
		return issues
	}

	missingFields, extraFields := compareSchema(example.Body, doc.RequestBody.Schema)
	
	if len(missingFields) > 0 {
		issues = append(issues, models.ExampleIssue{
			Example:    example,
			Type:       "MISSING_REQUIRED_FIELDS",
			Message:    fmt.Sprintf("请求体缺少必填字段: %s", strings.Join(missingFields, ", ")),
			Severity:   "blocker",
			RootCause:  "EXAMPLE_OUTDATED",
			Suggestion: fmt.Sprintf("请在请求体中添加这些必填字段: %s", strings.Join(missingFields, ", ")),
		})
	}

	if len(extraFields) > 0 {
		issues = append(issues, models.ExampleIssue{
			Example:    example,
			Type:       "UNKNOWN_FIELDS",
			Message:    fmt.Sprintf("请求体包含文档未定义的字段: %s", strings.Join(extraFields, ", ")),
			Severity:   "warning",
			RootCause:  "DOCUMENTATION_OUTDATED",
			Suggestion: fmt.Sprintf("请检查这些字段是否应该在文档中定义: %s", strings.Join(extraFields, ", ")),
		})
	}

	return issues
}

func checkResponseFields(example models.ExampleRequest, doc *models.OpenAPIRoute) []models.ExampleIssue {
	var issues []models.ExampleIssue

	if len(example.Response) == 0 {
		return issues
	}

	successResp, ok := doc.Responses[200]
	if !ok {
		successResp, ok = doc.Responses[201]
	}

	if !ok {
		return issues
	}

	missingFields, extraFields := compareSchema(example.Response, successResp.Schema)

	if len(missingFields) > 0 {
		issues = append(issues, models.ExampleIssue{
			Example:    example,
			Type:       "RESPONSE_MISSING_FIELDS",
			Message:    fmt.Sprintf("响应缺少文档中声明的字段: %s", strings.Join(missingFields, ", ")),
			Severity:   "warning",
			RootCause:  "DOCUMENTATION_OUTDATED",
			Suggestion: fmt.Sprintf("请更新文档，移除这些过时的字段声明: %s", strings.Join(missingFields, ", ")),
		})
	}

	if len(extraFields) > 0 {
		issues = append(issues, models.ExampleIssue{
			Example:    example,
			Type:       "RESPONSE_EXTRA_FIELDS",
			Message:    fmt.Sprintf("响应包含文档未声明的字段: %s", strings.Join(extraFields, ", ")),
			Severity:   "warning",
			RootCause:  "DOCUMENTATION_OUTDATED",
			Suggestion: fmt.Sprintf("请更新文档，添加这些新字段的定义: %s", strings.Join(extraFields, ", ")),
		})
	}

	return issues
}

func compareSchema(data map[string]interface{}, schema models.Schema) ([]string, []string) {
	var missingFields []string
	var extraFields []string

	if len(schema.Required) == 0 && len(schema.Properties) == 0 {
		return missingFields, extraFields
	}

	for _, requiredField := range schema.Required {
		if _, exists := data[requiredField]; !exists {
			missingFields = append(missingFields, requiredField)
		}
	}

	for field := range data {
		if _, exists := schema.Properties[field]; !exists {
			extraFields = append(extraFields, field)
		}
	}

	sort.Strings(missingFields)
	sort.Strings(extraFields)

	return missingFields, extraFields
}

func RunFullCheck(routes []models.Route, openapiRoutes []models.OpenAPIRoute, examples []models.ExampleRequest) CheckResult {
	result := CheckResult{
		Blockers:      []models.RouteIssue{},
		Warnings:      []models.OpenAPIIssue{},
		ExampleIssues: []models.ExampleIssue{},
		Suggestions:   []models.Suggestion{},
	}

	diffResult := DiffRoutes(routes, openapiRoutes)

	for _, route := range diffResult.UndocumentedRoutes {
		result.Blockers = append(result.Blockers, models.RouteIssue{
			Route:      route,
			Type:       "UNDOCUMENTED",
			Message:    "该路由没有对应的 OpenAPI 文档",
			Severity:   "blocker",
			Suggestion: fmt.Sprintf("请为 %s %s 添加 OpenAPI 文档，包含请求参数、请求体和响应格式", route.Method, route.Path),
		})
		result.Suggestions = append(result.Suggestions, models.Suggestion{
			Route:   route.Path,
			Method:  route.Method,
			Owner:   route.Owner,
			Service: route.Service,
			Action:  "添加文档",
			Details: fmt.Sprintf("为路由 %s %s 添加完整的 OpenAPI 文档", route.Method, route.Path),
		})
	}

	for _, outdated := range diffResult.OutdatedDocs {
		result.Warnings = append(result.Warnings, models.OpenAPIIssue{
			Route:      outdated.DocRoute,
			Type:       "OUTDATED",
			Message:    fmt.Sprintf("文档可能过期: %s", strings.Join(outdated.Differences, ", ")),
			Severity:   "warning",
			Suggestion: "请核对并更新文档内容",
		})
	}

	for _, doc := range diffResult.UnmatchedDocs {
		result.Warnings = append(result.Warnings, models.OpenAPIIssue{
			Route:      doc,
			Type:       "ORPHAN_DOC",
			Message:    "文档没有对应的实际路由",
			Severity:   "warning",
			Suggestion: fmt.Sprintf("请检查文档 %s %s 是否对应已删除或重命名的路由", doc.Method, doc.Path),
		})
	}

	exampleIssues := CheckExamples(examples, openapiRoutes)
	result.ExampleIssues = append(result.ExampleIssues, exampleIssues...)

	for _, issue := range exampleIssues {
		if issue.Severity == "blocker" {
			result.Blockers = append(result.Blockers, models.RouteIssue{
				Route: models.Route{
					Method: issue.Example.Method,
					Path:   issue.Example.Path,
				},
				Type:       "EXAMPLE_ISSUE",
				Message:    issue.Message,
				Severity:   issue.Severity,
				Suggestion: issue.Suggestion,
			})
		}
	}

	return result
}

func PrettyPrint(v interface{}) string {
	data, _ := json.MarshalIndent(v, "", "  ")
	return string(data)
}
