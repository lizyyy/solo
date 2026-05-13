package scanner

import (
	"encoding/json"
	"io/ioutil"
	"path/filepath"
	"strings"

	"github.com/example/api-doc-coverage/cli/pkg/models"
)

func ScanExamples(dir string) ([]models.ExampleRequest, error) {
	var examples []models.ExampleRequest

	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	for _, f := range files {
		if f.IsDir() {
			continue
		}

		ext := strings.ToLower(filepath.Ext(f.Name()))
		if ext != ".json" {
			continue
		}

		path := filepath.Join(dir, f.Name())
		data, err := ioutil.ReadFile(path)
		if err != nil {
			return nil, err
		}

		data = []byte(strings.TrimSpace(string(data)))

		if len(data) > 0 && data[0] == '[' {
			var exList []models.ExampleRequest
			err = json.Unmarshal(data, &exList)
			if err != nil {
				return nil, err
			}
			examples = append(examples, exList...)
		} else {
			var ex models.ExampleRequest
			err = json.Unmarshal(data, &ex)
			if err != nil {
				return nil, err
			}
			examples = append(examples, ex)
		}
	}

	return examples, nil
}
