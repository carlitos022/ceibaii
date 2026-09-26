package com.customserviciosrs.ceiba;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import org.json.JSONObject;
import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.util.*;
public final class CsrsDownloadsTabs {
  private static final String URL="http://209.126.77.129:12058/";
  private static String pendingUser,pendingPassword;
  private static View overlay,button,monitorView;
  private static boolean checking;
  private CsrsDownloadsTabs(){}
  public static void capture(Object user){
    try{pendingUser=String.valueOf(user.getClass().getMethod("getUserName").invoke(user));
      pendingPassword=String.valueOf(user.getClass().getMethod("getPassword").invoke(user));
    }catch(Exception ignored){pendingUser=null;pendingPassword=null;}
  }
  private static Object call(Object instance,String method)throws Exception{
    return instance.getClass().getMethod(method).invoke(instance);
  }
  private static Object singleton(String name,String method)throws Exception{
    return Class.forName(name).getMethod(method).invoke(null);
  }
  private static int id(Context c,String name){
    return c.getResources().getIdentifier(name,"id",c.getPackageName());
  }
  private static String currentUser(){
    try {Object biz=singleton("com.streamax.ceibaii.biz.LoginBizImpl","getInstance");
      Object login=call(biz,"getLoginUserEntity");
      return login==null?null:String.valueOf(call(login,"getUserName"));
    }catch(Exception ex){return null;}
  }
  private static String savedPassword(String user){
    try {
      Object prefs=singleton("com.streamax.ceibaii.utils.SharedPreferencesUtil","getInstance");
      Object servers=call(prefs,"getLoginList");
      for(Object server:(List<?>)servers){
        for(Object account:(List<?>)call(server,"getUserList")){
          if(user.equalsIgnoreCase(String.valueOf(call(account,"getUserName"))))
            return String.valueOf(call(account,"getPassword"));
        }
      }
    }catch(Exception ignored){}
    return null;
  }
  public static void attach(View root){
    if(root==null||checking)return;
    Context c=root.getContext();
    View monitor=root.findViewById(id(c,"tab_realtime_relativelayout"));
    LinearLayout bar=root.findViewById(id(c,"tab_ll"));
    FrameLayout content=root.findViewById(id(c,"tab_container"));
    if(monitor==null||bar==null||content==null)return;
    for(String n:new String[]{"tab_realbacktime_relativelayout","tab_datacenter_relativelayout","tab_setting_relativelayout"}){
      View v=root.findViewById(id(c,n));if(v!=null)v.setVisibility(View.GONE);
    }
    if(bar.getTag()!=null)return;
    bar.setTag("csrs-tabs");
    bar.setPadding(dp(c,12),dp(c,3),dp(c,12),dp(c,3));
    bar.setBackgroundColor(0xff081426);
    monitor.setBackground(round(c,0xff152940));
    String account=currentUser();
    if(account==null||!"admin".equalsIgnoreCase(account))return;
    String password=account.equalsIgnoreCase(pendingUser)?pendingPassword:savedPassword(account);
    pendingPassword=null;
    if(password==null||password.isEmpty())return;
    checking=true;
    new Thread(()->authenticate(root,bar,content,monitor,account,password)).start();
  }
  private static int dp(Context c,int n){return (int)(c.getResources().getDisplayMetrics().density*n+.5f);}
  private static GradientDrawable round(Context c,int color){
    GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(c,12));return d;
  }
  private static void authenticate(View root,LinearLayout bar,FrameLayout content,View monitor,String user,String password){
    try{
      HttpURLConnection h=(HttpURLConnection)new URL(URL+"api/auth/login").openConnection();
      h.setRequestMethod("POST");h.setConnectTimeout(8000);h.setReadTimeout(8000);
      h.setDoOutput(true);h.setRequestProperty("Content-Type","application/json; charset=utf-8");
      byte[] body=new JSONObject().put("username",user).put("password",password).toString().getBytes("UTF-8");
      try(OutputStream out=h.getOutputStream()){out.write(body);}
      if(h.getResponseCode()!=200)return;
      ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] buf=new byte[1024];int n;
      try(InputStream in=h.getInputStream()){while((n=in.read(buf))!=-1){b.write(buf,0,n);if(b.size()>8192)return;}}
      JSONObject result=new JSONObject(b.toString("UTF-8"));
      if(result.getJSONObject("user").getInt("rid")!=1)return;
      String cookie=h.getHeaderField("Set-Cookie");
      if(cookie==null||!cookie.startsWith("sd_session="))return;
      root.post(()->{
        android.webkit.CookieManager cm=android.webkit.CookieManager.getInstance();cm.setAcceptCookie(true);
        cm.setCookie(URL,cookie);cm.flush();addTab(root,bar,content,monitor);
      });
    }catch(Exception ex){android.util.Log.w("CsrsTabs","Descargas no disponibles: "+ex.getClass().getSimpleName());}
    finally{checking=false;}
  }

  private static void addTab(View root,LinearLayout bar,FrameLayout content,View monitor){
    if(root.getWindowToken()==null||!"admin".equalsIgnoreCase(currentUser()))return;
    Context c=root.getContext();
    LinearLayout item=new LinearLayout(c);item.setOrientation(LinearLayout.VERTICAL);
    item.setGravity(Gravity.CENTER);item.setBackground(round(c,0xff152940));
    TextView icon=new TextView(c);icon.setGravity(Gravity.CENTER);
    CsrsGlyph.attach(icon,3);
    item.addView(icon,new LinearLayout.LayoutParams(dp(c,28),dp(c,25)));
    TextView caption=new TextView(c);caption.setText("Descargas");caption.setTextSize(11);
    caption.setTextColor(0xff83ddeb);caption.setGravity(Gravity.CENTER);
    item.addView(caption,new LinearLayout.LayoutParams(-1,dp(c,20)));
    LinearLayout.LayoutParams pos=new LinearLayout.LayoutParams(0,-1,1);
    pos.leftMargin=dp(c,10);bar.addView(item,pos);
    button=item;monitorView=monitor;
    item.setOnClickListener(v->{
      if(overlay==null||overlay.getParent()!=content){
        if(overlay!=null&&overlay.getParent() instanceof android.view.ViewGroup)
          ((android.view.ViewGroup)overlay.getParent()).removeView(overlay);
        WebView web=new WebView(c);
        web.setBackgroundColor(0xfff3f7fb);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
          @Override public void onPageFinished(WebView view,String url){
            view.evaluateJavascript("document.getElementById('login-view')?.remove()",null);
          }
        });
        web.setDownloadListener((link,agent,disposition,mime,length)->{
          try{
            if(!link.startsWith(URL))return;
            android.app.DownloadManager.Request req=new android.app.DownloadManager.Request(android.net.Uri.parse(link));
            req.addRequestHeader("Cookie",android.webkit.CookieManager.getInstance().getCookie(URL));
            req.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setTitle("Video CEIBA X");
            android.app.DownloadManager dm=(android.app.DownloadManager)c.getSystemService(Context.DOWNLOAD_SERVICE);
            dm.enqueue(req);
            Toast.makeText(c,"Descarga iniciada",Toast.LENGTH_SHORT).show();
          }catch(Exception ex){Toast.makeText(c,"No se pudo iniciar la descarga",Toast.LENGTH_SHORT).show();}
        });
        content.addView(web,new FrameLayout.LayoutParams(-1,-1));
        overlay=web;web.loadUrl(URL);
      }else overlay.setVisibility(View.VISIBLE);
      monitor.setBackground(round(c,0xff081426));item.setBackground(round(c,0xff21476a));
    });
  }
  public static void showMonitor(){
    if(overlay!=null)overlay.setVisibility(View.GONE);
    if(button!=null)button.setBackground(round(button.getContext(),0xff152940));
    if(monitorView!=null)monitorView.setBackground(round(monitorView.getContext(),0xff152940));
  }
}

