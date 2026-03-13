param(
    [string]$Task
)

$path = ".ai/worktrees/$Task"
$branch = "task/$Task"

git worktree add $path -b $branch

Write-Host "Worktree created:"
Write-Host $path

wt -w 0 new-tab -d $path