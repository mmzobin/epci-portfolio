"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions";
import { PlayerAvatar } from "@/components/player-avatar";
import { SubmitButton } from "@/components/submit-button";
import { useI18n } from "@/lib/i18n";

type HeaderUser = {
  name: string;
  lastName: string;
  photoUrl: string | null;
};

export function UserMenu({ user }: { user: HeaderUser }) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRenderMenu, setShouldRenderMenu] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullName = `${user.name} ${user.lastName}`;

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
      className="relative shrink-0"
      onMouseEnter={openMenu}
      onMouseLeave={closeMenu}
      onFocus={openMenu}
    >
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 p-0.5 pl-0.5 pr-2 outline-none ring-1 ring-white/20 transition duration-150 hover:-translate-y-0.5 hover:border-limeball/40 hover:bg-white/10 hover:ring-limeball/50 focus-visible:ring-2 focus-visible:ring-limeball/70 focus-visible:ring-offset-2 focus-visible:ring-offset-court-dark active:translate-y-0 active:scale-95"
        aria-label={`Открыть профиль пользователя ${fullName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-testid="avatar-menu-button"
      >
        <PlayerAvatar photoUrl={user.photoUrl} name={user.name} lastName={user.lastName} size="sm" />
        <span className="text-[10px] leading-none text-white/65" aria-hidden="true">
          ▼
        </span>
      </Link>

      {shouldRenderMenu ? (
        <div className="absolute right-0 top-full z-30 min-w-full pt-2">
          <div
            className={`epci-nav-dropdown-panel origin-top-right ${isClosing ? "epci-nav-dropdown-panel-out" : ""}`}
            role="menu"
            data-testid="avatar-menu"
          >
            <Link
              className="epci-nav-dropdown-item text-white"
              href="/profile"
              role="menuitem"
              data-testid="nav-profile"
              onClick={closeMenuNow}
            >
              {t("nav.profile")}
            </Link>
            <form action={logoutAction}>
              <SubmitButton
                className="epci-nav-dropdown-item w-full text-left text-white"
                label={t("nav.logout")}

                role="menuitem"
                testId="logout-button"
              />
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
