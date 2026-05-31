# SpaceMind Windows Release Build Script
# This script automates the complete release build process for Windows.

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Starting SpaceMind Release Build for Windows" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Check Node.js and dependencies
Write-Host "`n[1/3] Building frontend assets..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules not found. Running 'npm install' first..." -ForegroundColor Gray
    npm install
}
npm run build
Write-Host "Frontend build completed successfully." -ForegroundColor Green

# 2. Check Python Virtual Environment
Write-Host "`n[2/3] Checking Python virtual environment..." -ForegroundColor Yellow
$PythonPath = ".\env\Scripts\python.exe"
if (-not (Test-Path $PythonPath)) {
    Write-Error "Python virtual environment not found at .\env. Please create it first using 'python -m venv env' and install dependencies."
}

# Verify eel package is installed in venv
$EelCheck = & $PythonPath -c "import eel" 2>$null
if ($lastExitCode -ne 0) {
    Write-Host "Eel is not installed in the virtual environment. Installing dependencies..." -ForegroundColor Gray
    & $PythonPath -m pip install -r requirements.txt
}

# 3. Run PyInstaller via Eel or Spec File
Write-Host "`n[3/3] Building standalone executable with PyInstaller..." -ForegroundColor Yellow

$SpecFile = "space-mind-windows-v0.1.0.spec"
$PyInstallerPath = ".\env\Scripts\pyinstaller.exe"

if (Test-Path $SpecFile) {
    Write-Host "Found spec file: $SpecFile. Building using the spec file..." -ForegroundColor Cyan
    & $PyInstallerPath $SpecFile --clean
    $OutExe = "space-mind-windows-v0.1.0.exe"
} else {
    Write-Host "No spec file found. Building using Python-Eel arguments..." -ForegroundColor Gray
    $BuildCommand = @(
        "-m", "eel", 
        "main.py", 
        "dist_vite", 
        "--onefile", 
        "--splash", "splashfile.png", 
        "--path", "env/lib/site-packages", 
        "--noconsole", 
        "--name", "space-mind-windows-v0.1.0", 
        "--icon", "assets/app_icon.ico",
        "--clean"
    )
    & $PythonPath $BuildCommand
    $OutExe = "space-mind-windows-v0.1.0.exe"
}

if ($lastExitCode -eq 0) {
    Write-Host "`n=============================================" -ForegroundColor Green
    Write-Host " Build Completed Successfully! 🎉" -ForegroundColor Green
    Write-Host "Executable generated at: .\dist\$OutExe" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
} else {
    Write-Error "PyInstaller build failed."
}
