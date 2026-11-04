package game

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/porchat/api/internal/chat"
	"github.com/porchat/api/internal/ws"
)

func TestStatsStore_DebateAndQuizRecording(t *testing.T) {
	tmpDir := t.TempDir()
	statsFile := filepath.Join(tmpDir, "stats.json")
	chatStore := chat.NewRoomStore()
	hub := ws.NewHub(chatStore)
	stats := NewStatsStore(statsFile, chatStore, hub)

	room := chatStore.CreateRoom("Arena Oficial", "ARN-1000", true, []string{"Otavio", "Pedro", "Raul"}, "Otavio")

	// 1. Record a Debate match where Side A (Otavio) beats Side B (Pedro)
	debState := &DebateState{
		Topic:      "Go vs Rust em Sistemas Distribuídos",
		Category:   "Tech",
		SideALabel: "Go",
		SideBLabel: "Rust",
		DebaterA: &Debater{
			ID:               "Otavio",
			Nickname:         "Otavio",
			OpeningArgument:  "Goroutines e canais tornam concorrência legível.",
			RebuttalArgument: "Compilação instantânea acelera o ciclo de entrega.",
			Votes:            3,
		},
		DebaterB: &Debater{
			ID:               "Pedro",
			Nickname:         "Pedro",
			OpeningArgument:  "Borrow checker elimina data races em tempo de compilação.",
			RebuttalArgument: "Zero-cost abstractions garantem latência previsível.",
			Votes:            1,
		},
		JurorIDs:   []string{"Raul", "Marina", "Lucas", "Helena"},
		VotesCount: map[string]int{"side_a": 3, "side_b": 1},
		WinnerSide: "side_a",
	}

	rec := stats.RecordDebateMatch(room.ID, debState)
	if rec == nil || rec.WinnerNickname != "Otavio" {
		t.Fatalf("expected Debate match history record with winner Otavio, got %+v", rec)
	}

	// Verify career stats updated
	otavioCareer := stats.GetPlayerCareerStats("Otavio")
	if otavioCareer.DebatesWon < 1 || otavioCareer.DebateVotesReceived < 3 {
		t.Errorf("expected Otavio career stats to reflect debate win and 3 votes, got %+v", otavioCareer)
	}

	// 2. Record a Quiz match
	quizPlayers := []*QuizPlayerRoundStats{
		{
			UserID:          "Raul",
			Nickname:        "Raul",
			TotalScore:      4850,
			CorrectAnswers:  5,
			TotalAnswers:    5,
			BestStreak:      5,
			FastestAnswerMs: 920,
		},
		{
			UserID:          "Pedro",
			Nickname:        "Pedro",
			TotalScore:      3200,
			CorrectAnswers:  4,
			TotalAnswers:    5,
			BestStreak:      3,
			FastestAnswerMs: 1450,
		},
	}

	qRec := stats.RecordQuizMatch(room.ID, "Tecnologia", quizPlayers)
	if qRec == nil || qRec.WinnerNickname != "Raul" {
		t.Fatalf("expected Quiz match history record with winner Raul, got %+v", qRec)
	}

	// Verify room leaderboard ordering
	board := stats.GetRoomLeaderboard(room.ID)
	if len(board) < 3 {
		t.Fatalf("expected at least 3 players on room leaderboard, got %d", len(board))
	}
	if board[0].Rank != 1 || board[0].Nickname != "Raul" {
		t.Errorf("expected Raul at Rank 1 with 4850 pts, got %+v", board[0])
	}

	// Verify room match history (newest first)
	history := stats.GetRoomHistory(room.ID)
	if len(history) != 2 || history[0].GameType != "quiz" || history[1].GameType != "debate" {
		t.Errorf("expected 2 match history entries ordered newest-first, got %+v", history)
	}

	// Verify game_card summary messages were posted to chatStore
	msgs := chatStore.GetMessagesFiltered(room.ID, "", "", "game_card", 20)
	if len(msgs) < 2 {
		t.Errorf("expected at least 2 game_card summary messages in room chat, got %d", len(msgs))
	}
}

