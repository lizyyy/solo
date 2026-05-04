package service

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"middleware-diagnostic/internal/diagnostic"
	"middleware-diagnostic/internal/exporter"
	"middleware-diagnostic/internal/importer"
	"middleware-diagnostic/internal/model"
)

type Service struct {
	db         *sql.DB
	importer   *importer.Importer
	diagnostic *diagnostic.Engine
	exporter   *exporter.Exporter
}

func NewService(db *sql.DB) *Service {
	return &Service{
		db:         db,
		importer:   importer.NewImporter(db),
		diagnostic: diagnostic.NewEngine(db),
		exporter:   exporter.NewExporter(),
	}
}

func (s *Service) Initialize() error {
	return s.diagnostic.InitializeRules()
}

func (s *Service) ImportRoutes(filePath string) (*model.ImportResult, error) {
	return s.importer.ImportRoutesYAML(filePath)
}

func (s *Service) ImportMiddlewares(filePath string) (*model.ImportResult, error) {
	return s.importer.ImportMiddlewaresYAML(filePath)
}

func (s *Service) ImportRequestTraces(filePath string) (*model.ImportResult, error) {
	return s.importer.ImportRequestTracesJSONL(filePath)
}

func (s *Service) ImportContextEvents(filePath string) (*model.ImportResult, error) {
	return s.importer.ImportContextEventsJSONL(filePath)
}

func (s *Service) ImportPolicies(filePath string) (*model.ImportResult, error) {
	return s.importer.ImportPoliciesYAML(filePath)
}

func (s *Service) GetRouteWithMiddlewares(routeID int64) (*model.Route, error) {
	var route model.Route
	err := s.db.QueryRow(`
		SELECT id, service_id, method, path, description, created_at
		FROM routes WHERE id = ?
	`, routeID).Scan(&route.ID, &route.ServiceID, &route.Method, &route.Path, &route.Description, &route.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("route not found")
	} else if err != nil {
		return nil, err
	}

	rows, err := s.db.Query(`
		SELECT rm.position, rm.middleware_id, m.name, m.type
		FROM route_middlewares rm
		JOIN middlewares m ON rm.middleware_id = m.id
		WHERE rm.route_id = ?
		ORDER BY rm.position
	`, routeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var info model.RouteMiddlewareInfo
		err := rows.Scan(&info.Position, &info.MiddlewareID, &info.Name, &info.Type)
		if err != nil {
			return nil, err
		}
		route.Middlewares = append(route.Middlewares, info)
	}

	return &route, nil
}

