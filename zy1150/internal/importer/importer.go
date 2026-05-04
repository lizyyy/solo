package importer

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
	"middleware-diagnostic/internal/model"
)

type Importer struct {
	db *sql.DB
}

func NewImporter(db *sql.DB) *Importer {
	return &Importer{db: db}
}

func (i *Importer) ImportRoutesYAML(filePath string) (*model.ImportResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	type RouteYAML struct {
		ServiceName string   `yaml:"service_name"`
		Method      string   `yaml:"method"`
		Path        string   `yaml:"path"`
		Description string   `yaml:"description,omitempty"`
		Middlewares []string `yaml:"middlewares"`
	}

	type RoutesConfig struct {
		Services []string    `yaml:"services,omitempty"`
		Routes   []RouteYAML `yaml:"routes"`
	}

	var config RoutesConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	result := &model.ImportResult{
		Success: true,
		Stats:   make(map[string]int),
	}

	tx, err := i.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	serviceMap := make(map[string]int64)
	middlewareMap := make(map[string]int64)

	for _, route := range config.Routes {
		serviceID, exists := serviceMap[route.ServiceName]
		if !exists {
			res, err := tx.Exec(`
				INSERT OR IGNORE INTO services (name, description) VALUES (?, ?)
			`, route.ServiceName, fmt.Sprintf("Service %s", route.ServiceName))
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("failed to insert service %s: %v", route.ServiceName, err))
				continue
			}
			serviceID, err = res.LastInsertId()
			if err != nil {
				var id int64
				err = tx.QueryRow(`SELECT id FROM services WHERE name = ?`, route.ServiceName).Scan(&id)
				if err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("failed to get service id %s: %v", route.ServiceName, err))
					continue
				}
				serviceID = id
			}
			serviceMap[route.ServiceName] = serviceID
			result.Stats["services"]++
		}

		var routeID int64
		err = tx.QueryRow(`
			SELECT id FROM routes WHERE service_id = ? AND method = ? AND path = ?
		`, serviceID, route.Method, route.Path).Scan(&routeID)

		if err == sql.ErrNoRows {
			res, err := tx.Exec(`
				INSERT INTO routes (service_id, method, path, description)
				VALUES (?, ?, ?, ?)
			`, serviceID, route.Method, route.Path, route.Description)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("failed to insert route %s %s: %v", route.Method, route.Path, err))
				continue
			}
			routeID, _ = res.LastInsertId()
			result.Stats["routes_inserted"]++
		} else if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("failed to check route %s %s: %v", route.Method, route.Path, err))
			continue
		} else {
			result.Stats["routes_updated"]++
		}

		_, err = tx.Exec(`DELETE FROM route_middlewares WHERE route_id = ?`, routeID)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("failed to clear old middlewares for route %d: %v", routeID, err))
			continue
		}

		for pos, mwName := range route.Middlewares {
			mwID, exists := middlewareMap[mwName]
			if !exists {
				var id int64
				err = tx.QueryRow(`SELECT id FROM middlewares WHERE name = ?`, mwName).Scan(&id)
				if err == sql.ErrNoRows {
					res, err := tx.Exec(`
						INSERT INTO middlewares (name, type, description)
						VALUES (?, 'unknown', ?)
					`, mwName, fmt.Sprintf("Auto-imported middleware %s", mwName))
					if err != nil {
						result.Errors = append(result.Errors, fmt.Sprintf("failed to insert middleware %s: %v", mwName, err))
						continue
					}
					id, _ = res.LastInsertId()
					result.Stats["middlewares"]++
				} else if err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("failed to get middleware %s: %v", mwName, err))
					continue
				}
				mwID = id
				middlewareMap[mwName] = mwID
			}

			_, err = tx.Exec(`
				INSERT INTO route_middlewares (route_id, middleware_id, position)
				VALUES (?, ?, ?)
			`, routeID, mwID, pos)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("failed to link middleware %s to route: %v", mwName, err))
				continue
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	result.Success = len(result.Errors) == 0
	return result, nil
}

func (i *Importer) ImportMiddlewaresYAML(filePath string) (*model.ImportResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	type MiddlewareYAML struct {
		Name        string                 `yaml:"name"`
		Type        string                 `yaml:"type"`
		Description string                 `yaml:"description,omitempty"`
		Config      map[string]interface{} `yaml:"config,omitempty"`
	}

	type MiddlewaresConfig struct {
		Middlewares []MiddlewareYAML `yaml:"middlewares"`
	}

	var config MiddlewaresConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	result := &model.ImportResult{
		Success: true,
		Stats:   make(map[string]int),
	}

	tx, err := i.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for _, mw := range config.Middlewares {
		configJSON, _ := json.Marshal(mw.Config)

		var existingID int64
		err = tx.QueryRow(`SELECT id FROM middlewares WHERE name = ?`, mw.Name).Scan(&existingID)

		if err == sql.ErrNoRows {
			_, err := tx.Exec(`
				INSERT INTO middlewares (name, type, description, config)
				VALUES (?, ?, ?, ?)
			`, mw.Name, mw.Type, mw.Description, string(configJSON))
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("failed to insert middleware %s: %v", mw.Name, err))
				continue
			}
			result.Stats["middlewares_inserted"]++
		} else if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("failed to check middleware %s: %v", mw.Name, err))
			continue
		} else {
			_, err := tx.Exec(`
				UPDATE middlewares SET type = ?, description = ?, config = ? WHERE name = ?
			`, mw.Type, mw.Description, string(configJSON), mw.Name)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("failed to update middleware %s: %v", mw.Name, err))
				continue
			}
			result.Stats["middlewares_updated"]++
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	result.Success = len(result.Errors) == 0
	return result, nil
}

