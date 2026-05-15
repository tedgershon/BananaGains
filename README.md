# s26_team_11

Repository for s26_team_11 in 17-437: Web Application Development. 

Project specifications are located in `project-specs/`.

## Local development

Backend: **http://127.0.0.1:8000** · Frontend: **http://localhost:3000** (run both in separate terminals).

**Backend** (`backend/`):

```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1  |  Unix: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Set `backend/.env` (Supabase: `supabase_url`, `supabase_key`, `supabase_jwt_secret`; see `backend/config.py` for the full `Settings` schema, including optional variables).

Apply SQL migrations in order via the Supabase SQL editor: `backend/supabase/migrations/`. Details: `backend/README.md`.

**Frontend** (`frontend/`):

```bash
cd frontend
pnpm install
pnpm dev
```

If frontend startup fails with `EADDRINUSE` on port `3000` (Windows PowerShell), run:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

Copy `frontend/.env.local.example` to `frontend/.env.local` if needed. `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000`.

## Contributing

One PR per file in `issues/`. See `issues/README.md` for the full lifecycle.

**Pick.** `rg -l "^status: open" issues/`. Check the frontmatter: `depends_on` must be empty (or already merged); `parallel_with` issues can ship concurrently.

**Branch** off `origin/main`:

```
issue/<id>-<slug>     # e.g. issue/09.1-badge-definitions-rls
```

**Commit** in 2–4 logical steps, each leaving the codebase in a valid state. Squash-merge on GitHub so `main` gets one commit per issue.

```
<id>: <imperative subject, <=60 chars>

<optional 1–2 sentence body explaining *why* if not obvious>

Refs issues/<id>-<slug>.md     # `Closes` on the final commit
```

The first commit also sets `status: in-progress`; the final commit sets `status: done`. Never commit a standalone status flip.

**PR body** copies the issue's acceptance-criteria checklist with verified boxes ticked, plus the verification output.

**Agents.** Run one Cursor background agent per issue — each gets its own worktree, so `parallel_with` issues parallelize cleanly. No master agent; per-PR review is the gate.

**Workflow files.** Operational details live in `issues/`:

- `issues/agent-prompt-template.md` — the kickoff prompt for each agent (fill in `[ ... ]` blocks, then paste).
- `issues/iteration-loop.md` — the 7-step per-issue loop.
- `issues/roadmap.md` — dependency waves + an LLM prompt to pick the next batch.
