package repository

import (
	"presigned-link-governance/config"
	"presigned-link-governance/model"
	"time"
)

type FileRepository struct{}

func NewFileRepository() *FileRepository {
	return &FileRepository{}
}

func (r *FileRepository) Create(file *model.FileObject) error {
	return config.DB.Create(file).Error
}

func (r *FileRepository) GetByID(id string) (*model.FileObject, error) {
	var file model.FileObject
	err := config.DB.First(&file, "id = ?", id).Error
	return &file, err
}

func (r *FileRepository) List() ([]model.FileObject, error) {
	var files []model.FileObject
	err := config.DB.Find(&files).Error
	return files, err
}

type IssuerRepository struct{}

func NewIssuerRepository() *IssuerRepository {
	return &IssuerRepository{}
}

func (r *IssuerRepository) Create(issuer *model.Issuer) error {
	return config.DB.Create(issuer).Error
}

func (r *IssuerRepository) GetByID(id string) (*model.Issuer, error) {
	var issuer model.Issuer
	err := config.DB.First(&issuer, "id = ?", id).Error
	return &issuer, err
}

func (r *IssuerRepository) GetByEmail(email string) (*model.Issuer, error) {
	var issuer model.Issuer
	err := config.DB.First(&issuer, "email = ?", email).Error
	return &issuer, err
}

func (r *IssuerRepository) List() ([]model.Issuer, error) {
	var issuers []model.Issuer
	err := config.DB.Find(&issuers).Error
	return issuers, err
}

type LinkRepository struct{}

func NewLinkRepository() *LinkRepository {
	return &LinkRepository{}
}

func (r *LinkRepository) Create(link *model.PresignedLink) error {
	return config.DB.Create(link).Error
}

func (r *LinkRepository) GetByID(id string) (*model.PresignedLink, error) {
	var link model.PresignedLink
	err := config.DB.Preload("File").Preload("Issuer").First(&link, "id = ?", id).Error
	return &link, err
}

func (r *LinkRepository) GetByToken(token string) (*model.PresignedLink, error) {
	var link model.PresignedLink
	err := config.DB.Preload("File").Preload("Issuer").First(&link, "token = ?", token).Error
	return &link, err
}

func (r *LinkRepository) GetByIdempotencyKey(key string) (*model.PresignedLink, error) {
	var link model.PresignedLink
	err := config.DB.First(&link, "idempotency_key = ?", key).Error
	return &link, err
}

func (r *LinkRepository) Update(link *model.PresignedLink) error {
	return config.DB.Save(link).Error
}

func (r *LinkRepository) ListByIssuer(issuerID string) ([]model.PresignedLink, error) {
	var links []model.PresignedLink
	err := config.DB.Preload("File").Where("issuer_id = ?", issuerID).Find(&links).Error
	return links, err
}

func (r *LinkRepository) ListByFile(fileID string) ([]model.PresignedLink, error) {
	var links []model.PresignedLink
	err := config.DB.Preload("Issuer").Where("file_id = ?", fileID).Find(&links).Error
	return links, err
}

func (r *LinkRepository) ListAll() ([]model.PresignedLink, error) {
	var links []model.PresignedLink
	err := config.DB.Preload("File").Preload("Issuer").Find(&links).Error
	return links, err
}

func (r *LinkRepository) ListExpired(now time.Time) ([]model.PresignedLink, error) {
	var links []model.PresignedLink
	err := config.DB.Where("expires_at < ? AND status = ?", now, model.LinkStatusActive).Find(&links).Error
	return links, err
}

type AccessLogRepository struct{}

func NewAccessLogRepository() *AccessLogRepository {
	return &AccessLogRepository{}
}

func (r *AccessLogRepository) Create(log *model.AccessLog) error {
	return config.DB.Create(log).Error
}

func (r *AccessLogRepository) GetByLinkID(linkID string, limit int) ([]model.AccessLog, error) {
	var logs []model.AccessLog
	err := config.DB.Where("link_id = ?", linkID).Order("access_time desc").Limit(limit).Find(&logs).Error
	return logs, err
}

func (r *AccessLogRepository) List(limit, offset int) ([]model.AccessLog, error) {
	var logs []model.AccessLog
	err := config.DB.Preload("Link").Order("access_time desc").Limit(limit).Offset(offset).Find(&logs).Error
	return logs, err
}

func (r *AccessLogRepository) Count() (int64, error) {
	var count int64
	err := config.DB.Model(&model.AccessLog{}).Count(&count).Error
	return count, err
}
