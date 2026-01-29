"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "在庫管理" },
  { href: "/cashflow", label: "収支ボード" },
];

export default function PageTabs() {
  const pathname = usePathname();
  const activeHref = pathname.startsWith("/cashflow") ? "/cashflow" : "/";

  return (
    <nav className="flex gap-2 flex-wrap" aria-label="ページ切り替え">
      {tabs.map((tab) => {
        const isActive = activeHref === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
              isActive
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
