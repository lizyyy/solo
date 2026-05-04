package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"config-manager/internal/model"
)

type Store struct {
	db *sql.DB
}

func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	s := &Store{db: db}
	if err := s.initSchema(); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) DB() *sql.DB {
	return s.db
}

func (s *Store) initSchema() error {
	schema := `
		CREATE TABLE IF NOT EXISTS tenants (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		);

		CREATE TABLE IF NOT EXISTS services (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			name TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			FOREIGN KEY (tenant_id) REFERENCES tenants(id),
			UNIQUE(tenant_id, name)
		);

		CREATE TABLE IF NOT EXISTS config_items (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			service_id TEXT NOT NULL,
			key TEXT NOT NULL,
			description TEXT,
			schema TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			FOREIGN KEY (tenant_id) REFERENCES tenants(id),
			FOREIGN KEY (service_id) REFERENCES services(id),
			UNIQUE(service_id, key)
		);

		CREATE TABLE IF NOT EXISTS config_versions (
			id TEXT PRIMARY KEY,
			config_id TEXT NOT NULL,
			version INTEGER NOT NULL,
			value TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'draft',
			published_at DATETIME,
			created_at DATETIME NOT NULL,
			created_by TEXT NOT NULL,
			FOREIGN KEY (config_id) REFERENCES config_items(id),
			UNIQUE(config_id, version)
		);

		CREATE TABLE IF NOT EXISTS releases (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			service_id TEXT NOT NULL,
			name TEXT NOT NULL,
			config_changes TEXT NOT NULL,
			gray_rule TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'draft',
			created_at DATETIME NOT NULL,
			started_at DATETIME,
			paused_at DATETIME,
			completed_at DATETIME,
			rolled_back_at DATETIME,
			created_by TEXT NOT NULL,
			approved_by TEXT,
			FOREIGN KEY (tenant_id) REFERENCES tenants(id),
			FOREIGN KEY (service_id) REFERENCES services(id)
		);

		CREATE TABLE IF NOT EXISTS clients (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			service_id TEXT NOT NULL,
			client_id TEXT NOT NULL,
			region TEXT NOT NULL,
			ip TEXT,
			metadata TEXT,
			last_seen DATETIME NOT NULL,
			created_at DATETIME NOT NULL,
			FOREIGN KEY (tenant_id) REFERENCES tenants(id),
			FOREIGN KEY (service_id) REFERENCES services(id),
			UNIQUE(tenant_id, service_id, client_id)
		);

		CREATE TABLE IF NOT EXISTS client_pulls (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			service_id TEXT NOT NULL,
			client_id TEXT NOT NULL,
			config_id TEXT NOT NULL,
			version_id TEXT NOT NULL,
			version INTEGER NOT NULL,
			release_id TEXT,
			is_gray_hit INTEGER DEFAULT 0,
			etag TEXT NOT NULL,
			pulled_at DATETIME NOT NULL,
			client_region TEXT NOT NULL,
			FOREIGN KEY (tenant_id) REFERENCES tenants(id),
			FOREIGN KEY (service_id) REFERENCES services(id),
			FOREIGN KEY (config_id) REFERENCES config_items(id),
			FOREIGN KEY (version_id) REFERENCES config_versions(id),
			FOREIGN KEY (release_id) REFERENCES releases(id)
		);

		CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			action TEXT NOT NULL,
			resource_id TEXT NOT NULL,
			resource_type TEXT NOT NULL,
			details TEXT,
			operator TEXT NOT NULL,
			created_at DATETIME NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_config_versions_config_id ON config_versions(config_id);
		CREATE INDEX IF NOT EXISTS idx_config_versions_version ON config_versions(version);
		CREATE INDEX IF NOT EXISTS idx_releases_service_id ON releases(service_id);
		CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);
		CREATE INDEX IF NOT EXISTS idx_client_pulls_client_id ON client_pulls(client_id);
		CREATE INDEX IF NOT EXISTS idx_client_pulls_release_id ON client_pulls(release_id);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
	`

	_, err := s.db.Exec(schema)
	return err
}

func (s *Store) CreateTenant(tenant *model.Tenant) error {
	now := time.Now()
	tenant.CreatedAt = now
	tenant.UpdatedAt = now

	query := `INSERT INTO tenants (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`
	_, err := s.db.Exec(query, tenant.ID, tenant.Name, tenant.CreatedAt, tenant.UpdatedAt)
	return err
}

