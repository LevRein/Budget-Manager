import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { AppState, Category, Transaction } from './types';
import BudgetSummary from './components/BudgetSummary';
import Categories from './components/Categories';
import Transactions from './components/Transactions';
import Onboarding from './components/Onboarding';
import AuthScreen from './components/AuthScreen';
import Charts from './components/Charts';

const STORAGE_KEY = 'budget-app-state'; // guest mode only

const defaultState: AppState = {
  monthlyBudget: 0,
  categories: [],
  transactions: [],
  onboardingCompleted: false,
  currentUser: undefined,
  username: undefined,
  preferences: {
    theme: 'dark',
    currency: 'USD'
  }
};

function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [loading, setLoading] = useState(true);
  const supabaseUserRef = useRef<User | null>(null);

  const [skipAuth, setSkipAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [settingsBudget, setSettingsBudget] = useState('');
  const [settingsPane, setSettingsPane] = useState<'email' | 'password' | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [accountMsg, setAccountMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'clearTransactions' | 'deleteAccount' | 'resetApp' | null>(null);
  const [exportYear, setExportYear] = useState(() => new Date().getFullYear().toString());

  const fetchUserData = async (user: User) => {
    const [profileResult, { data: categories }, { data: transactions }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('categories').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    let profile = profileResult.data;

    // PGRST116 = no row found — trigger may not have fired, so create the profile
    if (!profile && profileResult.error?.code === 'PGRST116') {
      const username =
        (user.user_metadata?.username as string) ||
        user.email?.split('@')[0] ||
        '';
      const { data: created } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username })
        .select()
        .single();
      profile = created;
    }

    setState({
      monthlyBudget: Number(profile?.monthly_budget ?? 0),
      categories: (categories ?? []).map((c: Record<string, unknown>) => ({
        name: c.name as string,
        budget: Number(c.budget),
      })),
      transactions: (transactions ?? []).map((t: Record<string, unknown>) => ({
        id: t.id as string,
        description: t.description as string,
        amount: Number(t.amount),
        category: t.category as string,
        date: t.date as string,
        month: t.month as string,
      })),
      onboardingCompleted: (profile?.onboarding_completed as boolean) ?? false,
      currentUser: user.email ?? undefined,
      username: (profile?.username as string) || user.email?.split('@')[0],
      preferences: {
        theme: ((profile?.theme as 'dark' | 'light') || 'dark'),
        currency: 'USD',
      },
    });
  };

  const loadGuestData = () => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as AppState;
      parsed.transactions = parsed.transactions.map(tx => ({
        ...tx,
        month: tx.month || new Date(tx.date).toISOString().slice(0, 7),
      }));
      if (!parsed.preferences) parsed.preferences = defaultState.preferences;
      if (parsed.onboardingCompleted === undefined) parsed.onboardingCompleted = false;
      setState(parsed);
    } catch { /* ignore */ }
  };

  // Auth initialization — handles both existing sessions and new sign-ins
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        // Fire-and-forget: callback must return void so Supabase doesn't await it
        // (awaiting would deadlock signInWithPassword in Supabase JS v2)
        void (async () => {
          try {
            if (session?.user) {
              supabaseUserRef.current = session.user;
              await fetchUserData(session.user);
            } else {
              loadGuestData();
            }
          } catch {
            supabaseUserRef.current = null;
            loadGuestData();
          } finally {
            setLoading(false);
          }
        })();
      } else if (event === 'SIGNED_IN' && session?.user) {
        supabaseUserRef.current = session.user;
        fetchUserData(session.user).catch(() => {
          supabaseUserRef.current = null;
          setState(prev => ({ ...prev, currentUser: session.user!.email ?? undefined }));
        });
      } else if (event === 'SIGNED_OUT') {
        supabaseUserRef.current = null;
        setState(defaultState);
      } else if (event === 'USER_UPDATED' && session?.user) {
        supabaseUserRef.current = session.user;
        setState(prev => ({ ...prev, currentUser: session.user!.email ?? prev.currentUser }));
      }
    });

    // Safety net: if INITIAL_SESSION never fires (rare network issue), unblock the UI
    const fallback = setTimeout(() => setLoading(false), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  // Guest-only localStorage persistence
  useEffect(() => {
    if (!supabaseUserRef.current) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.preferences.theme;
  }, [state.preferences.theme]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setShowSettings(false);
  };

  const updatePreferences = async (preferences: AppState['preferences']) => {
    setState(prev => ({ ...prev, preferences }));
    if (supabaseUserRef.current) {
      await supabase.from('profiles').update({ theme: preferences.theme }).eq('id', supabaseUserRef.current.id);
    }
  };

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const totalSpent = useMemo(
    () => state.transactions
      .filter(tx => tx.month === currentMonth)
      .reduce((sum, tx) => sum + tx.amount, 0),
    [state.transactions, currentMonth]
  );

  const remainingBudget = state.monthlyBudget - totalSpent;

  const categoryTotals = useMemo(() => {
    const currentMonthTransactions = state.transactions.filter(tx => tx.month === currentMonth);
    return state.categories.map(category => {
      const spent = currentMonthTransactions
        .filter(tx => tx.category === category.name)
        .reduce((sum, tx) => sum + tx.amount, 0);
      return { ...category, spent };
    });
  }, [state.categories, state.transactions, currentMonth]);

  const setMonthlyBudget = async (budget: number) => {
    setState(prev => ({ ...prev, monthlyBudget: budget }));
    if (supabaseUserRef.current) {
      await supabase.from('profiles').update({ monthly_budget: budget }).eq('id', supabaseUserRef.current.id);
    }
  };

  const addCategory = async (category: Category) => {
    setState(prev => ({ ...prev, categories: [...prev.categories, category] }));
    if (supabaseUserRef.current) {
      await supabase.from('categories').insert({
        user_id: supabaseUserRef.current.id,
        name: category.name,
        budget: category.budget,
      });
    }
  };

  const updateCategory = async (prevName: string, updatedCategory: Category) => {
    setState(prev => ({
      ...prev,
      categories: prev.categories.map(c => c.name === prevName ? updatedCategory : c),
      transactions: prev.transactions.map(t =>
        t.category === prevName ? { ...t, category: updatedCategory.name } : t
      ),
    }));
    if (supabaseUserRef.current) {
      const uid = supabaseUserRef.current.id;
      await supabase.from('categories')
        .update({ name: updatedCategory.name, budget: updatedCategory.budget })
        .eq('user_id', uid)
        .eq('name', prevName);
      if (prevName !== updatedCategory.name) {
        await supabase.from('transactions')
          .update({ category: updatedCategory.name })
          .eq('user_id', uid)
          .eq('category', prevName);
      }
    }
  };

  const removeCategory = async (name: string) => {
    setState(prev => ({ ...prev, categories: prev.categories.filter(c => c.name !== name) }));
    if (supabaseUserRef.current) {
      await supabase.from('categories').delete()
        .eq('user_id', supabaseUserRef.current.id)
        .eq('name', name);
    }
  };

  const addTransaction = async (transaction: Transaction) => {
    setState(prev => ({ ...prev, transactions: [transaction, ...prev.transactions] }));
    if (supabaseUserRef.current) {
      await supabase.from('transactions').insert({
        id: transaction.id,
        user_id: supabaseUserRef.current.id,
        description: transaction.description,
        amount: transaction.amount,
        category: transaction.category,
        date: transaction.date,
        month: transaction.month,
      });
    }
  };

  const removeTransaction = async (id: string) => {
    setState(prev => ({ ...prev, transactions: prev.transactions.filter(tx => tx.id !== id) }));
    if (supabaseUserRef.current) {
      await supabase.from('transactions').delete()
        .eq('id', id)
        .eq('user_id', supabaseUserRef.current.id);
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(tx => tx.id === id ? { ...tx, ...updates } : tx),
    }));
    if (supabaseUserRef.current) {
      await supabase.from('transactions').update(updates)
        .eq('id', id)
        .eq('user_id', supabaseUserRef.current.id);
    }
  };

  const completeOnboarding = async (monthlyBudget: number, categories: Category[]) => {
    setState(prev => ({ ...prev, monthlyBudget, categories, onboardingCompleted: true }));
    if (supabaseUserRef.current) {
      const uid = supabaseUserRef.current.id;
      await supabase.from('profiles')
        .update({ monthly_budget: monthlyBudget, onboarding_completed: true })
        .eq('id', uid);
      if (categories.length > 0) {
        await supabase.from('categories').insert(
          categories.map(c => ({ user_id: uid, name: c.name, budget: c.budget }))
        );
      }
    }
  };

  const resetOnboarding = async () => {
    setState(prev => ({
      ...defaultState,
      currentUser: prev.currentUser,
      username: prev.username,
      preferences: prev.preferences,
      onboardingCompleted: false,
    }));
    if (supabaseUserRef.current) {
      const uid = supabaseUserRef.current.id;
      await Promise.all([
        supabase.from('profiles').update({ monthly_budget: 0, onboarding_completed: false }).eq('id', uid),
        supabase.from('categories').delete().eq('user_id', uid),
        supabase.from('transactions').delete().eq('user_id', uid),
      ]);
    }
  };

  const updateEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setAccountMsg({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      setAccountMsg({ type: 'error', text: error.message });
      return;
    }
    setAccountMsg({ type: 'success', text: 'Confirmation sent to your new address. Check your inbox.' });
    setSettingsPane(null);
    setNewEmail('');
  };

  const updatePassword = async () => {
    if (newPwd.length < 6) {
      setAccountMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setAccountMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (!state.currentUser) return;
    // Verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: state.currentUser,
      password: currentPwd,
    });
    if (verifyError) {
      setAccountMsg({ type: 'error', text: 'Current password is incorrect.' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) {
      setAccountMsg({ type: 'error', text: error.message });
      return;
    }
    setAccountMsg({ type: 'success', text: 'Password updated successfully.' });
    setSettingsPane(null);
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
  };

  const exportData = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const lm = 20;
    const rm = 20;
    let y = 22;

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const isCurrentYear = exportYear === today.getFullYear().toString();

    // Compute year-scoped totals
    const yearTxs = state.transactions.filter(tx => tx.month.startsWith(exportYear));
    const yearTotal = yearTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const yearCatTotals = state.categories.map(cat => ({
      ...cat,
      spent: yearTxs.filter(tx => tx.category === cat.name).reduce((sum, tx) => sum + tx.amount, 0),
    }));

    const newPage = () => { doc.addPage(); y = 22; };
    const checkPage = (needed = 12) => { if (y > ph - needed) newPage(); };

    // ── Header ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(17, 24, 39);
    doc.text('Budget Manager', lm, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`${exportYear} Report  ·  Exported: ${dateStr}`, pw - rm, y, { align: 'right' });

    y += 5;
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    doc.line(lm, y, pw - rm, y);
    y += 12;

    // ── Budget Summary ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text('Budget Summary', lm, y);
    y += 7;

    const summaryRows: [string, string][] = [
      ['Monthly Budget', `$${state.monthlyBudget.toLocaleString()}`],
      [`Total Spent (${exportYear})`, `$${yearTotal.toLocaleString()}`],
    ];
    if (isCurrentYear) {
      summaryRows.push(['Remaining Budget (This Month)', `$${remainingBudget.toLocaleString()}`]);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    for (const [label, value] of summaryRows) {
      doc.text(label, lm, y);
      doc.text(value, pw - rm, y, { align: 'right' });
      y += 6;
    }
    y += 10;

    // ── Category Breakdown ──
    checkPage(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text('Category Breakdown', lm, y);
    y += 7;

    const c1 = lm, c2 = lm + 100, c3 = lm + 140;

    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Category', c1, y);
    doc.text(`Spent (${exportYear})`, c2, y);
    doc.text('Monthly Budget', c3, y);
    y += 4;

    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.3);
    doc.line(lm, y, pw - rm, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    for (const cat of yearCatTotals) {
      checkPage(10);
      const name = cat.name.length > 38 ? cat.name.slice(0, 37) + '…' : cat.name;
      doc.setTextColor(55, 65, 81);
      doc.text(name, c1, y);
      doc.text(`$${cat.spent.toLocaleString()}`, c2, y);
      doc.text(`$${cat.budget.toLocaleString()}`, c3, y);
      y += 6;
    }
    y += 10;

    // ── Transaction History ──
    checkPage(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text('Transaction History', lm, y);
    y += 7;

    const txsByMonth = yearTxs.reduce((acc, tx) => {
      if (!acc[tx.month]) acc[tx.month] = [];
      acc[tx.month].push(tx);
      return acc;
    }, {} as Record<string, Transaction[]>);

    const sortedMonths = Object.keys(txsByMonth).sort().reverse();

    for (const month of sortedMonths) {
      checkPage(25);
      const [yr, mo] = month.split('-');
      const monthLabel = new Date(parseInt(yr), parseInt(mo) - 1)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text(monthLabel, lm, y);
      y += 4;

      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.2);
      doc.line(lm, y, pw - rm, y);
      y += 4;

      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('Date', lm, y);
      doc.text('Category', lm + 48, y);
      doc.text('Amount', pw - rm, y, { align: 'right' });
      y += 4;
      doc.line(lm, y, pw - rm, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);

      const sorted = [...txsByMonth[month]].sort((a, b) => b.date.localeCompare(a.date));
      const monthTotal = sorted.reduce((sum, tx) => sum + tx.amount, 0);

      for (const tx of sorted) {
        checkPage(8);
        const [ty, tm, td] = tx.date.slice(0, 10).split('-').map(Number);
        const txDate = new Date(ty, tm - 1, td)
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const cat = tx.category.length > 26 ? tx.category.slice(0, 25) + '…' : tx.category;
        doc.text(txDate, lm, y);
        doc.text(cat, lm + 48, y);
        doc.text(`$${tx.amount.toFixed(2)}`, pw - rm, y, { align: 'right' });
        y += 5;
      }

      y += 1;
      doc.setLineWidth(0.2);
      doc.line(lm + 48, y, pw - rm, y);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('Month Total', lm + 48, y);
      doc.text(`$${monthTotal.toFixed(2)}`, pw - rm, y, { align: 'right' });
      y += 10;
    }

    doc.save(`budget-manager-${exportYear}.pdf`);
  };

  const executeConfirmAction = async () => {
    if (confirmAction === 'clearTransactions') {
      setState(prev => ({ ...prev, transactions: [] }));
      if (supabaseUserRef.current) {
        await supabase.from('transactions').delete().eq('user_id', supabaseUserRef.current.id);
      }
    } else if (confirmAction === 'deleteAccount' && supabaseUserRef.current) {
      const uid = supabaseUserRef.current.id;
      await Promise.all([
        supabase.from('transactions').delete().eq('user_id', uid),
        supabase.from('categories').delete().eq('user_id', uid),
        supabase.from('profiles').delete().eq('id', uid),
      ]);
      await supabase.rpc('delete_user');
      await supabase.auth.signOut();
      setState(defaultState);
      setShowSettings(false);
    } else if (confirmAction === 'resetApp') {
      await resetOnboarding();
      setShowSettings(false);
    }
    setConfirmAction(null);
  };

  const openSettings = () => {
    setSettingsBudget(state.monthlyBudget > 0 ? state.monthlyBudget.toString() : '');
    setSettingsPane(null);
    setAccountMsg(null);
    setShowProfile(false);
    setShowPreferences(false);
    setNewEmail('');
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setShowSettings(true);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!state.onboardingCompleted) {
    if (state.currentUser || skipAuth) {
      return <Onboarding onComplete={completeOnboarding} />;
    }
    return <AuthScreen onGuestContinue={() => setSkipAuth(true)} />;
  }

  return (
    <div className="app-shell">
      <header>
        <h1>Budget Manager</h1>
        <div className="header-actions">

          <button className="header-action-button" onClick={openSettings}>
            ⚙️
          </button>
        </div>
        <p>Track your monthly budget, categories, and expenses.</p>
      </header>

      <main>
        <BudgetSummary
          monthlyBudget={state.monthlyBudget}
          remainingBudget={remainingBudget}
          totalSpent={totalSpent}
          categories={categoryTotals}
        />

        <Charts
          transactions={state.transactions}
          categories={categoryTotals}
          monthlyBudget={state.monthlyBudget}
          theme={state.preferences.theme}
        />

        <Categories
          categories={categoryTotals}
          onAddCategory={addCategory}
          onUpdateCategory={updateCategory}
          onRemoveCategory={removeCategory}
        />

        <Transactions
          transactions={state.transactions}
          categories={state.categories}
          onAddTransaction={addTransaction}
          onUpdateTransaction={updateTransaction}
          onRemoveTransaction={removeTransaction}
        />
      </main>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="modal-close-button" onClick={() => setShowSettings(false)} aria-label="Close">✕</button>
            </div>

            <div className="settings-body">

              {/* ── Profile ── */}
              <div className="settings-section">
                <button
                  type="button"
                  className="settings-profile-toggle"
                  onClick={() => { setShowProfile(p => !p); setSettingsPane(null); setAccountMsg(null); }}
                >
                  <span>Profile</span>
                  <span className="settings-profile-chevron">{showProfile ? '▲' : '▼'}</span>
                </button>

                {showProfile && (
                  <div className="settings-profile-body">
                    {state.currentUser ? (
                      <>
                        {accountMsg && (
                          <div className={`settings-msg settings-msg--${accountMsg.type}`}>
                            {accountMsg.text}
                          </div>
                        )}

                        <div className="settings-info-row">
                          <span className="settings-info-label">Username</span>
                          <span className="settings-info-value">{state.username}</span>
                        </div>

                        <div className="settings-info-row">
                          <span className="settings-info-label">Email</span>
                          <span className="settings-info-value">{state.currentUser}</span>
                          <button
                            type="button"
                            className="settings-edit-btn"
                            onClick={() => { setSettingsPane(settingsPane === 'email' ? null : 'email'); setAccountMsg(null); }}
                          >
                            {settingsPane === 'email' ? 'Cancel' : 'Change'}
                          </button>
                        </div>

                        {settingsPane === 'email' && (
                          <div className="settings-inline-form">
                            <label>New Email
                              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" />
                            </label>
                            <button type="button" className="primary-button" onClick={updateEmail}>Save Email</button>
                          </div>
                        )}

                        <div className="settings-info-row">
                          <span className="settings-info-label">Password</span>
                          <span className="settings-info-value">••••••••</span>
                          <button
                            type="button"
                            className="settings-edit-btn"
                            onClick={() => { setSettingsPane(settingsPane === 'password' ? null : 'password'); setAccountMsg(null); }}
                          >
                            {settingsPane === 'password' ? 'Cancel' : 'Change'}
                          </button>
                        </div>

                        {settingsPane === 'password' && (
                          <div className="settings-inline-form">
                            <label>Current Password
                              <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="Your current password" />
                            </label>
                            <label>New Password
                              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="At least 6 characters" />
                            </label>
                            <label>Confirm New Password
                              <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Repeat new password" />
                            </label>
                            <button type="button" className="primary-button" onClick={updatePassword}>Save Password</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="settings-guest-notice">
                        You are using Budget Manager as a guest. Sign in or create an account to manage your profile.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Preferences ── */}
              <div className="settings-section">
                <button
                  type="button"
                  className="settings-profile-toggle"
                  onClick={() => setShowPreferences(p => !p)}
                >
                  <span>Preferences</span>
                  <span className="settings-profile-chevron">{showPreferences ? '▲' : '▼'}</span>
                </button>

                {showPreferences && (
                  <div className="settings-profile-body">
                    <div className="settings-field">
                      <label>
                        Monthly Budget
                        <div className="settings-budget-row">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settingsBudget}
                            onChange={(e) => setSettingsBudget(e.target.value)}
                            placeholder="0"
                          />
                          <button type="button" onClick={() => { const v = Number(settingsBudget); if (v > 0) setMonthlyBudget(v); }}>
                            Update
                          </button>
                        </div>
                      </label>
                    </div>
                    <div className="settings-field">
                      <label>
                        Theme
                        <select
                          value={state.preferences.theme}
                          onChange={(e) => updatePreferences({ ...state.preferences, theme: e.target.value as 'dark' | 'light' })}
                        >
                          <option value="dark">Dark</option>
                          <option value="light">Light</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Privacy & Data ── */}
              <div className="settings-section settings-section--last">
                <h3 className="settings-section-title">Privacy &amp; Data</h3>
                <p className="settings-privacy-notice">
                  {state.currentUser
                    ? 'Your data is securely stored in the cloud and synced across devices.'
                    : 'You are in guest mode. Your data is stored locally on this device only.'}
                </p>
                <div className="settings-export-row">
                  {(() => {
                    const years = [...new Set(state.transactions.map(tx => tx.month.slice(0, 4)))]
                      .sort()
                      .reverse();
                    if (years.length === 0) years.push(new Date().getFullYear().toString());
                    return years.length > 1 ? (
                      <select
                        className="settings-export-year"
                        value={exportYear}
                        onChange={e => setExportYear(e.target.value)}
                      >
                        {years.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    ) : null;
                  })()}
                  <button type="button" className="secondary-button" onClick={exportData}>
                    Export Data
                  </button>
                </div>
                <div className="settings-action-row" style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setConfirmAction('clearTransactions')}
                  >
                    Clear Transactions
                  </button>
                  {!state.currentUser && (
                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => setConfirmAction('resetApp')}
                    >
                      Reset App
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* ── Footer ── */}
            <div className="settings-footer">
              {state.currentUser ? (
                <>
                  <button type="button" className="secondary-button" onClick={signOut}>
                    Log Out
                  </button>
                  <button type="button" className="delete-button" onClick={() => setConfirmAction('deleteAccount')}>
                    Delete Account
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => { setState(defaultState); setSkipAuth(false); setShowSettings(false); }}
                >
                  Sign In / Create Account
                </button>
              )}
            </div>

          </div>
        </div>
      )}
      {confirmAction && (() => {
        const config = {
          clearTransactions: {
            title: 'Clear Transaction History?',
            body: 'This will permanently remove all of your recorded transactions. Your categories and budget settings will remain intact.',
            label: 'Clear Transactions',
          },
          deleteAccount: {
            title: 'Delete Account?',
            body: 'This will permanently delete your account and all associated data, including transactions, categories, and budget settings. This action cannot be undone.',
            label: 'Delete Account',
          },
          resetApp: {
            title: 'Reset App?',
            body: 'This will clear all your data and return you to the setup screen. This action cannot be undone.',
            label: 'Reset App',
          },
        }[confirmAction];
        return (
          <div className="modal-backdrop confirm-backdrop" onClick={() => setConfirmAction(null)}>
            <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
              <h3>{config.title}</h3>
              <p className="confirm-body">{config.body}</p>
              <p className="confirm-warning">This cannot be undone.</p>
              <div className="modal-actions">
                <button type="button" className="delete-button" onClick={executeConfirmAction}>
                  {config.label}
                </button>
                <button type="button" className="secondary-button" onClick={() => setConfirmAction(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default App;
