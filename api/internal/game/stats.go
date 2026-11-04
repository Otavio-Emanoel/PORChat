package game

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/porchat/api/internal/chat"
	"github.com/porchat/api/internal/ws"
)

type PlayerCareerStats struct {
	UserID              string  `json:"user_id"`
	Nickname            string  `json:"nickname"`
	TotalPoints         int     `json:"total_points"`
	MatchesPlayed       int     `json:"matches_played"`
	DebatesPlayed       int     `json:"debates_played"`
	DebatesWon          int     `json:"debates_won"`
	DebateVotesReceived int     `json:"debate_votes_received"`
	QuizzesPlayed       int     `json:"quizzes_played"`
	QuizWins            int     `json:"quiz_wins"`
	CorrectAnswers      int     `json:"correct_answers"`
	TotalAnswers        int     `json:"total_answers"`
	AccuracyPercent     float64 `json:"accuracy_percent"`
	BestStreak          int     `json:"best_streak"`
	FastestAnswerMs     int64   `json:"fastest_answer_ms"`
	UpdatedAt           string  `json:"updated_at"`
}

type RoomLeaderboardEntry struct {
	Rank            int     `json:"rank"`
	UserID          string  `json:"user_id"`
	Nickname        string  `json:"nickname"`
	TotalPoints     int     `json:"total_points"`
	DebatesWon      int     `json:"debates_won"`
	QuizWins        int     `json:"quiz_wins"`
	MatchesPlayed   int     `json:"matches_played"`
	BestStreak      int     `json:"best_streak"`
	AccuracyPercent float64 `json:"accuracy_percent"`
}

type MatchScoreSummary struct {
	Nickname string `json:"nickname"`
	Score    int    `json:"score"`
}

type MatchHistoryRecord struct {
	ID                string              `json:"id"`
	RoomID            string              `json:"room_id"`
	GameType          string              `json:"game_type"` // "debate" or "quiz"
	Title             string              `json:"title"`
	Category          string              `json:"category"`
	WinnerID          string              `json:"winner_id"`
	WinnerNickname    string              `json:"winner_nickname"`
	RunnerUpNickname  string              `json:"runner_up_nickname,omitempty"`
	Summary           string              `json:"summary"`
	ParticipantsCount int                 `json:"participants_count"`
	TopScores         []MatchScoreSummary `json:"top_scores,omitempty"`
	PlayedAt          string              `json:"played_at"`
}

type QuizPlayerRoundStats struct {
	UserID          string
	Nickname        string
	TotalScore      int
	CorrectAnswers  int
	TotalAnswers    int
	BestStreak      int
	FastestAnswerMs int64
}

type StatsStore struct {
	mu          sync.RWMutex
	globalStats map[string]*PlayerCareerStats            // lowercase nickname or userID -> stats
	roomStats   map[string]map[string]*PlayerCareerStats // roomID -> lowercase key -> stats
	roomHistory map[string][]*MatchHistoryRecord         // roomID -> match history (newest last)
	filePath    string
	chatStore   *chat.RoomStore
	hub         *ws.Hub
}

func NewStatsStore(filePath string, chatStore *chat.RoomStore, hub *ws.Hub) *StatsStore {
	if filePath == "" {
		filePath = "data/game_stats.json"
	}
	s := &StatsStore{
		globalStats: make(map[string]*PlayerCareerStats),
		roomStats:   make(map[string]map[string]*PlayerCareerStats),
		roomHistory: make(map[string][]*MatchHistoryRecord),
		filePath:    filePath,
		chatStore:   chatStore,
		hub:         hub,
	}
	if !s.LoadFromDisk(filePath) {
		s.seedInitialStats()
	}
	return s
}

func normalizePlayerKey(idOrNick string) string {
	return strings.ToLower(strings.TrimSpace(idOrNick))
}

