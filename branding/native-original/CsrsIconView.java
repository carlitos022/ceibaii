package com.customserviciosrs.ceiba;
import android.content.Context;
import android.graphics.Canvas;
import android.widget.TextView;
/** Draws the icon at a fixed dp size in the exact center of its touch target. */
public final class CsrsIconView extends TextView {
  private int type,size=28;
  public CsrsIconView(Context context){super(context);setIncludeFontPadding(false);}
  public void setIcon(int value,int dp){type=value;size=dp;invalidate();}
  @Override protected void onDraw(Canvas canvas){
    super.onDraw(canvas);
    if(type==0)return;
    int edge=(int)(size*getResources().getDisplayMetrics().density+0.5f);
    int x=(getWidth()-edge)/2,y=(getHeight()-edge)/2;
    CsrsGlyph icon=new CsrsGlyph(type);
    icon.setBounds(x,y,x+edge,y+edge);
    icon.draw(canvas);
  }
}
