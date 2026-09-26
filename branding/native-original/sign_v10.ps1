$ErrorActionPreference='Stop'
$src='C:\customserviciosrs\ceiba-fleet\branding\native-original'
$work='C:\customserviciosrs\ceiba-original-brand'
$tools='C:\Android\sdk\build-tools\35.0.0'
$signed=Join-Path $work 'CSRS-X-v10-ecuador-descargas.apk'
$env:CSRS_SIGNING_TEMP=[IO.File]::ReadAllText('C:\ceibaii-buildtools\signing\ceibaii-release-password.txt')
& (Join-Path $tools 'apksigner.bat') sign --ks 'C:\ceibaii-buildtools\signing\ceibaii-release.p12' --ks-type PKCS12 --ks-key-alias ceibaii --ks-pass env:CSRS_SIGNING_TEMP --key-pass env:CSRS_SIGNING_TEMP --out $signed (Join-Path $work 'CSRS-X-v10-aligned.apk')
if($LASTEXITCODE -ne 0){throw 'sign failed'}
& (Join-Path $tools 'apksigner.bat') verify --verbose $signed
if($LASTEXITCODE -ne 0){throw 'verify failed'}
& (Join-Path $tools 'aapt.exe') dump badging $signed | Select-Object -First 3
if($LASTEXITCODE -ne 0){throw 'badging failed'}
& python (Join-Path $src 'publish_version.py') $signed 'C:\customserviciosrs\ceiba-fleet\dist\downloads' 2025111109 2025111107
if($LASTEXITCODE -ne 0){throw 'publish failed'}