import { FormEvent, useState } from 'react';
import { Transaction, Category } from '../types';

interface TransactionsProps {
  transactions: Transaction[];
  categories: Category[];
  onAddTransaction: (transaction: Transaction) => void;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  onRemoveTransaction: (id: string) => void;
}

type SortField = 'date' | 'category' | 'amount';
type SortDir   = 'asc' | 'desc';

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(dateString));
}

function toDateInput(isoString: string) {
  return isoString.slice(0, 10);
}

function Transactions({ transactions, categories, onAddTransaction, onUpdateTransaction, onRemoveTransaction }: TransactionsProps) {
  const [isAdding, setIsAdding]               = useState(false);
  const [amount, setAmount]                   = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name ?? '');
  const [date, setDate]                       = useState(() => new Date().toISOString().slice(0, 10));

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount]                 = useState('');
  const [editCategory, setEditCategory]             = useState('');
  const [editDate, setEditDate]                     = useState('');

  const [pendingRemove, setPendingRemove] = useState<Transaction | null>(null);

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return new Set([currentMonth]);
  });

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const amountValue = Number(amount);
    if (amountValue <= 0 || !selectedCategory || !date) return;
    onAddTransaction({
      id: crypto.randomUUID(),
      description: selectedCategory,
      amount: amountValue,
      category: selectedCategory,
      date: new Date(date + 'T00:00:00').toISOString(),
      month: date.slice(0, 7),
    });
    setAmount('');
    setDate(new Date().toISOString().slice(0, 10));
    setIsAdding(false);
  };

  const beginEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setEditAmount(tx.amount.toString());
    setEditCategory(tx.category);
    setEditDate(toDateInput(tx.date));
  };

  const cancelEdit = () => setEditingTransaction(null);

  const handleUpdate = (event: FormEvent) => {
    event.preventDefault();
    if (!editingTransaction) return;
    const newAmount = Number(editAmount);
    if (newAmount <= 0 || !editCategory || !editDate) return;
    onUpdateTransaction(editingTransaction.id, {
      amount: newAmount,
      category: editCategory,
      description: editCategory,
      date: new Date(editDate + 'T00:00:00').toISOString(),
      month: editDate.slice(0, 7),
    });
    cancelEdit();
  };

  const sortTxs = (txs: Transaction[]) =>
    [...txs].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date')     cmp = a.date.localeCompare(b.date);
      if (sortField === 'category') cmp = a.category.localeCompare(b.category);
      if (sortField === 'amount')   cmp = a.amount - b.amount;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const transactionsByYear = transactions.reduce((acc, tx) => {
    const year = tx.month.slice(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const sortedYears  = Object.keys(transactionsByYear).sort().reverse();
  const currentYear  = new Date().getFullYear().toString();

  const formatYear  = (year: string) => year;
  const formatMonth = (month: string) => {
    const [y, m] = month.split('-');
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const SORT_FIELDS: SortField[] = ['date', 'category', 'amount'];

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Recent Transactions</h2>
          <p>Track your spending and add new expenses.</p>
        </div>
        <button type="button" className="icon-button" onClick={() => setIsAdding(prev => !prev)}>
          + Add Expense
        </button>
      </div>

      {/* Sort toolbar */}
      {transactions.length > 0 && (
        <div className="tx-toolbar">
          <span className="tx-sort-label">Sort by</span>
          <div className="tx-sort-pills">
            {SORT_FIELDS.map(field => (
              <button
                key={field}
                type="button"
                className={`tx-sort-pill${sortField === field ? ' active' : ''}`}
                onClick={() => setSortField(field)}
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tx-sort-dir"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          >
            {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
        </div>
      )}

      {/* Add expense modal */}
      {isAdding && (
        <div className="modal-backdrop" onClick={() => setIsAdding(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Expense</h3>
              <button type="button" className="modal-close-button" onClick={() => setIsAdding(false)} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <label>
                Category
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                  {categories.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Amount
                <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              </label>
              <label>
                Date
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setIsAdding(false)}>Cancel</button>
                <button type="submit">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction list */}
      {transactions.length === 0 ? (
        <p>No transactions recorded yet. Add an expense to get started.</p>
      ) : (
        <div>
          {sortedYears.map(year => {
            const isCurrentYear   = year === currentYear;
            const yearTransactions = transactionsByYear[year];
            const isExpanded      = expandedMonths.has(year) || isCurrentYear;

            if (isCurrentYear) {
              const transactionsByMonth = yearTransactions.reduce((acc, tx) => {
                if (!acc[tx.month]) acc[tx.month] = [];
                acc[tx.month].push(tx);
                return acc;
              }, {} as Record<string, Transaction[]>);
              const sortedMonths = Object.keys(transactionsByMonth).sort().reverse();

              return (
                <div key={year} className="year-section">
                  <h3 className="year-header">{formatYear(year)} (Current Year)</h3>
                  {sortedMonths.map(month => {
                    const monthExpanded = expandedMonths.has(month);
                    return (
                      <div key={month} className="month-section">
                        <h4
                          className={`month-header ${monthExpanded ? 'expanded' : 'collapsed'}`}
                          onClick={() => toggleMonth(month)}
                        >
                          {formatMonth(month)}
                          <span className="expand-icon">{monthExpanded ? '▼' : '▶'}</span>
                        </h4>
                        {monthExpanded && (
                          <table className="transactions-list">
                            <thead>
                              <tr>
                                <th>Category</th>
                                <th>Date</th>
                                <th>Amount</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortTxs(transactionsByMonth[month]).map(tx => (
                                <tr key={tx.id}>
                                  <td>{tx.category}</td>
                                  <td>{formatDate(tx.date)}</td>
                                  <td className="transaction-amount">${tx.amount.toFixed(2)}</td>
                                  <td className="tx-actions">
                                    <button type="button" className="small-button" onClick={() => beginEdit(tx)}>
                                      Edit
                                    </button>
                                    <button type="button" className="remove-button" onClick={() => setPendingRemove(tx)}>
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Past years — same monthly breakdown as current year
            const transactionsByMonth = yearTransactions.reduce((acc, tx) => {
              if (!acc[tx.month]) acc[tx.month] = [];
              acc[tx.month].push(tx);
              return acc;
            }, {} as Record<string, Transaction[]>);
            const sortedMonths = Object.keys(transactionsByMonth).sort().reverse();

            return (
              <div key={year} className="year-section">
                <h3
                  className={`year-header ${isExpanded ? 'expanded' : 'collapsed'}`}
                  onClick={() => toggleMonth(year)}
                >
                  {formatYear(year)}
                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                </h3>
                {isExpanded && sortedMonths.map(month => {
                  const monthExpanded = expandedMonths.has(month);
                  return (
                    <div key={month} className="month-section">
                      <h4
                        className={`month-header ${monthExpanded ? 'expanded' : 'collapsed'}`}
                        onClick={() => toggleMonth(month)}
                      >
                        {formatMonth(month)}
                        <span className="expand-icon">{monthExpanded ? '▼' : '▶'}</span>
                      </h4>
                      {monthExpanded && (
                        <table className="transactions-list">
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th>Date</th>
                              <th>Amount</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortTxs(transactionsByMonth[month]).map(tx => (
                              <tr key={tx.id}>
                                <td>{tx.category}</td>
                                <td>{formatDate(tx.date)}</td>
                                <td className="transaction-amount">${tx.amount.toFixed(2)}</td>
                                <td className="tx-actions">
                                  <button type="button" className="small-button" onClick={() => beginEdit(tx)}>
                                    Edit
                                  </button>
                                  <button type="button" className="remove-button" onClick={() => setPendingRemove(tx)}>
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editingTransaction && (
        <div className="modal-backdrop" onClick={cancelEdit}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Transaction</h3>
              <button type="button" className="modal-close-button" onClick={cancelEdit} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleUpdate}>
              <label>
                Category
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                  {categories.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={cancelEdit}>Cancel</button>
                <button type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove confirmation modal */}
      {pendingRemove && (
        <div className="modal-backdrop" onClick={() => setPendingRemove(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Remove transaction?</h3>
            <p>
              <strong>{pendingRemove.category}</strong> &mdash; ${pendingRemove.amount.toFixed(2)} on {formatDate(pendingRemove.date)}
            </p>
            <p>This cannot be undone.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="delete-button"
                onClick={() => { onRemoveTransaction(pendingRemove.id); setPendingRemove(null); }}
              >
                Remove
              </button>
              <button type="button" className="secondary-button" onClick={() => setPendingRemove(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Transactions;