func (s *StatsStore) seedInitialStats() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().Format(time.RFC3339)
	defaultRoomID := "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
	s.roomStats[defaultRoomID] = make(map[string]*PlayerCareerStats)

	founders := []*PlayerCareerStats{
		{
			UserID:              "Otavio",
			Nickname:            "Otavio",
			TotalPoints:         4250,
			MatchesPlayed:       6,
			DebatesPlayed:       3,
			DebatesWon:          2,
			DebateVotesReceived: 11,
			QuizzesPlayed:       3,
			QuizWins:            2,
			CorrectAnswers:      13,
			TotalAnswers:        15,
			AccuracyPercent:     86.7,
			BestStreak:          5,
			FastestAnswerMs:     1420,
			UpdatedAt:           now,
		},
		{
			UserID:              "Pedro",
			Nickname:            "Pedro",
			TotalPoints:         3890,
			MatchesPlayed:       6,
			DebatesPlayed:       3,
			DebatesWon:          1,
			DebateVotesReceived: 9,
			QuizzesPlayed:       3,
			QuizWins:            1,
			CorrectAnswers:      12,
			TotalAnswers:        15,
			AccuracyPercent:     80.0,
			BestStreak:          4,
			FastestAnswerMs:     1680,
			UpdatedAt:           now,
		},
		{
			UserID:              "Raul",
			Nickname:            "Raul",
			TotalPoints:         3640,
			MatchesPlayed:       5,
			DebatesPlayed:       2,
			DebatesWon:          1,
			DebateVotesReceived: 7,
			QuizzesPlayed:       3,
			QuizWins:            1,
			CorrectAnswers:      11,
			TotalAnswers:        15,
			AccuracyPercent:     73.3,
			BestStreak:          3,
			FastestAnswerMs:     1510,
			UpdatedAt:           now,
		},
	}

	for _, f := range founders {
		key := normalizePlayerKey(f.Nickname)
		copyGlobal := *f
		copyRoom := *f
		s.globalStats[key] = &copyGlobal
		s.roomStats[defaultRoomID][key] = &copyRoom
	}

	s.roomHistory[defaultRoomID] = []*MatchHistoryRecord{
		{
			ID:                uuid.New().String(),
			RoomID:            defaultRoomID,
			GameType:          "debate",
			Title:             "Monolito bem feito vs Arquitetura de Microsserviços",
			Category:          "Tech",
			WinnerID:          "Otavio",
			WinnerNickname:    "Otavio",
			RunnerUpNickname:  "Pedro",
			Summary:           "Otavio venceu o debate 'Monolito bem feito vs Arquitetura de Microsserviços' por 4 votos a 2.",
			ParticipantsCount: 6,
			TopScores: []MatchScoreSummary{
				{Nickname: "Otavio", Score: 600},
				{Nickname: "Pedro", Score: 250},
			},
			PlayedAt: time.Now().Add(-2 * time.Hour).Format(time.RFC3339),
		},
		{
			ID:                uuid.New().String(),
			RoomID:            defaultRoomID,
			GameType:          "quiz",
			Title:             "Quiz Relâmpago — Tecnologia",
			Category:          "Tecnologia",
			WinnerID:          "Pedro",
			WinnerNickname:    "Pedro",
			RunnerUpNickname:  "Raul",
			Summary:           "Pedro conquistou o 1º lugar no Quiz Relâmpago (Tecnologia) com 3.420 pts.",
			ParticipantsCount: 3,
			TopScores: []MatchScoreSummary{
				{Nickname: "Pedro", Score: 3420},
				{Nickname: "Raul", Score: 2980},
				{Nickname: "Otavio", Score: 2750},
			},
			PlayedAt: time.Now().Add(-1 * time.Hour).Format(time.RFC3339),
		},
	}
}

func (s *StatsStore) SaveToDisk(filePath string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data := struct {
		GlobalStats map[string]*PlayerCareerStats            `json:"global_stats"`
		RoomStats   map[string]map[string]*PlayerCareerStats `json:"room_stats"`
		RoomHistory map[string][]*MatchHistoryRecord         `json:"room_history"`
	}{
		GlobalStats: s.globalStats,
		RoomStats:   s.roomStats,
		RoomHistory: s.roomHistory,
	}

	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	_ = os.MkdirAll(filepath.Dir(filePath), 0755)
	tmpPath := filePath + ".tmp"
	if err := os.WriteFile(tmpPath, bytes, 0644); err != nil {
		return err
	}
	return os.Rename(tmpPath, filePath)
}

func (s *StatsStore) LoadFromDisk(filePath string) bool {
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		return false
	}

	var data struct {
		GlobalStats map[string]*PlayerCareerStats            `json:"global_stats"`
		RoomStats   map[string]map[string]*PlayerCareerStats `json:"room_stats"`
		RoomHistory map[string][]*MatchHistoryRecord         `json:"room_history"`
	}
	if err := json.Unmarshal(bytes, &data); err != nil {
		return false
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if data.GlobalStats != nil {
		s.globalStats = data.GlobalStats
	}
	if data.RoomStats != nil {
		s.roomStats = data.RoomStats
	}
	if data.RoomHistory != nil {
		s.roomHistory = data.RoomHistory
	}
	return len(s.globalStats) > 0
}

