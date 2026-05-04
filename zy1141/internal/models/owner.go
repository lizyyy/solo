package models

type Owner struct {
	ServiceName  string `csv:"service_name" json:"service_name"`
	Primary      string `csv:"primary" json:"primary"`
	Secondary    string `csv:"secondary" json:"secondary"`
	Team         string `csv:"team" json:"team"`
	SlackChannel string `csv:"slack_channel" json:"slack_channel"`
	Email        string `csv:"email" json:"email"`
}
