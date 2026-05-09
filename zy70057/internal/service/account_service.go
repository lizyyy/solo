package service

import (
	"fmt"

	"fundservice/internal/db"
	"fundservice/internal/model"
)

type CreateAccountRequest struct {
	Code        string `json:"code" binding:"required"`
	Name        string `json:"name" binding:"required"`
	ParentCode  string `json:"parent_code"`
	CompanyType string `json:"company_type" binding:"required"`
}

func CreateAccount(req *CreateAccountRequest) (*model.Account, error) {
	if req.CompanyType != model.AccountTypeHeadquarters && 
	   req.CompanyType != model.AccountTypeBranch && 
	   req.CompanyType != model.AccountTypeSubsidiary {
		return nil, fmt.Errorf("invalid company_type: %s", req.CompanyType)
	}

	existing, err := db.GetAccountByCode(req.Code)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("account with code %s already exists", req.Code)
	}

	parentID := model.NullString("")
	var level = 1
	if req.ParentCode != "" {
		parent, err := db.GetAccountByCode(req.ParentCode)
		if err != nil {
			return nil, err
		}
		if parent == nil {
			return nil, fmt.Errorf("parent account %s not found", req.ParentCode)
		}
		parentID = model.NullString(parent.ID)
		level = parent.Level + 1
	}

	acc := &model.Account{
		ID:          model.NewUUID(),
		Code:        req.Code,
		Name:        req.Name,
		ParentID:    parentID,
		Level:       level,
		CompanyType: req.CompanyType,
		Status:      model.AccountStatusActive,
	}

	if err := db.CreateAccount(acc); err != nil {
		return nil, err
	}

	return acc, nil
}

func GetAccountTree() (map[string]interface{}, error) {
	accounts, err := db.GetAllAccounts()
	if err != nil {
		return nil, err
	}

	childrenMap := make(map[string][]*model.Account)
	for _, acc := range accounts {
		parentID := acc.GetParentID()
		if parentID != "" {
			childrenMap[parentID] = append(childrenMap[parentID], acc)
		}
	}

	type TreeNode struct {
		ID          string      `json:"id"`
		Code        string      `json:"code"`
		Name        string      `json:"name"`
		ParentID    string      `json:"parent_id"`
		Level       int         `json:"level"`
		CompanyType string      `json:"company_type"`
		Status      string      `json:"status"`
		Children    []*TreeNode `json:"children"`
	}

	var buildTree func(parentID string) []*TreeNode
	buildTree = func(parentID string) []*TreeNode {
		var nodes []*TreeNode
		for _, acc := range childrenMap[parentID] {
			node := &TreeNode{
				ID:          acc.ID,
				Code:        acc.Code,
				Name:        acc.Name,
				ParentID:    acc.GetParentID(),
				Level:       acc.Level,
				CompanyType: acc.CompanyType,
				Status:      acc.Status,
				Children:    buildTree(acc.ID),
			}
			nodes = append(nodes, node)
		}
		return nodes
	}

	var roots []*TreeNode
	for _, acc := range accounts {
		if !acc.HasParent() {
			node := &TreeNode{
				ID:          acc.ID,
				Code:        acc.Code,
				Name:        acc.Name,
				ParentID:    acc.GetParentID(),
				Level:       acc.Level,
				CompanyType: acc.CompanyType,
				Status:      acc.Status,
				Children:    buildTree(acc.ID),
			}
			roots = append(roots, node)
		}
	}

	type FlatAccount struct {
		ID          string `json:"id"`
		Code        string `json:"code"`
		Name        string `json:"name"`
		ParentID    string `json:"parent_id"`
		Level       int    `json:"level"`
		CompanyType string `json:"company_type"`
		Status      string `json:"status"`
	}

	var flatAccounts []*FlatAccount
	for _, acc := range accounts {
		flatAccounts = append(flatAccounts, &FlatAccount{
			ID:          acc.ID,
			Code:        acc.Code,
			Name:        acc.Name,
			ParentID:    acc.GetParentID(),
			Level:       acc.Level,
			CompanyType: acc.CompanyType,
			Status:      acc.Status,
		})
	}

	return map[string]interface{}{
		"accounts": flatAccounts,
		"tree":     roots,
	}, nil
}
