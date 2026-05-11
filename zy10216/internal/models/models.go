package models

type Equipment struct {
	ID           string   `yaml:"id"`
	Name         string   `yaml:"name"`
	Type         string   `yaml:"type"`
	Deposit      float64  `yaml:"deposit"`
	DailyRate    float64  `yaml:"daily_rate"`
	Accessories  []string `yaml:"accessories"`
	IsAvailable  bool     `yaml:"is_available"`
	CreatedAt    string   `yaml:"created_at"`
	UpdatedAt    string   `yaml:"updated_at"`
}

type Renter struct {
	ID        string `yaml:"id"`
	Name      string `yaml:"name"`
	Phone     string `yaml:"phone"`
	Email     string `yaml:"email"`
	Notes     string `yaml:"notes"`
	CreatedAt string `yaml:"created_at"`
}

type CheckItem struct {
	Name    string `yaml:"name"`
	IsGood  bool   `yaml:"is_good"`
	Comment string `yaml:"comment"`
}

type Rental struct {
	ID                 string      `yaml:"id"`
	EquipmentID        string      `yaml:"equipment_id"`
	EquipmentName      string      `yaml:"equipment_name"`
	RenterID           string      `yaml:"renter_id"`
	RenterName         string      `yaml:"renter_name"`
	RenterPhone        string      `yaml:"renter_phone"`
	RentalStart        string      `yaml:"rental_start"`
	RentalEnd          string      `yaml:"rental_end"`
	ActualReturn       string      `yaml:"actual_return,omitempty"`
	DepositPaid        float64     `yaml:"deposit_paid"`
	DailyRate          float64     `yaml:"daily_rate"`
	AccessoriesOut     []string    `yaml:"accessories_out"`
	OutChecklist       []CheckItem `yaml:"out_checklist"`
	OutVerified        bool        `yaml:"out_verified"`
	AccessoriesBack    []string    `yaml:"accessories_back,omitempty"`
	InChecklist        []CheckItem `yaml:"in_checklist,omitempty"`
	InVerified         bool        `yaml:"in_verified,omitempty"`
	IsReturned         bool        `yaml:"is_returned"`
	IsCompensated      bool        `yaml:"is_compensated"`
	CompensationAmount float64     `yaml:"compensation_amount,omitempty"`
	CompensationNote   string      `yaml:"compensation_note,omitempty"`
	OverdueDays        int         `yaml:"overdue_days,omitempty"`
	OverdueFee         float64     `yaml:"overdue_fee,omitempty"`
	MissingAccessories []string    `yaml:"missing_accessories,omitempty"`
	MissingFee         float64     `yaml:"missing_fee,omitempty"`
	RefundAmount       float64     `yaml:"refund_amount,omitempty"`
	FinalBalance       float64     `yaml:"final_balance,omitempty"`
	Status             string      `yaml:"status"`
	CreatedAt          string      `yaml:"created_at"`
	UpdatedAt          string      `yaml:"updated_at"`
}

type DisputeRecord struct {
	ID            string `yaml:"id"`
	RentalID      string `yaml:"rental_id"`
	EquipmentName string `yaml:"equipment_name"`
	RenterName    string `yaml:"renter_name"`
	IssueType     string `yaml:"issue_type"`
	Description   string `yaml:"description"`
	Resolution    string `yaml:"resolution"`
	Amount        float64 `yaml:"amount"`
	Timestamp     string `yaml:"timestamp"`
}

type Database struct {
	Equipments   []Equipment     `yaml:"equipments"`
	Renters      []Renter        `yaml:"renters"`
	Rentals      []Rental        `yaml:"rentals"`
	Disputes     []DisputeRecord `yaml:"disputes"`
	LastModified string          `yaml:"last_modified"`
}
