param(
    [string]$Task
)

git worktree remove ".ai/worktrees/$Task" -f
git branch -D "task/$Task"