package com.customserviciosrs.ceiba;
import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.security.*;
import java.util.*;
public final class CsrsUpdateManager implements Application.ActivityLifecycleCallbacks {
  private static final String MANIFEST="http://209.126.77.129:3010/downloads/csrs-x-version.json";
  private static final String AUTHORITY="com.googlemap.ceibaii.csrsupdates";
  private final Application app;
  private Activity activity;
  private boolean checking,downloading,blocking;
  private JSONObject release;
  private AlertDialog dialog;
  private CsrsUpdateManager(Application app){this.app=app;}
  public static void init(Application app){app.registerActivityLifecycleCallbacks(new CsrsUpdateManager(app));}
  @Override public void onActivityResumed(Activity a){
    activity=a;
    if(a.getClass().getName().contains("SplashActivity"))return;
    if(blocking){if(dialog==null || !dialog.isShowing())showPrompt(a);return;}
    if(checking || downloading)return;
    checking=true;
    new Thread(()->check(a)).start();
  }
  private void check(Activity a){
    try {
      HttpURLConnection c=(HttpURLConnection)new URL(MANIFEST).openConnection();
      c.setConnectTimeout(7000);c.setReadTimeout(7000);
      if(c.getResponseCode()!=200)throw new IOException("version HTTP "+c.getResponseCode());
      ByteArrayOutputStream b=new ByteArrayOutputStream();
      byte[] buf=new byte[1024];int n;
      try(InputStream in=c.getInputStream()){while((n=in.read(buf))!=-1){b.write(buf,0,n);if(b.size()>16384)throw new IOException("metadata size");}}
      JSONObject j=new JSONObject(b.toString("UTF-8"));
      int installed=app.getPackageManager().getPackageInfo(app.getPackageName(),0).versionCode;
      if(!app.getPackageName().equals(j.getString("packageName")))throw new IOException("package mismatch");
      int minimum=j.getInt("minimumVersionCode"),latest=j.getInt("latestVersionCode");
      if(installed<minimum && latest>installed){
        release=j;blocking=true;
        a.runOnUiThread(()->{if(!a.isFinishing() && activity==a)showPrompt(a);});
      }
    }catch(Exception ex){android.util.Log.w("CsrsUpdate","Version check: "+ex.getMessage());}
    finally{checking=false;}
  }

