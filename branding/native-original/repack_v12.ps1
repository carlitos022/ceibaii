$ErrorActionPreference='Stop'
$src='C:\customserviciosrs\ceiba-fleet\branding\native-original'
$work='C:\customserviciosrs\ceiba-original-brand'
$sdk='C:\Android\sdk'
$tools=Join-Path $sdk 'build-tools\35.0.0'
$classes=Get-ChildItem $src -Filter 'Csrs*.java' | ForEach-Object FullName
& javac -nowarn -source 8 -target 8 -encoding UTF-8 -classpath (Join-Path $sdk 'platforms\android-36\android.jar') -d (Join-Path $work 'helper-classes') $classes
if($LASTEXITCODE -ne 0){throw 'javac failed'}
$compiled=Get-ChildItem (Join-Path $work 'helper-classes') -Recurse -Filter '*.class' | ForEach-Object FullName
& (Join-Path $tools 'd8.bat') --min-api 24 --lib (Join-Path $sdk 'platforms\android-36\android.jar') --output (Join-Path $work 'helper-dex') $compiled
if($LASTEXITCODE -ne 0){throw 'd8 failed'}
& python (Join-Path $src 'merge_helper_dex.py') (Join-Path $work 'CSRS-X-v12-premerge.apk') (Join-Path $work 'helper-dex\classes.dex') (Join-Path $work 'CSRS-X-v12-unsigned.apk')
if($LASTEXITCODE -ne 0){throw 'merge failed'}
& (Join-Path $tools 'zipalign.exe') -f -p 4 (Join-Path $work 'CSRS-X-v12-unsigned.apk') (Join-Path $work 'CSRS-X-v12-aligned.apk')
if($LASTEXITCODE -ne 0){throw 'zipalign failed'}
$signed=Join-Path $work 'CSRS-X-v12-vivo-fix.apk'
$env:CSRS_SIGNING_TEMP=[IO.File]::ReadAllText('C:\ceibaii-buildtools\signing\ceibaii-release-password.txt')
& (Join-Path $tools 'apksigner.bat') sign --ks 'C:\ceibaii-buildtools\signing\ceibaii-release.p12' --ks-type PKCS12 --ks-key-alias ceibaii --ks-pass env:CSRS_SIGNING_TEMP --key-pass env:CSRS_SIGNING_TEMP --out $signed (Join-Path $work 'CSRS-X-v12-aligned.apk')
if($LASTEXITCODE -ne 0){throw 'sign failed'}
& (Join-Path $tools 'apksigner.bat') verify --verbose $signed
if($LASTEXITCODE -ne 0){throw 'verify failed'}
& (Join-Path $tools 'aapt.exe') dump badging $signed | Select-Object -First 3
if($LASTEXITCODE -ne 0){throw 'version failed'}
& python (Join-Path $src 'publish_version.py') $signed 'C:\customserviciosrs\ceiba-fleet\dist\downloads' 2025111111 2025111107
if($LASTEXITCODE -ne 0){throw 'publish failed'}