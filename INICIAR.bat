@echo off
setlocal
cd /d "%~dp0"
if not exist ".runtime\python\python.exe" (
  echo Python portatil ausente. Use o ZIP LABIELOS-APRESENTACAO-Windows-x64 completo.
  echo Consulte docs\apresentacao.md para executar pelo codigo-fonte.
  pause
  exit /b 1
)
".runtime\python\python.exe" run.py
if errorlevel 1 pause
