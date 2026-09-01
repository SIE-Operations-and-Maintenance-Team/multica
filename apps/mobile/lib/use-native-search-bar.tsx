/**
 * Search wiring for the picker routes. Returns the current query string
 * plus a `searchBar` element the route renders above its list.
 *
 * - iOS: wires the native `UISearchController` (react-native-screens
 *   `headerSearchBarOptions`) into the route; `searchBar` is null — the
 *   field lives in the navigation header.
 * - Android: react-native-screens has no native header search bar, and
 *   `headerSearchBarOptions` is silently ignored there — the picker would
 *   render with NO search field at all. So Android falls back to a plain
 *   TextInput rendered by the route via `searchBar`.
 *
 * Used by every search-enabled picker route on mobile (issue/project/
 * label/lead). Pair with `useScrollToTopOnChange` in the body to reset
 * the list scroll position when the filter changes.
 *
 * Cancel button contract (iOS): `cancelSearch()` clears the native text
 * but does NOT fire `onChangeText`, so the route MUST reset query state
 * in `onCancelButtonPress`. Easy to forget when copy-pasted.
 *
 * Requires the Stack.Screen to register `headerShown: true` + a `title`
 * in the layout. See `apps/mobile/app/(app)/[workspace]/_layout.tsx`.
 */
import { useLayoutEffect, useState } from "react";
import { Platform, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import type { NativeSyntheticEvent, TextInputFocusEventData } from "react-native";
import { THEME } from "@/lib/theme";
import { useColorScheme } from "@/lib/use-color-scheme";

export function useNativeSearchBar(
  placeholder: string,
  options?: { autoFocus?: boolean },
): {
  query: string;
  searchBar: React.ReactNode;
} {
  const navigation = useNavigation();
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const [query, setQuery] = useState("");
  const autoFocus = options?.autoFocus;
  const isIos = Platform.OS === "ios";

  useLayoutEffect(() => {
    if (!isIos) return;
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder,
        autoCapitalize: "none",
        hideWhenScrolling: false,
        // Opt-in: pickers whose primary action is typing (assignee, label,
        // project, lead) set this so the keyboard appears on mount. Apple
        // HIG cautions against auto-keyboard for browse-first lists; pass
        // `autoFocus: true` only when the picker is search-first.
        autoFocus,
        onChangeText: (e: NativeSyntheticEvent<TextInputFocusEventData>) =>
          setQuery(e.nativeEvent.text),
        onCancelButtonPress: () => setQuery(""),
      },
    });
  }, [navigation, placeholder, autoFocus, isIos]);

  const searchBar = isIos ? null : (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: t.background,
      }}
    >
      <Ionicons
        name="search"
        size={16}
        color={t.mutedForeground}
      />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        placeholderTextColor={t.mutedForeground}
        autoCapitalize="none"
        autoFocus={autoFocus}
        returnKeyType="search"
        style={{
          flex: 1,
          height: 38,
          borderRadius: 10,
          paddingHorizontal: 12,
          fontSize: 15,
          color: t.foreground,
          backgroundColor: t.muted,
        }}
      />
    </View>
  );

  return { query, searchBar };
}