func (s *StatsStore) getOrCreatePlayerLocked(roomID, userID, nickname string) (*PlayerCareerStats, *PlayerCareerStats) {
	displayNick := strings.TrimSpace(nickname)
	if displayNick == "" {
		displayNick = strings.TrimSpace(userID)
	}
	key := normalizePlayerKey(displayNick)
	if key == "" {
		key = normalizePlayerKey(userID)
	}

	now := time.Now().Format(time.RFC3339)
	gStat, ok := s.globalStats[key]
	if !ok {
		gStat = &PlayerCareerStats{
			UserID:    userID,
			Nickname:  displayNick,
			UpdatedAt: now,
		}
		s.globalStats[key] = gStat
	} else if displayNick != "" {
		gStat.Nickname = displayNick
	}

	if s.roomStats[roomID] == nil {
		s.roomStats[roomID] = make(map[string]*PlayerCareerStats)
	}
	rStat, ok := s.roomStats[roomID][key]
	if !ok {
		rStat = &PlayerCareerStats{
			UserID:    userID,
			Nickname:  displayNick,
			UpdatedAt: now,
		}
		s.roomStats[roomID][key] = rStat
	} else if displayNick != "" {
		rStat.Nickname = displayNick
	}

	return gStat, rStat
}

func recomputeAccuracy(stat *PlayerCareerStats) {
	if stat.TotalAnswers > 0 {
		acc := (float64(stat.CorrectAnswers) / float64(stat.TotalAnswers)) * 100.0
		stat.AccuracyPercent = math.Round(acc*10) / 10
	}
	stat.UpdatedAt = time.Now().Format(time.RFC3339)
}

// RecordDebateMatch updates player career stats, room rankings, match history, and posts a game summary card to the room chat.
func (s *StatsStore) RecordDebateMatch(roomID string, state *DebateState) *MatchHistoryRecord {
	if state == nil || state.DebaterA == nil || state.DebaterB == nil {
		return nil
	}

	s.mu.Lock()
	votesA := state.VotesCount["side_a"]
	votesB := state.VotesCount["side_b"]

	pointsA := 200 + (votesA * 100)
	pointsB := 200 + (votesB * 100)
	winnerID := "tie"
	winnerNick := "Empate Técnico"
	runnerUpNick := ""

	if state.WinnerSide == "side_a" || votesA > votesB {
		pointsA += 350
		winnerID = state.DebaterA.ID
		winnerNick = state.DebaterA.Nickname
		runnerUpNick = state.DebaterB.Nickname
	} else if state.WinnerSide == "side_b" || votesB > votesA {
		pointsB += 350
		winnerID = state.DebaterB.ID
		winnerNick = state.DebaterB.Nickname
		runnerUpNick = state.DebaterA.Nickname
	} else {
		pointsA += 150
		pointsB += 150
	}

	// Update Debater A
	gA, rA := s.getOrCreatePlayerLocked(roomID, state.DebaterA.ID, state.DebaterA.Nickname)
	for _, st := range []*PlayerCareerStats{gA, rA} {
		st.MatchesPlayed++
		st.DebatesPlayed++
		st.TotalPoints += pointsA
		st.DebateVotesReceived += votesA
		if winnerID == state.DebaterA.ID {
			st.DebatesWon++
		}
		recomputeAccuracy(st)
	}

	// Update Debater B
	gB, rB := s.getOrCreatePlayerLocked(roomID, state.DebaterB.ID, state.DebaterB.Nickname)
	for _, st := range []*PlayerCareerStats{gB, rB} {
		st.MatchesPlayed++
		st.DebatesPlayed++
		st.TotalPoints += pointsB
		st.DebateVotesReceived += votesB
		if winnerID == state.DebaterB.ID {
			st.DebatesWon++
		}
		recomputeAccuracy(st)
	}

	category := state.Category
	if category == "" {
		category = "Debate"
	}

	summary := fmt.Sprintf("Resultado do Tribunal: %s (%d votos) vs %s (%d votos) em '%s'. Vencedor: %s.",
		state.DebaterA.Nickname, votesA, state.DebaterB.Nickname, votesB, state.Topic, winnerNick)

	rec := &MatchHistoryRecord{
		ID:                uuid.New().String(),
		RoomID:            roomID,
		GameType:          "debate",
		Title:             state.Topic,
		Category:          category,
		WinnerID:          winnerID,
		WinnerNickname:    winnerNick,
		RunnerUpNickname:  runnerUpNick,
		Summary:           summary,
		ParticipantsCount: 2 + len(state.JurorIDs),
		TopScores: []MatchScoreSummary{
			{Nickname: state.DebaterA.Nickname, Score: pointsA},
			{Nickname: state.DebaterB.Nickname, Score: pointsB},
		},
		PlayedAt: time.Now().Format(time.RFC3339),
	}

	s.roomHistory[roomID] = append(s.roomHistory[roomID], rec)
	if len(s.roomHistory[roomID]) > 50 {
		s.roomHistory[roomID] = s.roomHistory[roomID][len(s.roomHistory[roomID])-50:]
	}
	s.mu.Unlock()

	go func() { _ = s.SaveToDisk(s.filePath) }()
	s.publishSummaryToChat(roomID, "debate", state.Topic, category, winnerNick, summary)
	return rec
}

