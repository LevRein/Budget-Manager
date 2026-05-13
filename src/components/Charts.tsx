import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
  Line, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { Transaction, Category } from '../types';

interface ChartsProps {
  transactions: Transaction[];
  categories: (Category & { spent: number })[];
  monthlyBudget: number;
  theme: 'dark' | 'light';
}

type DonutSegment = { name: string; value: number; fill: string };

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function Charts({ transactions, categories, monthlyBudget, theme }: ChartsProps) {
  const [activeSegment, setActiveSegment]            = useState<DonutSegment | null>(null);
  const [activeHistorySegment, setActiveHistorySegment] = useState<DonutSegment | null>(null);
  const [showHistory, setShowHistory]                = useState(false);
  const [historyMonth, setHistoryMonth]              = useState('');
  const [trendMonth, setTrendMonth]                  = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const isDark      = theme === 'dark';
  const axisColor   = isDark ? '#9ca3af' : '#6b7280';
  const gridColor   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const tooltipBg   = isDark ? '#1f2937' : '#ffffff';
  const tooltipBdr  = isDark ? '#374151' : '#e5e7eb';
  const tooltipTxt  = isDark ? '#f9fafb' : '#111827';
  const modalBg     = isDark ? '#1f2937' : '#ffffff';
  const modalBorder = isDark ? '#374151' : '#e5e7eb';

  const now          = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const currencySymbol = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .formatToParts(0)
    .find(p => p.type === 'currency')?.value ?? '$';

  const yFmt = (v: number) =>
    v >= 1000 ? `${currencySymbol}${(v / 1000).toFixed(1)}k` : `${currencySymbol}${v}`;

  const makeTooltip = (txtColor: string) => ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: tooltipBg,
        border: `1px solid ${tooltipBdr}`,
        borderRadius: '0.75rem',
        padding: '0.6rem 0.9rem',
        color: txtColor,
        fontSize: '0.875rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}>
        {label && <p style={{ margin: '0 0 0.4rem', fontWeight: 700 }}>{label}</p>}
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ margin: '0.15rem 0', color: entry.color ?? txtColor }}>
            {entry.name}: {fmt(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  const renderTooltip = makeTooltip(tooltipTxt);

  // Bar chart tooltip — date + amount only, no cursor highlight box
  const barTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: tooltipBg,
        border: `1px solid ${tooltipBdr}`,
        borderRadius: '0.75rem',
        padding: '0.55rem 0.85rem',
        fontSize: '0.875rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}>
        <p style={{ margin: '0 0 0.2rem', fontWeight: 700, color: tooltipTxt }}>{label}</p>
        <p style={{ margin: 0, color: '#10b981', fontWeight: 600 }}>{fmt(payload[0].value)}</p>
      </div>
    );
  };

  const legendFmt = (value: string) => (
    <span style={{ color: axisColor, fontSize: '0.8rem' }}>{value}</span>
  );

  // ── Current-month data ────────────────────────────────────────────────

  const donutData = useMemo(() =>
    categories
      .filter(c => c.spent > 0)
      .map((c, i) => ({ name: c.name, value: c.spent, fill: PALETTE[i % PALETTE.length] })),
    [categories]
  );
  const totalThisMonth = donutData.reduce((s, c) => s + c.value, 0);

  const shiftMonth = (base: string, delta: number) => {
    const [y, m] = base.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const trendData = useMemo(() => {
    const byDay: Record<string, number> = {};
    transactions
      .filter(tx => tx.date.slice(0, 7) === trendMonth)
      .forEach(tx => {
        const key = tx.date.slice(0, 10);
        byDay[key] = (byDay[key] || 0) + tx.amount;
      });

    const [y, m] = trendMonth.split('-');
    const year = parseInt(y), month = parseInt(m);
    const daysInMonth = new Date(year, month, 0).getDate();
    const lastDay = trendMonth === currentMonth ? new Date().getDate() : daysInMonth;

    const result: { date: string; Spent: number }[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const key = `${y}-${m}-${String(d).padStart(2, '0')}`;
      const label = new Date(year, month - 1, d)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      result.push({ date: label, Spent: byDay[key] ?? 0 });
    }
    return result.filter(entry => entry.Spent > 0);
  }, [transactions, trendMonth, currentMonth]);

  const dailyData = useMemo(() => {
    const byDay: Record<string, number> = {};
    transactions
      .filter(tx => tx.date.slice(0, 7) === currentMonth)
      .forEach(tx => {
        const dateKey = tx.date.slice(0, 10);
        byDay[dateKey] = (byDay[dateKey] || 0) + tx.amount;
      });
    let running = 0;
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => {
        running += amount;
        return { day: parseInt(date.slice(8, 10)), Spent: running, Budget: monthlyBudget };
      });
  }, [transactions, currentMonth, monthlyBudget]);

  // ── History ───────────────────────────────────────────────────────────

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(tx => {
      const m = tx.date.slice(0, 7);
      if (m !== currentMonth) months.add(m);
    });
    return Array.from(months).sort().reverse();
  }, [transactions, currentMonth]);

  const openHistory = () => {
    setHistoryMonth(availableMonths[0] ?? '');
    setActiveHistorySegment(null);
    setShowHistory(true);
  };

  const formatMonthLabel = (month: string) => {
    const [y, m] = month.split('-');
    return new Date(parseInt(y), parseInt(m) - 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const historyDonutData = useMemo(() => {
    if (!historyMonth) return [];
    const byCat: Record<string, number> = {};
    transactions
      .filter(tx => tx.date.slice(0, 7) === historyMonth)
      .forEach(tx => { byCat[tx.category] = (byCat[tx.category] || 0) + tx.amount; });
    return Object.entries(byCat)
      .filter(([, v]) => v > 0)
      .map(([name, value], i) => ({ name, value, fill: PALETTE[i % PALETTE.length] }));
  }, [transactions, historyMonth]);

  const historyTotalSpent = historyDonutData.reduce((s, c) => s + c.value, 0);

  const historyTrendData = useMemo(() => {
    if (!historyMonth) return [];
    const byDay: Record<string, number> = {};
    transactions
      .filter(tx => tx.date.slice(0, 7) === historyMonth)
      .forEach(tx => {
        const key = tx.date.slice(0, 10);
        byDay[key] = (byDay[key] || 0) + tx.amount;
      });

    // Fill every day of the selected month
    const [y, m] = historyMonth.split('-');
    const year = parseInt(y), month = parseInt(m);
    const daysInMonth = new Date(year, month, 0).getDate();
    const result: { date: string; Spent: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${m}-${String(d).padStart(2, '0')}`;
      const label = new Date(year, month - 1, d)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      result.push({ date: label, Spent: byDay[key] ?? 0 });
    }
    return result.filter(entry => entry.Spent > 0);
  }, [transactions, historyMonth]);

  const historyDailyData = useMemo(() => {
    if (!historyMonth) return [];
    const byDay: Record<string, number> = {};
    transactions
      .filter(tx => tx.date.slice(0, 7) === historyMonth)
      .forEach(tx => {
        const key = tx.date.slice(0, 10);
        byDay[key] = (byDay[key] || 0) + tx.amount;
      });
    let running = 0;
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => {
        running += amount;
        return { day: parseInt(date.slice(8, 10)), Spent: running, Budget: monthlyBudget };
      });
  }, [transactions, historyMonth, monthlyBudget]);

  // ─────────────────────────────────────────────────────────────────────

  if (transactions.length === 0) {
    return (
      <div className="card charts-empty-card">
        <h2 style={{ margin: '0 0 0.5rem' }}>Spending Insights</h2>
        <p>Add transactions to see your spending charts here.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h2 style={{ margin: 0 }}>Spending Insights</h2>
          <p>Visual breakdown of your budget and spending patterns.</p>
        </div>
        {availableMonths.length > 0 && (
          <button type="button" className="history-button" onClick={openHistory}>
            ⏱ History
          </button>
        )}
      </div>

      <div className="charts-grid">

        {/* Donut — category breakdown */}
        <div className="chart-panel">
          <h3 className="chart-title">Category Breakdown</h3>
          <p className="chart-subtitle">This month's spending by category</p>
          {donutData.length === 0 ? (
            <div className="chart-empty">No spending recorded this month.</div>
          ) : (
            <div
              className="donut-wrapper"
              onTouchEnd={() => setActiveSegment(null)}
              onTouchCancel={() => setActiveSegment(null)}
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart margin={{ top: 20, right: 5, bottom: 5, left: 5 }}>
                  <Pie
                    data={donutData}
                    cx="50%" cy="48%"
                    innerRadius={68} outerRadius={100}
                    paddingAngle={3}
                    dataKey="value" nameKey="name"
                    onMouseEnter={(data) => {
                      if (data.name && data.value != null && data.fill)
                        setActiveSegment({ name: data.name as string, value: data.value as number, fill: data.fill as string });
                    }}
                    onMouseLeave={() => setActiveSegment(null)}
                  />
                  <Legend formatter={legendFmt} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                {activeSegment ? (
                  <>
                    <span className="donut-amount" style={{ color: activeSegment.fill }}>{fmt(activeSegment.value)}</span>
                    <span className="donut-label">{activeSegment.name}</span>
                  </>
                ) : (
                  <>
                    <span className="donut-amount">{fmt(totalThisMonth)}</span>
                    <span className="donut-label">spent</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bar — spending trends */}
        <div className="chart-panel">
          <h3 className="chart-title">Spending Trends</h3>
          <div className="trend-month-nav">
            <button type="button" className="trend-nav-btn" onClick={() => setTrendMonth(m => shiftMonth(m, -1))}>‹</button>
            <span className="trend-month-label">{formatMonthLabel(trendMonth)}</span>
            <button type="button" className="trend-nav-btn" onClick={() => setTrendMonth(m => shiftMonth(m, 1))} disabled={trendMonth >= currentMonth}>›</button>
          </div>
          {trendData.length === 0 ? (
            <div className="chart-empty">Not enough data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={yFmt} domain={[0, 'auto']} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip content={barTooltip} cursor={false} />
                <Bar dataKey="Spent" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Area — monthly progress */}
        <div className="chart-panel chart-panel-wide">
          <h3 className="chart-title">Monthly Progress</h3>
          <p className="chart-subtitle">Cumulative spending day by day this month</p>
          {dailyData.length === 0 ? (
            <div className="chart-empty">No transactions recorded this month.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="day" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false}
                  label={{ value: 'Day of month', position: 'insideBottom', offset: -2, fill: axisColor, fontSize: 11 }}
                  height={32} />
                <YAxis tickFormatter={yFmt} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip content={renderTooltip} />
                <Legend formatter={legendFmt} />
                <Line type="monotone" dataKey="Budget" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                <Area type="monotone" dataKey="Spent" stroke="#10b981" strokeWidth={2.5} fill="url(#spentGrad)" dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>

      {/* ── History modal ─────────────────────────────────────────────── */}
      {showHistory && (
        <div className="modal-backdrop" onClick={() => setShowHistory(false)}>
          <div className="modal modal-history" onClick={e => e.stopPropagation()}
            style={{ background: modalBg, border: `1px solid ${modalBorder}` }}>

            {/* Header */}
            <div className="modal-header">
              <h3>Spending History</h3>
              <button type="button" className="modal-close-button" onClick={() => setShowHistory(false)} aria-label="Close">✕</button>
            </div>

            {/* Month selector */}
            <div className="history-month-selector">
              <label htmlFor="history-month-select">Month</label>
              <select
                id="history-month-select"
                value={historyMonth}
                onChange={e => { setHistoryMonth(e.target.value); setActiveHistorySegment(null); }}
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{formatMonthLabel(m)}</option>
                ))}
              </select>
            </div>

            {/* Charts grouped together */}
            <div className="history-charts">

              {/* Category Breakdown */}
              <div className="history-chart-section">
                <h4 className="history-chart-title">Category Breakdown</h4>
                {historyDonutData.length === 0 ? (
                  <div className="chart-empty">No spending recorded.</div>
                ) : (
                  <div
                    className="donut-wrapper"
                    onTouchEnd={() => setActiveHistorySegment(null)}
                    onTouchCancel={() => setActiveHistorySegment(null)}
                  >
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart margin={{ top: 20, right: 5, bottom: 5, left: 5 }}>
                        <Pie
                          data={historyDonutData}
                          cx="50%" cy="48%"
                          innerRadius={58} outerRadius={85}
                          paddingAngle={3}
                          dataKey="value" nameKey="name"
                          onMouseEnter={(data) => {
                            if (data.name && data.value != null && data.fill)
                              setActiveHistorySegment({ name: data.name as string, value: data.value as number, fill: data.fill as string });
                          }}
                          onMouseLeave={() => setActiveHistorySegment(null)}
                        />
                        <Legend formatter={(v) => <span style={{ color: axisColor, fontSize: '0.8rem' }}>{v}</span>} iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      {activeHistorySegment ? (
                        <>
                          <span className="donut-amount" style={{ color: activeHistorySegment.fill }}>{fmt(activeHistorySegment.value)}</span>
                          <span className="donut-label">{activeHistorySegment.name}</span>
                        </>
                      ) : (
                        <>
                          <span className="donut-amount">{fmt(historyTotalSpent)}</span>
                          <span className="donut-label">spent</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Spending Trends */}
              <div className="history-chart-section">
                <h4 className="history-chart-title">Spending Trends</h4>
                {historyTrendData.length === 0 ? (
                  <div className="chart-empty">No data.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={historyTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={yFmt} domain={[0, 'auto']} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                      <Tooltip content={barTooltip} cursor={false} />
                      <Bar dataKey="Spent" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Monthly Progress */}
              <div className="history-chart-section">
                <h4 className="history-chart-title">Monthly Progress</h4>
                {historyDailyData.length === 0 ? (
                  <div className="chart-empty">No data.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={historyDailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="histSpentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="day" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false}
                        label={{ value: 'Day of month', position: 'insideBottom', offset: -2, fill: axisColor, fontSize: 11 }}
                        height={32} />
                      <YAxis tickFormatter={yFmt} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                      <Tooltip content={makeTooltip(tooltipTxt)} />
                      <Legend formatter={(v) => <span style={{ color: axisColor, fontSize: '0.8rem' }}>{v}</span>} />
                      <Line type="monotone" dataKey="Budget" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                      <Area type="monotone" dataKey="Spent" stroke="#10b981" strokeWidth={2.5} fill="url(#histSpentGrad)" dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