func (i *Importer) ImportRequestTracesJSONL(filePath string) (*model.ImportResult, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	result := &model.ImportResult{
		Success: true,
		Stats:   make(map[string]int),
	}

	tx, err := i.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		type TraceJSON struct {
			TraceID       string            `json:"trace_id"`
			ServiceName   string            `json:"service_name,omitempty"`
			Method        string            `json:"method"`
			Path          string            `json:"path"`
			Headers       map[string]string `json:"headers,omitempty"`
			BodyReadCount int               `json:"body_read_count"`
			StatusCode    int               `json:"status_code"`
			ResponseBody  string            `json:"response_body,omitempty"`
		}

		var trace TraceJSON
		if err := json.Unmarshal([]byte(line), &trace); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to parse JSON: %v", lineNum, err))
			continue
		}

		headersJSON, _ := json.Marshal(trace.Headers)

		var serviceID *int64
		if trace.ServiceName != "" {
			var id int64
			err := tx.QueryRow(`SELECT id FROM services WHERE name = ?`, trace.ServiceName).Scan(&id)
			if err == nil {
				serviceID = &id
			}
		}

		_, err = tx.Exec(`
			INSERT OR IGNORE INTO request_traces 
			(trace_id, service_id, method, path, headers, body_read_count, status_code, response_body)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, trace.TraceID, serviceID, trace.Method, trace.Path, string(headersJSON),
			trace.BodyReadCount, trace.StatusCode, trace.ResponseBody)

		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to insert trace %s: %v", lineNum, trace.TraceID, err))
			continue
		}
		result.Stats["traces"]++
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	result.Success = len(result.Errors) == 0
	return result, nil
}

func (i *Importer) ImportContextEventsJSONL(filePath string) (*model.ImportResult, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	result := &model.ImportResult{
		Success: true,
		Stats:   make(map[string]int),
	}

	tx, err := i.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		type EventJSON struct {
			TraceID        string  `json:"trace_id"`
			MiddlewareName *string `json:"middleware_name,omitempty"`
			EventType      string  `json:"event_type"`
			Key            *string `json:"key,omitempty"`
			Value          *string `json:"value,omitempty"`
			OldValue       *string `json:"old_value,omitempty"`
		}

		var event EventJSON
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to parse JSON: %v", lineNum, err))
			continue
		}

		_, err = tx.Exec(`
			INSERT INTO context_events 
			(trace_id, middleware_name, event_type, key, value, old_value)
			VALUES (?, ?, ?, ?, ?, ?)
		`, event.TraceID, event.MiddlewareName, event.EventType, event.Key, event.Value, event.OldValue)

		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("line %d: failed to insert event: %v", lineNum, err))
			continue
		}
		result.Stats["events"]++
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	result.Success = len(result.Errors) == 0
	return result, nil
}

func (i *Importer) ImportPoliciesYAML(filePath string) (*model.ImportResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	type PolicyYAML struct {
		Name        string                 `yaml:"name"`
		Type        string                 `yaml:"type"`
		Description string                 `yaml:"description,omitempty"`
		IsActive    *bool                  `yaml:"is_active,omitempty"`
		Rules       map[string]interface{} `yaml:"rules"`
	}

	type PoliciesConfig struct {
		Policies []PolicyYAML `yaml:"policies"`
	}

	var config PoliciesConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	result := &model.ImportResult{
		Success: true,
		Stats:   make(map[string]int),
	}

	tx, err := i.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for _, policy := range config.Policies {
		rulesJSON, _ := json.Marshal(policy.Rules)
		isActive := true
		if policy.IsActive != nil {
			isActive = *policy.IsActive
		}

		var existingID int64
		err = tx.QueryRow(`SELECT id FROM policies WHERE name = ?`, policy.Name).Scan(&existingID)

		if err == sql.ErrNoRows {
			_, err := tx.Exec(`
				INSERT INTO policies (name, type, description, is_active, rules)
				VALUES (?, ?, ?, ?, ?)
			`, policy.Name, policy.Type, policy.Description, isActive, string(rulesJSON))
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("failed to insert policy %s: %v", policy.Name, err))
				continue
			}
			result.Stats["policies_inserted"]++
		} else if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("failed to check policy %s: %v", policy.Name, err))
			continue
		} else {
			_, err := tx.Exec(`
				UPDATE policies SET type = ?, description = ?, is_active = ?, rules = ? WHERE name = ?
			`, policy.Type, policy.Description, isActive, string(rulesJSON), policy.Name)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("failed to update policy %s: %v", policy.Name, err))
				continue
			}
			result.Stats["policies_updated"]++
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	result.Success = len(result.Errors) == 0
	return result, nil
}
