// Expense categories
export const CATEGORIES = [
  { id: 'food', name: 'Food & Dining', icon: 'restaurant', color: '#22C55E' },
  { id: 'rent', name: 'Rent', icon: 'home', color: '#14B8A6' },
  { id: 'family', name: 'Family', icon: 'people', color: '#F97316' },
  { id: 'emi', name: 'EMI & Loans', icon: 'card', color: '#EF4444' },
  { id: 'transport', name: 'Travel', icon: 'airplane', color: '#06B6D4' },
  { id: 'shopping', name: 'Shopping', icon: 'bag-handle', color: '#8B5CF6' },
  { id: 'entertainment', name: 'Entertainment', icon: 'game-controller', color: '#EC4899' },
  { id: 'bills', name: 'Bills & Utilities', icon: 'flash', color: '#F59E0B' },
  { id: 'health', name: 'Health & Fitness', icon: 'fitness', color: '#10B981' },
  { id: 'education', name: 'Education', icon: 'school', color: '#3B82F6' },
  { id: 'personal', name: 'Personal Care', icon: 'body', color: '#A855F7' },
  { id: 'groceries', name: 'Groceries', icon: 'basket', color: '#84CC16' },
  { id: 'gadgets', name: 'Gadgets', icon: 'phone-portrait', color: '#6366F1' },
  { id: 'others', name: 'Others', icon: 'ellipsis-horizontal', color: '#64748B' },
] as const;

export type CategoryId = typeof CATEGORIES[number]['id'];

export const getCategoryById = (id: string) =>
  CATEGORIES.find(cat => cat.id === id) || CATEGORIES[CATEGORIES.length - 1];

export const getCategoryColor = (id: string) => getCategoryById(id).color;
