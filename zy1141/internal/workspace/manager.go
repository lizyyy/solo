package workspace

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"msctl/internal/models"
	"msctl/pkg/utils"
)

const (
	WorkspaceConfigFile = "workspace.yaml"
	DataDir             = "data"
	ReportsDir          = "reports"
	CacheDir            = ".cache"
)

type Manager struct {
	root string
}

func NewManager(root string) *Manager {
	return &Manager{root: root}
}

func (m *Manager) Init(name, description string) error {
	if m.Exists() {
		return fmt.Errorf("工作空间已存在: %s", m.root)
	}

	if err := os.MkdirAll(m.root, 0755); err != nil {
		return fmt.Errorf("创建工作空间目录失败: %w", err)
	}

	dirs := []string{
		filepath.Join(m.root, DataDir),
		filepath.Join(m.root, DataDir, "openapi"),
		filepath.Join(m.root, ReportsDir),
		filepath.Join(m.root, CacheDir),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("创建目录失败: %s: %w", dir, err)
		}
	}

	config := models.WorkspaceConfig{
		Version:     "1.0.0",
		Name:        name,
		Description: description,
		CreatedAt:   utils.Timestamp(),
		LastUpdated: utils.Timestamp(),
		Metadata:    make(map[string]string),
	}

	configPath := filepath.Join(m.root, WorkspaceConfigFile)
	if err := utils.WriteYAML(configPath, config); err != nil {
		return fmt.Errorf("写入配置文件失败: %w", err)
	}

	return nil
}

func (m *Manager) Exists() bool {
	configPath := filepath.Join(m.root, WorkspaceConfigFile)
	return utils.FileExists(configPath)
}

func (m *Manager) GetConfig() (*models.WorkspaceConfig, error) {
	configPath := filepath.Join(m.root, WorkspaceConfigFile)
	var config models.WorkspaceConfig
	if err := utils.ReadYAML(configPath, &config); err != nil {
		return nil, err
	}
	return &config, nil
}

func (m *Manager) UpdateConfig(config *models.WorkspaceConfig) error {
	config.LastUpdated = utils.Timestamp()
	configPath := filepath.Join(m.root, WorkspaceConfigFile)
	return utils.WriteYAML(configPath, config)
}

func (m *Manager) GetDataDir() string {
	return filepath.Join(m.root, DataDir)
}

func (m *Manager) GetReportsDir() string {
	return filepath.Join(m.root, ReportsDir)
}

func (m *Manager) GetCacheDir() string {
	return filepath.Join(m.root, CacheDir)
}

func (m *Manager) GetOpenAPIDir() string {
	return filepath.Join(m.root, DataDir, "openapi")
}

func (m *Manager) SaveWorkspace(ws *models.Workspace) error {
	if err := m.saveServices(ws); err != nil {
		return err
	}
	if err := m.saveCallEdges(ws); err != nil {
		return err
	}
	if err := m.saveOwners(ws); err != nil {
		return err
	}
	if err := m.savePolicies(ws); err != nil {
		return err
	}
	if err := m.saveDeployPlan(ws); err != nil {
		return err
	}
	return nil
}

func (m *Manager) saveServices(ws *models.Workspace) error {
	path := filepath.Join(m.GetDataDir(), "services.yaml")
	type servicesWrapper struct {
		Services []models.Service `yaml:"services"`
	}
	wrapper := servicesWrapper{
		Services: make([]models.Service, 0, len(ws.Services)),
	}
	for _, svc := range ws.Services {
		wrapper.Services = append(wrapper.Services, svc)
	}
	return utils.WriteYAML(path, wrapper)
}

func (m *Manager) saveCallEdges(ws *models.Workspace) error {
	path := filepath.Join(m.GetDataDir(), "call-edges.jsonl")
	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("创建 call-edges 文件失败: %w", err)
	}
	defer file.Close()

	for _, edge := range ws.CallEdges {
		data, err := wsModelsToRawEdge(edge)
		if err != nil {
			return err
		}
		line, err := utils.MarshalJSONLine(data)
		if err != nil {
			return err
		}
		if _, err := file.WriteString(line + "\n"); err != nil {
			return fmt.Errorf("写入 call-edges 失败: %w", err)
		}
	}
	return nil
}

