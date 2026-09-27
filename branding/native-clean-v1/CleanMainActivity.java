package com.customserviciosrs.ceiba;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;

public final class CleanMainActivity extends Activity {
  private static final String ORIGIN = "http://209.126.77.129:3000/";
  private static final String PAGE = ORIGIN + "?app=android";
  private FrameLayout root;
  private WebView web;
  private View loading;
  private String authJson;
  private boolean injected;
  private static String pendingUser;
  private static String pendingPassword;

  public static void capture(Object user) {
    try {
      pendingUser = String.valueOf(user.getClass().getMethod("getUserName").invoke(user));
      pendingPassword = String.valueOf(user.getClass().getMethod("getPassword").invoke(user));
    } catch (Exception ignored) {
      pendingUser = null;
      pendingPassword = null;
    }
  }

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
    root = new FrameLayout(this);
    root.setBackgroundColor(Color.rgb(7,21,35));
    web = new WebView(this);
    configureWebView();
    root.addView(web, new FrameLayout.LayoutParams(-1,-1));
    loading = buildLoading();
    root.addView(loading, new FrameLayout.LayoutParams(-1,-1));
    setContentView(root);
    authenticateAndOpen();
  }

  private void configureWebView() {
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    s.setUseWideViewPort(true);
    s.setLoadWithOverviewMode(false);
    web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
    web.setBackgroundColor(Color.rgb(7,21,35));
    web.setVisibility(View.INVISIBLE);
    web.addJavascriptInterface(new NativeBridge(), "CSRSVivoNative");
    web.setWebViewClient(new WebViewClient() {
      @Override public void onPageFinished(WebView view, String url) {
        if (authJson == null || !url.startsWith(ORIGIN)) return;
        if (!injected) {
          injected = true;
          String script = "localStorage.setItem('csrs_auth',"
            + JSONObject.quote(authJson)
            + ");location.replace('" + PAGE + "&ready=1')";
          view.evaluateJavascript(script, null);
          return;
        }
        if (url.contains("ready=1")) {
          view.setVisibility(View.VISIBLE);
          if (loading != null) loading.setVisibility(View.GONE);
        }
      }
      @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
        if (req.isForMainFrame()) runOnUiThread(() -> showError("No se pudo abrir CSRS X"));
      }
    });
    web.setDownloadListener(new DownloadListener() {
      @Override public void onDownloadStart(String url, String userAgent, String disposition,
                                            String mime, long length) {
        enqueueDownload(url, userAgent);
      }
    });
  }

  private View buildLoading() {
    LinearLayout panel = new LinearLayout(this);
    panel.setOrientation(LinearLayout.VERTICAL);
    panel.setGravity(Gravity.CENTER);
    panel.setBackgroundColor(Color.rgb(7,21,35));
    ProgressBar spinner = new ProgressBar(this);
    panel.addView(spinner, new LinearLayout.LayoutParams(dp(38), dp(38)));
    TextView title = new TextView(this);
    title.setText("Abriendo CSRS X");
    title.setTextColor(Color.WHITE);
    title.setTextSize(17);
    title.setGravity(Gravity.CENTER);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(48));
    lp.topMargin = dp(12);
    panel.addView(title, lp);
    return panel;
  }

  private void authenticateAndOpen() {
    new Thread(() -> {
      try {
        Object login = currentLogin();
        String username = login == null ? pendingUser : callString(login, "getUserName");
        String password = username != null && username.equalsIgnoreCase(pendingUser) ? pendingPassword : null;
        if (password == null || password.isEmpty()) password = login == null ? null : callString(login, "getPassword");
        if (password == null || password.isEmpty()) password = savedPassword(username);
        if (username == null || password == null || password.isEmpty()) throw new Exception("missing credentials");
        HttpURLConnection h = (HttpURLConnection)new URL(ORIGIN + "api/auth/login").openConnection();
        h.setRequestMethod("POST");
        h.setConnectTimeout(8000);
        h.setReadTimeout(8000);
        h.setDoOutput(true);
        h.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        byte[] body = new JSONObject().put("username", username).put("password", password)
          .toString().getBytes("UTF-8");
        try (OutputStream out = h.getOutputStream()) { out.write(body); }
        if (h.getResponseCode() != 200) throw new Exception("auth status");
        ByteArrayOutputStream data = new ByteArrayOutputStream();
        byte[] buf = new byte[2048];
        int n;
        try (InputStream in = h.getInputStream()) {
          while ((n = in.read(buf)) != -1) {
            data.write(buf,0,n);
            if (data.size() > 32768) throw new Exception("auth size");
          }
        }
        JSONObject response = new JSONObject(data.toString("UTF-8"));
        if (response.optInt("code") != 200 || !response.optBoolean("result")
            || response.optString("token").isEmpty()) throw new Exception("auth denied");
        JSONObject user = response.getJSONObject("user");
        if (!username.equalsIgnoreCase(user.optString("account"))) throw new Exception("account mismatch");
        HttpURLConnection verify = (HttpURLConnection)new URL(ORIGIN + "api/auth/verify").openConnection();
        verify.setRequestMethod("GET");
        verify.setConnectTimeout(8000);
        verify.setReadTimeout(8000);
        verify.setRequestProperty("Authorization", "Bearer " + response.getString("token"));
        int verifyStatus = verify.getResponseCode();
        verify.disconnect();
        if (verifyStatus != 200) throw new Exception("token verification failed");
        authJson = new JSONObject().put("token", response.getString("token"))
          .put("user", user).toString();
        pendingPassword = null;
        runOnUiThread(() -> web.loadUrl(PAGE + "&bootstrap=1"));
      } catch (Exception ex) {
        runOnUiThread(() -> showError("No se pudo iniciar la web con esta cuenta"));
      }
    }).start();
  }

  private Object currentLogin() {
    try {
      Object biz = Class.forName("com.streamax.ceibaii.biz.LoginBizImpl")
        .getMethod("getInstance").invoke(null);
      return biz.getClass().getMethod("getLoginUserEntity").invoke(biz);
    } catch (Exception ignored) { return null; }
  }

  private String savedPassword(String username) {
    if (username == null) return null;
    try {
      Object prefs = Class.forName("com.streamax.ceibaii.utils.SharedPreferencesUtil")
        .getMethod("getInstance").invoke(null);
      Object servers = prefs.getClass().getMethod("getLoginList").invoke(prefs);
      for (Object server : (List<?>)servers) {
        Object users = server.getClass().getMethod("getUserList").invoke(server);
        for (Object account : (List<?>)users) {
          String name = callString(account, "getUserName");
          if (username.equalsIgnoreCase(name)) return callString(account, "getPassword");
        }
      }
    } catch (Exception ignored) {}
    return null;
  }

  private String callString(Object target, String method) {
    try {
      Object value = target.getClass().getMethod(method).invoke(target);
      return value == null ? null : String.valueOf(value);
    } catch (Exception ignored) { return null; }
  }

  private void enqueueDownload(String url, String userAgent) {
    try {
      if (!url.startsWith(ORIGIN)) return;
      DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
      if (userAgent != null) req.addRequestHeader("User-Agent", userAgent);
      String cookie = CookieManager.getInstance().getCookie(ORIGIN);
      if (cookie != null) req.addRequestHeader("Cookie", cookie);
      req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      req.setTitle("Video CSRS X");
      DownloadManager dm = (DownloadManager)getSystemService(Context.DOWNLOAD_SERVICE);
      dm.enqueue(req);
      Toast.makeText(this, "Descarga iniciada", Toast.LENGTH_SHORT).show();
    } catch (Exception ex) {
      Toast.makeText(this, "No se pudo iniciar la descarga", Toast.LENGTH_SHORT).show();
    }
  }

  private void showError(String message) {
    if (loading instanceof LinearLayout) {
      LinearLayout panel = (LinearLayout)loading;
      panel.removeAllViews();
      TextView text = new TextView(this);
      text.setText(message);
      text.setTextColor(Color.WHITE);
      text.setTextSize(16);
      text.setGravity(Gravity.CENTER);
      panel.addView(text, new LinearLayout.LayoutParams(-1, dp(70)));
      TextView retry = new TextView(this);
      retry.setText("REINTENTAR");
      retry.setTextColor(Color.rgb(94,226,218));
      retry.setGravity(Gravity.CENTER);
      retry.setPadding(dp(20),dp(20),dp(20),dp(20));
      panel.addView(retry);
      retry.setOnClickListener(v -> { panel.removeAllViews(); finish(); startActivity(getIntent()); });
    }
  }

  private int dp(int value) {
    return (int)(getResources().getDisplayMetrics().density * value + 0.5f);
  }

  @Override public void onBackPressed() {
    if (web != null && web.canGoBack()) web.goBack();
    else super.onBackPressed();
  }

  private final class NativeBridge {
    @android.webkit.JavascriptInterface public void setMapFullscreen(boolean expand) {
      web.post(() -> {
        if (expand) {
          getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
          getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_FULLSCREEN);
        } else {
          getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
          getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        }
      });
    }
  }
}