// RecordQuizMatch updates player career stats, room rankings, match history, and posts a game summary card to the room chat.
func (s *StatsStore) RecordQuizMatch(roomID, category string, players []*QuizPlayerRoundStats) *MatchHistoryRecord {
	if len(players) == 0 {
		return nil
	}

	sorted := make([]*QuizPlayerRoundStats, len(players))
	copy(sorted, players)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].TotalScore == sorted[j].TotalScore {
			return sorted[i].FastestAnswerMs < sorted[j].FastestAnswerMs
		}
		return sorted[i].TotalScore > sorted[j].TotalScore
	})

	s.mu.Lock()
	winner := sorted[0]
	runnerUp := ""
	if len(sorted) > 1 {
		runnerUp = sorted[1].Nickname
	}

	topScores := make([]MatchScoreSummary, 0, len(sorted))
	for idx, p := range sorted {
		if idx < 5 {
			topScores = append(topScores, MatchScoreSummary{
				Nickname: p.Nickname,
				Score:    p.TotalScore,
			})
		}

		gStat, rStat := s.getOrCreatePlayerLocked(roomID, p.UserID, p.Nickname)
		for _, st := range []*PlayerCareerStats{gStat, rStat} {
			st.MatchesPlayed++
			st.QuizzesPlayed++
			st.TotalPoints += p.TotalScore
			st.CorrectAnswers += p.CorrectAnswers
			st.TotalAnswers += p.TotalAnswers
			if idx == 0 && p.TotalScore > 0 {
				st.QuizWins++
			}
			if p.BestStreak > st.BestStreak {
				st.BestStreak = p.BestStreak
			}
			if p.FastestAnswerMs > 0 && (st.FastestAnswerMs == 0 || p.FastestAnswerMs < st.FastestAnswerMs) {
				st.FastestAnswerMs = p.FastestAnswerMs
			}
			recomputeAccuracy(st)
		}
	}

	if category == "" {
		category = "Geral"
	}
	title := "Quiz Relâmpago — " + category
	summary := fmt.Sprintf("Quiz Relâmpago finalizado! 1º lugar: %s (%d pts).", winner.Nickname, winner.TotalScore)

	rec := &MatchHistoryRecord{
		ID:                uuid.New().String(),
		RoomID:            roomID,
		GameType:          "quiz",
		Title:             title,
		Category:          category,
		WinnerID:          winner.UserID,
		WinnerNickname:    winner.Nickname,
		RunnerUpNickname:  runnerUp,
		Summary:           summary,
		ParticipantsCount: len(sorted),
		TopScores:         topScores,
		PlayedAt:          time.Now().Format(time.RFC3339),
	}

	s.roomHistory[roomID] = append(s.roomHistory[roomID], rec)
	if len(s.roomHistory[roomID]) > 50 {
		s.roomHistory[roomID] = s.roomHistory[roomID][len(s.roomHistory[roomID])-50:]
	}
	s.mu.Unlock()

	go func() { _ = s.SaveToDisk(s.filePath) }()
	s.publishSummaryToChat(roomID, "quiz", title, category, winner.Nickname, summary)
	return rec
}

