package utils_test

import (
	"os"
	"path/filepath"
	"testing"

	"msctl/pkg/utils"
)

func TestFileExists(t *testing.T) {
	tmpDir := t.TempDir()

	testFile := filepath.Join(tmpDir, "test.txt")
	if utils.FileExists(testFile) {
		t.Error("FileExists should return false for non-existent file")
	}

	os.WriteFile(testFile, []byte("test"), 0644)
	if !utils.FileExists(testFile) {
		t.Error("FileExists should return true for existing file")
	}
}

func TestDirExists(t *testing.T) {
	tmpDir := t.TempDir()

	nonExistentDir := filepath.Join(tmpDir, "nonexistent")
	if utils.DirExists(nonExistentDir) {
		t.Error("DirExists should return false for non-existent directory")
	}

	if !utils.DirExists(tmpDir) {
		t.Error("DirExists should return true for existing directory")
	}
}

func TestEnsureDir(t *testing.T) {
	tmpDir := t.TempDir()

	newDir := filepath.Join(tmpDir, "subdir", "nested")
	if err := utils.EnsureDir(newDir); err != nil {
		t.Errorf("EnsureDir failed: %v", err)
	}

	if !utils.DirExists(newDir) {
		t.Error("EnsureDir should create the directory")
	}
}

func TestContains(t *testing.T) {
	tests := []struct {
		slice    []string
		item     string
		expected bool
	}{
		{[]string{"a", "b", "c"}, "b", true},
		{[]string{"a", "b", "c"}, "d", false},
		{[]string{}, "a", false},
	}

	for _, test := range tests {
		result := utils.Contains(test.slice, test.item)
		if result != test.expected {
			t.Errorf("Contains(%v, %q) = %v, expected %v", test.slice, test.item, result, test.expected)
		}
	}
}

func TestUnique(t *testing.T) {
	tests := []struct {
		input    []string
		expected []string
	}{
		{[]string{"a", "b", "a", "c", "b"}, []string{"a", "b", "c"}},
		{[]string{"a"}, []string{"a"}},
		{[]string{}, []string{}},
	}

	for _, test := range tests {
		result := utils.Unique(test.input)
		if len(result) != len(test.expected) {
			t.Errorf("Unique(%v) = %v, expected %v", test.input, result, test.expected)
		}
	}
}

func TestReadWriteYAML(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test.yaml")

	type TestData struct {
		Name  string `yaml:"name"`
		Value int    `yaml:"value"`
	}

	expected := TestData{Name: "test", Value: 42}

	if err := utils.WriteYAML(testFile, expected); err != nil {
		t.Errorf("WriteYAML failed: %v", err)
	}

	var actual TestData
	if err := utils.ReadYAML(testFile, &actual); err != nil {
		t.Errorf("ReadYAML failed: %v", err)
	}

	if actual.Name != expected.Name || actual.Value != expected.Value {
		t.Errorf("ReadYAML got %+v, expected %+v", actual, expected)
	}
}

func TestReadWriteJSON(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test.json")

	type TestData struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}

	expected := TestData{Name: "test", Value: 42}

	if err := utils.WriteJSON(testFile, expected, true); err != nil {
		t.Errorf("WriteJSON failed: %v", err)
	}

	var actual TestData
	if err := utils.ReadJSON(testFile, &actual); err != nil {
		t.Errorf("ReadJSON failed: %v", err)
	}

	if actual.Name != expected.Name || actual.Value != expected.Value {
		t.Errorf("ReadJSON got %+v, expected %+v", actual, expected)
	}
}

func TestReadWriteCSV(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test.csv")

	expected := [][]string{
		{"name", "value"},
		{"test1", "100"},
		{"test2", "200"},
	}

	if err := utils.WriteCSV(testFile, expected); err != nil {
		t.Errorf("WriteCSV failed: %v", err)
	}

	actual, err := utils.ReadCSV(testFile)
	if err != nil {
		t.Errorf("ReadCSV failed: %v", err)
	}

	if len(actual) != len(expected) {
		t.Errorf("ReadCSV got %d rows, expected %d", len(actual), len(expected))
	}
}
