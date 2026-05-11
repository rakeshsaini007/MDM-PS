import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('hi-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date();
  return d;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  
  try {
    const date = parseDateSafe(dateStr);
    
    return new Intl.DateTimeFormat('hi-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch (e) {
    return dateStr;
  }
}
