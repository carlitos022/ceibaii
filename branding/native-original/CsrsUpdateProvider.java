package com.customserviciosrs.ceiba;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.File;
import java.io.FileNotFoundException;
public final class CsrsUpdateProvider extends ContentProvider {
  @Override public boolean onCreate(){return true;}
  @Override public String getType(Uri uri){return "application/vnd.android.package-archive";}
  @Override public ParcelFileDescriptor openFile(Uri uri,String mode) throws FileNotFoundException {
    if(!"csrs-update.apk".equals(uri.getLastPathSegment())) throw new FileNotFoundException();
    File f=new File(getContext().getCacheDir(),"csrs-update.apk");
    return ParcelFileDescriptor.open(f,ParcelFileDescriptor.MODE_READ_ONLY);
  }
  @Override public Cursor query(Uri uri,String[] p,String s,String[] a,String o){return null;}
  @Override public Uri insert(Uri uri,ContentValues v){return null;}
  @Override public int delete(Uri uri,String s,String[] a){return 0;}
  @Override public int update(Uri uri,ContentValues v,String s,String[] a){return 0;}
}
