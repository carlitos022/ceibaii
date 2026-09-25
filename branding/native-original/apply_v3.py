"""Apply CEIBA II v3 branding to a fresh Apktool decode with smali.

CSRS_GOOGLE_MAPS_KEY must be set privately; never commit an APK or key.
Usage: python apply_v3.py DECODED_DIR
"""
from pathlib import Path
import os
import re
import subprocess
import sys

base = Path(__file__).resolve().parent
decoded = Path(sys.argv[1]).resolve()
key = os.environ.get("CSRS_GOOGLE_MAPS_KEY", "")
if not key.startswith("AIza"):
    raise SystemExit("Set CSRS_GOOGLE_MAPS_KEY to an authorized Google Maps Android key")


def edit(path, old, new):
    file = decoded / path
    content = file.read_text(encoding="utf-8-sig")
    if content.count(old) != 1:
        raise RuntimeError("Unexpected resource or smali structure: " + str(path))
    file.write_text(content.replace(old, new), encoding="utf-8")


subprocess.run([sys.executable, str(base / "brand_original.py"), str(decoded)], check=True)
subprocess.run([sys.executable, str(base / "brand_v2.py"), str(decoded)], check=True)
subprocess.run([sys.executable, str(base / "brand_frames.py"), str(decoded)], check=True)
edit(Path("apktool.yml"), "  versionCode: 2025111101", "  versionCode: 2025111102")

splash = Path("res/layout/activity_splash.xml")
edit(splash, 'android:src="@drawable/csrs_splash"',
     'android:src="@drawable/csrs_splash_anim"')

strings_path = decoded / "res/values/strings.xml"
strings = strings_path.read_text(encoding="utf-8-sig")
strings, count = re.subn(r'(<string name="google_map_key">)[^<]*(</string>)',
                         lambda m: m[1] + key + m[2], strings)
if count != 1:
    raise RuntimeError("Google Maps key resource not found")
strings_path.write_text(strings, encoding="utf-8")

smali = Path("smali_classes2/com/streamax/ceibaii/login/view/SplashActivity.smali")
edit(smali, "    const-wide/16 v1, 0x3e8\n\n    .line 60\n    invoke-virtual {v0, v1, v2}, Landroid/view/animation/AlphaAnimation;->setDuration(J)V",
     "    const-wide/16 v1, 0xc1c\n\n    .line 60\n    invoke-virtual {v0, v1, v2}, Landroid/view/animation/AlphaAnimation;->setDuration(J)V")
edit(smali, "    invoke-virtual {v0, v1}, Landroid/widget/ImageView;->startAnimation(Landroid/view/animation/Animation;)V\n\n    return-void\n.end method\n\n.method public loginServer()V",
     "    invoke-virtual {v0, v1}, Landroid/widget/ImageView;->startAnimation(Landroid/view/animation/Animation;)V\n\n"
     "    iget-object v0, p0, Lcom/streamax/ceibaii/login/view/SplashActivity;->mSplashImageView:Landroid/widget/ImageView;\n"
     "    invoke-virtual {v0}, Landroid/widget/ImageView;->getDrawable()Landroid/graphics/drawable/Drawable;\n"
     "    move-result-object v0\n    instance-of v1, v0, Landroid/graphics/drawable/AnimationDrawable;\n"
     "    if-eqz v1, :csrs_splash_done\n    check-cast v0, Landroid/graphics/drawable/AnimationDrawable;\n"
     "    invoke-virtual {v0}, Landroid/graphics/drawable/AnimationDrawable;->start()V\n"
     "    :csrs_splash_done\n    return-void\n.end method\n\n.method public loginServer()V")
login_smali = Path("smali_classes2/com/streamax/ceibaii/login/view/LoginActivity.smali")
edit(login_smali, "    :cond_0\n    return-void\n.end method\n\n.method public isTlsEnabled()Z",
     "    :cond_0\n"
     "    iget-object v0, p0, Lcom/streamax/ceibaii/login/view/LoginActivity;->mLoginTitle2Image:Landroid/widget/ImageView;\n"
     "    invoke-virtual {v0}, Landroid/widget/ImageView;->getDrawable()Landroid/graphics/drawable/Drawable;\n"
     "    move-result-object v0\n    instance-of v1, v0, Landroid/graphics/drawable/AnimationDrawable;\n"
     "    if-eqz v1, :csrs_login_done\n    check-cast v0, Landroid/graphics/drawable/AnimationDrawable;\n"
     "    invoke-virtual {v0}, Landroid/graphics/drawable/AnimationDrawable;->start()V\n"
     "    :csrs_login_done\n    return-void\n.end method\n\n.method public isTlsEnabled()Z")
map_smali = Path("smali_classes2/com/streamax/ceibaii/map/view/FragmentRealTimeMap.smali")
edit(map_smali, "    :goto_1\n    return-void\n.end method\n\n.method public onDestroy()V",
     "    :goto_1\n"
     "    iget-object v0, p0, Lcom/streamax/ceibaii/map/view/FragmentRealTimeMap;->frameLayout:Landroid/widget/FrameLayout;\n"
     "    iget-object v1, p0, Lcom/streamax/ceibaii/map/view/FragmentRealTimeMap;->mRmMapView:Lcom/streamax/rmmapdemo/api/RmMapView;\n"
     "    invoke-static {v0, v1}, Lcom/customserviciosrs/ceiba/CsrsMapControls;->attach(Landroid/widget/FrameLayout;Landroid/view/View;)V\n"
     "    return-void\n.end method\n\n.method public onDestroy()V")
print("Applied native logo frames, login title, Google Maps resource, and map controls")
