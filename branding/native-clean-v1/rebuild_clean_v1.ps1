$ErrorActionPreference='Stop'

$src='C:\customserviciosrs\ceiba-fleet\branding\native-clean-v1'
$v15='C:\customserviciosrs\ceiba-original-brand\functional-backups\CSRS-X-v15-STABLE\CSRS-X-v15-vivo-web.apk'
$decoded='C:\CSRSX_CLEAN_REBUILD_V1'
$work='C:\customserviciosrs\ceiba-original-brand'
$android='C:\Android\sdk'
$tools=Join-Path $android 'build-tools\35.0.0'
$platform=Join-Path $android 'platforms\android-36\android.jar'
$apktool='C:\tools\apktool\apktool_3.0.3.jar'
$classes=Join-Path $work 'clean-v1-helper-classes'
$dex=Join-Path $work 'clean-v1-helper-dex'
$pre=Join-Path $work 'CSRS-X-Clean-v1-premerge.apk'
$unsigned=Join-Path $work 'CSRS-X-Clean-v1-unsigned.apk'
$aligned=Join-Path $work 'CSRS-X-Clean-v1-aligned.apk'
$signed=Join-Path $work 'CSRS-X-Clean-v1.apk'
$signDir='C:\ceibaii-buildtools\signing-csrsx-clean'
$dest='C:\customserviciosrs\ceiba-fleet\dist\downloads\CSRS-X-Clean-v1.apk'

if (!(Test-Path $v15)) { throw 'Missing frozen v15 APK' }
if (!(Test-Path (Join-Path $signDir 'csrsx-clean-release.p12'))) { throw 'Missing Clean v1 keystore' }
if (!(Test-Path (Join-Path $signDir 'csrsx-clean-password.txt'))) { throw 'Missing Clean v1 signing password' }

Remove-Item $decoded,$classes,$dex -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $classes,$dex | Out-Null

& java -jar $apktool d -j 1 $v15 -o $decoded
if ($LASTEXITCODE -ne 0) { throw 'apktool decode failed' }

& python (Join-Path $src 'apply_clean_final.py') $decoded
if ($LASTEXITCODE -ne 0) { throw 'clean patch failed' }

& javac -nowarn -source 8 -target 8 -encoding UTF-8 -classpath $platform -d $classes (Join-Path $src 'CleanMainActivity.java')
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }

$compiled=Get-ChildItem $classes -Recurse -Filter '*.class' | ForEach-Object FullName
& (Join-Path $tools 'd8.bat') --min-api 24 --lib $platform --output $dex $compiled
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }

& java -jar $apktool b -j 1 $decoded -o $pre
if ($LASTEXITCODE -ne 0) { throw 'apktool build failed' }

& python (Join-Path $src 'merge_helper_dex.py') $pre (Join-Path $dex 'classes.dex') $unsigned
if ($LASTEXITCODE -ne 0) { throw 'dex merge failed' }

& (Join-Path $tools 'zipalign.exe') -f -p 4 $unsigned $aligned
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

$env:CSRSX_SIGN_PASS=[IO.File]::ReadAllText((Join-Path $signDir 'csrsx-clean-password.txt')).Trim()
try {
  & (Join-Path $tools 'apksigner.bat') sign --ks (Join-Path $signDir 'csrsx-clean-release.p12') --ks-type PKCS12 --ks-key-alias csrsx-clean --ks-pass env:CSRSX_SIGN_PASS --key-pass env:CSRSX_SIGN_PASS --out $signed $aligned
  if ($LASTEXITCODE -ne 0) { throw 'sign failed' }
  & (Join-Path $tools 'apksigner.bat') verify --verbose --print-certs $signed
  if ($LASTEXITCODE -ne 0) { throw 'signature verify failed' }
} finally {
  Remove-Item Env:CSRSX_SIGN_PASS -ErrorAction SilentlyContinue
}

$badging=& (Join-Path $tools 'aapt.exe') dump badging $signed
if ($LASTEXITCODE -ne 0) { throw 'badging failed' }
$packageLine=$badging | Select-Object -First 1
if ($packageLine -notmatch "name='com\.customserviciosrs\.csrsx'") { throw 'unexpected package' }
if ($packageLine -notmatch "versionCode='1'") { throw 'unexpected versionCode' }

Copy-Item $signed $dest -Force
Get-FileHash $signed -Algorithm SHA256 | Format-List Algorithm,Hash,Path
Write-Output "Published: $dest"
