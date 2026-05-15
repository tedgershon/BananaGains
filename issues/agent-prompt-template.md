# Agent kickoff prompt (template)

Generic version of the prompt used to start a single-issue implementation. Fill in every `[ ... ]` block, then paste the result into a fresh Cursor background agent (each agent should run in its own worktree).

For the per-issue iteration steps see `iteration-loop.md`. For picking the next issue see `roadmap.md`.

## Template

```text
You are implementing a single issue file from this repo. The issue file is
the source of truth for scope and acceptance criteria.

ISSUE FILE: issues/[ ID ]-[ SLUG ].md

Step 0 — Orient. Read these in order before any code changes:
  1. README.md → "Contributing" section.
  2. issues/README.md → the full lifecycle.
  3. issues/[ ID ]-[ SLUG ].md → scope, acceptance, verification.
  4. The files referenced under "Spec / design references" in the issue,
     plus any other files implied by the acceptance criteria:
       [ REFERENCED FILES: list each file with a one-line purpose. E.g.
         - features/extension/13-backend-hardening.md (§1b enum to copy verbatim)
         - backend/observability.py (where AppError is added)
         - backend/main.py (where global handlers are wired)
       ]

Step 1 — Summarize and wait. Reply with at most 5 bullets covering:
  - What you will change, in plain English.
  - Exact list of files you will touch (full paths).
  - Anything ambiguous in the acceptance criteria or referenced specs.
Then STOP and wait for me to reply "go" before writing any code.

Step 2 — Branch off the latest origin/main:

    git fetch origin
    git checkout -b issue/[ ID ]-[ SLUG ] origin/main

Step 3 — Implement EXACTLY the changes enumerated under "Acceptance
criteria" in the issue. Do not refactor, reformat, or touch unrelated
files. If anything is genuinely unclear, stop and ask — do not guess.
Match the existing style of neighboring files.

Step 4 — Commit in 2–4 logical steps, each leaving the repo in a valid
state. For this issue the natural shape is:

  [ COMMIT SHAPE: one bullet per commit, derived from the issue's
    acceptance-criteria sub-sections. Mark which commit flips status
    to in-progress (first) and which flips to done AND `git mv`s the
    issue file into issues/archive/ (last). Example:
      a. Add ErrorCode enum + AppError class in backend/observability.py.
         (sets `status: in-progress`)
      b. Wire validation + unhandled-exception handlers in backend/main.py.
         (sets `status: done`, `git mv issues/[ID]-...md issues/archive/`)
  ]

The status flip and the `git mv` to `issues/archive/` MUST land in the
same commit. Don't push a standalone archive move and don't leave the
file in `issues/` after it's done — see `issues/README.md` Lifecycle.

Commit message format (each commit):

    [ ID ]: <imperative subject, <=60 chars, no trailing period>

    <optional 1–2 sentence body explaining *why* if not obvious>

    Refs issues/[ ID ]-[ SLUG ].md

The final commit on the branch uses `Closes issues/[ ID ]-...md` instead
of `Refs`. No emojis, no co-author trailers, no filler.

Step 5 — Verify. Run the verification block from the issue (or paste a
clear description of how you'd run it if you cannot reach the relevant
environment from here). Confirm:

  [ VERIFICATION CHECKS: the expected outcomes from the issue's
    "Verification" section. Example:
      - POST /api/markets with empty body → 422 with envelope
        {"detail":{"code":"VALIDATION_FAILED","message":"...","errors":[...]}}
      - Sentry event recorded with error_code tag
  ]

Capture the actual output for the PR body. If a check requires an
environment the agent can't reach (DB, running app, Sentry dashboard,
etc.), hand the user the exact command(s) to run and the expected
output, and pause. When the user pastes back the actual result, update
the PR body's "Verification" section to show real output (not the
placeholder) before proceeding to Step 7.

Step 6 — Open the PR.

  Title:   [ ID ] — [ ISSUE TITLE ]

  Body, in this order:
    - Link to the issue file (relative path).
    - The full "Acceptance criteria" checklist copied from the issue,
      with boxes ticked ONLY for what you actually verified.
    - "Verification" section: the actual output from Step 5
      (or the explanation if the environment was unreachable).
    - "Files changed": one line per file explaining why it was touched.
      Anything outside the issue's enumerated files needs explicit
      justification here.

Step 7 — After the PR is open, push one follow-up commit on the same
branch that updates the issue frontmatter `pr:` to the PR number
(e.g. `pr: "#42"`), with message:

    [ ID ]: link PR in issue frontmatter

    Refs issues/[ ID ]-[ SLUG ].md

The PR will be squash-merged. On `main` the whole series becomes one
commit; on the branch reviewers walk through the logical steps.

Hard constraints:
- One issue per PR. If scope grows, stop and propose splitting the issue
  rather than expanding.
- Do not modify other issue files, design docs, or specs unless the
  acceptance criteria explicitly require it.
- Do not alter unrelated code paths, migrations, routers, or seed data.
- The PR diff against origin/main must contain only the files in the
  acceptance criteria. Diff and confirm before opening the PR.

Begin with Step 0 → Step 1. Do not start Step 2 until I say "go".

Environment notes (Windows + Cursor on this machine — read first):

- Shell is PowerShell, not bash. Bash-only constructs (heredocs
  `$(cat <<'EOF' ... EOF)`, `<` as a redirection operator) parse-fail in
  PowerShell. For multi-line commit messages, write the message to a temp
  file under `.git/` (gitignored) and use `git commit -F .git/COMMIT_MSG_TMP`,
  then delete the temp file.

- The Cursor shell wrapper auto-appends
  `Co-authored-by: Cursor <cursoragent@cursor.com>` to every `git commit`
  invocation, regardless of `--cleanup=verbatim` or `-F`. The hard
  constraint above forbids co-author trailers. To bypass without modifying
  git config, invoke the git executable directly and build the commit
  manually:

      git add <files>
      $tree   = (& 'C:\Program Files\Git\cmd\git.exe' write-tree).Trim()
      $parent = (& 'C:\Program Files\Git\cmd\git.exe' rev-parse HEAD).Trim()
      $new    = (Get-Content -Raw .git/COMMIT_MSG_TMP |
                 & 'C:\Program Files\Git\cmd\git.exe' commit-tree $tree -p $parent |
                 Out-String).Trim()
      & 'C:\Program Files\Git\cmd\git.exe' update-ref HEAD $new

  Verify with `git log -1 --format='%B'` — the trailer must not be present.

- `gh` CLI may or may not be installed. If `gh --version` fails, do NOT
  try to install it. Instead: write the PR title + body to
  `.git/PR_BODY.md` (gitignored), hand the user the URL printed by
  `git push` (`https://github.com/<owner>/<repo>/pull/new/<branch>`), and
  ask them to paste the body. Then ask them to reply with the PR number
  so Step 7 can run.

