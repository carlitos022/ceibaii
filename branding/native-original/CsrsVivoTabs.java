package com.customserviciosrs.ceiba;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;

/** Web Vivo shares the CMS account and leaves Monitor and Descargas untouched. */
public final class CsrsVivoTabs {
  private static final String ORIGIN="http://209.126.77.129:3000/";
  private static final String PAGE=ORIGIN+"?embed=vivo";
  private static String pendingUser,pendingPassword;
  private static FrameLayout content,holder;
  private static LinearLayout item;
  private static View monitor;
  private static WebView web;
  private static String authJson;
  private static boolean loading,installed;
  private CsrsVivoTabs(){}

  public static void capture(Object user){
    try {
      pendingUser=String.valueOf(user.getClass().getMethod("getUserName").invoke(user));
      pendingPassword=String.valueOf(user.getClass().getMethod("getPassword").invoke(user));
      authJson=null;
    } catch(Exception ignored){pendingUser=null;pendingPassword=null;authJson=null;}
  }
  private static Object call(Object object,String method)throws Exception {
    return object.getClass().getMethod(method).invoke(object);
  }
  private static Object singleton(String name,String method)throws Exception {
    return Class.forName(name).getMethod(method).invoke(null);
  }
  private static String currentUser(){
    try {
      Object biz=singleton("com.streamax.ceibaii.biz.LoginBizImpl","getInstance");
      Object user=call(biz,"getLoginUserEntity");
      return user==null?null:String.valueOf(call(user,"getUserName"));
    }catch(Exception ignored){return null;}
  }
  private static String savedPassword(String name){
    try {
      Object prefs=singleton("com.streamax.ceibaii.utils.SharedPreferencesUtil","getInstance");
      for(Object server:(List<?>)call(prefs,"getLoginList"))
        for(Object user:(List<?>)call(server,"getUserList"))
          if(name.equalsIgnoreCase(String.valueOf(call(user,"getUserName"))))
            return String.valueOf(call(user,"getPassword"));
    }catch(Exception ignored){}
    return null;
  }
  private static int dp(Context c,int n){return (int)(c.getResources().getDisplayMetrics().density*n+.5f);}
  private static GradientDrawable background(Context c,int color){
    GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(c,12));return d;
  }
  private static int id(Context c,String name){
    return c.getResources().getIdentifier(name,"id",c.getPackageName());
  }
  public static void attach(View root){
    if(root==null)return;
    Context c=root.getContext();
    LinearLayout bar=root.findViewById(id(c,"tab_ll"));
    FrameLayout body=root.findViewById(id(c,"tab_container"));
    View nativeMonitor=root.findViewById(id(c,"tab_realtime_relativelayout"));
    if(bar==null||body==null||nativeMonitor==null||currentUser()==null)return;
    if(bar.findViewWithTag("csrs-vivo")!=null)return;
    content=body;monitor=nativeMonitor;
    LinearLayout tab=new LinearLayout(c);tab.setTag("csrs-vivo");
    tab.setOrientation(LinearLayout.VERTICAL);tab.setGravity(Gravity.CENTER);
    tab.setBackground(background(c,0xff152940));tab.setContentDescription("Abrir Vivo");
    tab.setMinimumHeight(dp(c,56));
    tab.setForeground(new android.graphics.drawable.RippleDrawable(
      android.content.res.ColorStateList.valueOf(0x4461e1df),null,null));
    tab.addView(new Eye(c),new LinearLayout.LayoutParams(dp(c,40),dp(c,30)));
    TextView label=new TextView(c);label.setText("Vivo");label.setTextSize(13);
    label.setTextColor(0xff83ddeb);label.setGravity(Gravity.CENTER);
    label.setSingleLine(true);label.setIncludeFontPadding(false);
    tab.addView(label,new LinearLayout.LayoutParams(-1,dp(c,24)));
    LinearLayout.LayoutParams pos=new LinearLayout.LayoutParams(0,-1,1);
    pos.leftMargin=dp(c,8);bar.addView(tab,pos);item=tab;
    tab.setOnClickListener(v->open(root));
    bar.getViewTreeObserver().addOnGlobalLayoutListener(()->linkDownloads(bar));
    linkDownloads(bar);
  }
  private static void linkDownloads(LinearLayout bar){
    for(int i=0;i<bar.getChildCount();i++){
      View child=bar.getChildAt(i);
      if(child==item||child==monitor||"csrs-vivo-linked".equals(child.getTag()))continue;
      if(child instanceof ViewGroup && hasDownloads((ViewGroup)child)){
        child.setTag("csrs-vivo-linked");
        child.setOnTouchListener((v,e)->{if(e.getAction()==MotionEvent.ACTION_DOWN)showMonitor();return false;});
      }
    }
  }
  private static boolean hasDownloads(ViewGroup group){
    for(int i=0;i<group.getChildCount();i++){
      View child=group.getChildAt(i);
      if(child instanceof TextView && "Descargas".equals(((TextView)child).getText().toString()))return true;
      if(child instanceof ViewGroup && hasDownloads((ViewGroup)child))return true;
    }
    return false;
  }
  private static void open(View root){
    CsrsDownloadsTabs.showMonitor();
    Context c=root.getContext();
    if(holder!=null&&holder.getParent()!=content){
      if(holder.getParent() instanceof ViewGroup)
        ((ViewGroup)holder.getParent()).removeView(holder);
      holder=null;web=null;installed=false;
    }
    if(holder==null){
      holder=new FrameLayout(c);holder.setBackgroundColor(0xff071523);
      content.addView(holder,new FrameLayout.LayoutParams(-1,-1));
      web=new WebView(c);web.setVisibility(View.INVISIBLE);
      web.setBackgroundColor(0xff071523);
      web.getSettings().setJavaScriptEnabled(true);
      web.getSettings().setDomStorageEnabled(true);
      web.getSettings().setAllowFileAccess(false);
      web.getSettings().setAllowContentAccess(false);
      web.getSettings().setMediaPlaybackRequiresUserGesture(false);
      web.setWebViewClient(new WebViewClient(){
        @Override public void onPageFinished(WebView view,String url){
          if(!url.startsWith(ORIGIN)||authJson==null)return;
          if(!installed){
            installed=true;
            String script="localStorage.setItem('csrs_auth',"+JSONObject.quote(authJson)+");location.replace('"+PAGE+"&ready=1')";
            view.evaluateJavascript(script,null);
          }else if(url.contains("ready=1")&&holder!=null&&holder.getVisibility()==View.VISIBLE){
            for(int i=holder.getChildCount()-1;i>=0;i--)
              if(holder.getChildAt(i)!=view)holder.removeViewAt(i);
            view.setVisibility(View.VISIBLE);
          }
        }
        @Override public void onReceivedError(WebView view,android.webkit.WebResourceRequest req,android.webkit.WebResourceError err){
          if(req.isForMainFrame())view.post(()->error(root,"No se pudo abrir Vivo"));
        }
      });
      holder.addView(web,new FrameLayout.LayoutParams(-1,-1));
      loading(root);
      startAuth(root);
    }else{
      holder.setVisibility(View.VISIBLE);
      if(web!=null&&web.getVisibility()!=View.VISIBLE&&authJson!=null)web.reload();
    }
    holder.bringToFront();monitor.setBackground(background(c,0xff081426));item.setBackground(background(c,0xff21476a));
  }
  private static TextView message(Context c,String value){
    TextView label=new TextView(c);label.setText(value);label.setTextColor(0xffffffff);
    label.setTextSize(17);label.setGravity(Gravity.CENTER);return label;
  }
  private static void loading(View root){
    TextView label=message(root.getContext(),"Cargando Vivo...");
    holder.addView(label,new FrameLayout.LayoutParams(-1,-1));
  }
  private static void error(View root,String message){
    if(holder==null||holder.getVisibility()!=View.VISIBLE)return;
    holder.removeAllViews();
    LinearLayout panel=new LinearLayout(root.getContext());panel.setGravity(Gravity.CENTER);
    panel.setOrientation(LinearLayout.VERTICAL);
    panel.addView(message(root.getContext(),message));
    TextView retry=message(root.getContext(),"REINTENTAR");retry.setTextColor(0xff5ee2da);
    retry.setPadding(dp(root.getContext(),24),dp(root.getContext(),24),dp(root.getContext(),24),dp(root.getContext(),24));
    panel.addView(retry);holder.addView(panel,new FrameLayout.LayoutParams(-1,-1));
    retry.setOnClickListener(v->{holder.removeAllViews();holder.addView(web,new FrameLayout.LayoutParams(-1,-1));
      web.setVisibility(View.INVISIBLE);installed=false;loading(root);startAuth(root);});
  }
  private static void startAuth(View root){
    if(loading)return;
    String username=currentUser();
    String password=username!=null&&username.equalsIgnoreCase(pendingUser)?pendingPassword:savedPassword(username);
    if(username==null||password==null||password.isEmpty()){
      error(root,"Vuelve a iniciar sesion en CSRS X");return;
    }
    loading=true;
    new Thread(()->{
      try {
        HttpURLConnection h=(HttpURLConnection)new URL(ORIGIN+"api/auth/login").openConnection();
        h.setRequestMethod("POST");h.setConnectTimeout(8000);h.setReadTimeout(8000);
        h.setDoOutput(true);h.setRequestProperty("Content-Type","application/json; charset=utf-8");
        byte[] bytes=new JSONObject().put("username",username).put("password",password).toString().getBytes("UTF-8");
        try(OutputStream out=h.getOutputStream()){out.write(bytes);}
        if(h.getResponseCode()!=200)throw new Exception("auth status");
        ByteArrayOutputStream data=new ByteArrayOutputStream();byte[] buf=new byte[1024];int n;
        try(InputStream in=h.getInputStream()){
          while((n=in.read(buf))!=-1){data.write(buf,0,n);if(data.size()>16384)throw new Exception("auth size");}
        }
        JSONObject response=new JSONObject(data.toString("UTF-8"));
        if(response.optInt("code")!=200||!response.optBoolean("result")||response.optString("token").isEmpty())throw new Exception("auth denied");
        JSONObject user=response.getJSONObject("user");
        if(!username.equalsIgnoreCase(user.optString("account")))throw new Exception("account mismatch");
        HttpURLConnection verify=(HttpURLConnection)new URL(ORIGIN+"api/auth/verify").openConnection();
        verify.setRequestMethod("GET");verify.setConnectTimeout(8000);verify.setReadTimeout(8000);
        verify.setRequestProperty("Authorization","Bearer "+response.getString("token"));
        int status=verify.getResponseCode();verify.disconnect();
        if(status!=200)throw new Exception("token verification failed");
        String session=new JSONObject().put("token",response.getString("token")).put("user",user).toString();
        root.post(()->{authJson=session;pendingPassword=null;if(web!=null&&holder!=null&&holder.getVisibility()==View.VISIBLE){installed=false;web.loadUrl(PAGE);}});
      }catch(Exception ex){root.post(()->error(root,"No se pudo abrir Vivo con esta cuenta"));}
      finally{loading=false;}
    }).start();
  }
  public static void showMonitor(){
    if(holder!=null)holder.setVisibility(View.GONE);
    if(item!=null)item.setBackground(background(item.getContext(),0xff152940));
    if(monitor!=null)monitor.setBackground(background(monitor.getContext(),0xff152940));
  }
  private static final class Eye extends View {
    private final Paint paint=new Paint(3);
    Eye(Context c){super(c);}
    @Override protected void onDraw(Canvas canvas){
      super.onDraw(canvas);float cx=getWidth()/2f,cy=getHeight()/2f,d=getResources().getDisplayMetrics().density;
      Path eye=new Path();eye.moveTo(cx-12*d,cy);eye.quadTo(cx,cy-11*d,cx+12*d,cy);
      eye.quadTo(cx,cy+11*d,cx-12*d,cy);eye.close();
      paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(2*d);paint.setColor(0xffffffff);
      canvas.drawPath(eye,paint);paint.setStyle(Paint.Style.FILL);canvas.drawCircle(cx,cy,3.6f*d,paint);
    }
  }
}