  private void showPrompt(Activity a){
    if(dialog!=null && dialog.isShowing())return;
    dialog=new AlertDialog.Builder(a).setTitle("Actualizacion obligatoria")
      .setMessage("Hay una nueva version de CSRS X. Actualiza para continuar.")
      .setCancelable(false)
      .setPositiveButton("Actualizar",(d,w)->download(a))
      .setNegativeButton("Cancelar",(d,w)->a.finishAffinity()).create();
    dialog.show();
  }
  private void download(Activity a){
    if(downloading)return;
    downloading=true;
    ProgressBar bar=new ProgressBar(a,null,android.R.attr.progressBarStyleHorizontal);
    bar.setMax(100);bar.setProgress(0);
    LinearLayout box=new LinearLayout(a);box.setOrientation(LinearLayout.VERTICAL);
    int pad=(int)(24*a.getResources().getDisplayMetrics().density);
    box.setPadding(pad,pad,pad,pad);box.addView(bar);
    AlertDialog progress=new AlertDialog.Builder(a).setTitle("Descargando actualizacion")
      .setView(box).setCancelable(false)
      .setNegativeButton("Cancelar",(d,w)->{downloading=false;showPrompt(a);}).create();
    progress.show();
    new Thread(()->{
      File temp=new File(app.getCacheDir(),"csrs-update.tmp");
      File target=new File(app.getCacheDir(),"csrs-update.apk");
      try {
        String url=release.getString("apkUrl");
        if(!url.startsWith("http://209.126.77.129:3010/downloads/"))throw new IOException("URL no permitida");
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        c.setConnectTimeout(10000);c.setReadTimeout(20000);
        if(c.getResponseCode()!=200)throw new IOException("APK HTTP "+c.getResponseCode());
        long total=c.getContentLengthLong(),done=0;
        MessageDigest hash=MessageDigest.getInstance("SHA-256");
        byte[] bytes=new byte[32768];int n;
        try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(temp)){
          while((n=in.read(bytes))!=-1){
            if(!downloading)throw new IOException("Cancelado");
            out.write(bytes,0,n);hash.update(bytes,0,n);done+=n;
            int pct=total>0?(int)Math.min(100,done*100/total):0;
            a.runOnUiThread(()->bar.setProgress(pct));
          }
        }
        StringBuilder hex=new StringBuilder();for(byte b:hash.digest())hex.append(String.format(Locale.US,"%02x",b&255));
        if(!hex.toString().equalsIgnoreCase(release.getString("sha256")))throw new IOException("SHA-256 incorrecto");
        verifyPackage(temp,release.getInt("latestVersionCode"));
        if(target.exists())target.delete();
        if(!temp.renameTo(target))throw new IOException("No se pudo guardar APK");
        a.runOnUiThread(()->{progress.dismiss();downloading=false;showInstall(a);});
      }catch(Exception ex){
        temp.delete();a.runOnUiThread(()->{progress.dismiss();downloading=false;
          if(!"Cancelado".equals(ex.getMessage()))new AlertDialog.Builder(a).setTitle("Error de actualizacion")
            .setMessage(ex.getMessage()).setPositiveButton("Reintentar",(d,w)->download(a))
            .setNegativeButton("Salir",(d,w)->a.finishAffinity()).setCancelable(false).show();
        });
      }
    }).start();
  }

  private void verifyPackage(File apk,int expected) throws Exception{
    PackageManager pm=app.getPackageManager();
    PackageInfo incoming=pm.getPackageArchiveInfo(apk.getAbsolutePath(),PackageManager.GET_SIGNING_CERTIFICATES);
    PackageInfo current=pm.getPackageInfo(app.getPackageName(),PackageManager.GET_SIGNING_CERTIFICATES);
    if(incoming==null || !app.getPackageName().equals(incoming.packageName) || incoming.versionCode!=expected)
      throw new IOException("Paquete o version incorrectos");
    if(incoming.signingInfo==null || current.signingInfo==null)throw new IOException("Firma ausente");
    android.content.pm.Signature[] a=incoming.signingInfo.getApkContentsSigners();
    android.content.pm.Signature[] b=current.signingInfo.getApkContentsSigners();
    if(a.length!=b.length)throw new IOException("Firma distinta");
    for(int i=0;i<a.length;i++)if(!a[i].equals(b[i]))throw new IOException("Firma distinta");
  }
  private void install(Activity a){
    if(Build.VERSION.SDK_INT>=26 && !a.getPackageManager().canRequestPackageInstalls()){
      new AlertDialog.Builder(a).setTitle("Permitir instalacion")
        .setMessage("Android debe autorizar a CSRS X a instalar esta actualizacion. Al regresar, pulsa Instalar ahora.")
        .setPositiveButton("Abrir ajustes",(d,w)->{
          Intent i=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:"+app.getPackageName()));a.startActivity(i);
        }).setNegativeButton("Cancelar",(d,w)->showInstall(a)).setCancelable(false).show();
      return;
    }
    Intent i=new Intent(Intent.ACTION_VIEW);
    i.setDataAndType(Uri.parse("content://"+AUTHORITY+"/csrs-update.apk"),"application/vnd.android.package-archive");
    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    try{a.startActivity(i);}catch(Exception ex){new AlertDialog.Builder(a).setMessage("No se pudo abrir el instalador: "+ex.getMessage())
      .setPositiveButton("Reintentar",(d,w)->showInstall(a)).setNegativeButton("Salir",(d,w)->a.finishAffinity()).show();}
  }
  private void showInstall(Activity a){
    if(dialog!=null)dialog.dismiss();
    dialog=new AlertDialog.Builder(a).setTitle("Actualizacion descargada")
      .setMessage("El archivo esta listo. Android solicitara confirmar la instalacion.")
      .setPositiveButton("Instalar ahora",(d,w)->install(a))
      .setNegativeButton("Cancelar",(d,w)->a.finishAffinity()).setCancelable(false).create();
    dialog.show();
  }
  @Override public void onActivityPaused(Activity a){}
  @Override public void onActivityStarted(Activity a){}
  @Override public void onActivityStopped(Activity a){}
  @Override public void onActivityCreated(Activity a,Bundle b){}
  @Override public void onActivitySaveInstanceState(Activity a,Bundle b){}
  @Override public void onActivityDestroyed(Activity a){if(activity==a)activity=null;}
}