func TestCustomBankStore_TopicsAndQuestionsHTTP(t *testing.T) {
	tmpDir := t.TempDir()
	bankFile := filepath.Join(tmpDir, "bank.json")
	bank := NewCustomBankStore(bankFile)

	r := chi.NewRouter()
	r.Get("/api/rooms/{id}/topics", bank.ListRoomTopicsHTTP)
	r.Post("/api/rooms/{id}/topics", bank.CreateRoomTopicHTTP)
	r.Get("/api/rooms/{id}/questions", bank.ListRoomQuestionsHTTP)
	r.Post("/api/rooms/{id}/questions", bank.CreateRoomQuestionHTTP)

	roomID := "room-custom-123"

	// 1. Create custom debate topic
	topicPayload, _ := json.Marshal(map[string]string{
		"topic":        "Arquitetura Hexagonal vs Clean Architecture em Go",
		"category":     "Engenharia",
		"side_a_label": "Hexagonal (Ports & Adapters)",
		"side_b_label": "Clean Architecture",
		"created_by":   "Otavio",
	})
	reqTopic := httptest.NewRequest(http.MethodPost, "/api/rooms/"+roomID+"/topics", bytes.NewReader(topicPayload))
	recTopic := httptest.NewRecorder()
	r.ServeHTTP(recTopic, reqTopic)

	if recTopic.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for custom topic, got %d: %s", recTopic.Code, recTopic.Body.String())
	}

	// 2. Create custom trivia question
	qPayload, _ := json.Marshal(map[string]interface{}{
		"prompt":     "Qual pacote padrão do Go implementa servidores HTTP e clientes?",
		"category":   "Tecnologia",
		"difficulty": "Fácil",
		"options": map[string]string{
			"A": "net/http",
			"B": "io/http",
			"C": "os/net",
			"D": "sync/http",
		},
		"correct_option": "A",
		"created_by":     "Pedro",
	})
	reqQ := httptest.NewRequest(http.MethodPost, "/api/rooms/"+roomID+"/questions", bytes.NewReader(qPayload))
	recQ := httptest.NewRecorder()
	r.ServeHTTP(recQ, reqQ)

	if recQ.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for custom trivia question, got %d: %s", recQ.Code, recQ.Body.String())
	}

	// Verify persistence & expanded curated bank count (>= 45 items)
	if len(getExpandedQuestionBank()) < 45 {
		t.Errorf("expected at least 45 curated questions in expanded bank, got %d", len(getExpandedQuestionBank()))
	}
	if len(bank.GetRoomTopics(roomID)) != 1 {
		t.Errorf("expected 1 custom topic in room bank")
	}
	if len(bank.GetRoomQuestions(roomID)) != 1 {
		t.Errorf("expected 1 custom question in room bank")
	}
}

