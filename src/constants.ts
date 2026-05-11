import { MenuItem, AppSettings } from './types';

export const DEFAULT_MENU: MenuItem[] = [
  { id: '1', name: 'सब्जी रोटी फल', description: 'सब्जी, रोटी और ताजे फल', primaryGrain: 'wheat', hasMilk: false, hasFruit: true },
  { id: '2', name: 'दाल चावल', description: 'दाल और चावल', primaryGrain: 'rice', hasMilk: false, hasFruit: false },
  { id: '3', name: 'तहरी दूध', description: 'तहरी और गर्म दूध', primaryGrain: 'rice', hasMilk: true, hasFruit: false },
  { id: '4', name: 'दाल रोटी', description: 'दाल और गेहूं की रोटी', primaryGrain: 'wheat', hasMilk: false, hasFruit: false },
  { id: '5', name: 'तहरी', description: 'चावल की तहरी', primaryGrain: 'rice', hasMilk: false, hasFruit: false },
  { id: '6', name: 'सब्जी चावल', description: 'सब्जी और चावल', primaryGrain: 'rice', hasMilk: false, hasFruit: false },
];

export const DEFAULT_SETTINGS: AppSettings = {
  wheatRatePerStudent: 0.100, // 100g
  riceRatePerStudent: 0.100, // 100g
  milkRatePerStudent: 0.150, // 150ml
  foodCostRate: 6.78,
  milkCostRate: 9.6,
  fruitCostRate: 4,
};
