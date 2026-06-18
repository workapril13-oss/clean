import { useMemo, useState } from 'react';
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
import { initialCleaners, initialJobs, initialProducts } from './seedData';
import type { Job, Product, SupplyLine } from './types';

type DashboardView = 'client' | 'cleaner' | 'product';

type ProductFormState = {
  name: string;
  unit: string;
  costPerUnit: string;
  category: string;
};

type JobFormState = {
  clientName: string;
  date: string;
  cleanerId: string;
  jobType: Job['jobType'];
  chargeToClient: string;
};

type ChartRow = {
  name: string;
  value: number;
  secondary?: number;
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

const emptyJobForm: JobFormState = {
  clientName: '',
  date: new Date().toISOString().slice(0, 10),
  cleanerId: initialCleaners[0]?.id ?? '',
  jobType: 'residential',
  chargeToClient: '',
};

const unitOptions = ['oz', 'bottle', 'bag', 'cloth', 'pad'];

const jobTypeOptions: Job['jobType'][] = ['residential', 'commercial', 'deep clean', 'move-out'];

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

function createLine(productId = initialProducts[0]?.id ?? '', quantity = 1): SupplyLine {
  return {
    id: crypto.randomUUID(),
    productId,
    quantity,
  };
}

function sumSupplyCost(job: Job, products: Product[]) {
  return job.supplyLines.reduce((total, line) => {
    const product = products.find((entry) => entry.id === line.productId);
    return total + (product?.costPerUnit ?? 0) * line.quantity;
  }, 0);
}

function App() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cleaners, setCleaners] = useState(initialCleaners);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [dashboardView, setDashboardView] = useState<DashboardView>('client');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [jobForm, setJobForm] = useState<JobFormState>(emptyJobForm);
  const [jobLines, setJobLines] = useState<SupplyLine[]>([createLine()]);

  const jobMetrics = useMemo(
    () =>
      jobs.map((job) => {
        const supplyCost = sumSupplyCost(job, products);
        const grossMargin = job.chargeToClient - supplyCost;
        const marginPercent = job.chargeToClient > 0 ? (grossMargin / job.chargeToClient) * 100 : 0;
        const alert = supplyCost > job.chargeToClient * 0.15;
        const cleaner = cleaners.find((entry) => entry.id === job.cleanerId);

        return {
          ...job,
          cleanerName: cleaner?.name ?? 'Unassigned',
          supplyCost,
          grossMargin,
          marginPercent,
          alert,
        };
      }),
    [cleaners, jobs, products],
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
        const product = products.find((entry) => entry.id === line.productId);
        if (!product) {
          return;
        }
        grouped.set(product.name, (grouped.get(product.name) ?? 0) + product.costPerUnit * line.quantity);
      });
    });
    return [...grouped.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value);
  }, [jobMetrics, products]);

  const activeChartData =
    dashboardView === 'client' ? clientData : dashboardView === 'cleaner' ? cleanerData : productData;

  const activePieData = activeChartData.slice(0, 5);
  const alerts = jobMetrics.filter((job) => job.alert);

  const cleanerAssignments = useMemo(() => {
    return cleaners.map((cleaner) => {
      const assignedJobs = jobMetrics.filter((job) => cleaner.jobIds.includes(job.id));
      return {
        cleaner,
        assignedJobs,
        totalSupplyCost: assignedJobs.reduce((total, job) => total + job.supplyCost, 0),
        averageSupplyCost: assignedJobs.length > 0 ? assignedJobs.reduce((total, job) => total + job.supplyCost, 0) / assignedJobs.length : 0,
      };
    });
  }, [cleaners, jobMetrics]);

  const productEditorLabel = selectedProductId ? 'Update Product' : 'Add Product';
  const jobEditorLabel = selectedJobId ? 'Update Job' : 'Log Job';

  function resetProductEditor() {
    setSelectedProductId(null);
    setProductForm(emptyProductForm);
  }

  function resetJobEditor() {
    setSelectedJobId(null);
    setJobForm(emptyJobForm);
    setJobLines([createLine()]);
  }

  function handleProductSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: Product = {
      id: selectedProductId ?? slugify(productForm.name),
      name: productForm.name.trim(),
      unit: productForm.unit.trim(),
      costPerUnit: Number(productForm.costPerUnit),
      category: productForm.category.trim(),
    };

    if (!payload.name || !payload.category || Number.isNaN(payload.costPerUnit)) {
      return;
    }

    setProducts((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === payload.id);
      if (existingIndex >= 0) {
        return current.map((entry) => (entry.id === payload.id ? payload : entry));
      }
      return [...current, payload];
    });

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

  function handleJobSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const existingJob = jobs.find((job) => job.id === selectedJobId);

    const payload: Job = {
      id: selectedJobId ?? `job-${crypto.randomUUID()}`,
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
      return;
    }

    setJobs((current) => {
      if (!existingJob) {
        return [...current, payload];
      }

      return current.map((job) => (job.id === payload.id ? payload : job));
    });

    setCleaners((current) =>
      current.map((cleaner) => {
        const withoutCurrentJob = cleaner.jobIds.filter((jobId) => jobId !== payload.id);

        if (cleaner.id !== payload.cleanerId) {
          return {
            ...cleaner,
            jobIds: withoutCurrentJob,
          };
        }

        return {
          ...cleaner,
          jobIds: [...new Set([...withoutCurrentJob, payload.id])],
        };
      }),
    );

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
    setJobLines(job.supplyLines.length > 0 ? job.supplyLines : [createLine()]);
  }

  function updateJobLine(lineId: string, updates: Partial<SupplyLine>) {
    setJobLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, ...updates } : line)),
    );
  }

  function removeJobLine(lineId: string) {
    setJobLines((current) => (current.length > 1 ? current.filter((line) => line.id !== lineId) : current));
  }

  const selectedJobCost = jobLines.reduce((total, line) => {
    const product = products.find((entry) => entry.id === line.productId);
    return total + (product?.costPerUnit ?? 0) * Number(line.quantity || 0);
  }, 0);
  const selectedJobCharge = Number(jobForm.chargeToClient || 0);
  const selectedJobMargin = selectedJobCharge - selectedJobCost;
  const selectedJobMarginPercent = selectedJobCharge > 0 ? (selectedJobMargin / selectedJobCharge) * 100 : 0;
  const selectedJobAlert = selectedJobCharge > 0 ? selectedJobCost > selectedJobCharge * 0.15 : false;

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
                Track products, log supply usage per job, see cleaner efficiency, and flag work that is
                burning too much material cost.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Revenue" value={formatCurrency(dashboardStats.revenue)} tone="blue" />
              <StatCard label="Supply cost" value={formatCurrency(dashboardStats.supplyCost)} tone="slate" />
              <StatCard label="Gross margin" value={formatCurrency(dashboardStats.grossMargin)} tone="emerald" />
              <StatCard label="Alerts" value={dashboardStats.alerts.toString()} tone="amber" />
            </div>
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
                      dashboardView === view.id
                        ? 'bg-white text-accent-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
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
                      <Pie
                        data={activePieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={90}
                        paddingAngle={4}
                      >
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
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {alerts.length} flagged
              </span>
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
                      <span className="text-sm font-semibold text-amber-700">
                        {formatPercent((job.supplyCost / job.chargeToClient) * 100)}
                      </span>
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
              <button
                type="button"
                onClick={resetProductEditor}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-accent-200 hover:text-accent-700"
              >
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
                    {unitOptions.map((unit) => (
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
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
                      <td className="px-4 py-3 text-slate-600">{product.category}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatCurrency(product.costPerUnit)} / {product.unit}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleEditProduct(product)}
                          className="text-sm font-medium text-accent-700 hover:text-accent-800"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-700">Jobs</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Job logger</h2>
              </div>
              <button
                type="button"
                onClick={resetJobEditor}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-accent-200 hover:text-accent-700"
              >
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
                    {cleaners.map((cleaner) => (
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
                    {jobTypeOptions.map((type) => (
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
                  <button
                    type="button"
                    onClick={() => setJobLines((current) => [...current, createLine()])}
                    className="text-sm font-medium text-accent-700 hover:text-accent-800"
                  >
                    + Add line
                  </button>
                </div>
                <div className="space-y-3">
                  {jobLines.map((line) => (
                    <div key={line.id} className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(120px,0.5fr)_auto]">
                      <select
                        className="input"
                        value={line.productId}
                        onChange={(event) => updateJobLine(line.id, { productId: event.target.value })}
                      >
                        {products.map((product) => (
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
                      <button
                        type="button"
                        onClick={() => removeJobLine(line.id)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
                      >
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
                        <button
                          type="button"
                          onClick={() => handleEditJob(job)}
                          className="text-sm font-medium text-accent-700 hover:text-accent-800"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-700">Cleaners</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">Efficiency snapshot</h2>
            </div>
            <p className="text-sm text-slate-500">Lower supply cost per job means better efficiency.</p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {cleanerAssignments.map(({ cleaner, assignedJobs, totalSupplyCost, averageSupplyCost }) => (
              <div key={cleaner.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{cleaner.name}</p>
                    <p className="text-sm text-slate-500">{assignedJobs.length} assigned jobs</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    Avg {formatCurrency(averageSupplyCost)}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Total supply cost</span>
                    <span className="font-medium text-slate-900">{formatCurrency(totalSupplyCost)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Jobs handled</span>
                    <span className="font-medium text-slate-900">{assignedJobs.length}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
