import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Derives up to two display initials for an avatar fallback. Prefers a real
 * name (first letter of up to its first two words); falls back to the
 * email's local-part (first letter of up to two dot/underscore/hyphen/plus
 * -separated segments, or its first two characters if there are no
 * separators). Returns '?' if neither is usable.
 */
export function getInitials(
  name?: string | null,
  email?: string | null
): string {
  const trimmedName = name?.trim()
  if (trimmedName) {
    return trimmedName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("")
  }

  const localPart = email?.trim().split("@")[0] ?? ""
  if (!localPart) return "?"

  const segments = localPart.split(/[._\-+]+/).filter(Boolean)
  if (segments.length > 1) {
    return segments
      .slice(0, 2)
      .map((segment) => segment[0]!.toUpperCase())
      .join("")
  }
  return localPart.slice(0, 2).toUpperCase()
}
