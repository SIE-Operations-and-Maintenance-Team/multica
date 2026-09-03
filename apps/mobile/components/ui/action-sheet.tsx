/**
 * Cross-platform action sheet for the header "…" menus.
 *
 * iOS renders the native ActionSheetIOS — same look and behaviour as
 * before. Android has no ActionSheetIOS (the module is undefined there,
 * and calling it threw a TypeError that killed release builds outright —
 * the crash behind "tapping … on Inbox / Issue / Project exits the app"),
 * so it renders the same @rn-primitives DropdownMenu the bottom-bar More
 * popover uses.
 *
 * Android anchoring: pass `anchor` (a ref to a View wrapping the trigger
 * button — wrap with `collapsible={false}` semantics via
 * `<View ref={ref} collapsable={false}>`) and the menu pops right at the
 * button — same mechanism as MoreTabDropdownAnchor: the host moves its
 * invisible trigger over the measured button rect, so open() anchors the
 * Content there (below the button when it sits in the top half of the
 * screen, right-aligned when it sits in the right half). Without `anchor`
 * (long-press menus) the host stays pinned just above the bottom edge,
 * centered — the iOS ActionSheet convention.
 *
 * Mount <ActionSheetHost /> once near the root layout. Imperative call:
 *
 *   showActionSheet({
 *     options: ["取消", "编辑"],
 *     cancelButtonIndex: 0,
 *     destructiveButtonIndex: 1,
 *     title: "可选",
 *     onAction: (index) => { ... },
 *     anchor: menuAnchorRef, // optional, Android only
 *   });
 */
import { useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DropdownMenuPrimitive from "@rn-primitives/dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export interface ActionSheetConfig {
  options: string[];
  cancelButtonIndex: number;
  destructiveButtonIndex?: number;
  title?: string;
  onAction: (index: number) => void;
  /**
   * Android 锚点：触发按钮的 View ref（调用方把按钮包一层
   * `<View ref={ref} collapsable={false}>`）。传入后菜单在按钮附近弹出
   * （按钮在屏幕上半 → 向下方展开，靠屏幕右半 → 右对齐），即底部 More
   * 菜单的锚定行为；缺省回退到屏幕底部居中（长按类菜单保持 iOS 惯例）。
   */
  anchor?: React.RefObject<View | null>;
}

/** 锚点按钮的窗口坐标（measureInWindow 输出）。 */
interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HostRequest {
  config: ActionSheetConfig;
  rect?: AnchorRect;
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [current, setCurrent] = useState<HostRequest | null>(null);

  useEffect(() => {
    requestHost = (config) => {
      const anchor = config.anchor?.current;
      if (!anchor || typeof anchor.measureInWindow !== "function") {
        setCurrent(null);
        requestAnimationFrame(() => setCurrent({ config }));
        return;
      }
      // Clear first so a chained show (e.g. the comment menu's "表情…"
      // nested sheet fired from an item callback) starts from a closed
      // menu — opening while a dismiss animation is still running drops
      // the second menu. One frame later we mount the new items and open.
      setCurrent(null);
      anchor.measureInWindow((x, y, width, height) => {
        // 测量失败（按钮已卸载/尺寸为 0）→ 回退底部行为
        const rect: AnchorRect | undefined =
          width > 0 && height > 0 ? { x, y, width, height } : undefined;
        requestAnimationFrame(() => setCurrent({ config, rect }));
      });
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

  const rect = current?.rect;
  // 有锚点：隐形 trigger 覆盖按钮矩形，菜单贴着按钮弹出。触发按钮在屏幕
  // 上半 → 菜单向下方展开（header "…" 在顶部的场景），否则向上方展开；
  // 靠屏幕右半 → 右对齐（向左展开），否则左对齐。
  // 无锚点：保持底部全宽 1px 的回退定位，菜单在其上方居中。
  const side = rect && rect.y <= windowHeight ? "bottom" : "top";
  const align = rect && rect.x + rect.width > windowWidth / 2 ? "end" : "start";

  return (
    <View
      pointerEvents="box-none"
      style={
        rect
          ? {
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }
          : {
              position: "absolute",
              bottom: insets.bottom,
              left: 0,
              right: 0,
              height: 1,
            }
      }
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

        {/* Always mounted — the primitive only portals it while open, and
            having items ready before open() is what keeps the menu from
            rendering as an empty white popover. Item text must live in
            <Text>: bare string children of a View vanish in release
            builds (that was the blank-white-menu bug). */}
        <DropdownMenuContent
          side={side}
          align={align}
          sideOffset={8}
          className="w-72 p-1"
        >
          {current?.config.title ? (
            <DropdownMenuLabel>
              <Text className="text-xs font-medium text-muted-foreground">
                {current.config.title}
              </Text>
            </DropdownMenuLabel>
          ) : null}
          {current?.config.options.map((label, index) => (
            <DropdownMenuItem
              key={`${index}-${label}`}
              variant={
                index === current.config.destructiveButtonIndex
                  ? "destructive"
                  : "default"
              }
              onPress={() => {
                setCurrent(null);
                current.config.onAction(index);
              }}
            >
              <Text
                className={cn(
                  "text-sm",
                  index === current.config.destructiveButtonIndex
                    ? "text-destructive"
                    : "text-foreground",
                )}
              >
                {label}
              </Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </View>
  );
}
