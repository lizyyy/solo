package models

type ImportedData struct {
	Jobs       []*Job
	Workers    []*Worker
	Events     []*QueueEvent
	Config     *FullConfig
	QueueNames []string
	JobTypes   []string
}
