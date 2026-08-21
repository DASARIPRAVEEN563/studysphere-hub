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

## Run it on your phone

```bash
npx cap run android
```

Enable **Developer options → USB debugging** on the phone and plug it in.

## Build the shareable APK

```bash
cd android
./gradlew assembleDebug          # Windows: gradlew.bat assembleDebug
```

The file appears at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Send that file to students — they install it once and it stays on the phone.

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
- Icon: replace the `mipmap` images in `android/app/src/main/res/` — Android
  Studio's **Image Asset** tool can generate all sizes from `public/logo-3d.png`.