func TestDebateEngine_DualArgumentsReadyCheckAndCourtQuestions(t *testing.T) {
	chatStore := chat.NewRoomStore()
	hub := ws.NewHub(chatStore)
	eng := NewDebateEngine("room-debate-dual", hub)
	defer eng.Abort()

	eng.StartDebate("WebSockets vs Server-Sent Events", "Tech", "Otavio", "Pedro")
	if eng.GetPhase() != PhaseLobby {
		t.Fatalf("expected LOBBY phase initially, got %s", eng.GetPhase())
	}

	// Submit court question from audience member Raul
	eng.AskCourtQuestion("Raul", "Raul", "Como fica o consumo de bateria no mobile?", "both")
	st := eng.GetState()
	if len(st.CourtQuestions) != 1 || st.CourtQuestions[0].Nickname != "Raul" {
		t.Fatalf("expected 1 court question from Raul, got %+v", st.CourtQuestions)
	}

	// Ready check: when both debaters mark ready, engine transitions immediately from LOBBY to OPENING_ARGUMENTS
	eng.MarkPlayerReady("Otavio", "Otavio")
	if eng.GetPhase() != PhaseLobby {
		t.Errorf("expected to stay in LOBBY until both debaters are ready")
	}
	eng.MarkPlayerReady("Pedro", "Pedro")
	if eng.GetPhase() != PhaseOpeningArguments {
		t.Fatalf("expected automatic transition to OPENING_ARGUMENTS when both debaters are ready, got %s", eng.GetPhase())
	}

	// Submit Opening Arguments
	eng.SubmitArgument("Otavio", "WebSockets oferecem comunicação bidirecional full-duplex real.")
	eng.SubmitArgument("Pedro", "SSE é mais simples sobre HTTP/2 para fluxos unidirecionais.")

	st = eng.GetState()
	if st.DebaterA.OpeningArgument != "WebSockets oferecem comunicação bidirecional full-duplex real." {
		t.Errorf("unexpected DebaterA OpeningArgument: %s", st.DebaterA.OpeningArgument)
	}

	// Advance to REBUTTAL and submit Rebuttal Arguments -> OpeningArgument MUST be preserved!
	eng.SkipPhase()
	if eng.GetPhase() != PhaseRebuttal {
		t.Fatalf("expected REBUTTAL phase, got %s", eng.GetPhase())
	}

	eng.SubmitArgument("Otavio", "No PORChat precisamos enviar votos e buzzers em tempo real no mesmo canal.")
	eng.SubmitArgument("Pedro", "Com HTTP/3 o overhead de conexões POST paralelas é mínimo.")

	st = eng.GetState()
	if st.DebaterA.OpeningArgument != "WebSockets oferecem comunicação bidirecional full-duplex real." {
		t.Errorf("DebaterA OpeningArgument was overwritten during rebuttal! got: %s", st.DebaterA.OpeningArgument)
	}
	if st.DebaterA.RebuttalArgument != "No PORChat precisamos enviar votos e buzzers em tempo real no mesmo canal." {
		t.Errorf("DebaterA RebuttalArgument was not saved! got: %s", st.DebaterA.RebuttalArgument)
	}
	if st.DebaterB.OpeningArgument == "" || st.DebaterB.RebuttalArgument == "" {
		t.Errorf("expected both OpeningArgument and RebuttalArgument on DebaterB, got %+v", st.DebaterB)
	}
}

func TestTriviaEngine_DifficultyFilterAndFastestResponder(t *testing.T) {
	chatStore := chat.NewRoomStore()
	hub := ws.NewHub(chatStore)
	triv := NewTriviaEngine("room-quiz-test", hub)
	defer func() {
		triv.mu.Lock()
		triv.phase = QuizPhaseChat
		triv.mu.Unlock()
	}()

	triv.mu.Lock()
	triv.startQuizWithOptions(QuizConfig{
		Category:        "Tecnologia",
		Difficulty:      "Fácil",
		RoundCount:      3,
		QuestionSeconds: 20,
		IncludeCustom:   false,
	})
	triv.onPhaseTimeout(QuizPhaseLobby) // transition to QUESTION
	triv.mu.Unlock()

	if triv.phase != QuizPhaseQuestion {
		t.Fatalf("expected QUESTION phase, got %s", triv.phase)
	}
	if len(triv.questions) != 3 {
		t.Fatalf("expected 3 filtered questions, got %d", len(triv.questions))
	}
	for _, q := range triv.questions {
		if q.Category != "Tecnologia" || q.Difficulty != "Fácil" {
			t.Errorf("expected Tecnologia/Fácil question, got %s/%s", q.Category, q.Difficulty)
		}
	}

	correctOpt := triv.questions[0].CorrectOption
	time.Sleep(5 * time.Millisecond)

	cOtavio := &ws.Client{UserID: "Otavio", Nickname: "Otavio", RoomID: "room-quiz-test", ClientType: "mobile"}
	payloadBytes, _ := json.Marshal(map[string]string{"choice": correctOpt})
	triv.HandleAction(cOtavio, &ws.Envelope{
		Event:   "quiz:submit_answer",
		RoomID:  "room-quiz-test",
		Payload: payloadBytes,
	})

	if triv.state.FastestResponder == nil || triv.state.FastestResponder.Nickname != "Otavio" {
		t.Errorf("expected Otavio to be recorded as FastestResponder, got %+v", triv.state.FastestResponder)
	}
	if triv.state.AnsweredCount != 1 {
		t.Errorf("expected AnsweredCount=1, got %d", triv.state.AnsweredCount)
	}
}
