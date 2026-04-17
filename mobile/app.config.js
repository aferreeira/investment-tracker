export default {
  expo: {
    name: "Investment Tracker",
    slug: "investment-tracker",
    scheme: "investmenttracker",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: false,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#1a1a2e",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.investmenttracker.mobile",
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "com.googleusercontent.apps.354292965032-fcea9mgss6mscekrsd1855oonbef62br",
            ],
          },
        ],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#1a1a2e",
      },
      package: "com.investmenttracker.mobile",
    },
    extra: {
      eas: {
        projectId: "",
      },
      // Load credentials from environment variables
      apiBaseUrl: process.env.API_BASE_URL || "http://localhost:9100",
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || "NOT_SET",
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID || "NOT_SET",
    },
    plugins: [
      "expo-asset",
      "expo-font",
      "expo-secure-store",
      "expo-web-browser",
    ],
  },
};