func (s *StatsStore) publishSummaryToChat(roomID, gameType, topic, category, winner, summary string) {
	if s.chatStore == nil {
		return
	}
	msg := &chat.ChatMessage{
		ID:        uuid.New().String(),
		RoomID:    roomID,
		UserID:    "system",
		Nickname:  "Sistema",
		Content:   summary,
		Type:      "game_card",
		CreatedAt: time.Now(),
		GameData: map[string]interface{}{
			"game_type":    gameType,
			"topic":        topic,
			"category":     category,
			"winner":       winner,
			"summary":      summary,
			"action_label": "Ver Ranking da Sala",
		},
	}
	s.chatStore.AddMessage(msg)
	if s.hub != nil {
		if env, err := ws.NewEnvelope("chat:new_message", roomID, msg); err == nil {
			s.hub.BroadcastToRoom(roomID, env)
		}
	}
}

func (s *StatsStore) GetRoomLeaderboard(roomID string) []*RoomLeaderboardEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	roomMap := s.roomStats[roomID]
	entries := make([]*RoomLeaderboardEntry, 0, len(roomMap))
	for _, st := range roomMap {
		entries = append(entries, &RoomLeaderboardEntry{
			UserID:          st.UserID,
			Nickname:        st.Nickname,
			TotalPoints:     st.TotalPoints,
			DebatesWon:      st.DebatesWon,
			QuizWins:        st.QuizWins,
			MatchesPlayed:   st.MatchesPlayed,
			BestStreak:      st.BestStreak,
			AccuracyPercent: st.AccuracyPercent,
		})
	}

	// If room has no specific games played yet, populate from room members using global stats
	if len(entries) == 0 && s.chatStore != nil {
		if room, ok := s.chatStore.GetRoom(roomID); ok {
			for _, m := range room.Members {
				key := normalizePlayerKey(m)
				if gst, exists := s.globalStats[key]; exists {
					entries = append(entries, &RoomLeaderboardEntry{
						UserID:          gst.UserID,
						Nickname:        gst.Nickname,
						TotalPoints:     gst.TotalPoints,
						DebatesWon:      gst.DebatesWon,
						QuizWins:        gst.QuizWins,
						MatchesPlayed:   gst.MatchesPlayed,
						BestStreak:      gst.BestStreak,
						AccuracyPercent: gst.AccuracyPercent,
					})
				} else {
					entries = append(entries, &RoomLeaderboardEntry{
						UserID:   m,
						Nickname: m,
					})
				}
			}
		}
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].TotalPoints != entries[j].TotalPoints {
			return entries[i].TotalPoints > entries[j].TotalPoints
		}
		if entries[i].DebatesWon+entries[i].QuizWins != entries[j].DebatesWon+entries[j].QuizWins {
			return entries[i].DebatesWon+entries[i].QuizWins > entries[j].DebatesWon+entries[j].QuizWins
		}
		return strings.ToLower(entries[i].Nickname) < strings.ToLower(entries[j].Nickname)
	})

	for i := range entries {
		entries[i].Rank = i + 1
	}
	return entries
}

func (s *StatsStore) GetRoomHistory(roomID string) []*MatchHistoryRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()

	history := s.roomHistory[roomID]
	out := make([]*MatchHistoryRecord, 0, len(history))
	for i := len(history) - 1; i >= 0; i-- {
		out = append(out, history[i])
	}
	return out
}

func (s *StatsStore) GetPlayerCareerStats(userIDOrNick string) *PlayerCareerStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key := normalizePlayerKey(userIDOrNick)
	if st, ok := s.globalStats[key]; ok {
		copyStat := *st
		return &copyStat
	}
	for _, st := range s.globalStats {
		if strings.EqualFold(st.UserID, userIDOrNick) || strings.EqualFold(st.Nickname, userIDOrNick) {
			copyStat := *st
			return &copyStat
		}
	}
	return &PlayerCareerStats{
		UserID:    userIDOrNick,
		Nickname:  userIDOrNick,
		UpdatedAt: time.Now().Format(time.RFC3339),
	}
}

// --- HTTP Handlers ---

func (s *StatsStore) GetRoomLeaderboardHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	entries := s.GetRoomLeaderboard(roomID)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(entries)
}

func (s *StatsStore) GetRoomHistoryHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	history := s.GetRoomHistory(roomID)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(history)
}

func (s *StatsStore) GetUserStatsHTTP(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	stats := s.GetPlayerCareerStats(userID)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(stats)
}