func (s *Store) GetTenantByID(id string) (*model.Tenant, error) {
	var tenant model.Tenant
	query := `SELECT id, name, created_at, updated_at FROM tenants WHERE id = ?`
	err := s.db.QueryRow(query, id).Scan(&tenant.ID, &tenant.Name, &tenant.CreatedAt, &tenant.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, model.ErrTenantNotFound
	}
	return &tenant, err
}

func (s *Store) CreateService(service *model.Service) error {
	now := time.Now()
	service.CreatedAt = now
	service.UpdatedAt = now

	query := `INSERT INTO services (id, tenant_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, service.ID, service.TenantID, service.Name, service.CreatedAt, service.UpdatedAt)
	return err
}

func (s *Store) GetServiceByID(id string) (*model.Service, error) {
	var service model.Service
	query := `SELECT id, tenant_id, name, created_at, updated_at FROM services WHERE id = ?`
	err := s.db.QueryRow(query, id).Scan(&service.ID, &service.TenantID, &service.Name, &service.CreatedAt, &service.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, model.ErrServiceNotFound
	}
	return &service, err
}

func (s *Store) CreateConfigItem(config *model.ConfigItem) error {
	now := time.Now()
	config.CreatedAt = now
	config.UpdatedAt = now

	query := `INSERT INTO config_items (id, tenant_id, service_id, key, description, schema, created_at, updated_at) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, config.ID, config.TenantID, config.ServiceID, config.Key, config.Description, config.Schema, config.CreatedAt, config.UpdatedAt)
	return err
}

func (s *Store) GetConfigItemByID(id string) (*model.ConfigItem, error) {
	var config model.ConfigItem
	var schemaBytes []byte
	query := `SELECT id, tenant_id, service_id, key, description, schema, created_at, updated_at FROM config_items WHERE id = ?`
	err := s.db.QueryRow(query, id).Scan(&config.ID, &config.TenantID, &config.ServiceID, &config.Key, &config.Description, &schemaBytes, &config.CreatedAt, &config.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, model.ErrConfigNotFound
	}
	config.Schema = json.RawMessage(schemaBytes)
	return &config, err
}

func (s *Store) GetConfigItemByKey(serviceID, key string) (*model.ConfigItem, error) {
	var config model.ConfigItem
	var schemaBytes []byte
	query := `SELECT id, tenant_id, service_id, key, description, schema, created_at, updated_at FROM config_items WHERE service_id = ? AND key = ?`
	err := s.db.QueryRow(query, serviceID, key).Scan(&config.ID, &config.TenantID, &config.ServiceID, &config.Key, &config.Description, &schemaBytes, &config.CreatedAt, &config.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, model.ErrConfigNotFound
	}
	config.Schema = json.RawMessage(schemaBytes)
	return &config, err
}

func (s *Store) GetLatestVersion(configID string) (*model.ConfigVersion, error) {
	var version model.ConfigVersion
	var valueBytes []byte
	query := `SELECT id, config_id, version, value, status, published_at, created_at, created_by 
	          FROM config_versions WHERE config_id = ? ORDER BY version DESC LIMIT 1`
	err := s.db.QueryRow(query, configID).Scan(
		&version.ID, &version.ConfigID, &version.Version, &valueBytes,
		&version.Status, &version.PublishedAt, &version.CreatedAt, &version.CreatedBy)
	if err == sql.ErrNoRows {
		return nil, model.ErrVersionNotFound
	}
	version.Value = json.RawMessage(valueBytes)
	return &version, err
}

func (s *Store) CreateConfigVersion(version *model.ConfigVersion) error {
	version.CreatedAt = time.Now()

	query := `INSERT INTO config_versions (id, config_id, version, value, status, published_at, created_at, created_by) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, version.ID, version.ConfigID, version.Version, version.Value, version.Status, version.PublishedAt, version.CreatedAt, version.CreatedBy)
	return err
}

func (s *Store) GetConfigVersionByID(id string) (*model.ConfigVersion, error) {
	var version model.ConfigVersion
	var valueBytes []byte
	query := `SELECT id, config_id, version, value, status, published_at, created_at, created_by 
	          FROM config_versions WHERE id = ?`
	err := s.db.QueryRow(query, id).Scan(
		&version.ID, &version.ConfigID, &version.Version, &valueBytes,
		&version.Status, &version.PublishedAt, &version.CreatedAt, &version.CreatedBy)
	if err == sql.ErrNoRows {
		return nil, model.ErrVersionNotFound
	}
	version.Value = json.RawMessage(valueBytes)
	return &version, err
}

func (s *Store) CreateRelease(release *model.Release) error {
	release.CreatedAt = time.Now()

	query := `INSERT INTO releases (id, tenant_id, service_id, name, config_changes, gray_rule, status, created_at, started_at, paused_at, completed_at, rolled_back_at, created_by, approved_by) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, release.ID, release.TenantID, release.ServiceID, release.Name, release.ConfigChanges, release.GrayRule, release.Status, release.CreatedAt, release.StartedAt, release.PausedAt, release.CompletedAt, release.RolledBackAt, release.CreatedBy, release.ApprovedBy)
	return err
}