func (m *Manager) saveOwners(ws *models.Workspace) error {
	path := filepath.Join(m.GetDataDir(), "owners.csv")
	records := [][]string{
		{"service_name", "primary", "secondary", "team", "slack_channel", "email"},
	}
	for _, owner := range ws.Owners {
		records = append(records, []string{
			owner.ServiceName,
			owner.Primary,
			owner.Secondary,
			owner.Team,
			owner.SlackChannel,
			owner.Email,
		})
	}
	return utils.WriteCSV(path, records)
}

func (m *Manager) savePolicies(ws *models.Workspace) error {
	path := filepath.Join(m.GetDataDir(), "policies.yaml")
	type policiesWrapper struct {
		Policies []models.Policy `yaml:"policies"`
	}
	return utils.WriteYAML(path, policiesWrapper{Policies: ws.Policies})
}

func (m *Manager) saveDeployPlan(ws *models.Workspace) error {
	if ws.DeployPlan == nil {
		return nil
	}
	path := filepath.Join(m.GetDataDir(), "deploy-plan.yaml")
	return utils.WriteYAML(path, ws.DeployPlan)
}

func (m *Manager) LoadWorkspace() (*models.Workspace, error) {
	ws := &models.Workspace{
		Root:         m.root,
		Services:     make(map[string]models.Service),
		Owners:       make(map[string]models.Owner),
		OpenAPISpecs: make(map[string]models.OpenAPISpec),
	}

	if config, err := m.GetConfig(); err == nil {
		ws.Config = *config
	}

	if err := m.loadServices(ws); err != nil {
		return nil, err
	}
	if err := m.loadCallEdges(ws); err != nil {
		return nil, err
	}
	if err := m.loadOwners(ws); err != nil {
		return nil, err
	}
	if err := m.loadPolicies(ws); err != nil {
		return nil, err
	}
	if err := m.loadDeployPlan(ws); err != nil {
		return nil, err
	}
	if err := m.loadOpenAPISpecs(ws); err != nil {
		return nil, err
	}

	return ws, nil
}

func (m *Manager) loadServices(ws *models.Workspace) error {
	path := filepath.Join(m.GetDataDir(), "services.yaml")
	if !utils.FileExists(path) {
		return nil
	}

	type servicesWrapper struct {
		Services []models.Service `yaml:"services"`
	}
	var wrapper servicesWrapper
	if err := utils.ReadYAML(path, &wrapper); err != nil {
		return err
	}

	for _, svc := range wrapper.Services {
		ws.Services[svc.Name] = svc
	}
	return nil
}

func (m *Manager) loadCallEdges(ws *models.Workspace) error {
	path := filepath.Join(m.GetDataDir(), "call-edges.jsonl")
	if !utils.FileExists(path) {
		return nil
	}

	items, err := utils.ReadJSONL(path)
	if err != nil {
		return err
	}

	for _, item := range items {
		edge := rawEdgeToModel(item)
		ws.CallEdges = append(ws.CallEdges, edge)
	}
	return nil
}

func (m *Manager) loadOwners(ws *models.Workspace) error {
	path := filepath.Join(m.GetDataDir(), "owners.csv")
	if !utils.FileExists(path) {
		return nil
	}

	records, err := utils.ReadCSV(path)
	if err != nil {
		return err
	}

	if len(records) < 2 {
		return nil
	}

	headerMap := make(map[string]int)
	for i, h := range records[0] {
		headerMap[h] = i
	}

	for _, row := range records[1:] {
		owner := models.Owner{}
		if idx, ok := headerMap["service_name"]; ok && idx < len(row) {
			owner.ServiceName = row[idx]
		}
		if idx, ok := headerMap["primary"]; ok && idx < len(row) {
			owner.Primary = row[idx]
		}
		if idx, ok := headerMap["secondary"]; ok && idx < len(row) {
			owner.Secondary = row[idx]
		}
		if idx, ok := headerMap["team"]; ok && idx < len(row) {
			owner.Team = row[idx]
		}
		if idx, ok := headerMap["slack_channel"]; ok && idx < len(row) {
			owner.SlackChannel = row[idx]
		}
		if idx, ok := headerMap["email"]; ok && idx < len(row) {
			owner.Email = row[idx]
		}
		if owner.ServiceName != "" {
			ws.Owners[owner.ServiceName] = owner
		}
	}
	return nil
}

