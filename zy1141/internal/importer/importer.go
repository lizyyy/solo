package importer

import (
	"fmt"
	"path/filepath"

	"msctl/internal/models"
	"msctl/internal/workspace"
	"msctl/pkg/utils"
)

type Importer struct {
	wsManager *workspace.Manager
}

func NewImporter(wsManager *workspace.Manager) *Importer {
	return &Importer{wsManager: wsManager}
}

func (i *Importer) Import(config models.ImportConfig) (*models.Workspace, error) {
	ws, err := i.wsManager.LoadWorkspace()
	if err != nil {
		return nil, err
	}

	if err := i.importServices(ws, config.ServicesPath); err != nil {
		return nil, err
	}

	if err := i.importOpenAPI(ws, config.OpenAPIDir); err != nil {
		return nil, err
	}

	if err := i.importCallEdges(ws, config.CallEdgesPath); err != nil {
		return nil, err
	}

	if err := i.importOwners(ws, config.OwnersPath); err != nil {
		return nil, err
	}

	if err := i.importPolicies(ws, config.PoliciesPath); err != nil {
		return nil, err
	}

	if err := i.importDeployPlan(ws, config.DeployPlanPath); err != nil {
		return nil, err
	}

	if err := i.wsManager.SaveWorkspace(ws); err != nil {
		return nil, err
	}

	return ws, nil
}

func (i *Importer) importServices(ws *models.Workspace, path string) error {
	if path == "" {
		return nil
	}
	if !utils.FileExists(path) {
		return fmt.Errorf("服务文件不存在: %s", path)
	}

	type servicesWrapper struct {
		Services []models.Service `yaml:"services"`
	}
	var wrapper servicesWrapper
	if err := utils.ReadYAML(path, &wrapper); err != nil {
		return fmt.Errorf("解析 services.yaml 失败: %w", err)
	}

	for _, svc := range wrapper.Services {
		if svc.Name == "" {
			continue
		}
		ws.Services[svc.Name] = svc
	}

	return nil
}

func (i *Importer) importOpenAPI(ws *models.Workspace, dir string) error {
	if dir == "" || !utils.DirExists(dir) {
		return nil
	}

	files, err := utils.ListFiles(dir, ".yaml")
	if err != nil {
		return err
	}

	jsonFiles, err := utils.ListFiles(dir, ".json")
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

func (i *Importer) importCallEdges(ws *models.Workspace, path string) error {
	if path == "" || !utils.FileExists(path) {
		return nil
	}

	items, err := utils.ReadJSONL(path)
	if err != nil {
		return fmt.Errorf("解析 call-edges.jsonl 失败: %w", err)
	}

	for _, item := range items {
		edge := rawEdgeToModel(item)
		ws.CallEdges = append(ws.CallEdges, edge)
	}

	return nil
}

func (i *Importer) importOwners(ws *models.Workspace, path string) error {
	if path == "" || !utils.FileExists(path) {
		return nil
	}

	records, err := utils.ReadCSV(path)
	if err != nil {
		return fmt.Errorf("解析 owners.csv 失败: %w", err)
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

func (i *Importer) importPolicies(ws *models.Workspace, path string) error {
	if path == "" || !utils.FileExists(path) {
		return nil
	}

	type policiesWrapper struct {
		Policies []models.Policy `yaml:"policies"`
	}
	var wrapper policiesWrapper
	if err := utils.ReadYAML(path, &wrapper); err != nil {
		return fmt.Errorf("解析 policies.yaml 失败: %w", err)
	}

	ws.Policies = append(ws.Policies, wrapper.Policies...)

	return nil
}

func (i *Importer) importDeployPlan(ws *models.Workspace, path string) error {
	if path == "" || !utils.FileExists(path) {
		return nil
	}

	var plan models.DeployPlan
	if err := utils.ReadYAML(path, &plan); err != nil {
		return fmt.Errorf("解析 deploy-plan.yaml 失败: %w", err)
	}

	ws.DeployPlan = &plan

	return nil
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
