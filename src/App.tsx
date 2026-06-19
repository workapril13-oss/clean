import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { Cleaner, Job, Product, SupplyLine } from './types';

type DashboardView = 'client' | 'cleaner' | 'product';

type ProductFormState = {
  name: string;
  unit: string;
  costPerUnit: string;
  category: string;
};

type CleanerFormState = {
  name: string;
};

type JobFormState = {
  clientName: string;
  date: string;
  cleanerId: string;
  jobType: Job['jobType'];
  chargeToClient: string;
};

type AuthFormState = {
  email: string;
  password: string;
};

type ChartRow = {
  name: string;
  value: number;
  secondary?: number;
};

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  category: string;
  created_at: string;
};

type CleanerRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

type JobRow = {
  id: string;
  user_id: string;
  client_name: string;
  job_date: string;
  cleaner_id: string | null;
  job_type: Job['jobType'];
  charge_to_client: number;
  created_at: string;
};

type SupplyLineRow = {
  id: string;
  user_id: string;
  job_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
};

const dashboardViews: { id: DashboardView; label: string }[] = [
  { id: 'client', label: 'By Client' },
  { id: 'cleaner', label: 'By Cleaner' },
  { id: 'product', label: 'By Product' },
];

const pieColors = ['#2563eb', '#60a5fa', '#93c5fd', '#1d4ed8', '#0f766e', '#14b8a6'];

const emptyProductForm: ProductFormState = {
  name: '',
  unit: 'oz',
  costPerUnit: '',
  category: '',
};

const emptyCleanerForm: CleanerFormState = {
  name: '',
};

function createEmptyJobForm(cleanerId = ''): JobFormState {
  return {
    clientName: '',
    date: new Date().toISOString().slice(0, 10),
    cleanerId,
    jobType: 'residential',
    chargeToClient: '',
  };
}

function createAuthForm(): AuthFormState {
  return {
    email: '',
    password: '',
  };
}

function createLine(productId = '', quantity = 1): SupplyLine {
  return {
    id: crypto.randomUUID(),
    productId,
    quantity,
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function sumSupplyCost(job: Job, products: Product[]) {
  return job.supplyLines.reduce((total, line) => {
    const product = products.find((entry) => entry.id === line.productId);
    return total + (product?.costPerUnit ?? 0) * line.quantity;
  }, 0);
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    unit: row.unit,
    costPerUnit: Number(row.cost_per_unit),
    category: row.category,
  };
}

function mapCleanerRow(row: CleanerRow): Cleaner {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
  };
}

function mapJobRow(row: JobRow, supplyLines: SupplyLine[]): Job {
  return {
    id: row.id,
    userId: row.user_id,
    clientName: row.client_name,
    date: row.job_date,
    cleanerId: row.cleaner_id ?? '',
    jobType: row.job_type,
    chargeToClient: Number(row.charge_to_client),
    supplyLines,
  };
}

