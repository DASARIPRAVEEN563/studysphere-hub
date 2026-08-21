# Building the SKNSH Android app (APK)

The website is now also packaged as a real Android app with Capacitor. Once
installed, it lives in the phone's internal app storage with its own app icon,
its own private data folder, and no browser cache limits.

## One-time setup on your laptop

1. Install **Android Studio** (includes the Android SDK + JDK 21).
2. Push this project to GitHub and clone it on the laptop.
3. In the project folder:

```bash
npm install
npx cap add android
npx cap sync android
```

## Connect your mobile phone

You can either run the app directly from Android Studio or install the APK file
you build.

### Option A: Run straight from Android Studio (fastest for testing)

1. On your phone, open **Settings → About phone** and tap **Build number** 7
times until it says "You are now a developer".
2. Go back to **Settings → System → Developer options** and turn on
**USB debugging**.
3. Connect the phone to your laptop with a USB cable.
4. In Android Studio, click the run button (green triangle) or choose the phone
from the device dropdown and press **Run**.

### Option B: Build and share the APK file

```bash
cd android
./gradlew assembleDebug          # Windows: gradlew.bat assembleDebug
```

The APK appears at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Send `app-debug.apk` to students via WhatsApp, Telegram, Google Drive, or USB.
They tap the file on their phone and tap **Install**. If it warns about
"unknown sources", allow installation from that app.

## Build the shareable APK

Same as Option B above. Use this whenever you want a file you can send to
others.

## Play Store / signed release

```bash
cd android
./gradlew bundleRelease
```

Then sign `app/build/outputs/bundle/release/app-release.aab` with a keystore
created in Android Studio (Build → Generate Signed Bundle).

## How updates work

`capacitor.config.ts` points the app at `https://sknsh-by-pd.lovable.app`, so
every change you publish from Lovable shows up in the installed app instantly —
students never have to reinstall the APK. Only rebuild the APK when the app
icon, name, or native plugins change.

## App icon and name

- App name: **SKNSH** (set in `capacitor.config.ts`).
- App icon: the picture shown on the phone home screen.

You can change the icon in two ways. Use **Method A** if Android Studio is
working. Use **Method B** if you only have the project files.

### Method A: Change icon with Android Studio (easiest)

1. Open Android Studio.
2. Open the project: `File → Open → choose the android folder` (for example
   `C:\Users\vishu\StudioProjects\studysphere-hub\android`).
3. Wait for the bottom progress bar to finish.
4. In the left **Project** panel, find the `app` folder.
5. Right-click `app` → **New → Image Asset**.
6. A window called **Asset Studio** opens. Set these:
   - **Icon Type**: `Launcher Icons (Adaptive and Legacy)`
   - **Asset Type**: `Image`
   - **Path**: click the small folder icon and browse to `public/logo-3d.png`
     inside your main project folder.
   - **Resize**: drag the slider so the logo fits inside the blue circle.
   - **Background Layer**: pick a color like `#0b1020` (dark blue-black) or
     choose `Image` if you have a background image.
7. Click **Next**.
8. Click **Finish**.
9. Android Studio will now create all icon sizes automatically.
10. Build the APK again:

```bash
cd android
./gradlew assembleDebug
```

### Method B: Change icon with only files (no Android Studio needed)

If Android Studio's Image Asset does not open, do this:

1. Create one square logo image. Recommended size: **1024 × 1024 pixels**.
   Save it as `logo-1024.png`.
2. Resize that image to these sizes and save each one with the correct name:

| Size | File name |
|------|-----------|
| 48 × 48 | `ic_launcher_foreground.png` |
| 72 × 72 | `ic_launcher_foreground.png` |
| 96 × 96 | `ic_launcher_foreground.png` |
| 144 × 144 | `ic_launcher_foreground.png` |
| 192 × 192 | `ic_launcher_foreground.png` |
| 108 × 108 | `ic_launcher_background.png` (only the background color/image) |
| 162 × 162 | `ic_launcher_background.png` |
| 216 × 216 | `ic_launcher_background.png` |
| 324 × 324 | `ic_launcher_background.png` |
| 432 × 432 | `ic_launcher_background.png` |

3. Copy the foreground files into these folders (replace existing files):

```
android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png
android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png
android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png
android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png
```

4. Copy the background files into the same folders but named
   `ic_launcher_background.png`.
5. Also replace the simple legacy icons in these folders:

```
android/app/src/main/res/mipmap-mdpi/ic_launcher.png
android/app/src/main/res/mipmap-hdpi/ic_launcher.png
android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
```

6. Build the APK:

```bash
cd android
./gradlew assembleDebug
```

### Method C: Use a free online icon generator (simplest for beginners)

1. Go to a website like `icon.kitchen` in your browser.
2. Upload `public/logo-3d.png`.
3. Choose background color `#0b1020` and shape `circle` or `rounded square`.
4. Download the Android icon zip.
5. Unzip it. You will see folders like `mipmap-mdpi`, `mipmap-hdpi`, etc.
6. Copy each folder's contents into the matching folder inside
   `android/app/src/main/res/`.
7. Rebuild the APK.

### Important notes

- You must **uninstall the old app** from your phone before installing the new
  APK, or the old icon may stay.
- The icon change only shows after you install a freshly built APK. Website
  updates do not change the icon.
- If the icon looks blurry, use a bigger source image (at least 1024 × 1024).


## Phone notifications (WhatsApp style)

The app sends tray notifications for new shared notes, likes on your notes,
admin chat replies and new admin content.

After `npx cap sync android`, add this line inside `<manifest>` in
`android/app/src/main/AndroidManifest.xml` (needed on Android 13+):

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

Then rebuild the APK. Android asks the user once to allow notifications.

## App icon

The APK icon uses the original 3D student logo at `public/logo-3d.png`.
Run `python scripts/generate-android-icons.py` from the project root and
rebuild — nothing about the website logo changes.
