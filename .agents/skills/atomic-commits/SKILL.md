---
name: atomic-commits
description: >-
  Enforce clean, semantic, English git commits split into granular, atomic units
  without any Co-authored-by tags. Use whenever committing code, creating commits,
  staging changes, or breaking down multiple frontend, backend, and fullstack modifications into separate commits.
---

# 📦 Atomic Commits Skill

This skill guides creating clean, granular, and semantic Git commits in **English**, ensuring changes are never bundled into single monolithic commits and that **no `Co-authored-by` or AI attribution tags** are added.

---

## 1. Core Principles (Non-Negotiable)

1. **Always English:** Commit titles and bodies must be written in English using clear, imperative language (e.g., `feat(api): add room state machine`, not `added room state machine` or Portuguese).
2. **NO Co-authored-by:** Never include `Co-authored-by: ...`, `Signed-off-by: ...`, or any automated AI bot footnotes in commit messages. Keep commits clean and authored solely by the developer.
3. **Atomic & Isolated Commits:** Each commit should represent one logical unit of work.
   - **Never mix frontend and backend** in the same commit.
   - **Never mix feature logic with unrelated refactoring or styling** in the same commit.
   - If multiple distinct features or fixes were implemented across layers, create separate commits for each feature and each layer.

---

## 2. Commit Message Structure (Conventional Commits)

```text
<type>(<scope>): <short imperative description>

[optional body explaining 'why' and context, wrapped at 72 chars]
```

### Commit Types
- `feat`: A new user-facing feature or API capability.
- `fix`: A bug fix.
- `refactor`: Code change that neither fixes a bug nor adds a feature.
- `style`: Changes that do not affect code meaning (formatting, CSS/Tailwind color tokens, typography adjustments).
- `docs`: Documentation changes only (`README.md`, `AGENTS.md`, guides).
- `test`: Adding or correcting tests.
- `chore`: Tooling, dependency updates, build configurations, skill installations.
- `perf`: Performance improvements (e.g., query optimization, reduced bundle size).

### Recommended Scopes for PORChat
- `api`: Go backend HTTP REST handlers, models, database layer.
- `ws`: WebSocket hub, connection lifecycle, room synchronization.
- `game`: Game engine, FSM (Debate Court, Quick Trivia), timers.
- `web`: Next.js web client, chat feed, general UI components.
- `tv`: TV Mode big-screen display, live argument feeds, stage animations.
- `mobile`: React Native mobile application, chat screens.
- `controller`: Mobile game controller overlay, buzzers, voting cards, haptics.
- `skills`: Agent skills and workspace custom definitions.
- `deps`: Dependency installations or configuration upgrades.

---

## 3. Step-by-Step Commit Workflow

### Step 1: Inspect Changes
Run `git status` and `git diff --stat` to see all touched files:
```bash
git status
git diff --stat
```

### Step 2: Categorize and Group Files
Cluster modified files by layer and functionality:
- Backend files (`/backend/...`, `/api/...`) grouped by feature.
- Web frontend files (`/web/...`) grouped by feature/page.
- Mobile controller files (`/mobile/...`) grouped by component.
- Shared contracts, types, or documentation (`AGENTS.md`, `README.md`).

### Step 3: Stage Specific Files Only
Never use `git add .` or `git add -A` when multiple unrelated or cross-domain changes are present. Stage only the files for the target commit:
```bash
git add backend/internal/game/debate.go backend/internal/game/debate_test.go
```

### Step 4: Commit with Clear Message (No Co-authored)
```bash
git commit -m "feat(game): implement debate opening arguments timer and state transition"
```
Ensure no `-s` (signoff) or automated trailer flags are passed that inject co-author metadata.

### Step 5: Repeat for Remaining Groups
Continue staging and committing file-by-file or group-by-group until the working tree is clean.

### Step 6: Validate History
Review the resulting commit chain to confirm clarity, ordering, and absence of co-author tags:
```bash
git log -n 5 --oneline
```

---

## 4. Good vs. Bad Examples

### ❌ Bad (Monolithic & Tagged)
```text
Commit: feat: implement court game and web tv mode and fix mobile voting button

Co-authored-by: Assistant <assistant@ai.com>
```
*Why bad:* Combines Go game engine, Next.js TV mode, and React Native mobile fix into a single blob; contains AI co-author attribution.

---

### ✅ Good (Granular, Layered & Clean)
```text
Commit 1: feat(game): implement court debate finite state machine and countdown ticker
Commit 2: feat(api): expose debate room websocket event broadcaster
Commit 3: feat(web): create TV Mode debate arena layout and argument cards
Commit 4: feat(mobile): build Side A vs Side B tactile voting cards with press feedback
Commit 5: fix(controller): resolve touch latency on voting buzzer pressable
Commit 6: docs(architecture): update debate state transitions in AGENTS.md
```
*Why good:* Every commit is independent, easy to review, bisect, cherry-pick, or revert without breaking other systems.
