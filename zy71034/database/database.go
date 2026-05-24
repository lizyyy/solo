package database

import (
	"prescription-timeline/config"
	"prescription-timeline/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init(cfg *config.Config) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(cfg.DBPath), &gorm.Config{})
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(
		&models.Patient{},
		&models.Consultation{},
		&models.Prescription{},
		&models.PharmacistReview{},
		&models.DrugDispensation{},
		&models.PrescriptionReport{},
		&models.SupplementRecord{},
		&models.ProcessingLog{},
	)
	if err != nil {
		return err
	}

	return nil
}

func CreatePatient(patient *models.Patient) error {
	return DB.Create(patient).Error
}

func GetPatientByID(id string) (*models.Patient, error) {
	var patient models.Patient
	err := DB.First(&patient, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &patient, nil
}

func CreateConsultation(consultation *models.Consultation) error {
	return DB.Create(consultation).Error
}

func GetConsultationByID(id string) (*models.Consultation, error) {
	var consultation models.Consultation
	err := DB.First(&consultation, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &consultation, nil
}

func CreatePrescription(prescription *models.Prescription) error {
	return DB.Create(prescription).Error
}

func GetPrescriptionByID(id string) (*models.Prescription, error) {
	var prescription models.Prescription
	err := DB.First(&prescription, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &prescription, nil
}

func UpdatePrescription(prescription *models.Prescription) error {
	return DB.Save(prescription).Error
}

func ListPrescriptions(status string) ([]models.Prescription, error) {
	var prescriptions []models.Prescription
	query := DB
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Find(&prescriptions).Error
	return prescriptions, err
}

func CreatePharmacistReview(review *models.PharmacistReview) error {
	return DB.Create(review).Error
}

func GetReviewsByPrescriptionID(prescriptionID string) ([]models.PharmacistReview, error) {
	var reviews []models.PharmacistReview
	err := DB.Where("prescription_id = ?", prescriptionID).Order("review_time desc").Find(&reviews).Error
	return reviews, err
}

func CreateDrugDispensation(dispensation *models.DrugDispensation) error {
	return DB.Create(dispensation).Error
}

func GetDispensationsByPrescriptionID(prescriptionID string) ([]models.DrugDispensation, error) {
	var dispensations []models.DrugDispensation
	err := DB.Where("prescription_id = ?", prescriptionID).Order("dispensation_time desc").Find(&dispensations).Error
	return dispensations, err
}

func CountDispensations(prescriptionID string) (int64, error) {
	var count int64
	err := DB.Model(&models.DrugDispensation{}).Where("prescription_id = ? AND intercepted = ?", prescriptionID, false).Count(&count).Error
	return count, err
}

func CreatePrescriptionReport(report *models.PrescriptionReport) error {
	return DB.Create(report).Error
}

func GetReportByPrescriptionID(prescriptionID string) (*models.PrescriptionReport, error) {
	var report models.PrescriptionReport
	err := DB.Where("prescription_id = ?", prescriptionID).First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func UpdatePrescriptionReport(report *models.PrescriptionReport) error {
	return DB.Save(report).Error
}

func CreateSupplementRecord(record *models.SupplementRecord) error {
	return DB.Create(record).Error
}

func GetSupplementsByPrescriptionID(prescriptionID string) ([]models.SupplementRecord, error) {
	var records []models.SupplementRecord
	err := DB.Where("prescription_id = ?", prescriptionID).Order("supplement_time desc").Find(&records).Error
	return records, err
}

func CreateProcessingLog(log *models.ProcessingLog) error {
	return DB.Create(log).Error
}

func GetLogsByPrescriptionID(prescriptionID string) ([]models.ProcessingLog, error) {
	var logs []models.ProcessingLog
	err := DB.Where("prescription_id = ?", prescriptionID).Order("created_at desc").Find(&logs).Error
	return logs, err
}

func GetReportByID(id string) (*models.PrescriptionReport, error) {
	var report models.PrescriptionReport
	err := DB.First(&report, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func ListReports(closedOnly bool) ([]models.PrescriptionReport, error) {
	var reports []models.PrescriptionReport
	query := DB
	if closedOnly {
		query = query.Where("closed_at IS NOT NULL")
	}
	err := query.Order("created_at desc").Find(&reports).Error
	return reports, err
}
