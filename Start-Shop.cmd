@echo off
setlocal
cd /d "%~dp0"
set "ARCHENLICHT_NODE=node"
where node >nul 2>nul
if not errorlevel 1 goto runtime_ready
set "ARCHENLICHT_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%ARCHENLICHT_NODE%" goto runtime_ready
echo Node.js 24 oder neuer fehlt. Bitte https://nodejs.org/ verwenden.
exit /b 1
:runtime_ready
if "%~1"=="test" goto test
if "%~1"=="check" goto check
if "%~1"=="seed" goto seed
if "%~1"=="dev" goto dev
if "%~1"=="install" goto install
if "%~1"=="assets" goto assets
if "%~1"=="design-previews" goto design_previews
"%ARCHENLICHT_NODE%" --env-file-if-exists=.env server/index.js
exit /b %errorlevel%
:test
"%ARCHENLICHT_NODE%" --test --test-concurrency=1 tests/*.test.js
exit /b %errorlevel%
:check
"%ARCHENLICHT_NODE%" scripts/check.mjs
exit /b %errorlevel%
:seed
"%ARCHENLICHT_NODE%" --env-file-if-exists=.env scripts/seed.mjs
exit /b %errorlevel%
:dev
"%ARCHENLICHT_NODE%" --env-file-if-exists=.env --watch server/index.js
exit /b %errorlevel%
:install
where npm >nul 2>nul
if errorlevel 1 goto bundled_install
call npm install
exit /b %errorlevel%
:assets
"%ARCHENLICHT_NODE%" scripts/brand-assets.mjs
exit /b %errorlevel%
:design_previews
"%ARCHENLICHT_NODE%" scripts/design-preview.mjs
exit /b %errorlevel%
:bundled_install
"%ARCHENLICHT_NODE%" "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs" install
exit /b %errorlevel%