func (m *Manager) loadPolicies(ws *models.Workspace) error {
	path := filepath.Join(m.GetDataDir(), "policies.yaml")
	if !utils.FileExists(path) {
		return nil
	}

	type policiesWrapper struct {
		Policies []models.Policy `yaml:"policies"`
	}
	var wrapper policiesWrapper
	if err := utils.ReadYAML(path, &wrapper); err != nil {
		return err
	}

	ws.Policies = wrapper.Policies
	return nil
}

func (m *Manager) loadDeployPlan(ws *models.Workspace) error {
	path := filepath.Join(m.GetDataDir(), "deploy-plan.yaml")
	if !utils.FileExists(path) {
		return nil
	}

	var plan models.DeployPlan
	if err := utils.ReadYAML(path, &plan); err != nil {
		return err
	}

	ws.DeployPlan = &plan
	return nil
}

func (m *Manager) loadOpenAPISpecs(ws *models.Workspace) error {
	openapiDir := m.GetOpenAPIDir()
	if !utils.DirExists(openapiDir) {
		return nil
	}

	files, err := utils.ListFiles(openapiDir, ".yaml")
	if err != nil {
		return err
	}

	jsonFiles, err := utils.ListFiles(openapiDir, ".json")
	if err == nil {
		files = append(files, jsonFiles...)
	}

	for _, file := range files {
		var spec map[string]interface{}
		if err := utils.ReadYAML(file, &spec); err != nil {
			if err := utils.ReadJSON(file, &spec); err != nil {
				continue
			}
		}
		name := filepath.Base(file)
		ws.OpenAPISpecs[name] = models.OpenAPISpec{
			FilePath: file,
			Spec:     spec,
		}
	}
	return nil
}

func (m *Manager) SaveAnalysisResult(result *models.AnalysisResult) error {
	reportsDir := m.GetReportsDir()
	if err := utils.EnsureDir(reportsDir); err != nil {
		return err
	}

	timestamp := time.Now().Format("20060102-150405")
	filename := fmt.Sprintf("analysis-%s.json", timestamp)
	path := filepath.Join(reportsDir, filename)

	return utils.WriteJSON(path, result, true)
}

func (m *Manager) SavePlanResult(result *models.PlanResult) error {
	reportsDir := m.GetReportsDir()
	if err := utils.EnsureDir(reportsDir); err != nil {
		return err
	}

	timestamp := time.Now().Format("20060102-150405")
	filename := fmt.Sprintf("plan-%s.json", timestamp)
	path := filepath.Join(reportsDir, filename)

	return utils.WriteJSON(path, result, true)
}

func rawEdgeToModel(item map[string]interface{}) models.CallEdge {
	edge := models.CallEdge{}
	if v, ok := item["source_service"].(string); ok {
		edge.SourceService = v
	}
	if v, ok := item["target_service"].(string); ok {
		edge.TargetService = v
	}
	if v, ok := item["method"].(string); ok {
		edge.Method = v
	}
	if v, ok := item["path"].(string); ok {
		edge.Path = v
	}
	if v, ok := item["operation_id"].(string); ok {
		edge.OperationID = v
	}
	if v, ok := item["protocol"].(string); ok {
		edge.Protocol = v
	}
	if v, ok := item["tags"].([]interface{}); ok {
		for _, tag := range v {
			if s, ok := tag.(string); ok {
				edge.Tags = append(edge.Tags, s)
			}
		}
	}
	if v, ok := item["metadata"].(map[string]interface{}); ok {
		edge.Metadata = make(map[string]string)
		for k, mv := range v {
			if s, ok := mv.(string); ok {
				edge.Metadata[k] = s
			}
		}
	}
	return edge
}

func wsModelsToRawEdge(edge models.CallEdge) (models.RawCallEdge, error) {
	return models.RawCallEdge{
		SourceService: edge.SourceService,
		TargetService: edge.TargetService,
		Method:        edge.Method,
		Path:          edge.Path,
		OperationID:   edge.OperationID,
		Protocol:      edge.Protocol,
		Tags:          edge.Tags,
		Metadata:      edge.Metadata,
	}, nil
}

func init() {
	_ = utils.MarshalJSONLine
}
