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

- Name: `appName` in `capacitor.config.ts` (currently **SKNSH**).
- Icon: the easiest way is to use Android Studio's **Image Asset** tool.

### Change the APK icon

1. Open the project in Android Studio (`npx cap open android`).
2. In the Project panel, right-click the `android/app` folder (or the `res`
folder).
3. Choose **New → Image Asset**.
4. In the window:
   - **Icon type**: Launcher Icons (Adaptive and Legacy).
   - **Asset**: select **Image** and browse to your source icon. The project logo
     is at `public/logo-3d.png`.
   - Resize so the logo fits inside the safe zone circle.
   - Pick a background color (for example `#0b1020` to match the splash).
5. Click **Next**, then **Finish**. Android Studio will replace all the
`mipmap-xxx` images automatically.
6. Rebuild the APK:

```bash
cd android
./gradlew assembleDebug
```

The new icon will appear on the phone after installing the rebuilt APK.