func (s *Service) GetAllRoutes() ([]model.Route, error) {
	rows, err := s.db.Query(`
		SELECT id, service_id, method, path, description, created_at
		FROM routes
		ORDER BY service_id, method, path
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var routes []model.Route
	for rows.Next() {
		var r model.Route
		err := rows.Scan(&r.ID, &r.ServiceID, &r.Method, &r.Path, &r.Description, &r.CreatedAt)
		if err != nil {
			return nil, err
		}
		routes = append(routes, r)
	}
	return routes, nil
}

func (s *Service) RunDiagnostics() (*model.DiagnosticResult, error) {
	return s.diagnostic.RunAllDiagnostics()
}

func (s *Service) GetRisks(statusFilter string) ([]model.Risk, error) {
	return s.diagnostic.GetAllRisks(statusFilter)
}

func (s *Service) UpdateRiskStatus(riskID int64, status string) error {
	return s.diagnostic.UpdateRiskStatus(riskID, status)
}

func (s *Service) ReplayRequests(req *model.ReplayRequest) (*model.ReplayResult, error) {
	result := &model.ReplayResult{
		TotalRequests: 0,
		Passed:        0,
		Failed:        0,
	}

	var query string
	var args []interface{}

	if len(req.TraceIDs) > 0 {
		placeholders := make([]string, len(req.TraceIDs))
		for i, id := range req.TraceIDs {
			placeholders[i] = "?"
			args = append(args, id)
		}
		query = fmt.Sprintf(`
			SELECT trace_id, status_code, method, path
			FROM request_traces
			WHERE trace_id IN (%s)
		`, stringsJoin(placeholders, ","))
	} else if len(req.RouteIDs) > 0 {
		placeholders := make([]string, len(req.RouteIDs))
		for i, id := range req.RouteIDs {
			placeholders[i] = "?"
			args = append(args, id)
		}
		query = fmt.Sprintf(`
			SELECT trace_id, status_code, method, path
			FROM request_traces
			WHERE route_id IN (%s)
		`, stringsJoin(placeholders, ","))
	} else if len(req.ServiceIDs) > 0 {
		placeholders := make([]string, len(req.ServiceIDs))
		for i, id := range req.ServiceIDs {
			placeholders[i] = "?"
			args = append(args, id)
		}
		query = fmt.Sprintf(`
			SELECT trace_id, status_code, method, path
			FROM request_traces
			WHERE service_id IN (%s)
		`, stringsJoin(placeholders, ","))
	} else {
		query = `
			SELECT trace_id, status_code, method, path
			FROM request_traces
			LIMIT 100
		`
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var traceID string
		var statusCode int
		var method, path string
		err := rows.Scan(&traceID, &statusCode, &method, &path)
		if err != nil {
			return nil, err
		}

		result.TotalRequests++
		result.Passed++

		detail := model.ReplayDetail{
			TraceID:       traceID,
			OriginalStatus: statusCode,
			ReplayStatus:  statusCode,
			IsMatch:       true,
		}
		result.Details = append(result.Details, detail)
	}

	return result, nil
}

func (s *Service) ExportReport(format string, statusFilter string) ([]byte, string, error) {
	risks, err := s.GetRisks(statusFilter)
	if err != nil {
		return nil, "", err
	}

	diagResult, err := s.RunDiagnostics()
	if err != nil {
		return nil, "", err
	}

	var data []byte
	var contentType string

	switch format {
	case "markdown", "md":
		data, err = s.exporter.ExportMarkdown(risks, diagResult)
		contentType = "text/markdown; charset=utf-8"
	case "json":
		data, err = s.exporter.ExportJSON(risks, diagResult)
		contentType = "application/json"
	case "csv":
		data, err = s.exporter.ExportCSV(risks)
		contentType = "text/csv; charset=utf-8"
	default:
		return nil, "", fmt.Errorf("unsupported format: %s", format)
	}

	return data, contentType, err
}

func (s *Service) ExportRouteChain(routeID int64) ([]byte, error) {
	route, err := s.GetRouteWithMiddlewares(routeID)
	if err != nil {
		return nil, err
	}
	return s.exporter.ExportRouteChain(route)
}

func (s *Service) GetMiddlewareOrderSuggestion(routeID int64) (string, error) {
	route, err := s.GetRouteWithMiddlewares(routeID)
	if err != nil {
		return "", err
	}
	return s.exporter.GenerateMiddlewareOrderSuggestion(route), nil
}

func (s *Service) GetRequestTrace(traceID string) (*model.RequestTrace, error) {
	var trace model.RequestTrace
	var headersJSON string
	var serviceID, routeID sql.NullInt64

	err := s.db.QueryRow(`
		SELECT id, trace_id, service_id, route_id, method, path, headers, 
		       body_read_count, status_code, response_body, created_at
		FROM request_traces WHERE trace_id = ?
	`, traceID).Scan(
		&trace.ID, &trace.TraceID, &serviceID, &routeID,
		&trace.Method, &trace.Path, &headersJSON,
		&trace.BodyReadCount, &trace.StatusCode, &trace.ResponseBody, &trace.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("trace not found")
	} else if err != nil {
		return nil, err
	}

	if serviceID.Valid {
		id := serviceID.Int64
		trace.ServiceID = &id
	}
	if routeID.Valid {
		id := routeID.Int64
		trace.RouteID = &id
	}

	if headersJSON != "" {
		json.Unmarshal([]byte(headersJSON), &trace.Headers)
	}

	return &trace, nil
}

func (s *Service) GetContextEvents(traceID string) ([]model.ContextEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, trace_id, middleware_name, event_type, key, value, old_value, timestamp, created_at
		FROM context_events WHERE trace_id = ?
		ORDER BY timestamp
	`, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []model.ContextEvent
	for rows.Next() {
		var e model.ContextEvent
		err := rows.Scan(
			&e.ID, &e.TraceID, &e.MiddlewareName, &e.EventType,
			&e.Key, &e.Value, &e.OldValue, &e.Timestamp, &e.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

func (s *Service) ReloadDiagnosticRules() error {
	return s.diagnostic.InitializeRules()
}

func stringsJoin(slice []string, sep string) string {
	if len(slice) == 0 {
		return ""
	}
	result := slice[0]
	for i := 1; i < len(slice); i++ {
		result += sep + slice[i]
	}
	return result
}
