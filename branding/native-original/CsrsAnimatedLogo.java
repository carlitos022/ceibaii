package com.customserviciosrs.ceiba;

import android.content.Context;
import android.graphics.Color;
import android.util.AttributeSet;
import android.webkit.WebView;

/** Displays the original animated SVG, without affecting login controls. */
public final class CsrsAnimatedLogo extends WebView {
    public CsrsAnimatedLogo(Context context, AttributeSet attrs) {
        super(context, attrs);
        setBackgroundColor(Color.TRANSPARENT);
        setVerticalScrollBarEnabled(false);
        setHorizontalScrollBarEnabled(false);
        getSettings().setAllowFileAccess(true);
        loadUrl("file:///android_asset/csrs_logo_animado.svg");
    }
}
