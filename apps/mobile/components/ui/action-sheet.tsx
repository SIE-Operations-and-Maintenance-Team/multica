/**
 * Cross-platform action sheet for the header "…" menus.
 *
 * iOS renders the native ActionSheetIOS — same look and behaviour as
 * before. Android has no ActionSheetIOS (the module is undefined there,
 * and calling it threw a TypeError that killed release builds outright —
 * the crash behind "tapping … on Inbox / Issue / Project exits the app"),
 * so it renders the same @rn-primitives DropdownMenu the bottom-bar More
 * popover uses, anchored just above the bottom edge and centered.
 *
 * Mount <ActionSheetHost /> once near the root layout. Imperative call:
 *
 *   showActionSheet({
 *     options: ["取消", "编辑"],
 *     cancelButtonIndex: 0,
 *     destructiveButtonIndex: 1,
 *     title: "可选",
 *     onAction: (index) => { ... },
 *   });
 */
import { useEffect, useRef, useState } from "react";
import { ActionSheetIOS, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DropdownMenuPrimitive from "@rn-primitives/dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ActionSheetConfig {
  options: string[];
  cancelButtonIndex: number;
  destructiveButtonIndex?: number;
  title?: string;
  onAction: (index: number) => void;
}

// Module-level handle: showActionSheet() forwards Android requests to the
// mounted host. Reassigned on mount, nulled on unmount.
let requestHost: ((config: ActionSheetConfig) => void) | null = null;

export function showActionSheet(config: ActionSheetConfig): void {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: config.options,
        cancelButtonIndex: config.cancelButtonIndex,
        destructiveButtonIndex: config.destructiveButtonIndex,
        title: config.title,
      },
      config.onAction,
    );
    return;
  }
  requestHost?.(config);
}

export function ActionSheetHost() {
  if (Platform.OS === "ios") return null;
  return <AndroidActionSheetHost />;
}

function AndroidActionSheetHost() {
  const triggerRef = useRef<DropdownMenuPrimitive.TriggerRef>(null);
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ActionSheetConfig | null>(null);

  useEffect(() => {
    requestHost = (config) => {
      // Clear first so a chained show (e.g. the comment menu's "表情…"
      // nested sheet fired from an item callback) starts from a closed
      // menu — opening while a dismiss animation is still running drops
      // the second menu. One frame later we mount the new items and open.
      setCurrent(null);
      requestAnimationFrame(() => setCurrent(config));
    };
    return () => {
      requestHost = null;
    };
  }, []);

  // Open after the items commit — open() reads the anchor rect and mounts
  // the Content, which must already render the fresh option list.
  useEffect(() => {
    if (current) triggerRef.current?.open();
  }, [current]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: insets.bottom + 56,
        left: "35%",
        width: "30%",
        height: 1,
      }}
    >
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) setCurrent(null);
        }}
      >
        <DropdownMenuTrigger ref={triggerRef} asChild>
          <Pressable
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: "100%", height: "100%" }}
          />
        </DropdownMenuTrigger>

        {current ? (
          <DropdownMenuContent
            side="top"
            align="center"
            sideOffset={8}
            className="w-64 p-1"
          >
            {current.title ? (
              <DropdownMenuLabel>{current.title}</DropdownMenuLabel>
            ) : null}
            {current.options.map((label, index) => (
              <DropdownMenuItem
                key={`${index}-${label}`}
                variant={
                  index === current.destructiveButtonIndex
                    ? "destructive"
                    : "default"
                }
                onPress={() => {
                  setCurrent(null);
                  current.onAction(index);
                }}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        ) : null}
      </DropdownMenu>
    </View>
  );
}
