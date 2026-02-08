import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Merge Tailwind CSS classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format wallet address for display
export function formatAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Format date for display
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(d);
}

// Format MON amount
export function formatMON(amount: string, decimals = 4): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  return num.toFixed(decimals).replace(/\.?0+$/, '');
}

// Truncate string with ellipsis
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

// Parse tags from comma-separated string
export function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);
}

// Generate avatar placeholder URL
export function getAvatarUrl(address: string): string {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`;
}
