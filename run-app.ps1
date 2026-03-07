# 从 exe 所在目录启动，避免找不到 Microsoft.ui.xaml.dll
$ErrorActionPreference = "Stop"
$proj = "src/ContextMaster.UI/ContextMaster.UI.csproj"
$outDir = "src/ContextMaster.UI/bin/x64/Debug/net8.0-windows10.0.18362.0"

# 若未构建或需重建，先构建
if (-not (Test-Path "$outDir/ContextMaster.UI.exe")) {
    Write-Host "Building..."
    dotnet build $proj -p Platform=x64 -v q
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Push-Location $outDir
try {
    & .\ContextMaster.UI.exe
} finally {
    Pop-Location
}
