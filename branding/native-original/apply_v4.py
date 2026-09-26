"""Brand CEIBA II with the web logo reveal, retaining the native login and Monitor.
Run against a fresh Apktool decode with CSRS_GOOGLE_MAPS_KEY set privately.
"""
from pathlib import Path
import subprocess,sys
base=Path(__file__).resolve().parent
target=Path(sys.argv[1]).resolve()
subprocess.run([sys.executable,str(base/'apply_v3.py'),str(target)],check=True)
p=target/'smali_classes2/com/streamax/ceibaii/login/view/SplashActivity.smali'
s=p.read_text(encoding='utf-8')
old='    const/4 v1, 0x0\n\n    const/high16 v2, 0x3f800000'
assert s.count(old)==1 and s.count('const-wide/16 v1, 0xc1c')==1
s=s.replace(old,'    const/high16 v1, 0x3f800000  # 1.0f\n\n    const/high16 v2, 0x3f800000')
s=s.replace('const-wide/16 v1, 0xc1c','const-wide/16 v1, 0x1')
p.write_text(s,encoding='utf-8')
p=target/'apktool.yml'
s=p.read_text(encoding='utf-8')
assert s.count('versionCode: 2025111102')==1
p.write_text(s.replace('versionCode: 2025111102','versionCode: 2025111103'),encoding='utf-8')
print('Web-style logo reveal applied; no full-screen alpha transition')
