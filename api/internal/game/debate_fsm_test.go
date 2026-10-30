package game

import (
	"sync"
	"testing"
	"time"

	"github.com/porchat/api/internal/chat"
	"github.com/porchat/api/internal/ws"
)

func TestDebateFSM_InitialState(t *testing.T) {
	store := chat.NewRoomStore()
	hub := ws.NewHub(store)
	go hub.Run()
	defer hub.Close()

	engine := NewDebateEngine("fsm-room-1", hub)

	if engine.IsActive() {
		t.Errorf("Engine should be inactive initially")
	}

	if engine.GetPhase() != PhaseChat {
		t.Errorf("Initial phase should be CHAT, got %s", engine.GetPhase())
	}
}

func TestDebateFSM_FullProgressionAndWinner(t *testing.T) {
	store := chat.NewRoomStore()
	hub := ws.NewHub(store)
	go hub.Run()
	defer hub.Close()

	engine := NewDebateEngine("fsm-room-2", hub)

	// Step 1: Start Debate with custom topic and debaters
	engine.StartDebate("Vim vs VS Code", "Tech", "user-vim", "user-vscode")
	if !engine.IsActive() {
		t.Fatalf("Engine should be active after StartDebate")
	}

	if engine.GetPhase() != PhaseLobby {
		t.Fatalf("Expected phase LOBBY, got %s", engine.GetPhase())
	}

	state := engine.GetState()
	if state == nil {
		t.Fatalf("State should not be nil")
	}
	if state.DebaterA == nil || state.DebaterA.ID != "user-vim" {
		t.Errorf("DebaterA ID mismatch: %+v", state.DebaterA)
	}
	if state.DebaterB == nil || state.DebaterB.ID != "user-vscode" {
		t.Errorf("DebaterB ID mismatch: %+v", state.DebaterB)
	}

	// Step 2: Skip Lobby -> Opening Arguments
	engine.SkipPhase()
	if engine.GetPhase() != PhaseOpeningArguments {
		t.Fatalf("Expected phase OPENING_ARGUMENTS, got %s", engine.GetPhase())
	}

	// Submit arguments
	engine.SubmitArgument("user-vim", "Vim is ultra fast and keyboard-driven.")
	engine.SubmitArgument("user-vscode", "VS Code has a massive extension ecosystem.")

	state = engine.GetState()
	if state.DebaterA.Argument != "Vim is ultra fast and keyboard-driven." {
		t.Errorf("Argument A not recorded: %s", state.DebaterA.Argument)
	}
	if state.DebaterB.Argument != "VS Code has a massive extension ecosystem." {
		t.Errorf("Argument B not recorded: %s", state.DebaterB.Argument)
	}

	// Step 3: Skip to Rebuttal
	engine.SkipPhase()
	if engine.GetPhase() != PhaseRebuttal {
		t.Fatalf("Expected phase REBUTTAL, got %s", engine.GetPhase())
	}

	// Step 4: Skip to Voting
	engine.SkipPhase()
	if engine.GetPhase() != PhaseVoting {
		t.Fatalf("Expected phase VOTING, got %s", engine.GetPhase())
	}

	// Jurors vote
	engine.CastVote("juror-1", "side_a")
	engine.CastVote("juror-2", "side_a")
	engine.CastVote("juror-3", "side_b")

	// Changing vote
	engine.CastVote("juror-3", "side_a") // switches to side_a

	state = engine.GetState()
	if state.VotesCount["side_a"] != 3 {
		t.Errorf("Expected 3 votes for side_a, got %d", state.VotesCount["side_a"])
	}
	if state.VotesCount["side_b"] != 0 {
		t.Errorf("Expected 0 votes for side_b, got %d", state.VotesCount["side_b"])
	}

	// Step 5: Skip to Results
	engine.SkipPhase()
	if engine.GetPhase() != PhaseResults {
		t.Fatalf("Expected phase RESULTS, got %s", engine.GetPhase())
	}

	state = engine.GetState()
	if state.WinnerSide != "side_a" {
		t.Errorf("Expected winner side_a, got %s", state.WinnerSide)
	}

	// Step 6: Skip to Return to Chat
	engine.SkipPhase()
	if engine.GetPhase() != PhaseChat {
		t.Fatalf("Expected phase CHAT after results, got %s", engine.GetPhase())
	}
	if engine.IsActive() {
		t.Errorf("Engine should be inactive after returning to CHAT")
	}
}

func TestDebateFSM_TieResolution(t *testing.T) {
	store := chat.NewRoomStore()
	hub := ws.NewHub(store)
	go hub.Run()
	defer hub.Close()

	engine := NewDebateEngine("fsm-room-tie", hub)
	engine.StartDebate("Tabs vs Spaces", "Tech", "u1", "u2")
	engine.SkipPhase() // OPENING_ARGUMENTS
	engine.SkipPhase() // REBUTTAL
	engine.SkipPhase() // VOTING

	// Equal votes
	engine.CastVote("juror-1", "side_a")
	engine.CastVote("juror-2", "side_b")

	engine.SkipPhase() // RESULTS
	state := engine.GetState()

	if state.WinnerSide != "tie" {
		t.Errorf("Expected winner 'tie', got %s", state.WinnerSide)
	}
}

func TestDebateFSM_PauseResumeAndAbort(t *testing.T) {
	store := chat.NewRoomStore()
	hub := ws.NewHub(store)
	go hub.Run()
	defer hub.Close()

	engine := NewDebateEngine("fsm-room-pause", hub)
	engine.StartDebate("Dark vs Light", "Tech", "u1", "u2")

	state := engine.GetState()
	if state.IsPaused {
		t.Errorf("Debate should not be paused initially")
	}

	engine.Pause()
	state = engine.GetState()
	if !state.IsPaused {
		t.Errorf("Debate state should be paused")
	}

	engine.Resume()
	state = engine.GetState()
	if state.IsPaused {
		t.Errorf("Debate state should be resumed")
	}

	engine.Abort()
	if engine.GetPhase() != PhaseChat {
		t.Errorf("Debate phase should be CHAT after Abort()")
	}
	if engine.IsActive() {
		t.Errorf("Debate should not be active after Abort()")
	}
}

func TestDebateFSM_ConcurrentVoting(t *testing.T) {
	store := chat.NewRoomStore()
	hub := ws.NewHub(store)
	go hub.Run()
	defer hub.Close()

	engine := NewDebateEngine("fsm-room-concurrent-vote", hub)
	engine.StartDebate("Star Wars vs Senhor dos Aneis", "Cultura", "u1", "u2")
	engine.SkipPhase() // OPENING_ARGUMENTS
	engine.SkipPhase() // REBUTTAL
	engine.SkipPhase() // VOTING

	var wg sync.WaitGroup
	// 50 concurrent voters voting simultaneously
	for i := 0; i < 50; i++ {
		wg.Add(1)
		voterID := string(rune('A' + (i % 26))) + string(rune('0' + (i % 10)))
		side := "side_a"
		if i%2 == 1 {
			side = "side_b"
		}
		go func(id, s string) {
			defer wg.Done()
			engine.CastVote(id, s)
		}(voterID, side)
	}
	wg.Wait()

	state := engine.GetState()
	totalVotes := state.VotesCount["side_a"] + state.VotesCount["side_b"]
	if totalVotes == 0 {
		t.Errorf("Expected votes to be recorded concurrently")
	}

	// Trigger reactions
	for _, emoji := range []string{"🔥", "💀", "🍅", "👏"} {
		engine.TriggerReaction(emoji)
	}
	time.Sleep(10 * time.Millisecond)
}
