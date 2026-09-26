package com.customserviciosrs.ceiba;
import android.graphics.*;
import android.graphics.drawable.Drawable;
import android.widget.TextView;
public final class CsrsGlyph extends Drawable {
  private final int type;
  public CsrsGlyph(int t){type=t;}
  public static void attach(TextView v,int type){
    CsrsGlyph icon=new CsrsGlyph(type);
    icon.setBounds(0,0,24,24);
    v.setText("");
    v.setCompoundDrawables(null,icon,null,null);
  }
  @Override public int getIntrinsicWidth(){return 24;}
  @Override public int getIntrinsicHeight(){return 24;}
  @Override public void draw(Canvas c){
    Rect b=getBounds();
    c.save();c.translate(b.left,b.top);
    c.scale(b.width()/24f,b.height()/24f);
    Paint p=new Paint(3);p.setColor(Color.WHITE);p.setStyle(Paint.Style.STROKE);
    p.setStrokeWidth(1.8f);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);
    if(type==1){
      Path path=new Path();
      path.moveTo(3,8);path.lineTo(12,4);path.lineTo(21,8);path.lineTo(12,12);path.close();c.drawPath(path,p);
      path.offset(0,5);c.drawPath(path,p);
      path.offset(0,4);c.drawPath(path,p);
    }else if(type==2){
      c.drawLine(3,9,3,3,p);c.drawLine(3,3,9,3,p);
      c.drawLine(15,3,21,3,p);c.drawLine(21,3,21,9,p);
      c.drawLine(3,15,3,21,p);c.drawLine(3,21,9,21,p);
      c.drawLine(15,21,21,21,p);c.drawLine(21,15,21,21,p);
    }else{
      c.drawLine(12,3,12,16,p);
      c.drawLine(7,11,12,16,p);c.drawLine(12,16,17,11,p);
      c.drawLine(4,20,20,20,p);c.drawLine(4,17,4,20,p);c.drawLine(20,17,20,20,p);
    }
    c.restore();
  }
  @Override public void setAlpha(int alpha){}
  @Override public void setColorFilter(android.graphics.ColorFilter filter){}
  @Override public int getOpacity(){return -3;}
}

