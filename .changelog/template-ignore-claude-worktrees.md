- **`.claude/worktrees/` is gitignored:** Claude Code's worktree mode checks
  a branch out under that path inside the repo, and the directory otherwise
  shows as untracked in the main checkout. To apply: add the line to
  `.gitignore`.
