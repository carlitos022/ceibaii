"""Refine the native CSRS X splash and login after apply_v5.py."""
from pathlib import Path
from lxml import etree
from PIL import Image
import sys

root=Path(sys.argv[1]).resolve()
res=root/'res'
a='{http://schemas.android.com/apk/res/android}'
app='{http://schemas.android.com/apk/res-auto}'
for file in res.glob('values*/strings.xml'):
    tree=etree.parse(str(file))
    for item in tree.getroot():
        if item.get('name')=='app_name': item.text='CSRS X'
        if item.get('name')=='custom_brand_product': item.text='CSRS X'
    tree.write(str(file),encoding='utf-8',xml_declaration=True)
colors=res/'values/colors.xml'
tree=etree.parse(str(colors))
if not any(e.get('name')=='csrs_splash_navy' for e in tree.getroot()):
    c=etree.SubElement(tree.getroot(),'color',name='csrs_splash_navy')
    c.text='#020816'
tree.write(str(colors),encoding='utf-8',xml_declaration=True)
s=res/'values/styles.xml'
tree=etree.parse(str(s))
style=next(e for e in tree.getroot() if e.tag=='style' and e.get('name')=='AppTheme.Splash')
bg=next(e for e in style if e.get('name')=='android:windowBackground')
bg.text='@color/csrs_splash_navy'
tree.write(str(s),encoding='utf-8',xml_declaration=True)
v31=res/'values-v31/styles.xml'
tree=etree.parse(str(v31))
style=next((e for e in tree.getroot() if e.tag=='style' and e.get('name')=='AppTheme.Splash'),None)
if style is None: style=etree.SubElement(tree.getroot(),'style',name='AppTheme.Splash',parent='@style/Theme.AppCompat.NoActionBar')
for name,value in (
    ('android:windowBackground','@color/csrs_splash_navy'),
    ('android:windowSplashScreenBackground','@color/csrs_splash_navy'),
    ('android:windowSplashScreenAnimatedIcon','@drawable/csrs_blank_splash_icon')):
    e=next((x for x in style if x.get('name')==name),None)
    if e is None: e=etree.SubElement(style,'item',name=name)
    e.text=value
tree.write(str(v31),encoding='utf-8',xml_declaration=True)
blank=res/'drawable/csrs_blank_splash_icon.xml'
blank.write_text('<?xml version="1.0" encoding="utf-8"?><shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="@color/csrs_splash_navy"/></shape>',encoding='utf-8')

source=Image.open(res/'drawable-xxhdpi/custom_logo.png').convert('RGBA')
mark=source.crop((28,10,212,136))
target=Image.new('RGBA',(240,190),(0,0,0,0))
mark.thumbnail((212,170),Image.Resampling.LANCZOS)
target.alpha_composite(mark,((240-mark.width)//2,(190-mark.height)//2))
target.save(res/'drawable-xxhdpi/csrs_login_symbol.png',optimize=True)

layout=res/'layout/activity_login.xml'
tree=etree.parse(str(layout))
head=tree.getroot()[0]
brand=next(x for x in head if x.tag=='LinearLayout')
for extra in list(brand)[3:]: brand.remove(extra)
brand.attrib.pop(app+'layout_constraintTop_toTopOf',None)
brand.set(app+'layout_constraintTop_toTopOf','parent')
brand.set(app+'layout_constraintBottom_toBottomOf','parent')
brand.set(a+'layout_marginTop','8.0dp')
brand.set(a+'layout_marginBottom','8.0dp')
icon,title,company=list(brand)
icon.set(a+'src','@drawable/csrs_login_symbol')
icon.set(a+'layout_width','100.0dp')
icon.set(a+'layout_height','82.0dp')
icon.set(a+'scaleType','fitCenter')
icon.set(a+'layout_marginBottom','4.0dp')
title.set(a+'textSize','22.0sp')
title.set(a+'layout_marginTop','0.0dp')
title.set(a+'letterSpacing','0.05')
company.set(a+'textSize','11.0sp')
company.set(a+'layout_marginTop','2.0dp')
company.set(a+'letterSpacing','0.08')
tree.write(str(layout),encoding='utf-8',xml_declaration=True)
meta=root/'apktool.yml'
raw=meta.read_text(encoding='utf-8')
assert raw.count('versionCode: 2025111104')==1
meta.write_text(raw.replace('versionCode: 2025111104','versionCode: 2025111105'),encoding='utf-8')
print('CSRS X name, clean system splash and centered login branding applied')

