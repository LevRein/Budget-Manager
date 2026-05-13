import { Category } from '../types';

interface BudgetSummaryProps {
  monthlyBudget: number;
  remainingBudget: number;
  totalSpent: number;
  categories: Array<Category & { spent: number }>;
}

function BudgetSummary({ monthlyBudget, remainingBudget, totalSpent, categories }: BudgetSummaryProps) {
  return (
    <section className="card">
      <h2>Summary</h2>
      <div className="summary-grid">
        <div className="summary-card">
          <strong>Monthly budget</strong>
          <span>${monthlyBudget.toLocaleString()}</span>
        </div>
        <div className="summary-card">
          <strong>Total spent</strong>
          <span>${totalSpent.toLocaleString()}</span>
        </div>
        <div className="summary-card">
          <strong>Remaining budget</strong>
          <span>${remainingBudget.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h3>Category breakdown</h3>
        <div className="summary-grid category-breakdown-grid">
          {categories.map(category => {
            const spent = category.spent;
            const available = category.budget - category.spent;
            const isOver = available < 0;
            const usedPercent = category.budget > 0 ? Math.min(100, Math.round((spent / category.budget) * 100)) : 0;
            return (
              <div key={category.name} className="summary-card category-summary-card">
                <div className="category-card-top">
                  <strong>{category.name}</strong>
                </div>

                <div className="category-summary-values">
                  <div>
                    <span>Spent</span>
                    <strong>${spent.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Available</span>
                    <strong style={{ color: isOver ? '#ef4444' : undefined }}>
                      {isOver ? `-$${Math.abs(available).toLocaleString()}` : `$${available.toLocaleString()}`}
                    </strong>
                  </div>
                </div>

                <div className="category-progress">
                  <div className="category-progress-bar-background">
                    <div
                      className={`category-progress-fill ${spent > category.budget ? 'over' : ''}`}
                      style={{ width: `${usedPercent}%` }}
                    />
                  </div>
                  <span className="progress-note">{usedPercent}% used</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default BudgetSummary;