func (s *Store) GetReleaseByID(id string) (*model.Release, error) {
	var release model.Release
	var configChangesBytes, grayRuleBytes []byte
	query := `SELECT id, tenant_id, service_id, name, config_changes, gray_rule, status, created_at, started_at, paused_at, completed_at, rolled_back_at, created_by, approved_by 
	          FROM releases WHERE id = ?`
	err := s.db.QueryRow(query, id).Scan(
		&release.ID, &release.TenantID, &release.ServiceID, &release.Name, &configChangesBytes, &grayRuleBytes,
		&release.Status, &release.CreatedAt, &release.StartedAt, &release.PausedAt, &release.CompletedAt, &release.RolledBackAt, &release.CreatedBy, &release.ApprovedBy)
	if err == sql.ErrNoRows {
		return nil, model.ErrReleaseNotFound
	}
	release.ConfigChanges = json.RawMessage(configChangesBytes)
	release.GrayRule = json.RawMessage(grayRuleBytes)
	return &release, err
}

func (s *Store) UpdateReleaseStatus(releaseID string, status model.ReleaseStatus) error {
	query := `UPDATE releases SET status = ? WHERE id = ?`
	result, err := s.db.Exec(query, status, releaseID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return model.ErrReleaseNotFound
	}
	return nil
}

func (s *Store) GetOrCreateClient(client *model.Client) (*model.Client, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var existing model.Client
	var metadataBytes []byte
	query := `SELECT id, tenant_id, service_id, client_id, region, ip, metadata, last_seen, created_at 
	          FROM clients WHERE tenant_id = ? AND service_id = ? AND client_id = ?`
	err = tx.QueryRow(query, client.TenantID, client.ServiceID, client.ClientID).Scan(
		&existing.ID, &existing.TenantID, &existing.ServiceID, &existing.ClientID,
		&existing.Region, &existing.IP, &metadataBytes, &existing.LastSeen, &existing.CreatedAt)
	if err == nil {
		existing.Metadata = json.RawMessage(metadataBytes)
		updateQuery := `UPDATE clients SET last_seen = ? WHERE id = ?`
		now := time.Now()
		_, err = tx.Exec(updateQuery, now, existing.ID)
		if err != nil {
			return nil, err
		}
		existing.LastSeen = now
		return &existing, tx.Commit()
	}

	if err != sql.ErrNoRows {
		return nil, err
	}

	now := time.Now()
	client.ID = model.NewID()
	client.CreatedAt = now
	client.LastSeen = now

	insertQuery := `INSERT INTO clients (id, tenant_id, service_id, client_id, region, ip, metadata, last_seen, created_at) 
	                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = tx.Exec(insertQuery, client.ID, client.TenantID, client.ServiceID, client.ClientID, client.Region, client.IP, client.Metadata, client.LastSeen, client.CreatedAt)
	if err != nil {
		return nil, err
	}

	return client, tx.Commit()
}

func (s *Store) CreateClientPull(pull *model.ClientPull) error {
	pull.PulledAt = time.Now()

	query := `INSERT INTO client_pulls (id, tenant_id, service_id, client_id, config_id, version_id, version, release_id, is_gray_hit, etag, pulled_at, client_region) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, pull.ID, pull.TenantID, pull.ServiceID, pull.ClientID, pull.ConfigID, pull.VersionID, pull.Version, pull.ReleaseID, pull.IsGrayHit, pull.ETag, pull.PulledAt, pull.ClientRegion)
	return err
}

