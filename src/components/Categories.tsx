import { FormEvent, useState } from 'react';
import { Category } from '../types';

interface CategoryWithSpent extends Category {
  spent: number;
}

interface CategoriesProps {
  categories: CategoryWithSpent[];
  onAddCategory: (category: Category) => void;
  onUpdateCategory: (prevName: string, category: Category) => void;
  onRemoveCategory: (name: string) => void;
}

function Categories({ categories, onAddCategory, onUpdateCategory, onRemoveCategory }: CategoriesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryBudget, setCategoryBudget] = useState('0');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBudget, setEditBudget] = useState('0');
  const [confirmingCategory, setConfirmingCategory] = useState<Category | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    const budget = Number(categoryBudget);
    if (!name || budget <= 0) return;
    if (categories.some(c => c.name === name)) return;
    onAddCategory({ name, budget });
    setCategoryName('');
    setCategoryBudget('0');
    setIsAdding(false);
  };

  const beginEdit = (category: Category) => {
    setEditName(category.name);
    setEditBudget(category.budget.toString());
    setEditingCategory(category.name);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditName('');
    setEditBudget('0');
  };

  const handleUpdate = (event: FormEvent) => {
    event.preventDefault();
    if (!editingCategory) return;
    const name = editName.trim();
    const budget = Number(editBudget);
    if (!name || budget <= 0) return;
    if (name !== editingCategory && categories.some(c => c.name === name)) return;
    onUpdateCategory(editingCategory, { name, budget });
    cancelEdit();
  };

  const handleDelete = () => {
    if (!confirmingCategory) return;
    onRemoveCategory(confirmingCategory.name);
    setConfirmingCategory(null);
  };

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Categories</h2>
          <p>Manage your budget categories and add new budget targets.</p>
        </div>
        <button type="button" className="icon-button" onClick={() => setIsAdding(prev => !prev)}>
          + Add
        </button>
      </div>

      <div className="summary-grid">
        {categories.length > 0 ? (
          categories.map(category => {
            const progress = Math.min(100, Math.round((category.spent / category.budget) * 100));
            return (
              <div key={category.name} className="summary-card">
                <div className="category-card-header">
                  <strong>{category.name}</strong>
                  <div className="category-actions">
                    <button type="button" className="small-button" onClick={() => beginEdit(category)}>
                      Edit
                    </button>
                  </div>
                </div>
                <span>${category.budget.toLocaleString()}</span>
                <div className="progress-wrapper">
                  <div
                    className={`progress-bar ${category.spent > category.budget ? 'progress-bar-over' : ''}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="progress-label">
                  <span>{progress}% used</span>
                  <span>${category.spent.toLocaleString()} spent</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="summary-card">
            <strong>No categories yet</strong>
            <span>Add a category to begin tracking.</span>
          </div>
        )}
      </div>

      {/* Add category modal */}
      {isAdding && (
        <div className="modal-backdrop" onClick={() => setIsAdding(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Category</h3>
              <button type="button" className="modal-close-button" onClick={() => setIsAdding(false)} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <label>
                Category name
                <input
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  placeholder="e.g. Transportation"
                />
              </label>
              <label>
                Category budget
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={categoryBudget}
                  onChange={e => setCategoryBudget(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setIsAdding(false)}>Cancel</button>
                <button type="submit">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingCategory && (
        <div className="modal-backdrop" onClick={cancelEdit}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Category</h3>
              <button type="button" className="modal-close-button" onClick={cancelEdit} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleUpdate}>
              <label>
                Category name
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </label>
              <label>
                Category budget
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editBudget}
                  onChange={e => setEditBudget(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="delete-button"
                  style={{ marginRight: 'auto' }}
                  onClick={() => {
                    setConfirmingCategory({ name: editingCategory, budget: Number(editBudget) });
                    cancelEdit();
                  }}
                >
                  Remove
                </button>
                <button type="button" className="secondary-button" onClick={cancelEdit}>
                  Cancel
                </button>
                <button type="submit">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmingCategory && (
        <div className="modal-backdrop" onClick={() => setConfirmingCategory(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm removal</h3>
            <p>Are you sure you want to remove <strong>{confirmingCategory.name}</strong>?</p>
            <p>Past expenses will be kept but will no longer be linked to this category.</p>
            <div className="modal-actions">
              <button type="button" onClick={handleDelete}>Remove</button>
              <button type="button" className="secondary-button" onClick={() => setConfirmingCategory(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Categories;
