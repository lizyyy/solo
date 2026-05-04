package types

type Rules struct {
	CompatibilityChecks CompatibilityRules `yaml:"compatibility_checks"`
	PerformanceChecks   PerformanceRules   `yaml:"performance_checks"`
	IgnoredFields       []string           `yaml:"ignored_fields"`
	CustomMappings      []CustomMapping    `yaml:"custom_mappings"`
}

type CompatibilityRules struct {
	FieldDeletion      bool `yaml:"field_deletion"`
	FieldRenaming      bool `yaml:"field_renaming"`
	TypeNarrowing      bool `yaml:"type_narrowing"`
	RequiredFields     bool `yaml:"required_fields"`
	UnknownFields      bool `yaml:"unknown_fields"`
	DefaultValueDrift  bool `yaml:"default_value_drift"`
	EnumExtension      bool `yaml:"enum_extension"`
	TimestampPrecision bool `yaml:"timestamp_precision"`
	RepeatedChange     bool `yaml:"repeated_change"`
}

type PerformanceRules struct {
	CompareJSON       bool `yaml:"compare_json"`
	CompareProtobuf   bool `yaml:"compare_protobuf"`
	CompareMessagePack bool `yaml:"compare_msgpack"`
	SampleSize        int  `yaml:"sample_size"`
	Iterations        int  `yaml:"iterations"`
}

type CustomMapping struct {
	OldField     string `yaml:"old_field"`
	NewField     string `yaml:"new_field"`
	Transformation string `yaml:"transformation"`
}
