import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "../i18n";

const TITLES = {
  "/": null, "/login": "auth.login", "/register": "auth.register", "/home": "nav.home",
  "/sandbox": "nav.sandbox", "/lobby": "nav.lobby", "/leaderboard": "nav.leaderboard", "/profile": "nav.profile",
  "/forgot-password": "auth.forgotTitle", "/reset-password": "auth.resetTitle",
};
const BASE = "Robostrike";

// Per-route document title / description + Google Analytics SPA page views.
export default function PageMeta() {
  const { pathname } = useLocation();
  const { t, lang } = useI18n();

  useEffect(() => {
    const key = pathname.startsWith("/room/") ? "nav.lobby" : TITLES[pathname];
    document.title = key ? `${t(key)} | ${BASE}` : `${BASE} – ${t("app.tagline")}`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && pathname === "/") desc.setAttribute("content", t("landing.sub"));
  }, [pathname, lang, t]);

  const first = useRef(true);
  useEffect(() => {
    // the gtag snippet already counts the first page load
    if (first.current) { first.current = false; return; }
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", { page_path: pathname, page_location: window.location.href, page_title: document.title });
    }
  }, [pathname]);

  return null;
}
