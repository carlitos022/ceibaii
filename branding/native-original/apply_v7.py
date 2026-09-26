"""Add final login motto and self-hosted mandatory APK update wiring after v6."""
from pathlib import Path
from lxml import etree
import sys
root=Path(sys.argv[1]).resolve()
a='{http://schemas.android.com/apk/res/android}'
layout=root/'res/layout/activity_login.xml'
tree=etree.parse(str(layout))
brand=next(x for x in tree.getroot()[0] if x.tag=='LinearLayout')
if not any(x.get(a+'text')=='TECNOLOGÍA, SEGURIDAD Y CONFIANZA' for x in brand):
    motto=etree.SubElement(brand,'TextView')
    for k,v in {'layout_width':'wrap_content','layout_height':'wrap_content',
      'layout_marginTop':'4.0dp','text':'TECNOLOGÍA, SEGURIDAD Y CONFIANZA',
      'textSize':'9.0sp','textColor':'@color/custom_text',
      'letterSpacing':'0.04','gravity':'center'}.items(): motto.set(a+k,v)
tree.write(str(layout),encoding='utf-8',xml_declaration=True)
manifest=root/'AndroidManifest.xml'
tree=etree.parse(str(manifest))
base=tree.getroot()
if not any(e.get(a+'name')=='android.permission.REQUEST_INSTALL_PACKAGES' for e in base):
    p=etree.Element('uses-permission');p.set(a+'name','android.permission.REQUEST_INSTALL_PACKAGES')
    base.insert(0,p)
application=base.find('application')
if not any(e.get(a+'name')=='com.customserviciosrs.ceiba.CsrsUpdateProvider' for e in application):
    p=etree.SubElement(application,'provider')
    p.set(a+'name','com.customserviciosrs.ceiba.CsrsUpdateProvider')
    p.set(a+'authorities','com.googlemap.ceibaii.csrsupdates')
    p.set(a+'exported','false');p.set(a+'grantUriPermissions','true')
tree.write(str(manifest),encoding='utf-8',xml_declaration=True)
smali=root/'smali/com/streamax/ceibaii/activity/Cb2App.smali'
raw=smali.read_text(encoding='utf-8')
needle='invoke-super {p0}, Landroid/app/Application;->onCreate()V'
assert raw.count(needle)==1
hook='invoke-static {p0}, Lcom/customserviciosrs/ceiba/CsrsUpdateManager;->init(Landroid/app/Application;)V'
if hook not in raw: raw=raw.replace(needle,needle+'\n\n    '+hook)
smali.write_text(raw,encoding='utf-8')
meta=root/'apktool.yml'
raw=meta.read_text(encoding='utf-8')
assert raw.count('versionCode: 2025111105')==1
meta.write_text(raw.replace('versionCode: 2025111105','versionCode: 2025111106'),encoding='utf-8')
print('CSRS X motto and updater wiring applied')