func (s *Store) CreateAuditLog(log *model.AuditLog) error {
	log.CreatedAt = time.Now()

	query := `INSERT INTO audit_logs (id, tenant_id, action, resource_id, resource_type, details, operator, created_at) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, log.ID, log.TenantID, log.Action, log.ResourceID, log.ResourceType, log.Details, log.Operator, log.CreatedAt)
	return err
}

func (s *Store) GetAuditLogsByResource(resourceID string, limit int) ([]*model.AuditLog, error) {
	query := `SELECT id, tenant_id, action, resource_id, resource_type, details, operator, created_at 
	          FROM audit_logs WHERE resource_id = ? ORDER BY created_at DESC LIMIT ?`
	rows, err := s.db.Query(query, resourceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*model.AuditLog
	for rows.Next() {
		var log model.AuditLog
		var detailsBytes []byte
		if err := rows.Scan(&log.ID, &log.TenantID, &log.Action, &log.ResourceID, &log.ResourceType, &detailsBytes, &log.Operator, &log.CreatedAt); err != nil {
			return nil, err
		}
		log.Details = json.RawMessage(detailsBytes)
		logs = append(logs, &log)
	}
	return logs, nil
}

func (s *Store) GetActiveRelease(serviceID string) (*model.Release, error) {
	query := `SELECT id, tenant_id, service_id, name, config_changes, gray_rule, status, created_at, started_at, paused_at, completed_at, rolled_back_at, created_by, approved_by 
	          FROM releases WHERE service_id = ? AND status IN (?, ?) ORDER BY started_at DESC LIMIT 1`
	var release model.Release
	var configChangesBytes, grayRuleBytes []byte
	err := s.db.QueryRow(query, serviceID, model.ReleaseStatusRolling, model.ReleaseStatusPaused).Scan(
		&release.ID, &release.TenantID, &release.ServiceID, &release.Name, &configChangesBytes, &grayRuleBytes,
		&release.Status, &release.CreatedAt, &release.StartedAt, &release.PausedAt, &release.CompletedAt, &release.RolledBackAt, &release.CreatedBy, &release.ApprovedBy)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	release.ConfigChanges = json.RawMessage(configChangesBytes)
	release.GrayRule = json.RawMessage(grayRuleBytes)
	return &release, nil
}

func (s *Store) GetClientsByService(serviceID string) ([]*model.Client, error) {
	query := `SELECT id, tenant_id, service_id, client_id, region, ip, metadata, last_seen, created_at 
	          FROM clients WHERE service_id = ? ORDER BY created_at DESC`
	rows, err := s.db.Query(query, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []*model.Client
	for rows.Next() {
		var client model.Client
		var metadataBytes []byte
		if err := rows.Scan(&client.ID, &client.TenantID, &client.ServiceID, &client.ClientID, &client.Region, &client.IP, &metadataBytes, &client.LastSeen, &client.CreatedAt); err != nil {
			return nil, err
		}
		client.Metadata = json.RawMessage(metadataBytes)
		clients = append(clients, &client)
	}
	return clients, nil
}

func (s *Store) GetPullsByRelease(releaseID string) ([]*model.ClientPull, error) {
	query := `SELECT id, tenant_id, service_id, client_id, config_id, version_id, version, release_id, is_gray_hit, etag, pulled_at, client_region 
	          FROM client_pulls WHERE release_id = ? ORDER BY pulled_at DESC`
	rows, err := s.db.Query(query, releaseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pulls []*model.ClientPull
	for rows.Next() {
		var pull model.ClientPull
		if err := rows.Scan(&pull.ID, &pull.TenantID, &pull.ServiceID, &pull.ClientID, &pull.ConfigID, &pull.VersionID, &pull.Version, &pull.ReleaseID, &pull.IsGrayHit, &pull.ETag, &pull.PulledAt, &pull.ClientRegion); err != nil {
			return nil, err
		}
		pulls = append(pulls, &pull)
	}
	return pulls, nil
}

func (s *Store) GetPublishedVersion(configID string) (*model.ConfigVersion, error) {
	query := `SELECT id, config_id, version, value, status, published_at, created_at, created_by 
	          FROM config_versions WHERE config_id = ? AND status = 'published' ORDER BY version DESC LIMIT 1`
	var version model.ConfigVersion
	var valueBytes []byte
	err := s.db.QueryRow(query, configID).Scan(
		&version.ID, &version.ConfigID, &version.Version, &valueBytes,
		&version.Status, &version.PublishedAt, &version.CreatedAt, &version.CreatedBy)
	if err == sql.ErrNoRows {
		return nil, model.ErrVersionNotFound
	}
	version.Value = json.RawMessage(valueBytes)
	return &version, err
}

func (s *Store) UpdateVersionStatus(versionID string, status string, publishTime *time.Time) error {
	query := `UPDATE config_versions SET status = ?, published_at = ? WHERE id = ?`
	var publishArg interface{}
	if publishTime != nil {
		publishArg = *publishTime
	}
	_, err := s.db.Exec(query, status, publishArg, versionID)
	return err
}

func (s *Store) SeedTestData() error {
	operator := "system"

	tenant := &model.Tenant{
		ID:   "t_001",
		Name: "内部租户",
	}
	if err := s.CreateTenant(tenant); err != nil {
		return fmt.Errorf("create tenant: %w", err)
	}

	service := &model.Service{
		ID:       "s_001",
		TenantID: "t_001",
		Name:     "订单服务",
	}
	if err := s.CreateService(service); err != nil {
		return fmt.Errorf("create service: %w", err)
	}

	rateLimitSchema := json.RawMessage(`{"type":"object","properties":{"max_qps":{"type":"integer"},"window_sec":{"type":"integer"}},"required":["max_qps","window_sec"]}`)
	config1 := &model.ConfigItem{
		ID:          "c_001",
		TenantID:    "t_001",
		ServiceID:   "s_001",
		Key:         "rate_limit",
		Description: "限流配置",
		Schema:      rateLimitSchema,
	}
	if err := s.CreateConfigItem(config1); err != nil {
		return fmt.Errorf("create config rate_limit: %w", err)
	}

	switchSchema := json.RawMessage(`{"type":"object","properties":{"enabled":{"type":"boolean"}},"required":["enabled"]}`)
	config2 := &model.ConfigItem{
		ID:          "c_002",
		TenantID:    "t_001",
		ServiceID:   "s_001",
		Key:         "feature_new_checkout",
		Description: "新结账流程开关",
		Schema:      switchSchema,
	}
	if err := s.CreateConfigItem(config2); err != nil {
		return fmt.Errorf("create config feature_new_checkout: %w", err)
	}

	regionSchema := json.RawMessage(`{"type":"object","patternProperties":{"^[a-z]{2}_[A-Z]{2}$":{"type":"object","properties":{"priority":{"type":"integer"},"tax_rate":{"type":"number"}}}},"additionalProperties":false}`)
	config3 := &model.ConfigItem{
		ID:          "c_003",
		TenantID:    "t_001",
		ServiceID:   "s_001",
		Key:         "region_policy",
		Description: "地区策略配置",
		Schema:      regionSchema,
	}
	if err := s.CreateConfigItem(config3); err != nil {
		return fmt.Errorf("create config region_policy: %w", err)
	}

	version1_1 := &model.ConfigVersion{
		ID:        "v_001",
		ConfigID:  "c_001",
		Version:   1,
		Value:     json.RawMessage(`{"max_qps":100,"window_sec":60}`),
		Status:    "published",
		CreatedBy: operator,
	}
	now := time.Now()
	version1_1.PublishedAt = sql.NullTime{Time: now, Valid: true}
	if err := s.CreateConfigVersion(version1_1); err != nil {
		return fmt.Errorf("create version v_001: %w", err)
	}

	version2_1 := &model.ConfigVersion{
		ID:        "v_002",
		ConfigID:  "c_002",
		Version:   1,
		Value:     json.RawMessage(`{"enabled":false}`),
		Status:    "published",
		CreatedBy: operator,
	}
	version2_1.PublishedAt = sql.NullTime{Time: now, Valid: true}
	if err := s.CreateConfigVersion(version2_1); err != nil {
		return fmt.Errorf("create version v_002: %w", err)
	}

	version3_1 := &model.ConfigVersion{
		ID:        "v_003",
		ConfigID:  "c_003",
		Version:   1,
		Value:     json.RawMessage(`{"zh_CN":{"priority":1,"tax_rate":0.13},"en_US":{"priority":2,"tax_rate":0.08}}`),
		Status:    "published",
		CreatedBy: operator,
	}
	version3_1.PublishedAt = sql.NullTime{Time: now, Valid: true}
	if err := s.CreateConfigVersion(version3_1); err != nil {
		return fmt.Errorf("create version v_003: %w", err)
	}

	version1_2 := &model.ConfigVersion{
		ID:        "v_004",
		ConfigID:  "c_001",
		Version:   2,
		Value:     json.RawMessage(`{"max_qps":500,"window_sec":60}`),
		Status:    "draft",
		CreatedBy: "admin_user",
	}
	if err := s.CreateConfigVersion(version1_2); err != nil {
		return fmt.Errorf("create version v_004: %w", err)
	}

	version2_2 := &model.ConfigVersion{
		ID:        "v_005",
		ConfigID:  "c_002",
		Version:   2,
		Value:     json.RawMessage(`{"enabled":true}`),
		Status:    "draft",
		CreatedBy: "admin_user",
	}
	if err := s.CreateConfigVersion(version2_2); err != nil {
		return fmt.Errorf("create version v_005: %w", err)
	}

	return nil
}
