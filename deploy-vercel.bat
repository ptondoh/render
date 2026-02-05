@echo off
echo.
echo ====================================
echo   Deploiement SAP vers Vercel
echo ====================================
echo.

REM Verifier si Vercel CLI est installe
where vercel >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [1/3] Installation de Vercel CLI...
    npm install -g vercel
) else (
    echo [1/3] Vercel CLI deja installe
)

echo.
echo [2/3] Preparation du build frontend...
cd frontend
call npm install
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERREUR: Le build a echoue!
    pause
    exit /b 1
)

cd ..
echo.
echo [3/3] Deploiement vers Vercel...
vercel --prod

echo.
echo ====================================
echo   Deploiement termine!
echo ====================================
echo.
echo Votre application est maintenant disponible en ligne.
echo Vercel vous a fourni une URL ci-dessus.
echo.
pause
