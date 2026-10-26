package com.avgust.hero;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // не гасить экран во время игры
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // рисуем и в зоне выреза под камеру, иначе в альбомной ориентации сбоку чёрная полоса
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        // ровные 60 Гц: на экранах 90/120 Гц кадры игры скачут 8–50 мс (рывки «то быстро, то медленно»),
        // а при 60 Гц каждый кадр одинаковой длины и совпадает с шагом физики. Заодно меньше греется.
        WindowManager.LayoutParams rate = getWindow().getAttributes();
        rate.preferredRefreshRate = 60f;
        getWindow().setAttributes(rate);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // после сворачивания/шторки системные панели снова прячем
        if (hasFocus) hideSystemBars();
    }

    /** Полный экран: прячем статус-бар и навигацию, свайп от края показывает их ненадолго. */
    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
