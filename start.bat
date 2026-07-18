@echo off
title Mee-a-rai PDF Studio (Port 4200)
cd /d "%~dp0"
start "" http://localhost:4200
call npm run dev