function upsertIntoArray<T extends { id: string }>(items: T[], item: T) {
  const next = items.filter((entry) => entry.id !== item.id);
  return [...next, item];
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [authForm, setAuthForm] = useState<AuthFormState>(createAuthForm());
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dashboardView, setDashboardView] = useState<DashboardView>('client');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCleanerId, setSelectedCleanerId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [cleanerForm, setCleanerForm] = useState<CleanerFormState>(emptyCleanerForm);
  const [jobForm, setJobForm] = useState<JobFormState>(createEmptyJobForm());
  const [jobLines, setJobLines] = useState<SupplyLine[]>([createLine()]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (!active) {
        return;
      }
      setSession(nextSession);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const currentUserId = session?.user.id ?? '';

  useEffect(() => {
    if (!currentUserId) {
      setProducts([]);
      setCleaners([]);
      setJobs([]);
      setWorkspaceLoading(false);
      setSelectedProductId(null);
      setSelectedCleanerId(null);
      setSelectedJobId(null);
      setProductForm(emptyProductForm);
      setCleanerForm(emptyCleanerForm);
      setJobForm(createEmptyJobForm());
      setJobLines([createLine()]);
      return;
    }

    let cancelled = false;

    async function loadWorkspace() {
      setWorkspaceLoading(true);
      setAuthError('');
      setAuthMessage('');

      const [productsResult, cleanersResult, jobsResult, supplyLinesResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, user_id, name, unit, cost_per_unit, category, created_at')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: true }),
        supabase
          .from('cleaners')
          .select('id, user_id, name, created_at')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: true }),
        supabase
          .from('jobs')
          .select('id, user_id, client_name, job_date, cleaner_id, job_type, charge_to_client, created_at')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: true }),
        supabase
          .from('job_supply_lines')
          .select('id, user_id, job_id, product_id, quantity, created_at')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: true }),
      ]);

      if (cancelled) {
        return;
      }

      const firstError = productsResult.error ?? cleanersResult.error ?? jobsResult.error ?? supplyLinesResult.error;
      if (firstError) {
        setAuthError(firstError.message);
        setWorkspaceLoading(false);
        return;
      }

      const nextProducts = (productsResult.data ?? []).map(mapProductRow);
      const nextCleaners = (cleanersResult.data ?? []).map(mapCleanerRow);
      const nextJobsRows = jobsResult.data ?? [];
      const nextSupplyLinesRows = supplyLinesResult.data ?? [];

      const nextJobs = nextJobsRows.map((jobRow) => {
        const supplyLines = nextSupplyLinesRows
          .filter((lineRow) => lineRow.job_id === jobRow.id)
          .map((lineRow) => ({
            id: lineRow.id,
            productId: lineRow.product_id,
            quantity: Number(lineRow.quantity),
          }));

        return mapJobRow(jobRow, supplyLines);
      });

      setProducts(nextProducts);
      setCleaners(nextCleaners);
      setJobs(nextJobs);
      setSelectedProductId(null);
      setSelectedCleanerId(null);
      setSelectedJobId(null);
      setProductForm(emptyProductForm);
      setCleanerForm(emptyCleanerForm);
      setJobForm(createEmptyJobForm(nextCleaners[0]?.id ?? ''));
      setJobLines([createLine(nextProducts[0]?.id ?? '')]);
      setDashboardView('client');
      setWorkspaceLoading(false);
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const visibleProducts = useMemo(() => products, [products]);
  const visibleCleaners = useMemo(() => cleaners, [cleaners]);
  const visibleJobs = useMemo(() => jobs, [jobs]);

  const jobMetrics = useMemo(
    () =>
      visibleJobs.map((job) => {
        const supplyCost = sumSupplyCost(job, visibleProducts);
        const grossMargin = job.chargeToClient - supplyCost;
        const marginPercent = job.chargeToClient > 0 ? (grossMargin / job.chargeToClient) * 100 : 0;
        const alert = supplyCost > job.chargeToClient * 0.15;
        const cleaner = visibleCleaners.find((entry) => entry.id === job.cleanerId);

        return {
          ...job,
          cleanerName: cleaner?.name ?? 'Unassigned',
          supplyCost,
          grossMargin,
          marginPercent,
          alert,
        };
      }),
    [visibleCleaners, visibleJobs, visibleProducts],
  );

  const dashboardStats = useMemo(() => {
    const totals = jobMetrics.reduce(
      (accumulator, job) => {
        accumulator.revenue += job.chargeToClient;
        accumulator.supplyCost += job.supplyCost;
        accumulator.grossMargin += job.grossMargin;
        accumulator.alerts += job.alert ? 1 : 0;
        return accumulator;
      },
      { revenue: 0, supplyCost: 0, grossMargin: 0, alerts: 0 },
    );

    return {
      ...totals,
      marginPercent: totals.revenue > 0 ? (totals.grossMargin / totals.revenue) * 100 : 0,
    };
  }, [jobMetrics]);

  const clientData = useMemo<ChartRow[]>(() => {
    const grouped = new Map<string, number>();
    jobMetrics.forEach((job) => {
      grouped.set(job.clientName, (grouped.get(job.clientName) ?? 0) + job.supplyCost);
    });
    return [...grouped.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value);
  }, [jobMetrics]);

  const cleanerData = useMemo<ChartRow[]>(() => {
    const grouped = new Map<string, { total: number; jobsCount: number }>();
    jobMetrics.forEach((job) => {
      const current = grouped.get(job.cleanerName) ?? { total: 0, jobsCount: 0 };
      current.total += job.supplyCost;
      current.jobsCount += 1;
      grouped.set(job.cleanerName, current);
    });
    return [...grouped.entries()]
      .map(([name, value]) => ({ name, value: value.total, secondary: value.total / value.jobsCount }))
      .sort((left, right) => right.value - left.value);
  }, [jobMetrics]);

  const productData = useMemo<ChartRow[]>(() => {
    const grouped = new Map<string, number>();
    jobMetrics.forEach((job) => {
      job.supplyLines.forEach((line) => {
        const product = visibleProducts.find((entry) => entry.id === line.productId);
        if (!product) {
          return;
        }
        grouped.set(product.name, (grouped.get(product.name) ?? 0) + product.costPerUnit * line.quantity);
      });
    });
    return [...grouped.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value);
  }, [jobMetrics, visibleProducts]);

  const activeChartData =
    dashboardView === 'client' ? clientData : dashboardView === 'cleaner' ? cleanerData : productData;
  const activePieData = activeChartData.slice(0, 5);
  const alerts = jobMetrics.filter((job) => job.alert);

  const cleanerAssignments = useMemo(() => {
    return visibleCleaners.map((cleaner) => {
      const assignedJobs = visibleJobs.filter((job) => job.cleanerId === cleaner.id);
      return {
        cleaner,
        assignedJobs,
        totalSupplyCost: assignedJobs.reduce((total, job) => total + sumSupplyCost(job, visibleProducts), 0),
        averageSupplyCost:
          assignedJobs.length > 0
            ? assignedJobs.reduce((total, job) => total + sumSupplyCost(job, visibleProducts), 0) / assignedJobs.length
            : 0,
      };
    });
  }, [visibleCleaners, visibleJobs, visibleProducts]);

  const productEditorLabel = selectedProductId ? 'Update Product' : 'Add Product';
  const cleanerEditorLabel = selectedCleanerId ? 'Update Cleaner' : 'Add Cleaner';
  const jobEditorLabel = selectedJobId ? 'Update Job' : 'Log Job';
  const isWorkspaceBooting = Boolean(currentUserId) && workspaceLoading;

  function resetProductEditor() {
    setSelectedProductId(null);
    setProductForm(emptyProductForm);
  }

  function resetCleanerEditor() {
    setSelectedCleanerId(null);
    setCleanerForm(emptyCleanerForm);
  }

  function resetJobEditor() {
    setSelectedJobId(null);
    setJobForm(createEmptyJobForm(visibleCleaners[0]?.id ?? ''));
    setJobLines([createLine(visibleProducts[0]?.id ?? '')]);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');

    const email = authForm.email.trim();
    const password = authForm.password;

    if (!email || !password) {
      setAuthError('Enter both an email and password.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthForm(createAuthForm());
  }

  async function handleLogout() {
    setAuthError('');
    setAuthMessage('');
    await supabase.auth.signOut();
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUserId) {
      return;
    }

    const payload: Product = {
      id: selectedProductId ?? crypto.randomUUID(),
      userId: currentUserId,
      name: productForm.name.trim(),
      unit: productForm.unit.trim(),
      costPerUnit: Number(productForm.costPerUnit),
      category: productForm.category.trim(),
    };

    if (!payload.name || !payload.category || Number.isNaN(payload.costPerUnit)) {
      return;
    }

    const { error } = await supabase.from('products').upsert({
      id: payload.id,
      user_id: payload.userId,
      name: payload.name,
      unit: payload.unit,
      cost_per_unit: payload.costPerUnit,
      category: payload.category,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setProducts((current) => upsertIntoArray(current, payload));
    resetProductEditor();
  }

  function handleEditProduct(product: Product) {
    setSelectedProductId(product.id);
    setProductForm({
      name: product.name,
      unit: product.unit,
      costPerUnit: product.costPerUnit.toString(),
      category: product.category,
    });
  }

  async function handleCleanerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUserId) {
      return;
    }

    const payload: Cleaner = {
      id: selectedCleanerId ?? crypto.randomUUID(),
      userId: currentUserId,
      name: cleanerForm.name.trim(),
    };

    if (!payload.name) {
      return;
    }

    const { error } = await supabase.from('cleaners').upsert({
      id: payload.id,
      user_id: payload.userId,
      name: payload.name,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setCleaners((current) => upsertIntoArray(current, payload));
    setCleanerForm(emptyCleanerForm);
    setSelectedCleanerId(null);

    if (!jobForm.cleanerId) {
      setJobForm((current) => ({ ...current, cleanerId: payload.id }));
    }
  }

  function handleEditCleaner(cleaner: Cleaner) {
    setSelectedCleanerId(cleaner.id);
    setCleanerForm({ name: cleaner.name });
  }

  async function handleJobSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUserId) {
      return;
    }

    const payload: Job = {
      id: selectedJobId ?? crypto.randomUUID(),
      userId: currentUserId,
      clientName: jobForm.clientName.trim(),
      date: jobForm.date,
      cleanerId: jobForm.cleanerId,
      jobType: jobForm.jobType,
      chargeToClient: Number(jobForm.chargeToClient),
      supplyLines: jobLines
        .filter((line) => line.productId && line.quantity > 0)
        .map((line) => ({
          id: line.id,
          productId: line.productId,
          quantity: Number(line.quantity),
        })),
    };

    if (!payload.clientName || !payload.cleanerId || Number.isNaN(payload.chargeToClient) || payload.supplyLines.length === 0) {
      setAuthError('Add a client, cleaner, charge, and at least one supply line.');
      return;
    }

    const { error: jobError } = await supabase.from('jobs').upsert({
      id: payload.id,
      user_id: payload.userId,
      client_name: payload.clientName,
      job_date: payload.date,
      cleaner_id: payload.cleanerId,
      job_type: payload.jobType,
      charge_to_client: payload.chargeToClient,
    });

    if (jobError) {
      setAuthError(jobError.message);
      return;
    }

    const deleteError = await supabase.from('job_supply_lines').delete().eq('job_id', payload.id);
    if (deleteError.error) {
      setAuthError(deleteError.error.message);
      return;
    }

    const lineRows = payload.supplyLines.map((line) => ({
      id: line.id,
      user_id: payload.userId,
      job_id: payload.id,
      product_id: line.productId,
      quantity: line.quantity,
    }));

    const { error: linesError } = lineRows.length > 0 ? await supabase.from('job_supply_lines').insert(lineRows) : { error: null };
    if (linesError) {
      setAuthError(linesError.message);
      return;
    }

    setJobs((current) => upsertIntoArray(current, payload));
    resetJobEditor();
  }

  function handleEditJob(job: Job) {
    setSelectedJobId(job.id);
    setJobForm({
      clientName: job.clientName,
      date: job.date,
      cleanerId: job.cleanerId,
      jobType: job.jobType,
      chargeToClient: job.chargeToClient.toString(),
    });
    setJobLines(job.supplyLines.length > 0 ? job.supplyLines : [createLine(visibleProducts[0]?.id ?? '')]);
  }

  function updateJobLine(lineId: string, updates: Partial<SupplyLine>) {
    setJobLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...updates } : line)));
  }

  function removeJobLine(lineId: string) {
    setJobLines((current) => (current.length > 1 ? current.filter((line) => line.id !== lineId) : current));
  }

  const selectedJobCost = jobLines.reduce((total, line) => {
    const product = visibleProducts.find((entry) => entry.id === line.productId);
    return total + (product?.costPerUnit ?? 0) * Number(line.quantity || 0);
  }, 0);
  const selectedJobCharge = Number(jobForm.chargeToClient || 0);
  const selectedJobMargin = selectedJobCharge - selectedJobCost;
  const selectedJobMarginPercent = selectedJobCharge > 0 ? (selectedJobMargin / selectedJobCharge) * 100 : 0;
  const selectedJobAlert = selectedJobCharge > 0 ? selectedJobCost > selectedJobCharge * 0.15 : false;

  if (authLoading || isWorkspaceBooting) {
    return <LoadingPanel label={isWorkspaceBooting ? 'Loading your workspace' : 'Loading session'} />;
  }

  if (!session) {
    return (
      <AuthPanel
        authForm={authForm}
        authError={authError}
        authMessage={authMessage}
        onAuthSubmit={handleAuthSubmit}
        onAuthFormChange={setAuthForm}
      />
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-6 shadow-soft backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center rounded-full border border-accent-100 bg-accent-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-700">
                Supply Cost Tracking
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Margin visibility for cleaning businesses.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Track products, log supply usage per job, see cleaner efficiency, and keep every account isolated in Supabase.
              </p>
            </div>
            <div className="flex flex-col items-end gap-4">
              <div className="text-right text-sm text-slate-500">
                Signed in as <span className="font-medium text-slate-800">{session.user.email}</span>
              </div>
              <button type="button" onClick={handleLogout} className="primary-button">
                Logout
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Revenue" value={formatCurrency(dashboardStats.revenue)} tone="blue" />
            <StatCard label="Supply cost" value={formatCurrency(dashboardStats.supplyCost)} tone="slate" />
            <StatCard label="Gross margin" value={formatCurrency(dashboardStats.grossMargin)} tone="emerald" />
            <StatCard label="Alerts" value={dashboardStats.alerts.toString()} tone="amber" />
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-700">Dashboard</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Cost intelligence {dashboardViews.find((view) => view.id === dashboardView)?.label.toLowerCase()}</h2>
              </div>
              <div className="inline-flex rounded-2xl bg-slate-100 p-1">
                {dashboardViews.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setDashboardView(view.id)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      dashboardView === view.id ? 'bg-white text-accent-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
              <div className="h-[360px] rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeChartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-12} height={60} />
                    <YAxis tickFormatter={(value) => `$${value}`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="value" name="Supply cost" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-700">Share of cost</p>
                  <p className="text-xs text-slate-500">Top five items in the current view</p>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={activePieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={90} paddingAngle={4}>
                        {activePieData.map((entry, index) => (
                          <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {activePieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                        <span>{entry.name}</span>
                      </div>
                      <span className="font-medium text-slate-900">{formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600">Alerts</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Jobs over 15%</h2>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{alerts.length} flagged</span>
            </div>
            <div className="mt-5 space-y-3">
              {alerts.length > 0 ? (
                alerts.map((job) => (
                  <div key={job.id} className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-950">{job.clientName}</p>
                        <p className="text-xs text-slate-600">
                          {job.cleanerName} · {job.jobType} · {job.date}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-amber-700">{formatPercent((job.supplyCost / job.chargeToClient) * 100)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-slate-700">
                      <span>Supply cost</span>
                      <span className="font-medium">{formatCurrency(job.supplyCost)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm text-slate-700">
                      <span>Charge</span>
                      <span className="font-medium">{formatCurrency(job.chargeToClient)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No jobs exceed the 15% threshold.
                </div>
              )}
            </div>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-700">Inventory</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Product panel</h2>
              </div>
              <button type="button" onClick={resetProductEditor} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-accent-200 hover:text-accent-700">
                New product
              </button>
            </div>

            <form className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleProductSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name">
                  <input
                    className="input"
                    value={productForm.name}
                    onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Pine-Sol"
                  />
                </Field>
                <Field label="Category">
                  <input
                    className="input"
                    value={productForm.category}
                    onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))}
                    placeholder="Disinfectant"
                  />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Unit">
                  <select
                    className="input"
                    value={productForm.unit}
                    onChange={(event) => setProductForm((current) => ({ ...current, unit: event.target.value }))}
                  >
                    {['oz', 'bottle', 'bag', 'cloth', 'pad'].map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cost per unit">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={productForm.costPerUnit}
                    onChange={(event) => setProductForm((current) => ({ ...current, costPerUnit: event.target.value }))}
                    placeholder="0.00"
                  />
                </Field>
                <div className="flex items-end">
                  <button type="submit" className="primary-button w-full">
                    {productEditorLabel}
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Unit cost</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {visibleProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
                      <td className="px-4 py-3 text-slate-600">{product.category}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatCurrency(product.costPerUnit)} / {product.unit}
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => handleEditProduct(product)} className="text-sm font-medium text-accent-700 hover:text-accent-800">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {visibleProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                        No products yet. Add your first one above.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-700">Cleaners</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Cleaner panel</h2>
              </div>
              <button type="button" onClick={resetCleanerEditor} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-accent-200 hover:text-accent-700">
                New cleaner
              </button>
            </div>

            <form className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleCleanerSubmit}>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <Field label="Cleaner name">
                  <input
                    className="input"
                    value={cleanerForm.name}
                    onChange={(event) => setCleanerForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Maria"
                  />
                </Field>
                <div className="flex items-end">
                  <button type="submit" className="primary-button w-full">
                    {cleanerEditorLabel}
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Cleaner</th>
                    <th className="px-4 py-3">Assigned jobs</th>
                    <th className="px-4 py-3">Avg supply cost</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {cleanerAssignments.map(({ cleaner, assignedJobs, averageSupplyCost }) => (
                    <tr key={cleaner.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{cleaner.name}</td>
                      <td className="px-4 py-3 text-slate-600">{assignedJobs.length}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(averageSupplyCost)}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => handleEditCleaner(cleaner)} className="text-sm font-medium text-accent-700 hover:text-accent-800">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cleaners.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                        No cleaners yet. Add one before creating jobs.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-700">Jobs</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">Job logger</h2>
            </div>
            <button type="button" onClick={resetJobEditor} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-accent-200 hover:text-accent-700">
              New job
            </button>
          </div>

          <form className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleJobSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Client name">
                <input
                  className="input"
                  value={jobForm.clientName}
                  onChange={(event) => setJobForm((current) => ({ ...current, clientName: event.target.value }))}
                  placeholder="Alder Apartments"
                />
              </Field>
              <Field label="Date">
                <input
                  className="input"
                  type="date"
                  value={jobForm.date}
                  onChange={(event) => setJobForm((current) => ({ ...current, date: event.target.value }))}
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Cleaner">
                <select
                  className="input"
                  value={jobForm.cleanerId}
                  onChange={(event) => setJobForm((current) => ({ ...current, cleanerId: event.target.value }))}
                >
                  <option value="">Select cleaner</option>
                  {visibleCleaners.map((cleaner) => (
                    <option key={cleaner.id} value={cleaner.id}>
                      {cleaner.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Job type">
                <select
                  className="input"
                  value={jobForm.jobType}
                  onChange={(event) => setJobForm((current) => ({ ...current, jobType: event.target.value as Job['jobType'] }))}
                >
                  {['residential', 'commercial', 'deep clean', 'move-out'].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Charge to client">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={jobForm.chargeToClient}
                  onChange={(event) => setJobForm((current) => ({ ...current, chargeToClient: event.target.value }))}
                  placeholder="250.00"
                />
              </Field>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Supply usage</p>
                <button type="button" onClick={() => setJobLines((current) => [...current, createLine(visibleProducts[0]?.id ?? '')])} className="text-sm font-medium text-accent-700 hover:text-accent-800">
                  + Add line
                </button>
              </div>
              <div className="space-y-3">
                {jobLines.map((line) => (
                  <div key={line.id} className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(120px,0.5fr)_auto]">
                    <select className="input" value={line.productId} onChange={(event) => updateJobLine(line.id, { productId: event.target.value })}>
                      <option value="">Select product</option>
                      {visibleProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      min="0"
                      value={line.quantity}
                      onChange={(event) => updateJobLine(line.id, { quantity: Number(event.target.value) })}
                      placeholder="Qty"
                    />
                    <button type="button" onClick={() => removeJobLine(line.id)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-800">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Supply cost" value={formatCurrency(selectedJobCost)} />
                <Metric label="Gross margin" value={formatCurrency(selectedJobMargin)} />
                <Metric label="Margin %" value={formatPercent(selectedJobMarginPercent)} />
                <Metric label="Alert" value={selectedJobAlert ? 'Over 15%' : 'Within range'} tone={selectedJobAlert ? 'amber' : 'emerald'} />
              </div>
            </div>

            <button type="submit" className="primary-button">
              {jobEditorLabel}
            </button>
          </form>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Cleaner</th>
                  <th className="px-4 py-3">Supply cost</th>
                  <th className="px-4 py-3">Margin</th>
                  <th className="px-4 py-3">Alert</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {jobMetrics.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{job.clientName}</div>
                      <div className="text-xs text-slate-500">
                        {job.jobType} · {job.date}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{job.cleanerName}</td>
                    <td className="px-4 py-3 text-slate-600">{formatCurrency(job.supplyCost)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatCurrency(job.grossMargin)}
                      <div className="text-xs text-slate-500">{formatPercent(job.marginPercent)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${job.alert ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {job.alert ? 'Over 15%' : 'OK'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => handleEditJob(job)} className="text-sm font-medium text-accent-700 hover:text-accent-800">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {jobMetrics.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      No jobs yet. Add a cleaner, then log a job.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function AuthPanel({
  authForm,
  authError,
  authMessage,
  onAuthSubmit,
  onAuthFormChange,
}: {
  authForm: AuthFormState;
  authError: string;
  authMessage: string;
  onAuthSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAuthFormChange: (next: AuthFormState) => void;
}) {
  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.8fr)]">
        <section className="rounded-3xl border border-white/70 bg-white/90 p-8 shadow-soft backdrop-blur">
          <div className="inline-flex rounded-full border border-accent-100 bg-accent-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-700">
            Supply Cost Tracking
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">Sign in to your private dashboard.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Each authenticated account has its own Supabase-backed products, cleaners, jobs, and supply lines.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {['Supabase saved', 'Private per user', 'Login only'].map((label) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                {label}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <form className="mt-2 space-y-4" onSubmit={onAuthSubmit}>
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={authForm.email}
                onChange={(event) => onAuthFormChange({ ...authForm, email: event.target.value })}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <input
                className="input"
                type="password"
                value={authForm.password}
                onChange={(event) => onAuthFormChange({ ...authForm, password: event.target.value })}
                placeholder="••••••••"
              />
            </Field>
            {authError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</p> : null}
            {authMessage ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{authMessage}</p> : null}
            <button type="submit" className="primary-button w-full">
              Log in
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm font-medium text-slate-600 shadow-soft">
        {label}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'slate' | 'emerald' | 'amber' }) {
  const toneClasses = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="block font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'amber' | 'emerald' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-900',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className={`rounded-2xl px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export default App;
