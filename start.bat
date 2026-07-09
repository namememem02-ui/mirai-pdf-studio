@echo off
title PDF Support (Port 4200)
cd /d "%~dp0"
start "" http://localhost:4200
call npm run dev
