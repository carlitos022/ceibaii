package ec.customserviciosrs.webapp;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class UpdateManager {
    private static final String UPDATE_URL =
            "https://nacionalx.ddns.net/app/updates/nacional.json";
    private static final String EXPECTED_CERT_SHA256 =
            "a508631bc2305cb7bd8ca5740c79063e025d799724e5cb4e26180c60c2f5a9a1";
    private final Activity activity;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private JSONObject pendingUpdate;
    private boolean permissionRequested;
    private boolean checkStarted;

    public UpdateManager(Activity activity) {
        this.activity = activity;
    }

    public void checkForUpdates() {
        if (checkStarted) return;
        checkStarted = true;
        executor.execute(() -> {
            try {
                JSONObject update = fetchManifest();
                int remoteCode = update.getInt("versionCode");
                int localCode = getLocalVersionCode();
                if (remoteCode > localCode) {
                    activity.runOnUiThread(() -> showUpdateDialog(update));
                }
            } catch (Exception ignored) {
                // Una falla de red nunca debe impedir abrir CSRS X.
            }
        });
    }

    public void onResume() {
        if (!permissionRequested || pendingUpdate == null) return;
        if (canInstallPackages()) {
            permissionRequested = false;
            JSONObject update = pendingUpdate;
            pendingUpdate = null;
            downloadAndInstall(update);
        }
    }
    private JSONObject fetchManifest() throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(UPDATE_URL).openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        conn.setUseCaches(false);
        conn.setRequestProperty("Accept", "application/json");
        try (BufferedInputStream in = new BufferedInputStream(conn.getInputStream());
             java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            return new JSONObject(new String(
                    out.toByteArray(), java.nio.charset.StandardCharsets.UTF_8));
        } finally {
            conn.disconnect();
        }
    }

    private int getLocalVersionCode() throws Exception {
        PackageInfo info = activity.getPackageManager()
                .getPackageInfo(activity.getPackageName(), 0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return (int) info.getLongVersionCode();
        }
        return info.versionCode;
    }

    private void showUpdateDialog(JSONObject update) {
        String version = update.optString("versionName", "nueva");
        String notes = update.optString("notes", "Hay una nueva version disponible.");
        boolean mandatory = update.optBoolean("mandatory", false);
        AlertDialog.Builder builder = new AlertDialog.Builder(activity)
                .setTitle("Actualizacion CSRS X " + version)
                .setMessage(notes)
                .setPositiveButton("Actualizar", (dialog, which) -> prepareInstall(update));

        if (!mandatory) {
            builder.setNegativeButton("Mas tarde", null);
        }

        AlertDialog dialog = builder.create();
        dialog.setCancelable(!mandatory);
        dialog.setCanceledOnTouchOutside(!mandatory);
        dialog.show();
    }

    private void prepareInstall(JSONObject update) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !canInstallPackages()) {
            pendingUpdate = update;
            permissionRequested = true;
            Toast.makeText(activity,
                    "Activa Permitir desde esta fuente para actualizar CSRS X.",
                    Toast.LENGTH_LONG).show();
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(intent);
            return;
        }
        downloadAndInstall(update);
    }
    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || activity.getPackageManager().canRequestPackageInstalls();
    }

    private void downloadAndInstall(JSONObject update) {
        Toast.makeText(activity, "Descargando actualizacion...", Toast.LENGTH_SHORT).show();
        executor.execute(() -> {
            try {
                String apkUrl = update.getString("apkUrl");
                String expectedSha = update.getString("sha256").replace(":", "")
                        .toLowerCase(Locale.ROOT);

                File dir = new File(activity.getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new IllegalStateException("No se pudo crear carpeta temporal");
                }

                File apk = new File(dir, "CSRS-X-update.apk");
                downloadFile(apkUrl, apk);

                String actualSha = sha256(apk);
                if (!actualSha.equals(expectedSha)) {
                    apk.delete();
                    throw new SecurityException("SHA-256 no coincide");
                }

                int expectedVersionCode = update.getInt("versionCode");
                if (!isTrustedUpdate(apk, expectedVersionCode)) {
                    apk.delete();
                    throw new SecurityException("Firma, paquete o version APK no validos");
                }
                activity.runOnUiThread(() -> launchInstaller(apk));
            } catch (Exception e) {
                activity.runOnUiThread(() -> Toast.makeText(activity,
                        "No se pudo actualizar. Intenta nuevamente.",
                        Toast.LENGTH_LONG).show());
            }
        });
    }

    private void downloadFile(String url, File output) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(12000);
        conn.setReadTimeout(30000);
        conn.setInstanceFollowRedirects(true);
        try (BufferedInputStream in = new BufferedInputStream(conn.getInputStream());
             FileOutputStream out = new FileOutputStream(output)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.getFD().sync();
        } finally {
            conn.disconnect();
        }
    }

    private boolean isTrustedUpdate(File apk, int expectedVersionCode) throws Exception {
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;
        PackageInfo info = activity.getPackageManager()
                .getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (info == null || !activity.getPackageName().equals(info.packageName)) return false;

        long archiveCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.getLongVersionCode()
                : info.versionCode;
        if (archiveCode != expectedVersionCode) return false;

        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null) return false;
            signatures = info.signingInfo.hasMultipleSigners()
                    ? info.signingInfo.getApkContentsSigners()
                    : info.signingInfo.getSigningCertificateHistory();
        } else {
            signatures = info.signatures;
        }
        if (signatures == null || signatures.length == 0) return false;

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (Signature signature : signatures) {
            byte[] certHash = digest.digest(signature.toByteArray());
            StringBuilder hex = new StringBuilder();
            for (byte b : certHash) hex.append(String.format(Locale.ROOT, "%02x", b));
            if (EXPECTED_CERT_SHA256.equals(hex.toString())) return true;
            digest.reset();
        }
        return false;
    }
    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (BufferedInputStream in = new BufferedInputStream(
                new java.io.FileInputStream(file))) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : digest.digest()) {
            hex.append(String.format(Locale.ROOT, "%02x", b));
        }
        return hex.toString();
    }

    private void launchInstaller(File apk) {
        Uri uri = FileProvider.getUriForFile(
                activity,
                activity.getPackageName() + ".fileprovider",
                apk);

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
    }
}
