package store

import (
	"path/filepath"
	"testing"
)

func TestLocalStore_SaveAndLoad(t *testing.T) {
	tmpDir := t.TempDir()
	storePath := filepath.Join(tmpDir, "store.json")

	s := NewLocalStore(storePath)

	data := &SnapshotData{
		Users: map[string]interface{}{
			"user-1": map[string]interface{}{"name": "Otavio"},
		},
		Rooms: map[string]interface{}{
			"room-1": map[string]interface{}{"name": "PORChat VIP"},
		},
		Messages: map[string][]interface{}{
			"room-1": {
				map[string]interface{}{"content": "Hello!"},
			},
		},
	}

	if err := s.Save(data); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	var loaded SnapshotData
	ok, err := s.Load(&loaded)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if !ok {
		t.Fatalf("Load returned false")
	}

	if len(loaded.Users) != 1 || len(loaded.Rooms) != 1 {
		t.Errorf("Unexpected loaded data: users=%d, rooms=%d", len(loaded.Users), len(loaded.Rooms))
	}
}

func TestLocalStore_LoadNonExistent(t *testing.T) {
	tmpDir := t.TempDir()
	storePath := filepath.Join(tmpDir, "non_existent.json")

	s := NewLocalStore(storePath)

	var loaded SnapshotData
	ok, err := s.Load(&loaded)
	if err != nil {
		t.Fatalf("Expected nil err for non-existent file, got: %v", err)
	}
	if ok {
		t.Errorf("Expected false for non-existent file, got true")
	}
}
