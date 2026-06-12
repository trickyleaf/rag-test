"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { Locale } from "@/i18n/types";

const LOCALES: { value: Locale; label: string }[] = [
  { value: "it", label: "IT" },
  { value: "en", label: "EN" },
];

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(lang: Locale) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("hl", lang);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex items-center gap-1">
      {LOCALES.map(({ value, label }) => (
        <Link
          className={[
            "rounded px-2 py-1 text-xs font-semibold uppercase transition-colors",
            locale === value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          ].join(" ")}
          href={buildHref(value)}
          key={value}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
