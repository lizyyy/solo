package openapi

import (
	"encoding/json"
	"io/ioutil"
	"path/filepath"
	"strings"

	"github.com/example/api-doc-coverage/cli/pkg/models"
	"gopkg.in/yaml.v2"
)

type openapiDoc struct {
	OpenAPI    string                     `yaml:"openapi" json:"openapi"`
	Paths      map[string]map[string]pathItem `yaml:"paths" json:"paths"`
	Components components                 `yaml:"components" json:"components"`
}

type pathItem struct {
	Summary     string           `yaml:"summary" json:"summary"`
	Description string           `yaml:"description" json:"description"`
	Parameters  []parameter      `yaml:"parameters" json:"parameters"`
	RequestBody *requestBody     `yaml:"requestBody" json:"requestBody"`
	Responses   map[string]response `yaml:"responses" json:"responses"`
}

type parameter struct {
	Name     string `yaml:"name" json:"name"`
	In       string `yaml:"in" json:"in"`
	Required bool   `yaml:"required" json:"required"`
	Schema   schema `yaml:"schema" json:"schema"`
}

type requestBody struct {
	Required bool                `yaml:"required" json:"required"`
	Content  map[string]mediaType `yaml:"content" json:"content"`
}

type mediaType struct {
	Schema schema `yaml:"schema" json:"schema"`
}

type response struct {
	Description string              `yaml:"description" json:"description"`
	Content     map[string]mediaType `yaml:"content" json:"content"`
}

type schema struct {
	Type       string            `yaml:"type" json:"type"`
	Properties map[string]schema `yaml:"properties" json:"properties"`
	Required   []string          `yaml:"required" json:"required"`
	Ref        string            `yaml:"$ref" json:"$ref"`
}

type components struct {
	Schemas map[string]schema `yaml:"schemas" json:"schemas"`
}

func Parse(path string) ([]models.OpenAPIRoute, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var doc openapiDoc

	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".json" {
		err = json.Unmarshal(data, &doc)
	} else {
		err = yaml.Unmarshal(data, &doc)
	}

	if err != nil {
		return nil, err
	}

	var routes []models.OpenAPIRoute

	for path, methods := range doc.Paths {
		for method, item := range methods {
			httpMethod := strings.ToUpper(method)
			if httpMethod == "GET" || httpMethod == "POST" || httpMethod == "PUT" ||
				httpMethod == "DELETE" || httpMethod == "PATCH" {
				
				route := models.OpenAPIRoute{
					Method:      httpMethod,
					Path:        path,
					Summary:     item.Summary,
					Description: item.Description,
					Responses:   make(map[int]models.Response),
				}

				for _, p := range item.Parameters {
					route.RequestParams = append(route.RequestParams, models.Param{
						Name:     p.Name,
						In:       p.In,
						Required: p.Required,
						Type:     p.Schema.Type,
					})
				}

				if item.RequestBody != nil {
					reqBody := models.RequestBody{
						Required: item.RequestBody.Required,
					}
					
					for _, mt := range item.RequestBody.Content {
						reqBody.Schema = convertSchema(mt.Schema, doc.Components.Schemas)
						break
					}
					route.RequestBody = &reqBody
				}

				for statusCode, resp := range item.Responses {
					status := parseStatusCode(statusCode)
					response := models.Response{
						Description: resp.Description,
					}
					
					for _, mt := range resp.Content {
						response.Schema = convertSchema(mt.Schema, doc.Components.Schemas)
						break
					}
					route.Responses[status] = response
				}

				routes = append(routes, route)
			}
		}
	}

	return routes, nil
}

func convertSchema(s schema, schemas map[string]schema) models.Schema {
	result := models.Schema{
		Type:     s.Type,
		Required: s.Required,
		Ref:      s.Ref,
	}

	if len(s.Properties) > 0 {
		result.Properties = make(map[string]models.Schema)
		for name, prop := range s.Properties {
			result.Properties[name] = convertSchema(prop, schemas)
		}
	}

	if s.Ref != "" {
		parts := strings.Split(s.Ref, "/")
		if len(parts) > 0 {
			schemaName := parts[len(parts)-1]
			if refSchema, exists := schemas[schemaName]; exists {
				result.Type = refSchema.Type
				result.Required = refSchema.Required
				if len(refSchema.Properties) > 0 {
					result.Properties = make(map[string]models.Schema)
					for name, prop := range refSchema.Properties {
						result.Properties[name] = convertSchema(prop, schemas)
					}
				}
			}
		}
	}

	return result
}

func parseStatusCode(code string) int {
	switch code {
	case "200", "default":
		return 200
	case "201":
		return 201
	case "204":
		return 204
	case "400":
		return 400
	case "401":
		return 401
	case "403":
		return 403
	case "404":
		return 404
	case "500":
		return 500
	default:
		return 200
	}
}
