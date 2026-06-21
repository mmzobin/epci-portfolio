"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dictionaries";

const adminLinks: { href: string; labelKey: DictKey; testId: string }[] = [
  { href: "/admin/users", labelKey: "nav.admin_players", testId: "nav-admin" },
  { href: "/admin/clubs", labelKey: "nav.admin_clubs", testId: "nav-admin-clubs" },
  { href: "/admin/tournaments", labelKey: "nav.admin_tournaments", testId: "nav-admin-tournaments" }
];

export function HeaderManageMenu() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRenderMenu, setShouldRenderMenu] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = pathname.startsWith("/admin");

  function openMenu() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setShouldRenderMenu(true);
    setIsClosing(false);
    setIsOpen(true);
  }

  const closeMenuNow = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsOpen(false);
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setShouldRenderMenu(false);
      setIsClosing(false);
    }, 110);
  }, []);

  function closeMenu() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(closeMenuNow, 120);
  }

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) closeMenuNow();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenuNow();
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeMenuNow]);

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={closeMenu}
      onFocus={openMenu}
    >
      <button
        className={`epci-header-nav-link gap-1.5 ${isActive ? "epci-header-nav-link-active" : ""}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-testid="nav-manage"
        onClick={openMenu}
      >
        <span>{t("nav.manage")}</span>
        <span className="text-xs leading-none text-white/65" aria-hidden="true">
          ▼
        </span>
      </button>

      {shouldRenderMenu ? (
        <div className="absolute left-0 top-full z-30 min-w-full pt-2">
          <div
            className={`epci-nav-dropdown-panel ${isClosing ? "epci-nav-dropdown-panel-out" : ""}`}
            role="menu"
            data-testid="manage-menu"
          >
            {adminLinks.map((link) => {
              const linkActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  className={`epci-nav-dropdown-item ${
                    linkActive ? "bg-white/10 text-limeball" : "text-white"
                  }`}
                  href={link.href}
                  role="menuitem"
                  aria-current={linkActive ? "page" : undefined}
                  data-testid={link.testId}
                  onClick={closeMenuNow}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
