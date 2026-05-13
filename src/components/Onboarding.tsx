import { FormEvent, useState } from 'react';
import { Category } from '../types';

interface OnboardingProps {
  onComplete: (monthlyBudget: number, categories: Category[]) => void;
}

function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'budget' | 'categories'>('budget');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryBudget, setNewCategoryBudget] = useState('');

  const handleAddCategory = () => {
    if (newCategoryName.trim() && newCategoryBudget) {
      setCategories(prev => [...prev, {
        name: newCategoryName.trim(),
        budget: Number(newCategoryBudget)
      }]);
      setNewCategoryName('');
      setNewCategoryBudget('');
    }
  };

  const handleRemoveCategory = (index: number) => {
    setCategories(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCategoryBudget = (index: number, budget: string) => {
    setCategories(prev => prev.map((cat, i) =>
      i === index ? { ...cat, budget: Number(budget) || 0 } : cat
    ));
  };

  const handleBudgetSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (Number(monthlyBudget) > 0) setStep('categories');
  };

  const handleCategoriesSubmit = (event: FormEvent) => {
    event.preventDefault();
    const budget = Number(monthlyBudget);
    if (budget > 0 && categories.length > 0) onComplete(budget, categories);
  };

  if (step === 'budget') {
    return (
      <div className="onboarding-container">
        <div className="onboarding-card">
          <h1 className="step-title">Monthly Budget</h1>
          <form onSubmit={handleBudgetSubmit} className="setup-form">
            <label>
              Amount
              <input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder="3000"
                min="0"
                step="0.01"
                required
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-button">Next</button>
            </div>
          </form>
          <div className="progress-indicator">Step 1 of 2</div>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <h1 className="step-title">Budget Categories</h1>
        <form onSubmit={handleCategoriesSubmit} className="setup-form">
          <div className="categories-list">
            {categories.length === 0 ? (
              <div className="empty-state">Add your first category to get started.</div>
            ) : (
              categories.map((category, index) => (
                <div key={index} className="category-item">
                  <span className="category-name">{category.name}</span>
                  <input
                    type="number"
                    value={category.budget || ''}
                    onChange={(e) => handleUpdateCategoryBudget(index, e.target.value)}
                    placeholder="Budget amount"
                    min="0"
                    step="0.01"
                  />
                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => handleRemoveCategory(index)}
                    disabled={categories.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="add-category">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
            />
            <input
              type="number"
              value={newCategoryBudget}
              onChange={(e) => setNewCategoryBudget(e.target.value)}
              placeholder="Budget amount"
              min="0"
              step="0.01"
            />
            <button type="button" onClick={handleAddCategory}>Add Category</button>
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setStep('budget')}>
              Back
            </button>
            <button type="submit" className="primary-button">Start Budgeting</button>
          </div>
        </form>
        <div className="progress-indicator">Step 2 of 2</div>
      </div>
    </div>
  );
}

export default Onboarding;
