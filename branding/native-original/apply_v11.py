"""Apply the Vivo hooks to the CSRS X v10/v11 decoded project once."""
from pathlib import Path
import sys
root = Path(sys.argv[1]).resolve()
frag = root / 'smali_classes2/com/streamax/ceibaii/tab/view/FragmentOptions.smali'
raw = frag.read_text(encoding='utf-8')
attach = '    invoke-static {v0}, Lcom/customserviciosrs/ceiba/CsrsDownloadsTabs;->attach(Landroid/view/View;)V'
vivo_attach = '    invoke-static {v0}, Lcom/customserviciosrs/ceiba/CsrsVivoTabs;->attach(Landroid/view/View;)V'
monitor = '    invoke-static {}, Lcom/customserviciosrs/ceiba/CsrsDownloadsTabs;->showMonitor()V'
vivo_monitor = '    invoke-static {}, Lcom/customserviciosrs/ceiba/CsrsVivoTabs;->showMonitor()V'
assert raw.count(attach) == 1 and raw.count(monitor) == 1
if vivo_attach not in raw:
    raw = raw.replace(attach, attach + '\n\n' + vivo_attach)
if vivo_monitor not in raw:
    raw = raw.replace(monitor, monitor + '\n\n' + vivo_monitor)
assert raw.count(vivo_attach) == 1 and raw.count(vivo_monitor) == 1
frag.write_text(raw, encoding='utf-8')
login = root / 'smali_classes2/com/streamax/ceibaii/login/view/LoginActivity.smali'
raw = login.read_text(encoding='utf-8')
needle = '    invoke-static {v3}, Lcom/customserviciosrs/ceiba/CsrsDownloadsTabs;->capture(Ljava/lang/Object;)V'
vivo_capture = '    invoke-static {v3}, Lcom/customserviciosrs/ceiba/CsrsVivoTabs;->capture(Ljava/lang/Object;)V'
assert raw.count(needle) == 1
if vivo_capture not in raw:
    raw = raw.replace(needle, needle + '\n\n' + vivo_capture)
assert raw.count(vivo_capture) == 1
login.write_text(raw, encoding='utf-8')
meta = root / 'apktool.yml'
raw = meta.read_text(encoding='utf-8')
if 'versionCode: 2025111109' in raw:
    assert raw.count('versionCode: 2025111109') == 1
    meta.write_text(raw.replace('versionCode: 2025111109', 'versionCode: 2025111110'), encoding='utf-8')
else:
    assert raw.count('versionCode: 2025111110') == 1
(root / 'AndroidManifest.xml').touch()
print('CSRS X v11 native Vivo tab ready')