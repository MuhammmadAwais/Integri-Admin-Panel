import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names using clsx and tailwind-merge.
 * Useful for conditional classes and ensuring Tailwind classes merge correctly.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
