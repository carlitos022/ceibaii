from pathlib import Path
import re, shutil, sys

root=Path(sys.argv[1])
newpkg="com.customserviciosrs.csrsx"

# Manifest
p=root/"AndroidManifest.xml"
s=p.read_text(encoding="utf-8")
s=s.replace("com.googlemap.ceibaii",newpkg)
# Clean v1 has no self-updater: remove its install permission and provider declaration.
s=re.sub(r'\s*<uses-permission\b[^>]*android:name="android\.permission\.REQUEST_INSTALL_PACKAGES"[^>]*/>',"",s)
s=re.sub(r'\s*<provider\b[^>]*android:name="com\.customserviciosrs\.ceiba\.CsrsUpdateProvider"[^>]*/>',"",s)
for name in [
 "com.streamax.ceibaii.tab.view.MainActivity",
 "com.streamax.ceibaii.real.view.RealVideoActivity",
 "com.streamax.ceibaii.back.view.RealPlaybackActivity",
 "com.streamax.ceibaii.datacenter.view.DataCenterMapActivity",
 "com.streamax.ceibaii.evidence.view.EvidenceDetailActivity",
 "com.streamax.ceibaii.evidence.view.EvidenceDetailLogActivity",
]:
    s=re.sub(r'\s*<activity\b[^>]*android:name="'+re.escape(name)+r'"[^>]*/>',"",s)
anchor='<activity android:label="@string/app_name" android:name="com.streamax.ceibaii.login.view.LoginActivity" android:screenOrientation="portrait" android:theme="@style/AppTheme.LoginTheme"/>'
if anchor not in s:
    anchor='<activity android:label="@string/app_name" android:name="com.streamax.ceibaii.login.view.LoginActivity" android:screenOrientation="portrait" android:theme="@style/AppTheme.LoginTheme" />'
assert anchor in s, "login activity anchor missing"
clean='<activity android:exported="false" android:launchMode="singleTask" android:name="com.customserviciosrs.ceiba.CleanMainActivity" android:screenOrientation="portrait"/>'
s=s.replace(anchor,anchor+"\n        "+clean,1)
p.write_text(s,encoding="utf-8")

# Login captures only clean activity.
p=root/"smali_classes2/com/streamax/ceibaii/login/view/LoginActivity.smali"
s=p.read_text(encoding="utf-8")
s=s.replace("    invoke-static {v3}, Lcom/customserviciosrs/ceiba/CsrsDownloadsTabs;->capture(Ljava/lang/Object;)V\n\n","")
s=s.replace("    invoke-static {v3}, Lcom/customserviciosrs/ceiba/CsrsVivoTabs;->capture(Ljava/lang/Object;)V\n\n","")
marker="    invoke-direct {p0, p1, v0, v3}, Lcom/streamax/ceibaii/login/view/LoginActivity;->login"
assert marker in s
s=s.replace(marker,"    invoke-static {v3}, Lcom/customserviciosrs/ceiba/CleanMainActivity;->capture(Ljava/lang/Object;)V\n\n"+marker,1)
p.write_text(s,encoding="utf-8")

# Successful native login goes straight to clean web shell.
p=root/"smali_classes2/com/streamax/ceibaii/login/view/BaseLogin.smali"
s=p.read_text(encoding="utf-8").replace(
 "Lcom/streamax/ceibaii/tab/view/MainActivity;",
 "Lcom/customserviciosrs/ceiba/CleanMainActivity;"
)
p.write_text(s,encoding="utf-8")

# Remove v15 updater + adapt package-specific service action.
p=root/"smali/com/streamax/ceibaii/activity/Cb2App.smali"
s=p.read_text(encoding="utf-8")
s=s.replace("    invoke-static {p0}, Lcom/customserviciosrs/ceiba/CsrsUpdateManager;->init(Landroid/app/Application;)V\n\n","")
s=s.replace("com.googlemap.ceibaii",newpkg)
p.write_text(s,encoding="utf-8")

# BuildConfig identity/version.
p=root/"smali/com/streamax/ceibaii/BuildConfig.smali"
s=p.read_text(encoding="utf-8")
s=s.replace("com.googlemap.ceibaii",newpkg)
s=re.sub(r'\.field public static final VERSION_CODE:I = .*','.field public static final VERSION_CODE:I = 0x1',s,count=1)
s=re.sub(r'\.field public static final VERSION_NAME:Ljava/lang/String; = ".*"','.field public static final VERSION_NAME:Ljava/lang/String; = "1.0.0"',s,count=1)
p.write_text(s,encoding="utf-8")

# Package literals known to be used by push/runtime helpers.
for rel in [
 "smali_classes2/com/streamax/ceibaii/login/view/TestActivity.smali",
 "smali_classes2/com/streamax/ceibaii/push/MyFirebaseMessagingService.smali",
 "smali_classes2/com/streamax/ceibaii/push/MyJpushReceiver.smali",
]:
    p=root/rel
    if p.exists():
        s=p.read_text(encoding="utf-8").replace("com.googlemap.ceibaii",newpkg)
        if rel.endswith("MyJpushReceiver.smali"):
            s=s.replace("com.streamax.ceibaii.tab.view.MainActivity","com.customserviciosrs.ceiba.CleanMainActivity")
        p.write_text(s,encoding="utf-8")

# v1 metadata.
p=root/"apktool.yml"
s=p.read_text(encoding="utf-8")
s=re.sub(r"versionCode:\s*\d+","versionCode: 1",s,count=1)
s=re.sub(r"versionName:\s*[^\r\n]+","versionName: 1.0.0",s,count=1)
p.write_text(s,encoding="utf-8")

# Remove old custom helper dex sources and native Fleet/tab UI.
for rel in [
 "smali_classes3",
 "smali_classes2/com/streamax/ceibaii/tab/view",
 "smali_classes2/com/streamax/ceibaii/tab/viewmodel",
]:
    t=root/rel
    if t.exists():
        shutil.rmtree(t)

print("FINAL_PATCH_OK")
