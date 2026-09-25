@echo off
setlocal
set JAVA_HOME=C:\tools\jdk21\jdk-21.0.12.1+1
set ANDROID_HOME=C:\Android\Sdk
set ANDROID_SDK_ROOT=C:\Android\Sdk
set GRADLE_USER_HOME=C:\Users\Administrator\.gradle
cd /d C:\customserviciosrs\ceiba-fleet\android
del /q task-build.log task-build-exit.txt 2>nul
call gradlew.bat assembleDebug --no-daemon --max-workers=1 --console=plain -Dorg.gradle.internal.instrumentation.agent=false > task-build.log 2>&1
set RC=%ERRORLEVEL%
echo %RC%>task-build-exit.txt
exit /b %RC%
