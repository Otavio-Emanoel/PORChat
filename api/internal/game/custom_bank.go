package game

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/porchat/api/internal/security"
)

type CustomDebateTopic struct {
	ID         string `json:"id"`
	RoomID     string `json:"room_id"`
	Topic      string `json:"topic"`
	Category   string `json:"category"`
	SideALabel string `json:"side_a_label"`
	SideBLabel string `json:"side_b_label"`
	CreatedBy  string `json:"created_by"`
	CreatedAt  string `json:"created_at"`
}

type CustomTriviaQuestion struct {
	ID            string            `json:"id"`
	RoomID        string            `json:"room_id"`
	Prompt        string            `json:"prompt"`
	Category      string            `json:"category"`
	Difficulty    string            `json:"difficulty"`
	Options       map[string]string `json:"options"`
	CorrectOption string            `json:"correct_option"`
	CreatedBy     string            `json:"created_by"`
	CreatedAt     string            `json:"created_at"`
}

type CustomBankStore struct {
	mu        sync.RWMutex
	topics    map[string][]*CustomDebateTopic    // roomID -> topics
	questions map[string][]*CustomTriviaQuestion // roomID -> questions
	filePath  string
}

func NewCustomBankStore(filePath string) *CustomBankStore {
	if filePath == "" {
		filePath = "data/custom_bank.json"
	}
	store := &CustomBankStore{
		topics:    make(map[string][]*CustomDebateTopic),
		questions: make(map[string][]*CustomTriviaQuestion),
		filePath:  filePath,
	}
	_ = store.LoadFromDisk(filePath)
	return store
}

