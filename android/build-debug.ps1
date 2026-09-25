$ErrorActionPreference = 'Continue'
$env:JAVA_HOME = 'C:\tools\jdk21\jdk-21.0.12.1+1'
$env:ANDROID_HOME = 'C:\Android\sdk'
$env:ANDROID_SDK_ROOT = 'C:\Android\sdk'
Set-Location 'C:\customserviciosrs\ceiba-fleet\android'
$log = Join-Path $PWD 'gradle-detached.log'
$exitFile = Join-Path $PWD 'gradle-exit-code.txt'
Remove-Item $log,$exitFile -Force -ErrorAction SilentlyContinue
try {
  & .\gradlew.bat assembleDebug --no-daemon --max-workers=1 --console=plain *> $log
  $code = $LASTEXITCODE
} catch {
  $_ | Out-File -FilePath $log -Append
  $code = 1
}
Set-Content -Path $exitFile -Value ([string]$code) -Encoding ASCII
exit $code
