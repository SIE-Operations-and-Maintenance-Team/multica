/**
 * inbox:new → 系统通知的移动端决策层，对齐 web
 * packages/core/realtime/use-realtime-sync.ts 的 handleInboxNew：
 * 前台静默、来源工作区 mute 门控、payload 组装；缓存失效（invalidate）
 * 由 use-inbox-realtime 的订阅方负责，这里只做"要不要发、发什么"。
 *
 * 自托管部署没有 FCM：通知来源是 app 内 WS 实时流，app 进程被杀后收不到
 * 新事件通知（lib/system-notification.ts 的模块注释详述）。
 */
import { AppState } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import type { InboxItem } from "@multica/core/types";
import { workspaceListOptions } from "@/data/queries/workspaces";
import { notificationPreferenceKeys } from "@/data/queries/notification-preferences";
import { showInboxNotification } from "@/lib/system-notification";

/**
 * 解析收件箱条目来源工作区的 slug（经缓存的工作区列表，冷缓存取一次）。
 * 与 web 的 resolveInboxSourceSlug 相同的 #3766 防御：通知的门控与点击
 * 路由都钉在条目**归属**的工作区上，绝不回退到当前活跃工作区。解析失败
 * 返回 null，调用方以空 slug 发通知（点击为 no-op）而不是猜一个。
 */
async function resolveSourceSlug(
  qc: QueryClient,
  workspaceId: string,
): Promise<string | null> {
  if (!workspaceId) return null;
  try {
    const workspaces = await qc.ensureQueryData(workspaceListOptions());
    return workspaces?.find((w) => w.id === workspaceId)?.slug ?? null;
  } catch {
    // 工作区列表不可得（网络抖动）：发无深链的通知，而不是猜 slug。
    return null;
  }
}

export async function handleInboxNewNotification(
  qc: QueryClient,
  item: InboxItem,
): Promise<void> {
  // 前台静默（对齐 web 的 document.hasFocus() 门控）：用户正看着 Multica
  // 时，收件箱的未读样式已经足够，不打断。
  if (AppState.currentState === "active") return;
  const slug = await resolveSourceSlug(qc, item.workspace_id);
  // mute 门控读"来源工作区"的**已缓存**偏好：mobile 的 ApiClient 没有
  // per-request 的 X-Workspace-Slug 覆盖（跟随当前活跃工作区），冷缓存
  // 直查会读错工作区的设置并把它缓存到错误的 key 下（web 同款缺陷的
  // 防御）。没有温缓存时跳过检查放行——对齐 web 的网络失败回退：宁可
  // 发出也不吞掉横幅。
  try {
    const prefData = qc.getQueryData<{
      preferences: Record<string, string>;
    }>(notificationPreferenceKeys.all(item.workspace_id));
    if (prefData?.preferences?.system_notifications === "muted") return;
  } catch {
    // Fall through with default behavior.
  }
  await showInboxNotification({
    slug: slug ?? "",
    itemId: item.id,
    issueKey: item.issue_id ?? item.id,
    title: item.title,
    body: item.body ?? "",
  });
}
