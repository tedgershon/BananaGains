# Roadmap & "What's next" picker

A wave-by-wave view of the open issues plus an LLM prompt for picking the next batch when the roadmap drifts. See `iteration-loop.md` for the per-issue loop and `agent-prompt-template.md` for the kickoff prompt.

## Static roadmap

Anything in the same wave can run as parallel agents (each in its own Cursor background-agent worktree). `HUMAN` items require manual SaaS / console work — assign to a teammate, not an agent.

```
Wave 0 (now):
  HUMAN:  12.1  (Sentry account + Vercel integration)
  AGENT:  09.1  ← start here
          13.2, 16.1, 18.1   (parallel, disjoint paths)

Wave 1  (after 12.1):                 12.2, 12.4
Wave 2  (after 12.2):                 12.3, 14.4
        (after 16.1):                 16.2
        (after 18.1):                 18.2
Wave 3  (after 12.3):                 13.1
Wave 4  (after 13.1):                 13.3, 13.4, 13.5, 17.1
Wave 5  (after 13.3 + 13.4 + 13.5):   13.6, 13.10
        (after 13.4):                 13.9
Wave 6  (after 13.6):                 13.7, 13.8
        (after 13.10):                14.1
Wave 7  (after 14.1):                 14.2, 15.1
Wave 8  (after 14.2):                 14.3
        (after 15.1):                 15.2, 15.3, 15.4
Wave 9  (after 17.1 + 13.6):          17.2
```

Correct as of the current `issues/` directory. When the dependency graph changes (issues dropped, scope split, new deps discovered), prefer the prompt below.

## "What's next" prompt

Paste into any agent to compute the ready set:

```text
You are helping me pick the next issue(s) to implement.

Inputs:
- Read every file matching issues/*.md.
- Treat the following IDs as `status: done` even if their files say
  otherwise (they just merged but main may not be pulled yet):
    DONE_OVERRIDES = [<comma-separated IDs, or empty>]

Algorithm:
- For each issue with `status: open` (after applying DONE_OVERRIDES),
  it is READY iff every ID in `depends_on` resolves to `status: done`
  (also after overrides). Otherwise BLOCKED.
- Exclude any issue whose body indicates manual SaaS or console setup
  with no code changes (e.g. 12.1 Sentry account setup). Flag it
  separately as HUMAN-ONLY.

Output, terse, in this exact structure:

  READY (sorted by phase asc, then id asc):
    <id>  <title>             deps:[...]  parallel_with:[...]

  RECOMMENDED NEXT BATCH (up to 3, must touch disjoint paths):
    <id>  — <one sentence on which code paths it touches>
    ...
    Rationale: <one sentence on why these three don't collide>

  HIGHEST-LEVERAGE PICK (1 issue whose merge would unblock the most
  downstream open issues, even if not in the batch above):
    <id>  unblocks: [<ids>]

  HUMAN-ONLY (still open, needs a human, not an agent):
    <id>  <one-line reason>

No prose outside these sections. Do not propose any issue whose
`depends_on` is unsatisfied.
```
