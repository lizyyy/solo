package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"visitor-pass/internal/config"
	"visitor-pass/internal/model"
)

type Claims struct {
	UserID   string      `json:"user_id"`
	Username string      `json:"username"`
	Role     model.Role  `json:"role"`
	jwt.RegisteredClaims
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	return string(bytes), err
}

func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func GenerateToken(userID string, username string, role model.Role) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

func ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

type Permission struct {
	CanCreate bool
	CanRead  bool
	CanUpdate bool
	CanDelete bool
	Fields  []string
}

var RolePermissions = map[model.Role]map[string]Permission{
	model.RoleDataEntry: {
		"appointment": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: false,
			Fields: []string{"id", "visitor_name", "license_plate", "visit_date", "visit_end_date", "status"},
		},
		"gate_record": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: false,
		},
		"plate_image": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: false,
		},
		"batch": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: false,
			CanDelete: false,
		},
		"reconciliation": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: false,
			CanDelete: false,
		},
		"audit": {
			CanCreate: false,
			CanRead:   false,
			CanUpdate: false,
			CanDelete: false,
		},
	},
	model.RoleReviewer: {
		"appointment": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: false,
			Fields: []string{"id", "visitor_name", "visitor_id_card", "license_plate", "visit_date", "visit_end_date", "status", "reviewed_by", "reviewed_at"},
		},
		"gate_record": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: false,
		},
		"plate_image": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: false,
		},
		"batch": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: false,
		},
		"reconciliation": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: false,
			CanDelete: false,
		},
		"audit": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: false,
			CanDelete: false,
		},
	},
	model.RoleSupervisor: {
		"appointment": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: true,
		},
		"gate_record": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: true,
		},
		"plate_image": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: true,
		},
		"batch": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: true,
		},
		"reconciliation": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: true,
		},
		"audit": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: false,
			CanDelete: false,
		},
		"user": {
			CanCreate: true,
			CanRead:   true,
			CanUpdate: true,
			CanDelete: true,
		},
	},
	model.RoleReadOnly: {
		"appointment": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: false,
			CanDelete: false,
			Fields: []string{"id", "visitor_name", "visit_date", "status"},
		},
		"gate_record": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: false,
			CanDelete: false,
		},
		"plate_image": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: false,
			CanDelete: false,
		},
		"batch": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: false,
			CanDelete: false,
		},
		"reconciliation": {
			CanCreate: false,
			CanRead:   true,
			CanUpdate: false,
			CanDelete: false,
		},
		"audit": {
			CanCreate: false,
			CanRead:   false,
			CanUpdate: false,
			CanDelete: false,
		},
	},
}

func HasPermission(role interface{}, resource string, action string) bool {
	r, ok := role.(model.Role)
	if !ok {
		return false
	}
	perm, ok := RolePermissions[r][resource]
	if !ok {
		return false
	}
	switch action {
	case "create":
		return perm.CanCreate
	case "read":
		return perm.CanRead
	case "update":
		return perm.CanUpdate
	case "delete":
		return perm.CanDelete
	}
	return false
}

func GetVisibleFields(role model.Role, resource string) []string {
	perm, ok := RolePermissions[role][resource]
	if !ok || len(perm.Fields) == 0 {
		return nil
	}
	return perm.Fields
}