func (b *CustomBankStore) SaveToDisk(filePath string) error {
	b.mu.RLock()
	defer b.mu.RUnlock()

	data := struct {
		Topics    map[string][]*CustomDebateTopic    `json:"topics"`
		Questions map[string][]*CustomTriviaQuestion `json:"questions"`
	}{
		Topics:    b.topics,
		Questions: b.questions,
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

func (b *CustomBankStore) LoadFromDisk(filePath string) bool {
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		return false
	}

	var data struct {
		Topics    map[string][]*CustomDebateTopic    `json:"topics"`
		Questions map[string][]*CustomTriviaQuestion `json:"questions"`
	}
	if err := json.Unmarshal(bytes, &data); err != nil {
		return false
	}

	b.mu.Lock()
	defer b.mu.Unlock()
	if data.Topics != nil {
		b.topics = data.Topics
	}
	if data.Questions != nil {
		b.questions = data.Questions
	}
	return true
}

func (b *CustomBankStore) AddTopic(roomID, topic, category, sideA, sideB, createdBy string) (*CustomDebateTopic, error) {
	cleanTopic, err := security.ValidateChatMessage(strings.TrimSpace(topic), 5, 220)
	if err != nil {
		return nil, errors.New("topic must be between 5 and 220 characters")
	}
	cleanCat := strings.TrimSpace(category)
	if cleanCat == "" {
		cleanCat = "Personalizado"
	}
	cleanSideA := strings.TrimSpace(sideA)
	if cleanSideA == "" {
		cleanSideA = "Defesa Coral (A)"
	}
	cleanSideB := strings.TrimSpace(sideB)
	if cleanSideB == "" {
		cleanSideB = "Defesa Menta (B)"
	}
	creator := strings.TrimSpace(createdBy)
	if creator == "" {
		creator = "Membro"
	}

	item := &CustomDebateTopic{
		ID:         uuid.New().String(),
		RoomID:     roomID,
		Topic:      cleanTopic,
		Category:   cleanCat,
		SideALabel: cleanSideA,
		SideBLabel: cleanSideB,
		CreatedBy:  creator,
		CreatedAt:  time.Now().Format(time.RFC3339),
	}

	b.mu.Lock()
	b.topics[roomID] = append(b.topics[roomID], item)
	b.mu.Unlock()

	go func() { _ = b.SaveToDisk(b.filePath) }()
	return item, nil
}

func (b *CustomBankStore) GetRoomTopics(roomID string) []*CustomDebateTopic {
	b.mu.RLock()
	defer b.mu.RUnlock()

	list := b.topics[roomID]
	out := make([]*CustomDebateTopic, len(list))
	copy(out, list)
	return out
}

func (b *CustomBankStore) AddTriviaQuestion(roomID, prompt, category, difficulty string, options map[string]string, correctOption, createdBy string) (*CustomTriviaQuestion, error) {
	cleanPrompt, err := security.ValidateChatMessage(strings.TrimSpace(prompt), 5, 280)
	if err != nil {
		return nil, errors.New("question prompt must be between 5 and 280 characters")
	}

	requiredKeys := []string{"A", "B", "C", "D"}
	cleanOpts := make(map[string]string, 4)
	for _, k := range requiredKeys {
		val := strings.TrimSpace(options[k])
		if val == "" {
			return nil, errors.New("all 4 options (A, B, C, D) are required")
		}
		sanitizedOpt, err := security.ValidateChatMessage(val, 1, 140)
		if err != nil {
			return nil, errors.New("invalid option text for " + k)
		}
		cleanOpts[k] = sanitizedOpt
	}

	corr := strings.ToUpper(strings.TrimSpace(correctOption))
	if corr != "A" && corr != "B" && corr != "C" && corr != "D" {
		return nil, errors.New("correct_option must be A, B, C, or D")
	}

	cleanCat := strings.TrimSpace(category)
	if cleanCat == "" {
		cleanCat = "Personalizado"
	}

	cleanDiff := strings.TrimSpace(difficulty)
	if cleanDiff != "Fácil" && cleanDiff != "Média" && cleanDiff != "Difícil" {
		cleanDiff = "Média"
	}

	creator := strings.TrimSpace(createdBy)
	if creator == "" {
		creator = "Membro"
	}

	item := &CustomTriviaQuestion{
		ID:            uuid.New().String(),
		RoomID:        roomID,
		Prompt:        cleanPrompt,
		Category:      cleanCat,
		Difficulty:    cleanDiff,
		Options:       cleanOpts,
		CorrectOption: corr,
		CreatedBy:     creator,
		CreatedAt:     time.Now().Format(time.RFC3339),
	}

	b.mu.Lock()
	b.questions[roomID] = append(b.questions[roomID], item)
	b.mu.Unlock()

	go func() { _ = b.SaveToDisk(b.filePath) }()
	return item, nil
}

func (b *CustomBankStore) GetRoomQuestions(roomID string) []*CustomTriviaQuestion {
	b.mu.RLock()
	defer b.mu.RUnlock()

	list := b.questions[roomID]
	out := make([]*CustomTriviaQuestion, len(list))
	copy(out, list)
	return out
}

// --- HTTP Handlers for Custom Debate Topics & Trivia Questions ---

func (b *CustomBankStore) ListRoomTopicsHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	custom := b.GetRoomTopics(roomID)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"custom_topics":  custom,
		"curated_topics": curatedTopics,
	})
}

func (b *CustomBankStore) CreateRoomTopicHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	var req struct {
		Topic      string `json:"topic"`
		Category   string `json:"category"`
		SideALabel string `json:"side_a_label"`
		SideBLabel string `json:"side_b_label"`
		CreatedBy  string `json:"created_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	created, err := b.AddTopic(roomID, req.Topic, req.Category, req.SideALabel, req.SideBLabel, req.CreatedBy)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(created)
}

func (b *CustomBankStore) ListRoomQuestionsHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	custom := b.GetRoomQuestions(roomID)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"custom_questions": custom,
		"curated_count":    len(getExpandedQuestionBank()),
		"categories":       []string{"Tecnologia", "Games", "Cultura Pop", "Ciência", "História", "Geral", "Personalizado"},
	})
}

func (b *CustomBankStore) CreateRoomQuestionHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	var req struct {
		Prompt        string            `json:"prompt"`
		Category      string            `json:"category"`
		Difficulty    string            `json:"difficulty"`
		Options       map[string]string `json:"options"`
		CorrectOption string            `json:"correct_option"`
		CreatedBy     string            `json:"created_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	created, err := b.AddTriviaQuestion(roomID, req.Prompt, req.Category, req.Difficulty, req.Options, req.CorrectOption, req.CreatedBy)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(created)
}

