"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type HeaderNavLinkProps = {
  href: string;
  children: React.ReactNode;
  testId: string;
};

export function HeaderNavLink({ href, children, testId }: HeaderNavLinkProps) {
  const pathname = usePathname();
  const isHome = href === "/";
  const isActive = isHome ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      className={`epci-header-nav-link ${isActive ? "epci-header-nav-link-active" : ""}`}
      href={href}
      aria-current={isActive ? "page" : undefined}
      data-testid={testId}
    >
      {children}
    </Link>
  );
}
