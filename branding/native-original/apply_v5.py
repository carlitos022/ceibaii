"""Apply the proven CEIBA X 0.8 splash/logo assets to the current native APK.
Usage: python apply_v5.py CURRENT_DECODE EXTRACTED_0_8_RES
Run after apply_v4.py. Keep signing/API keys outside Git.
"""
from pathlib import Path
from copy import deepcopy
from lxml import etree
import shutil, sys

root, old = map(lambda s: Path(s).resolve(), sys.argv[1:3])
res, src = root/'res', old/'res'
a='{http://schemas.android.com/apk/res/android}'
app='{http://schemas.android.com/apk/res-auto}'
def edit(path, before, after):
    s=path.read_text(encoding='utf-8')
    if s.count(before)!=1: raise RuntimeError(f'Unexpected source {path}: {before[:45]}')
    path.write_text(s.replace(before,after),encoding='utf-8')
def copy_resource(directory, name):
    source=src/directory/name
    if not source.is_file(): raise FileNotFoundError(source)
    dest=res/directory/name
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,dest)

copy_resource('drawable-xxhdpi','ceibaii_icon.png')
copy_resource('drawable-xxhdpi','ceibaii_icon_small.png')
copy_resource('drawable-xxhdpi','custom_logo.png')
copy_resource('drawable-xxhdpi','startup_bg.png')
copy_resource('drawable-xxhdpi','login_title.png')
(res/'drawable-xxhdpi/login_title.xml').unlink()
for p in (res/'drawable-nodpi').glob('csrs_splash_frame_*.png'): p.unlink()
for p in (res/'drawable-xxhdpi').glob('csrs_login_frame_*.png'): p.unlink()
for p in (res/'drawable-nodpi/csrs_splash_anim.xml',res/'drawable-nodpi/csrs_splash.png'):
    if p.exists(): p.unlink()
asset=root/'assets/ceiba_splash_anim.html'
shutil.copyfile(old/'assets/ceiba_splash_anim.html',asset)
legacy=root/'assets/csrs_logo_animado.svg'
if legacy.exists(): legacy.unlink()

splash=etree.parse(str(src/'layout/activity_splash.xml'))
web=splash.getroot().xpath('//*[@android:id="@id/splash_webview"]',namespaces={'android':a[1:-1]})
if len(web)!=1: raise RuntimeError('Missing CEIBA X WebView')
web[0].set(a+'id','@+id/splash_webview')
splash.write(str(res/'layout/activity_splash.xml'),encoding='utf-8',xml_declaration=True)

login=etree.parse(str(res/'layout/activity_login.xml'))
old_login=etree.parse(str(src/'layout/activity_login.xml'))
head=login.getroot()[0]
brand=etree.Element('LinearLayout',nsmap=head.nsmap)
brand.set(a+'orientation','vertical')
brand.set(a+'gravity','center')
brand.set(a+'layout_width','wrap_content')
brand.set(a+'layout_height','wrap_content')
brand.set(app+'layout_constraintStart_toStartOf','parent')
brand.set(app+'layout_constraintEnd_toEndOf','parent')
brand.set(app+'layout_constraintTop_toTopOf','@id/guideline')
for node in old_login.getroot()[6][:5]:
    child=deepcopy(node)
    ident=child.get(a+'id','')
    if ident.startswith('@id/'): child.set(a+'id','@+id/'+ident[4:])
    brand.append(child)
head.insert(1,brand)
for node in head:
    if node.get(a+'id','').split('/')[-1] in ('iv_login_title1','iv_login_title2','tv_login_title'):
        node.set(a+'alpha','0')
login.write(str(res/'layout/activity_login.xml'),encoding='utf-8',xml_declaration=True)

for file in ('strings.xml','colors.xml','dimens.xml'):
    target=res/'values'/file
    current=etree.parse(str(target)); previous=etree.parse(str(src/'values'/file))
    known={e.get('name') for e in current.getroot()}
    for item in previous.getroot():
        name=item.get('name','')
        if name.startswith('custom_') and name not in known:
            current.getroot().append(deepcopy(item)); known.add(name)
    current.write(str(target),encoding='utf-8',xml_declaration=True)

smali=root/'smali_classes2/com/streamax/ceibaii/login/view/SplashActivity.smali'
s=smali.read_text(encoding='utf-8')
start=s.index('.method public initViews()V')
end=s.index('.end method',start)
method=s[start:end]
if '.locals 3' not in method: raise RuntimeError('Unexpected SplashActivity registers')
method=method.replace('.locals 3','.locals 4',1)
needle='const/high16 v1, 0x3f800000  # 1.0f'
if method.count(needle)!=1: raise RuntimeError('Splash initial alpha changed')
method=method.replace(needle,'const/4 v1, 0x0',1)
if method.count('const-wide/16 v1, 0x1')!=1: raise RuntimeError('Splash duration changed')
method=method.replace('const-wide/16 v1, 0x1','const-wide/16 v1, 0xdac',1)
old_tail='    :csrs_splash_done\n    return-void\n'
new_tail='''    :csrs_splash_done
    invoke-virtual {p0}, Lcom/streamax/ceibaii/login/view/SplashActivity;->getResources()Landroid/content/res/Resources;
    move-result-object v3
    const-string v0, "splash_webview"
    const-string v1, "id"
    invoke-virtual {p0}, Lcom/streamax/ceibaii/login/view/SplashActivity;->getPackageName()Ljava/lang/String;
    move-result-object v2
    invoke-virtual {v3, v0, v1, v2}, Landroid/content/res/Resources;->getIdentifier(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)I
    move-result v0
    invoke-virtual {p0, v0}, Lcom/streamax/ceibaii/login/view/SplashActivity;->findViewById(I)Landroid/view/View;
    move-result-object v0
    check-cast v0, Landroid/webkit/WebView;
    if-eqz v0, :csrs_web_done
    const/4 v1, 0x0
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setBackgroundColor(I)V
    const-string v1, "file:///android_asset/ceiba_splash_anim.html"
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
    :csrs_web_done
    return-void
'''
if method.count(old_tail)!=1: raise RuntimeError('Splash tail changed')
method=method.replace(old_tail,new_tail)
smali.write_text(s[:start]+method+s[end:],encoding='utf-8')
edit(root/'apktool.yml','versionCode: 2025111103','versionCode: 2025111104')
print('CEIBA X SVG splash, login logo, app icon and v5 code ready')

