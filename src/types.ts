
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  primaryGrain: 'wheat' | 'rice' | 'both';
  hasMilk: boolean;
  hasFruit: boolean;
}

export interface DailyEntry {
  id: string;
  date: string;
  presentStudents: number;
  eatingStudents: number;
  cumulativeTotal: number;
  wheatQty: number; // in kg
  riceQty: number; // in kg
  milkQty: number; // in liters
  fruitType: string;
  foodCost: number; // in Rs
  fruitCost: number; // in Rs
  milkCost: number; // in Rs
  totalFoodFruitCost: number; // foodCost + fruitCost
  mealType: string; // references MenuItem.name
}

export interface AppSettings {
  wheatRatePerStudent: number; // kg
  riceRatePerStudent: number; // kg
  milkRatePerStudent: number; // liter
  foodCostRate: number; // Rs per student
  milkCostRate: number; // Rs per student
  fruitCostRate: number; // Rs per student
}
