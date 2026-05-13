package models

import "time"

type Route struct {
	Method      string
	Path        string
	Service     string
	Owner       string
	Handler     string
	Description string
}

type OpenAPIRoute struct {
	Method         string
	Path           string
	Summary        string
	Description    string
	RequestParams  []Param
	RequestBody    *RequestBody
	Responses      map[int]Response
}

type Param struct {
	Name     string
	In       string
	Required bool
	Type     string
}

type RequestBody struct {
	Required bool
	Schema   Schema
}

type Response struct {
	Description string
	Schema      Schema
}

type Schema struct {
	Type       string
	Properties map[string]Schema
	Required   []string
	Ref        string
}

type ExampleRequest struct {
	Name     string
	Method   string
	Path     string
	Query    map[string]interface{}
	Headers  map[string]string
	Body     map[string]interface{}
	Response map[string]interface{}
}

type RouteIssue struct {
	Route    Route
	Type     string
	Message  string
	Severity string
	Suggestion string
}

type OpenAPIIssue struct {
	Route      OpenAPIRoute
	Type       string
	Message    string
	Severity   string
	Suggestion string
}

type ExampleIssue struct {
	Example    ExampleRequest
	Type       string
	Message    string
	Severity   string
	RootCause  string
	Suggestion string
}

type IgnoreItem struct {
	ID          string
	Pattern     string
	Type        string
	Reason      string
	ExpiresAt   time.Time
	CreatedAt   time.Time
	Service     string
	Owner       string
}

type CoverageReport struct {
	Timestamp   time.Time
	TotalRoutes int
	Documented  int
	Undocumented int
	Outdated    int
	
	Blockers    []RouteIssue
	Warnings    []OpenAPIIssue
	
	ByService   map[string]ServiceCoverage
	ByOwner     map[string]OwnerCoverage
	
	Suggestions []Suggestion
}

type ServiceCoverage struct {
	Service       string
	TotalRoutes   int
	Documented    int
	Undocumented  int
	Issues        int
	Blockers      int
	Warnings      int
}

type OwnerCoverage struct {
	Owner         string
	TotalRoutes   int
	Documented    int
	Undocumented  int
	Issues        int
	Blockers      int
	Warnings      int
}

type Suggestion struct {
	Route       string
	Method      string
	Owner       string
	Service     string
	Action      string
	Details     string
}
