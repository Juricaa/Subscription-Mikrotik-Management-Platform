@echo off
cd /d %~dp0

echo Nettoyage des installations precedentes...
if exist node_modules rmdir /s /q node_modules
if exist pnpm-lock.yaml del /q pnpm-lock.yaml
if exist pnpm-workspace.yaml del /q pnpm-workspace.yaml

echo Verification du cache npm...
npm cache verify

echo Installation avec npm uniquement...
npm install --no-audit --no-fund
if errorlevel 1 goto error

echo Lancement du serveur Vite...
npm run dev
if errorlevel 1 goto error

goto end

:error
echo.
echo Une erreur npm est survenue. Si tu vois "Exit handler never called!", reinstalle Node.js LTS puis relance ce fichier.
pause
exit /b 1

:end
pause
