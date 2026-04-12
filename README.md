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