// getExpandedQuestionBank returns 48 curated Trivia questions across 6 categories and 3 difficulties.
func getExpandedQuestionBank() []TriviaQuestion {
	return []TriviaQuestion{
		// --- TECNOLOGIA (10) ---
		{
			ID: "t1", Category: "Tecnologia", Difficulty: "Média",
			Prompt: "Qual linguagem foi criada no Google por Robert Griesemer, Rob Pike e Ken Thompson?",
			Options: map[string]string{"A": "Rust", "B": "Go (Golang)", "C": "Kotlin", "D": "TypeScript"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "t2", Category: "Tecnologia", Difficulty: "Fácil",
			Prompt: "Qual porta TCP padrão é utilizada pelo protocolo HTTP não criptografado?",
			Options: map[string]string{"A": "21", "B": "443", "C": "80", "D": "8080"},
			CorrectOption: "C", TotalTimeSeconds: 15,
		},
		{
			ID: "t3", Category: "Tecnologia", Difficulty: "Média",
			Prompt: "Quantos bits compõem um endereço IPv4 tradicional?",
			Options: map[string]string{"A": "16 bits", "B": "32 bits", "C": "64 bits", "D": "128 bits"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "t4", Category: "Tecnologia", Difficulty: "Difícil",
			Prompt: "Qual estrutura de dados opera estritamente no princípio LIFO (Last In, First Out)?",
			Options: map[string]string{"A": "Fila (Queue)", "B": "Pilha (Stack)", "C": "Grafo Direcionado", "D": "Árvore Rubro-Negra"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "t5", Category: "Tecnologia", Difficulty: "Média",
			Prompt: "Qual comando do Git desfaz o último commit mantendo as alterações preparadas (staged)?",
			Options: map[string]string{"A": "git reset --soft HEAD~1", "B": "git reset --hard", "C": "git revert -f", "D": "git clean -fd"},
			CorrectOption: "A", TotalTimeSeconds: 15,
		},
		{
			ID: "t6", Category: "Tecnologia", Difficulty: "Difícil",
			Prompt: "No protocolo WebSocket (RFC 6455), qual cabeçalho HTTP inicia o handshake de upgrade?",
			Options: map[string]string{"A": "X-Socket-Stream", "B": "Upgrade: websocket", "C": "Connection: keep-alive", "D": "Sec-Fetch-Mode: ws"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "t7", Category: "Tecnologia", Difficulty: "Fácil",
			Prompt: "Qual banco de dados em memória é amplamente utilizado para cache chave-valor e pub/sub?",
			Options: map[string]string{"A": "PostgreSQL", "B": "SQLite", "C": "Redis", "D": "MariaDB"},
			CorrectOption: "C", TotalTimeSeconds: 15,
		},
		{
			ID: "t8", Category: "Tecnologia", Difficulty: "Difícil",
			Prompt: "No teorema CAP para sistemas distribuídos, o que significa a letra 'P'?",
			Options: map[string]string{"A": "Persistência em Disco", "B": "Paralelismo de Threads", "C": "Tolerância a Partições de Rede", "D": "Processamento Assíncrono"},
			CorrectOption: "C", TotalTimeSeconds: 15,
		},
		{
			ID: "t9", Category: "Tecnologia", Difficulty: "Média",
			Prompt: "Qual algoritmo de hash criptográfico produz um resumo fixo de 256 bits (32 bytes)?",
			Options: map[string]string{"A": "MD5", "B": "SHA-1", "C": "SHA-256", "D": "CRC32"},
			CorrectOption: "C", TotalTimeSeconds: 15,
		},
		{
			ID: "t10", Category: "Tecnologia", Difficulty: "Fácil",
			Prompt: "Qual código de status HTTP indica que um recurso foi criado com sucesso no servidor?",
			Options: map[string]string{"A": "200 OK", "B": "201 Created", "C": "204 No Content", "D": "302 Found"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},

		// --- GAMES (8) ---
		{
			ID: "g1", Category: "Games", Difficulty: "Fácil",
			Prompt: "Em Minecraft, qual bloco é indispensável para construir a moldura de um portal para o Nether?",
			Options: map[string]string{"A": "Bedrock", "B": "Obsidiana", "C": "Pedra Luminosa", "D": "Bloco de Ferro"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "g2", Category: "Games", Difficulty: "Média",
			Prompt: "Qual é o nome do protagonista herói da franquia The Legend of Zelda?",
			Options: map[string]string{"A": "Zelda", "B": "Link", "C": "Ganon", "D": "Sheik"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "g3", Category: "Games", Difficulty: "Média",
			Prompt: "Qual estúdio polonês desenvolveu os jogos The Witcher 3 e Cyberpunk 2077?",
			Options: map[string]string{"A": "Bethesda", "B": "CD Projekt RED", "C": "BioWare", "D": "Larian Studios"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "g4", Category: "Games", Difficulty: "Fácil",
			Prompt: "Qual jogo cooperativo de dedução social popularizou termos como 'Sus' e 'Sabotagem' em 2020?",
			Options: map[string]string{"A": "Among Us", "B": "Fall Guys", "C": "Valorant", "D": "Overwatch"},
			CorrectOption: "A", TotalTimeSeconds: 15,
		},
		{
			ID: "g5", Category: "Games", Difficulty: "Difícil",
			Prompt: "Qual diretor da FromSoftware liderou a criação de Dark Souls, Bloodborne e Elden Ring?",
			Options: map[string]string{"A": "Hideo Kojima", "B": "Hidetaka Miyazaki", "C": "Shinji Mikami", "D": "Tetsuya Nomura"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "g6", Category: "Games", Difficulty: "Média",
			Prompt: "Em Counter-Strike, quanto tempo padrão (em segundos) leva o defuse da C4 COM kit de desarme?",
			Options: map[string]string{"A": "3 segundos", "B": "5 segundos", "C": "7 segundos", "D": "10 segundos"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "g7", Category: "Games", Difficulty: "Difícil",
			Prompt: "Qual RPG isométrico da Larian Studios venceu o prêmio de Jogo do Ano (GOTY) no The Game Awards 2023?",
			Options: map[string]string{"A": "Alan Wake 2", "B": "Baldur's Gate 3", "C": "Diablo IV", "D": "Starfield"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "g8", Category: "Games", Difficulty: "Fácil",
			Prompt: "Qual é o nome do encanador irmão de Mario que estrela a série 'Luigi's Mansion'?",
			Options: map[string]string{"A": "Wario", "B": "Waluigi", "C": "Luigi", "D": "Toad"},
			CorrectOption: "C", TotalTimeSeconds: 15,
		},

		// --- CULTURA POP & CINEMA (8) ---
		{
			ID: "c1", Category: "Cultura Pop", Difficulty: "Fácil",
			Prompt: "Qual é o nome da nave estelar pilotada por Han Solo e Chewbacca em Star Wars?",
			Options: map[string]string{"A": "USS Enterprise", "B": "Millennium Falcon", "C": "X-Wing Red 5", "D": "Razor Crest"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "c2", Category: "Cultura Pop", Difficulty: "Média",
			Prompt: "Qual ator interpretou J. Robert Oppenheimer no filme vencedor do Oscar dirigido por Christopher Nolan?",
			Options: map[string]string{"A": "Cillian Murphy", "B": "Christian Bale", "C": "Matt Damon", "D": "Robert Downey Jr."},
			CorrectOption: "A", TotalTimeSeconds: 15,
		},
		{
			ID: "c3", Category: "Cultura Pop", Difficulty: "Fácil",
			Prompt: "Quantos Anéis de Poder foram entregues aos Senhores dos Anões na mitologia de Tolkien?",
			Options: map[string]string{"A": "3", "B": "7", "C": "9", "D": "1"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "c4", Category: "Cultura Pop", Difficulty: "Média",
			Prompt: "Qual filme sul-coreano dirigido por Bong Joon-ho fez história ao vencer o Oscar de Melhor Filme em 2020?",
			Options: map[string]string{"A": "Oldboy", "B": "Parasita", "C": "Invasão Zumbi", "D": "Memórias de um Assassino"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "c5", Category: "Cultura Pop", Difficulty: "Difícil",
			Prompt: "Na série Breaking Bad, qual é o nome químico do composto azul produzido por Walter White?",
			Options: map[string]string{"A": "Cloridrato de Metilamina", "B": "Metanfetamina Cristalina", "C": "Fulminato de Mercúrio", "D": "Ricina Purificada"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "c6", Category: "Cultura Pop", Difficulty: "Fácil",
			Prompt: "Qual estúdio de animação japonês produziu 'A Viagem de Chihiro' e 'Meu Amigo Totoro'?",
			Options: map[string]string{"A": "Toei Animation", "B": "Studio Ghibli", "C": "MAPPA", "D": "Kyoto Animation"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "c7", Category: "Cultura Pop", Difficulty: "Média",
			Prompt: "Em 'Duna', de Frank Herbert, qual é a substância mais valiosa do universo encontrada apenas em Arrakis?",
			Options: map[string]string{"A": "Vibranium", "B": "Melange (Especiaria)", "C": "Unobtainium", "D": "Kyber"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "c8", Category: "Cultura Pop", Difficulty: "Difícil",
			Prompt: "Qual banda britânica lançou o álbum conceitual 'The Dark Side of the Moon' em 1973?",
			Options: map[string]string{"A": "Led Zeppelin", "B": "Pink Floyd", "C": "Queen", "D": "The Who"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},

		// --- CIÊNCIA & ESPAÇO (8) ---
		{
			ID: "s1", Category: "Ciência", Difficulty: "Fácil",
			Prompt: "Qual é o planeta mais quente do Sistema Solar devido ao seu intenso efeito estufa?",
			Options: map[string]string{"A": "Mercúrio", "B": "Vênus", "C": "Marte", "D": "Júpiter"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "s2", Category: "Ciência", Difficulty: "Difícil",
			Prompt: "Qual elemento químico possui o símbolo 'W' e o maior ponto de fusão entre todos os metais?",
			Options: map[string]string{"A": "Tungstênio", "B": "Vanádio", "C": "Titânio", "D": "Osmio"},
			CorrectOption: "A", TotalTimeSeconds: 15,
		},
		{
			ID: "s3", Category: "Ciência", Difficulty: "Média",
			Prompt: "Aproximadamente quanto tempo a luz do Sol leva para percorrer a distância até a Terra?",
			Options: map[string]string{"A": "1 segundo", "B": "8 minutos e 20 segundos", "C": "1 hora e 15 minutos", "D": "24 minutos"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "s4", Category: "Ciência", Difficulty: "Fácil",
			Prompt: "Qual organela celular é responsável pela respiração celular e produção de ATP?",
			Options: map[string]string{"A": "Ribossomo", "B": "Mitocôndria", "C": "Complexo de Golgi", "D": "Lisossomo"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "s5", Category: "Ciência", Difficulty: "Média",
			Prompt: "Qual cientista formulou as três leis do movimento planetário no século XVII?",
			Options: map[string]string{"A": "Galileu Galilei", "B": "Johannes Kepler", "C": "Nicolau Copérnico", "D": "Tycho Brahe"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "s6", Category: "Ciência", Difficulty: "Difícil",
			Prompt: "Qual partícula subatômica elementar confere massa a outras partículas através do campo de Higgs?",
			Options: map[string]string{"A": "Quark Top", "B": "Bóson de Higgs", "C": "Neutrino Tau", "D": "Glúon"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "s7", Category: "Ciência", Difficulty: "Fácil",
			Prompt: "Qual gás é o mais abundante na atmosfera terrestre (cerca de 78%)?",
			Options: map[string]string{"A": "Oxigênio", "B": "Nitrogênio", "C": "Dióxido de Carbono", "D": "Argônio"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "s8", Category: "Ciência", Difficulty: "Média",
			Prompt: "Na escala Kelvin de temperatura absoluta, o zero absoluto (0 K) equivale a quantos graus Celsius?",
			Options: map[string]string{"A": "-100 °C", "B": "-273,15 °C", "C": "-459,67 °C", "D": "-300 °C"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},

		// --- HISTÓRIA & GEOGRAFIA (7) ---
		{
			ID: "h1", Category: "História", Difficulty: "Fácil",
			Prompt: "Qual foi a capital do Brasil imediatamente antes da inauguração de Brasília em 1960?",
			Options: map[string]string{"A": "Salvador", "B": "São Paulo", "C": "Rio de Janeiro", "D": "Ouro Preto"},
			CorrectOption: "C", TotalTimeSeconds: 15,
		},
		{
			ID: "h2", Category: "História", Difficulty: "Média",
			Prompt: "Em que ano ocorreu a Queda do Muro de Berlim, marco do fim da Guerra Fria?",
			Options: map[string]string{"A": "1985", "B": "1989", "C": "1991", "D": "1993"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "h3", Category: "História", Difficulty: "Difícil",
			Prompt: "Qual civilização antiga construiu a cidade de Machu Picchu na Cordilheira dos Andes?",
			Options: map[string]string{"A": "Asteca", "B": "Inca", "C": "Maia", "D": "Olmeca"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "h4", Category: "História", Difficulty: "Média",
			Prompt: "Quem foi a cientista e matemática inglesa considerada a primeira programadora da história?",
			Options: map[string]string{"A": "Marie Curie", "B": "Ada Lovelace", "C": "Grace Hopper", "D": "Rosalind Franklin"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "h5", Category: "História", Difficulty: "Difícil",
			Prompt: "Qual tratado assinado em 1494 dividiu as terras recém-descobertas entre Portugal e Espanha?",
			Options: map[string]string{"A": "Tratado de Madri", "B": "Tratado de Tordesilhas", "C": "Tratado de Utrecht", "D": "Tratado de Versalhes"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "h6", Category: "História", Difficulty: "Fácil",
			Prompt: "Em qual continente está localizado o Deserto do Saara?",
			Options: map[string]string{"A": "Ásia", "B": "África", "C": "Oceania", "D": "América do Sul"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "h7", Category: "História", Difficulty: "Média",
			Prompt: "Qual navegador português comandou a primeira frota europeia a chegar à Índia contornando a África?",
			Options: map[string]string{"A": "Pedro Álvares Cabral", "B": "Vasco da Gama", "C": "Fernão de Magalhães", "D": "Bartolomeu Dias"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},

		// --- CONHECIMENTOS GERAIS (7) ---
		{
			ID: "b1", Category: "Geral", Difficulty: "Fácil",
			Prompt: "Quantas casas ao todo possui um tabuleiro oficial de Xadrez (8x8)?",
			Options: map[string]string{"A": "48", "B": "64", "C": "72", "D": "100"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "b2", Category: "Geral", Difficulty: "Média",
			Prompt: "Qual país possui a maior quantidade de fusos horários do mundo (incluindo territórios ultramarinos)?",
			Options: map[string]string{"A": "Rússia", "B": "França", "C": "Estados Unidos", "D": "China"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "b3", Category: "Geral", Difficulty: "Fácil",
			Prompt: "Qual instrumento musical de cordas possui tradicionalmente 6 cordas afinadas em E-A-D-G-B-E?",
			Options: map[string]string{"A": "Violino", "B": "Violão / Guitarra", "C": "Cavaquinho", "D": "Contrabaixo"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "b4", Category: "Geral", Difficulty: "Difícil",
			Prompt: "Qual escritor brasileiro é o autor do romance clássico 'Grande Sertão: Veredas'?",
			Options: map[string]string{"A": "Machado de Assis", "B": "João Guimarães Rosa", "C": "Graciliano Ramos", "D": "Jorge Amado"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "b5", Category: "Geral", Difficulty: "Média",
			Prompt: "Qual é o maior oceano do planeta Terra em área superficial e volume de água?",
			Options: map[string]string{"A": "Oceano Atlântico", "B": "Oceano Pacífico", "C": "Oceano Índico", "D": "Oceano Ártico"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "b6", Category: "Geral", Difficulty: "Difícil",
			Prompt: "Na arquitetura e pintura renascentista, quem pintou o afresco 'A Escola de Atenas' no Vaticano?",
			Options: map[string]string{"A": "Michelangelo", "B": "Rafael Sanzio", "C": "Leonardo da Vinci", "D": "Sandro Botticelli"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "b7", Category: "Geral", Difficulty: "Fácil",
			Prompt: "Quantos minutos tem uma partida oficial de futebol (tempo regulamentar sem acréscimos)?",
			Options: map[string]string{"A": "80 minutos", "B": "90 minutos", "C": "100 minutos", "D": "60 minutos"},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
	}
}
