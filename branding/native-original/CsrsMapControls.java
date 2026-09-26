package com.customserviciosrs.ceiba;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.DialogInterface;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

/** Small controls over the existing native map; never recreates map or markers. */
public final class CsrsMapControls {
    private final FrameLayout originalFrame;
    private final View map;
    private Dialog dialog;
    private ViewGroup.LayoutParams previousParams;

    private CsrsMapControls(FrameLayout frame, View mapView) {
        originalFrame = frame;
        map = mapView;
        addControls(frame, false);
    }

    public static void attach(FrameLayout frame, View mapView) {
        if (frame != null && mapView != null) new CsrsMapControls(frame, mapView);
    }

    private int dp(int size) {
        return (int) (size * originalFrame.getResources().getDisplayMetrics().density + 0.5f);
    }

    private TextView button(String label, String description) {
        TextView button = new TextView(originalFrame.getContext());
        button.setText(label);
        button.setContentDescription(description);
        button.setTextSize(19);
        button.setTextColor(Color.WHITE);
        button.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xD8203044);
        bg.setCornerRadius(dp(10));
        bg.setStroke(dp(1), 0x9948C7ED);
        button.setBackground(bg);
        button.setElevation(dp(3));
        return button;
    }

    private void addControls(FrameLayout parent, final boolean expanded) {
        LinearLayout bar = new LinearLayout(parent.getContext());
        bar.setOrientation(LinearLayout.VERTICAL);
        TextView layers = button("", "Elegir capa del mapa");
        CsrsGlyph.attach(layers, 1);
        TextView full = button("", expanded ? "Volver al mapa normal" : "Pantalla completa");
        CsrsGlyph.attach(full, 2);
        LinearLayout.LayoutParams item = new LinearLayout.LayoutParams(dp(42), dp(42));
        item.bottomMargin = dp(7);
        bar.addView(layers, item);
        bar.addView(full, new LinearLayout.LayoutParams(dp(42), dp(42)));
        FrameLayout.LayoutParams place = new FrameLayout.LayoutParams(dp(42), dp(91), Gravity.TOP | Gravity.RIGHT);
        place.topMargin = dp(14);
        place.rightMargin = dp(12);
        parent.addView(bar, place);
        layers.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { chooseLayer(); }
        });
        full.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (expanded) dialog.dismiss(); else enterFullscreen();
            }
        });
    }

    private Object googleMap() throws Exception {
        Field field = map.getClass().getDeclaredField("mGoogleMap");
        field.setAccessible(true);
        return field.get(map);
    }

    private void chooseLayer() {
        final Activity activity = (Activity) originalFrame.getContext();
        final Object google;
        try { google = googleMap(); }
        catch (Exception ex) { Toast.makeText(activity, "Mapa no disponible", Toast.LENGTH_SHORT).show(); return; }
        if (google == null) { Toast.makeText(activity, "Esperando al mapa", Toast.LENGTH_SHORT).show(); return; }
        int selected = 0;
        try {
            Method getType = google.getClass().getMethod("getMapType");
            selected = ((Integer) getType.invoke(google)).intValue() == 4 ? 1 : 0;
        } catch (Exception ignored) { }
        new AlertDialog.Builder(activity)
            .setTitle("Capa del mapa")
            .setSingleChoiceItems(new String[]{"Calles", "Sat\u00e9lite con calles"}, selected,
                new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface popup, int which) {
                        try {
                            google.getClass().getMethod("setMapType", Integer.TYPE)
                                  .invoke(google, which == 0 ? 1 : 4);
                        } catch (Exception ex) {
                            Toast.makeText(activity, "No se pudo cambiar la capa", Toast.LENGTH_SHORT).show();
                        }
                        popup.dismiss();
                    }
                }).setNegativeButton("Cancelar", null).show();
    }

    private void enterFullscreen() {
        Activity activity = (Activity) originalFrame.getContext();
        previousParams = map.getLayoutParams();
        originalFrame.removeView(map);
        final FrameLayout fullFrame = new FrameLayout(activity);
        fullFrame.setBackgroundColor(Color.BLACK);
        fullFrame.addView(map, new FrameLayout.LayoutParams(-1, -1));
        addControls(fullFrame, true);
        dialog = new Dialog(activity, android.R.style.Theme_NoTitleBar_Fullscreen);
        dialog.setContentView(fullFrame);
        dialog.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface ignored) {
                fullFrame.removeView(map);
                originalFrame.addView(map, 0, previousParams);
                dialog = null;
            }
        });
        Window window = dialog.getWindow();
        if (window != null) {
            window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
        }
        dialog.show();
    }
}

