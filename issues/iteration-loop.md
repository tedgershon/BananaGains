# Per-issue loop

After each PR squash-merges to `main`:

1. `git checkout main && git pull origin main` — pull the merge.
2. Confirm the issue's frontmatter is `status: done` on main: `git log -1 --stat issues/<id>-*.md`. If a PR slipped through without flipping it, push a follow-up commit on main: `<id>: mark issue done`.
3. Delete the merged branch locally and on the remote.
4. Pick the next batch (1–3 issues, disjoint paths) using `roadmap.md` or the "what's next" prompt inside it.
5. For each chosen issue, open a fresh Cursor background agent (its own worktree) and paste `agent-prompt-template.md` with every `[ ... ]` block filled in.
6. Review and merge each PR as it goes green.
7. Repeat from step 1.

The only step that needs human judgment is step 4 (pick the next issue) and step 6 (PR review). The rest is mechanical.
