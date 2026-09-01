/**
 * Copyright splash shown on every cold start before the entry redirect
 * (app/index.tsx keeps it on screen for at least 2s). Dark background +
 * centered logo + bottom copyright line, mirroring the native splash so
 * the hand-off is seamless. Fixed dark colours on purpose — the page must
 * look identical regardless of the user's theme, and the status bar is
 * forced to light content while it shows.
 */
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";

export function BrandSplash() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0b0f19",
      }}
    >
      <StatusBar style="light" />
      <Image
        source={require("../../assets/icon.png")}
        style={{ width: 96, height: 96, borderRadius: 22 }}
        contentFit="cover"
      />
      <Text
        style={{
          marginTop: 14,
          fontSize: 26,
          fontWeight: "700",
          letterSpacing: 0.5,
          color: "#f4f4f5",
        }}
      >
        Multica
      </Text>

      <View
        style={{
          position: "absolute",
          bottom: 34,
          alignItems: "center",
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 11, color: "#8b93a1" }}>
          Copyright © 2026 SMOM 运维团队
        </Text>
        <Text style={{ fontSize: 11, color: "#8b93a1" }}>
          未经授权，不得修改或二次分发
        </Text>
      </View>
    </View>
  );
}
