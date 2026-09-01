import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/data/auth-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { BrandSplash } from "@/components/brand/brand-splash";

/**
 * Entry redirect. AuthInitializer (in _layout.tsx) finishes auth + slug
 * hydration before this renders meaningfully — until then, isLoading is true.
 *
 * Every cold start first shows the copyright splash (BrandSplash) for at
 * least SPLASH_MIN_MS, overlapping the auth hydration — the wait and the
 * loading gate are the same screen, so there is no flash in between.
 *
 *   no user            → /login
 *   user, no slug      → /select-workspace
 *   user, slug         → /[slug]/inbox
 */
const SPLASH_MIN_MS = 2000;

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const slug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!splashMinElapsed || isLoading) {
    return <BrandSplash />;
  }

  if (!user) return <Redirect href="/login" />;
  if (!slug) return <Redirect href="/select-workspace" />;
  return <Redirect href={`/${slug}/inbox`} />;
}
