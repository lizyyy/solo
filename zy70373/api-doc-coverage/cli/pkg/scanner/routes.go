package scanner

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/ioutil"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/example/api-doc-coverage/cli/pkg/config"
	"github.com/example/api-doc-coverage/cli/pkg/models"
	"gopkg.in/yaml.v2"
)

func ScanRoutes(cfg *config.Config) ([]models.Route, error) {
	var allRoutes []models.Route

	files, err := ioutil.ReadDir(cfg.RoutesDir)
	if err != nil {
		return nil, err
	}

	for _, f := range files {
		if f.IsDir() {
			continue
		}

		ext := filepath.Ext(f.Name())
		if ext == ".go" {
			routes, err := scanGoFile(filepath.Join(cfg.RoutesDir, f.Name()), cfg)
			if err != nil {
				return nil, err
			}
			allRoutes = append(allRoutes, routes...)
		} else if ext == ".yaml" || ext == ".yml" {
			routes, err := scanYAMLFile(filepath.Join(cfg.RoutesDir, f.Name()), cfg)
			if err != nil {
				return nil, err
			}
			allRoutes = append(allRoutes, routes...)
		}
	}

	return allRoutes, nil
}

func scanGoFile(path string, cfg *config.Config) ([]models.Route, error) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	var routes []models.Route

	ast.Inspect(node, func(n ast.Node) bool {
		call, ok := n.(*ast.CallExpr)
		if !ok {
			return true
		}

		sel, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return true
		}

		methods := map[string]string{
			"GET":    "GET",
			"POST":   "POST",
			"PUT":    "PUT",
			"DELETE": "DELETE",
			"PATCH":  "PATCH",
		}

		methodName := sel.Sel.Name
		httpMethod, exists := methods[methodName]
		if !exists {
			return true
		}

		if len(call.Args) < 2 {
			return true
		}

		pathLit, ok := call.Args[0].(*ast.BasicLit)
		if !ok || pathLit.Kind != token.STRING {
			return true
		}

		routePath := strings.Trim(pathLit.Value, "\"`")
		service, owner := getServiceAndOwner(routePath, cfg)

		handler := ""
		if len(call.Args) > 1 {
			switch arg := call.Args[1].(type) {
			case *ast.SelectorExpr:
				handler = fmt.Sprintf("%s.%s", arg.X, arg.Sel.Name)
			case *ast.Ident:
				handler = arg.Name
			}
		}

		route := models.Route{
			Method:  httpMethod,
			Path:    routePath,
			Service: service,
			Owner:   owner,
			Handler: handler,
		}

		routes = append(routes, route)
		return true
	})

	return routes, nil
}

type yamlRoute struct {
	Method      string `yaml:"method"`
	Path        string `yaml:"path"`
	Service     string `yaml:"service"`
	Owner       string `yaml:"owner"`
	Handler     string `yaml:"handler"`
	Description string `yaml:"description"`
}

func scanYAMLFile(path string, cfg *config.Config) ([]models.Route, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var yamlRoutes []yamlRoute
	err = yaml.Unmarshal(data, &yamlRoutes)
	if err != nil {
		return nil, err
	}

	var routes []models.Route
	for _, yr := range yamlRoutes {
		service := yr.Service
		owner := yr.Owner

		if service == "" {
			service, owner = getServiceAndOwner(yr.Path, cfg)
		}

		routes = append(routes, models.Route{
			Method:      yr.Method,
			Path:        yr.Path,
			Service:     service,
			Owner:       owner,
			Handler:     yr.Handler,
			Description: yr.Description,
		})
	}

	return routes, nil
}

func getServiceAndOwner(path string, cfg *config.Config) (string, string) {
	for serviceName, info := range cfg.ServiceMap {
		re := regexp.MustCompile("^" + info.Prefix)
		if re.MatchString(path) {
			return serviceName, info.Owner
		}
	}

	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) > 0 {
		service := parts[0]
		owner := cfg.OwnerMap[service]
		if owner == "" {
			owner = "unknown"
		}
		return service, owner
	}

	return "default", "unknown"
}
