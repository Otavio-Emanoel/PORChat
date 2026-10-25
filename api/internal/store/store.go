package store

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
)

type SnapshotData struct {
	Users    map[string]interface{}   `json:"users"`
	Rooms    map[string]interface{}   `json:"rooms"`
	Messages map[string][]interface{} `json:"messages"`
}

type LocalStore struct {
	mu       sync.Mutex
	filePath string
}

func NewLocalStore(customPath string) *LocalStore {
	path := customPath
	if path == "" {
		path = os.Getenv("DATA_STORE_PATH")
	}
	if path == "" {
		path = "data/store.json"
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("[LocalStore] Warning: could not create dir %s: %v", dir, err)
	}

	return &LocalStore{
		filePath: path,
	}
}

func (s *LocalStore) Save(data *SnapshotData) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	tmpFile := s.filePath + ".tmp"
	if err := os.WriteFile(tmpFile, bytes, 0644); err != nil {
		return err
	}

	return os.Rename(tmpFile, s.filePath)
}

func (s *LocalStore) Load(target interface{}) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return false, nil
	}

	bytes, err := os.ReadFile(s.filePath)
	if err != nil {
		return false, err
	}

	if err := json.Unmarshal(bytes, target); err != nil {
		return false, err
	}

	return true, nil
}
