/**
 * 系统通知桥（mobile）——对齐 packages/core/platform/system-notification.ts
 * 的 payload 形状与 web use-realtime-sync.handleInboxNew 的门控语义。
 *
 * 展示层用 expo-notifications 的本地通知。自托管部署没有 FCM 推送通道，
 * 通知来源是 app 内的 WS 实时流（inbox:new）——app 进程被杀后收不到新事件
 * 通知，仅 WS 连接存活期间有效。
 *
 * - 前台静默：app 在前台时不发系统横幅（对齐 web 的 document.hasFocus()
 *   门控）——inbox 列表与未读徽标已实时呈现新事件。
 * - 权限：Android 13+ 需要 POST_NOTIFICATIONS 运行时申请，被拒后引导到
 *   系统设置；入口在「更多 → 我的 → 设置 → 通知」页。
 * - 点击路由：宿主（根布局）注册 handler——core 同款注入模式，core 保持
 *   headless，这里同理让路由决策留在 app 层。
 */
import { AppState, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";

/** 与 core 的 WebNotificationPermission 形状一致，方便设置页复用同一 UI 模式。 */
export type SystemNotificationPermission =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

export interface InboxNotificationPayload {
  /**
   * 来源工作区 slug。解析失败时为空串——点击是一次 no-op 而不是路由到
   * 错误的工作区（对齐 core 的 #3766 防御）。
   */
  slug: string;
  /** 收件箱行 id——点击时可用于标记已读。 */
  itemId: string;
  /** 收件箱页的 issue 选择器（有事项用 issue id，否则用行 id）。 */
  issueKey: string;
  title: string;
  body: string;
}

type ClickHandler = (payload: InboxNotificationPayload) => void;

let clickHandler: ClickHandler | null = null;

/**
 * 注册系统通知点击后的路由行为（跳到来源工作区的收件箱）。由根布局挂载
 * 时调用一次；未注册时点击是静默 no-op。
 */
export function registerInboxNotificationClickHandler(
  handler: ClickHandler | null,
): void {
  clickHandler = handler;
}

function mapPermission(
  settings: Notifications.NotificationPermissionsStatus,
): SystemNotificationPermission {
  if (settings.granted) return "granted";
  // Android 13+ / iOS：拒绝后 canAskAgain=false，只能去系统设置开启。
  return settings.canAskAgain ? "default" : "denied";
}

/** 当前系统通知权限。web 平台无意义，返回 "unsupported"。 */
export async function getNotificationPermission(): Promise<SystemNotificationPermission> {
  if (Platform.OS === "web") return "unsupported";
  const settings = await Notifications.getPermissionsAsync();
  return mapPermission(settings);
}

/**
 * 申请通知权限。仅在 "default"（还没问过）时触发系统弹窗——已被拒/已授予
 * 的结果原样返回（对齐 core 的 requestWebNotificationPermission 语义）。
 */
export async function requestNotificationPermission(): Promise<SystemNotificationPermission> {
  if (Platform.OS === "web") return "unsupported";
  const current = await getNotificationPermission();
  if (current !== "default") return current;
  const settings = await Notifications.requestPermissionsAsync();
  return mapPermission(settings);
}

/**
 * 启动时自动申请通知权限：仅当还没问过（"default"）时弹系统授权框。
 * 已授予直接返回；已被拒（"denied"）时系统不会再弹，调了也无害——
 * 不打扰原则下这里显式跳过。设置页里的手动入口保留（denied 后引导
 * 系统设置、granted 展示状态徽标）。
 */
export async function ensureNotificationPermissionRequested(): Promise<void> {
  if (Platform.OS === "web") return;
  const current = await getNotificationPermission();
  if (current === "default") await requestNotificationPermission();
}

/** 权限被永久拒绝后，引导用户到系统设置手动开启。 */
export async function openSystemNotificationSettings(): Promise<void> {
  // RN 的 Linking.openSettings 双端直达本应用的通知设置页
  // （Android 指向应用详情、iOS 指向设置）。
  Linking.openSettings();
}

// 前台横幅静默：app 在前台时收到通知（竞态窗口内越过 AppState 门控的）只
// 进通知列表不弹横幅——inbox 的实时列表与未读样式已展示该事件。
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * 为一条新的收件箱事件展示系统通知。展示层的最后防线：前台静默 + 权限
 * gate（event 决策方是 realtime 层的 mute/来源工作区检查）。
 * `identifier` 用收件箱行 id——WS 重连重放同一行事件时覆盖旧横幅而不是
 * 堆叠（对齐 core 的 web `tag` 语义）。
 */
export async function showInboxNotification(
  payload: InboxNotificationPayload,
): Promise<void> {
  if (Platform.OS === "web") return;
  if (AppState.currentState === "active") return;
  try {
    const permission = await getNotificationPermission();
    if (permission !== "granted") return;
    await Notifications.scheduleNotificationAsync({
      identifier: payload.itemId,
      content: {
        title: payload.title,
        body: payload.body,
        data: {
          slug: payload.slug,
          itemId: payload.itemId,
          issueKey: payload.issueKey,
        },
      },
      trigger: null,
    });
  } catch {
    // 通知展示失败（权限被撤、系统异常等）不是关键路径——静默降级，
    // 收件箱列表与未读徽标仍然反映了新事件（对齐 web 的容错哲学）。
  }
}

/**
 * 挂载通知点击路由（根布局 useEffect 调用一次）。覆盖两类点击：
 * app 存活时的 response listener + 进程被通知冷启动的 last response。
 * slug 为空（无法解析来源工作区）时点击是 no-op 而非错误路由。
 */
export function setupInboxNotificationRouting(): () => void {
  const route = (payload: InboxNotificationPayload | null): void => {
    if (!payload?.slug) return;
    clickHandler?.(payload);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      route(
        response.notification.request.content
          .data as unknown as InboxNotificationPayload,
      );
    },
  );
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    // 冷启动时才需要处理 last response——app 已在前台时它返回 null。
    if (!response) return;
    route(
      response.notification.request.content
        .data as unknown as InboxNotificationPayload,
    );
  });
  return () => subscription.remove();
}
