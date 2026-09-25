"""Apply the CEIBA II v2 branding to a fresh Apktool decode with smali.

CSRS_GOOGLE_MAPS_KEY must be set privately; never commit an APK or key.
Usage: python apply_v2.py DECODED_DIR ORIGINAL_SVG_PATH
"""
from pathlib import Path
import os
import re
import subprocess
import sys

base = Path(__file__).resolve().parent
decoded = Path(sys.argv[1]).resolve()
logo_source = Path(sys.argv[2]).resolve()
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
source = logo_source.read_text(encoding="utf-8-sig")
source = source.replace('<rect width="1024" height="1024" fill="#000000"/>', "")
(decoded / "assets" / "csrs_logo_animado.svg").write_text(source, encoding="utf-8")

splash = Path("res/layout/activity_splash.xml")
edit(splash, "</androidx.constraintlayout.widget.ConstraintLayout>",
     '    <com.customserviciosrs.ceiba.CsrsAnimatedLogo android:layout_width="160.0dp" android:layout_height="160.0dp" '
     'app:layout_constraintBottom_toBottomOf="parent" app:layout_constraintTop_toTopOf="parent" '
     'app:layout_constraintStart_toStartOf="parent" app:layout_constraintEnd_toEndOf="parent" '
     'app:layout_constraintVertical_bias="0.40" />\n</androidx.constraintlayout.widget.ConstraintLayout>')
login = Path("res/layout/activity_login.xml")
login_anchor = '        <TextView android:textSize="@dimen/login_title_text_size" android:textColor="@color/text_edit_color" android:id="@id/tv_login_title"'
edit(login, login_anchor,
     '        <com.customserviciosrs.ceiba.CsrsAnimatedLogo android:layout_width="115.0dp" '
     'android:layout_height="115.0dp" android:translationY="-32.0dp" '
     'app:layout_constraintTop_toTopOf="@id/guideline" '
     'app:layout_constraintStart_toStartOf="parent" app:layout_constraintEnd_toEndOf="parent" />\n'
     + login_anchor)

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
map_smali = Path("smali_classes2/com/streamax/ceibaii/map/view/FragmentRealTimeMap.smali")
edit(map_smali, "    :goto_1\n    return-void\n.end method\n\n.method public onDestroy()V",
     "    :goto_1\n"
     "    iget-object v0, p0, Lcom/streamax/ceibaii/map/view/FragmentRealTimeMap;->frameLayout:Landroid/widget/FrameLayout;\n"
     "    iget-object v1, p0, Lcom/streamax/ceibaii/map/view/FragmentRealTimeMap;->mRmMapView:Lcom/streamax/rmmapdemo/api/RmMapView;\n"
     "    invoke-static {v0, v1}, Lcom/customserviciosrs/ceiba/CsrsMapControls;->attach(Landroid/widget/FrameLayout;Landroid/view/View;)V\n"
     "    return-void\n.end method\n\n.method public onDestroy()V")
print("Applied animation, login title, Google Maps resource, and native map controls")
