#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP_SRC="app/android/app/src/main/java/com/miko/ai"
mkdir -p "$APP_SRC"
cat > "$APP_SRC/AutoUpdatePlugin.java" <<'JAVA'
package com.miko.ai;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Environment;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AutoUpdate")
public class AutoUpdatePlugin extends Plugin {
    private BroadcastReceiver receiver;
    private long downloadId = -1;

    @PluginMethod
    public void start(PluginCall call) {
        String url = call.getString("url", "");
        if (url.isEmpty()) { call.reject("URL update kosong"); return; }
        Uri updateUri = Uri.parse(url);
        if (!"https".equalsIgnoreCase(updateUri.getScheme()) || !"github.com".equalsIgnoreCase(updateUri.getHost()) || !"/v1-byte/Miko-Ai/releases/download/latest/Miko-AI-main.apk".equals(updateUri.getPath())) { call.reject("URL update tidak tepercaya"); return; }
        try {
            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setTitle("Miko AI");
            request.setDescription("Pembaruan otomatis");
            request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, "miko-ai-update.apk");
            downloadId = manager.enqueue(request);
            receiver = new BroadcastReceiver() {
                @Override public void onReceive(Context context, Intent intent) {
                    if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction()) || intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != downloadId) return;
                    Uri apk = manager.getUriForDownloadedFile(downloadId);
                    if (apk != null) {
                        Intent install = new Intent(Intent.ACTION_VIEW, apk);
                        install.setDataAndType(apk, "application/vnd.android.package-archive");
                        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        getActivity().startActivity(install);
                    }
                    try { context.unregisterReceiver(this); } catch (Exception ignored) {}
                }
            };
            ContextCompat.registerReceiver(getContext(), receiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), ContextCompat.RECEIVER_NOT_EXPORTED);
            JSObject result = new JSObject(); result.put("started", true); call.resolve(result);
        } catch (Exception e) { call.reject("Auto-update gagal", e); }
    }
}
JAVA
MAIN="app/android/app/src/main/java/com/miko/ai/MainActivity.java"
python3 - "$MAIN" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text()
if 'AutoUpdatePlugin' not in s:
    s=s.replace('import com.getcapacitor.BridgeActivity;', 'import android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\nimport com.miko.ai.AutoUpdatePlugin;')
    s=s.replace('public class MainActivity extends BridgeActivity {', 'public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(AutoUpdatePlugin.class);\n        super.onCreate(savedInstanceState);\n    }')
    p.write_text(s)
manifest=Path('app/android/app/src/main/AndroidManifest.xml')
ms=manifest.read_text()
perm='<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />'
if perm not in ms:
    ms=ms.replace('<application', perm+'\n    <application', 1)
    manifest.write_text(ms)
PY
