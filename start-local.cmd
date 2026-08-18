@echo off
setlocal
set "CODEX_NODE=C:\Users\Asus\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "CODEX_PNPM=C:\Users\Asus\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"

where node >nul 2>nul
if errorlevel 1 if exist "%CODEX_NODE%\node.exe" set "PATH=%CODEX_NODE%;%PATH%"

where pnpm >nul 2>nul
if not errorlevel 1 (
  pnpm run dev
) else if exist "%CODEX_PNPM%" (
  call "%CODEX_PNPM%" run dev
) else (
  echo Node.js and pnpm were not found. Install Node.js LTS, then run: corepack enable
  exit /b 1
)
