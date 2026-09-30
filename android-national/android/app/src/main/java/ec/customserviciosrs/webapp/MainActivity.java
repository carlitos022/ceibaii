package ec.customserviciosrs.webapp;

import android.Manifest;
import android.app.DownloadManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int DOWNLOAD_PERMISSION_REQUEST = 4102;
    private UpdateManager updateManager;
    private String[] pendingDownload;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.getWebView().setBackgroundColor(android.graphics.Color.rgb(2, 12, 23));
        bridge.getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            Uri uri = Uri.parse(url);
            Uri origin = Uri.parse(bridge.getWebView().getUrl());
            if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    || origin.getHost() == null || !origin.getHost().equalsIgnoreCase(uri.getHost())
                    || origin.getPort() != uri.getPort()
                    || uri.getPath() == null || !uri.getPath().startsWith("/app/admin-downloader/")) {
                Toast.makeText(this, "Enlace de descarga no permitido", Toast.LENGTH_SHORT).show();
                return;
            }
            String[] download = {url, userAgent, contentDisposition, mimeType};
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                    && ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                pendingDownload = download;
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, DOWNLOAD_PERMISSION_REQUEST);
                return;
            }
            enqueueDownload(download);
        });
        updateManager = new UpdateManager(this);
        updateManager.checkForUpdates();
    }

    private void enqueueDownload(String[] download) {
        try {
            String fileName = URLUtil.guessFileName(download[0], download[2], download[3]);
            fileName = fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
            if (!fileName.toLowerCase().endsWith(".mp4")) fileName += ".mp4";
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(download[0]));
            String cookies = CookieManager.getInstance().getCookie(download[0]);
            if (cookies != null && !cookies.isEmpty()) request.addRequestHeader("Cookie", cookies);
            if (download[1] != null) request.addRequestHeader("User-Agent", download[1]);
            request.setTitle(fileName);
            request.setDescription("Biblioteca CSRS X Nacional");
            request.setMimeType("video/mp4");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            manager.enqueue(request);
            Toast.makeText(this, "Descarga iniciada. Consulta la bandeja de Android.", Toast.LENGTH_LONG).show();
        } catch (Exception error) {
            Toast.makeText(this, "No se pudo iniciar la descarga", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == DOWNLOAD_PERMISSION_REQUEST && pendingDownload != null) {
            String[] download = pendingDownload;
            pendingDownload = null;
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) enqueueDownload(download);
            else Toast.makeText(this, "Se necesita permiso para guardar en Descargas", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (updateManager != null) updateManager.onResume();
    }
}
