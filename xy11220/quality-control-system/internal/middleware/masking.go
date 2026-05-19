package middleware

import (
	"encoding/json"
	"reflect"
	"strings"

	"github.com/gin-gonic/gin"
)

type MaskingMiddleware struct {
	maskPhone    bool
	maskIDCard   bool
	sensitiveMap map[string]bool
}

func NewMaskingMiddleware() *MaskingMiddleware {
	return &MaskingMiddleware{
		maskPhone:  true,
		maskIDCard: true,
		sensitiveMap: map[string]bool{
			"phone":       true,
			"mobile":      true,
			"id_card":     true,
			"idcard":      true,
			"email":       true,
			"keeperphone": true,
			"operatorphone": true,
			"checkerphone": true,
			"inspectorphone": true,
			"managerphone": true,
		},
	}
}

func (m *MaskingMiddleware) MaskResponse() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		body, exists := c.Get("response_body")
		if !exists {
			return
		}

		masked := m.maskValue(body)
		c.Set("response_body", masked)
	}
}

func (m *MaskingMiddleware) maskValue(value interface{}) interface{} {
	if value == nil {
		return nil
	}

	v := reflect.ValueOf(value)
	switch v.Kind() {
	case reflect.Map:
		return m.maskMap(value.(map[string]interface{}))
	case reflect.Slice, reflect.Array:
		return m.maskSlice(value)
	case reflect.Struct:
		jsonData, _ := json.Marshal(value)
		var mapData map[string]interface{}
		json.Unmarshal(jsonData, &mapData)
		return m.maskMap(mapData)
	case reflect.Ptr:
		if v.IsNil() {
			return nil
		}
		return m.maskValue(v.Elem().Interface())
	default:
		return value
	}
}

func (m *MaskingMiddleware) maskMap(data map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for key, value := range data {
		lowerKey := strings.ToLower(key)
		if m.sensitiveMap[lowerKey] {
			if strVal, ok := value.(string); ok {
				result[key] = m.maskString(strVal, lowerKey)
			} else {
				result[key] = value
			}
		} else {
			result[key] = m.maskValue(value)
		}
	}
	return result
}

func (m *MaskingMiddleware) maskSlice(data interface{}) interface{} {
	v := reflect.ValueOf(data)
	result := make([]interface{}, v.Len())
	for i := 0; i < v.Len(); i++ {
		result[i] = m.maskValue(v.Index(i).Interface())
	}
	return result
}

func (m *MaskingMiddleware) maskString(value string, fieldType string) string {
	if len(value) == 0 {
		return value
	}

	if fieldType == "phone" || fieldType == "mobile" ||
		strings.Contains(fieldType, "phone") {
		if len(value) >= 11 {
			return value[:3] + "****" + value[7:]
		}
		if len(value) > 4 {
			return value[:2] + "****" + value[len(value)-2:]
		}
		return "****"
	}

	if fieldType == "id_card" || fieldType == "idcard" {
		if len(value) >= 18 {
			return value[:6] + "********" + value[14:]
		}
		if len(value) > 8 {
			return value[:3] + "****" + value[len(value)-3:]
		}
		return "****"
	}

	if fieldType == "email" {
		parts := strings.Split(value, "@")
		if len(parts) == 2 {
			username := parts[0]
			if len(username) > 3 {
				return username[:2] + "****@" + parts[1]
			}
			return "****@" + parts[1]
		}
	}

	if len(value) > 6 {
		return value[:2] + "****" + value[len(value)-2:]
	}
	return "****"
}

func ResponseCaptureMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}
