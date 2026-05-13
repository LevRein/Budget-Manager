export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  month: string; // e.g., "2026-05"
}

export interface Category {
  name: string;
  budget: number;
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  currency: string;
}

export interface UserProfile {
  email: string;
  username: string;
  passwordHash: string;
}

export interface AppState {
  monthlyBudget: number;
  categories: Category[];
  transactions: Transaction[];
  onboardingCompleted: boolean;
  currentUser?: string;
  username?: string;
  preferences: UserPreferences;

}