- You have no database, Supabase, or running-app access from this
  environment. For any verification step that requires hitting the DB or
  a live endpoint: hand the user the exact SQL / curl / page URL, tell
  them what output to expect, and ask them to paste back. Then update
  the PR body with the actual result before Step 7. If the verification
  is a negative test (e.g. "expect RLS error"), warn the user that
  Supabase Studio surfaces an expected error as "Failed to run sql
  query" — that wording is the success condition, not failure.
```

## Fill-in checklist

Before pasting, replace every block. Find-and-replace handles the first three; the last three are issue-specific authoring:

- [ ] `[ ID ]` — the issue number, e.g. `09.1`
- [ ] `[ SLUG ]` — the kebab slug, e.g. `badge-definitions-rls`
- [ ] `[ ISSUE TITLE ]` — the H1 text from the issue file, e.g. `Enable RLS on badge_definitions`
- [ ] `[ REFERENCED FILES ]` — the issue's "Spec / design references" plus any files implied by the acceptance criteria
- [ ] `[ COMMIT SHAPE ]` — 1–4 bullets derived from the acceptance-criteria sub-sections; explicitly mark the commits that flip `status: in-progress` and `status: done`
- [ ] `[ VERIFICATION CHECKS ]` — copy the expected outcomes from the issue's "Verification" section

Sanity check: search the filled prompt for `[ ` and `]` — anything still bracketed is a missed substitution.
