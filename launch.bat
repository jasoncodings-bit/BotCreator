

cd /d "%~dp0"
llama-server.exe --model "Qwen3.6-27B-uncensored-heretic-v2-Q4_K_M.gguf" ^
--mmproj "Qwen3.6-27B-mmproj-BF16.gguf" ^
--jinja ^
--host 0.0.0.0 ^
--port 8081 ^
-c 48000 ^
-ctv q8_0 ^
-ctk q8_0 ^
--reasoning off ^
--tools all

pause
pause
