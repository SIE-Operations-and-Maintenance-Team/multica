/**
 * Symbol — cross-platform glyph component for the SF Symbols the app uses.
 *
 * iOS renders the real SF Symbol via expo-image's `sf:` source. Android has
 * no SF Symbols: expo-image silently renders *nothing* for `sf:` sources
 * there, which is exactly how every tab bar / More-menu icon went blank on
 * the Android APK. So Android falls back to the Ionicons set
 * (@expo/vector-icons, already the app's icon workhorse via IconButton)
 * through the explicit mapping below.
 *
 * When introducing a new `sf:` name anywhere in the app, render it through
 * this component and add its Ionicons counterpart here — a missing entry
 * would render nothing on Android again.
 */
import type { ComponentProps } from "react";
import { Platform, type ImageStyle, type StyleProp, type TextStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const IONICON_FALLBACK: Record<
  string,
  ComponentProps<typeof Ionicons>["name"]
> = {
  // Bottom tab bar
  "tray.fill": "file-tray",
  tray: "file-tray-outline",
  checklist: "checkbox",
  "checklist.unchecked": "checkbox-outline",
  "bubble.left.fill": "chatbubble",
  "bubble.left": "chatbubble-outline",
  ellipsis: "ellipsis-horizontal",
  // More popover
  pin: "pin",
  "list.bullet": "list",
  "square.stack": "layers",
  "chevron.right": "chevron-forward",
  // Workspace switcher
  checkmark: "checkmark",
};

export function Symbol({
  name,
  color,
  size,
  style,
}: {
  /** SF Symbol name (without the `sf:` prefix). */
  name: string;
  color: string;
  size: number;
  // Ionicons takes TextStyle; the iOS Image branch casts to its ImageStyle —
  // callers only ever pass layout-agnostic tweaks (opacity, transform).
  style?: StyleProp<TextStyle>;
}) {
  if (Platform.OS === "ios") {
    return (
      <Image
        source={`sf:${name}`}
        tintColor={color}
        style={[{ width: size, height: size }, style] as StyleProp<ImageStyle>}
      />
    );
  }

  const ionicon = IONICON_FALLBACK[name];
  if (!ionicon) {
    // A missing mapping means Android would silently render nothing — the
    // exact bug this component exists to prevent. Fail loud in dev.
    if (__DEV__) {
      throw new Error(`Symbol: no Ionicons fallback for sf:${name}`);
    }
    return null;
  }
  return <Ionicons name={ionicon} size={size} color={color} style={style} />;
}
