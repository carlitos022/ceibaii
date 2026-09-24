@echo off
cd /d C:\customserviciosrs\ceiba2-web
start "ceiba2-web-server" /min node.exe --no-warnings --loader tsx node_modules/tsx/dist/cli.js server.ts
