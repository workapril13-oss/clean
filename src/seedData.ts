import type { Cleaner, Job, Product } from './types';

export type ProductSeed = Omit<Product, 'userId'>;
export type CleanerSeed = Omit<Cleaner, 'userId'>;
export type JobSeed = Omit<Job, 'userId' | 'cleanerId'> & { cleanerKey: string };

export const initialProducts: ProductSeed[] = [
  { id: 'pine-sol', name: 'Pine-Sol', unit: 'oz', costPerUnit: 0.28, category: 'Disinfectant' },
  { id: 'windex', name: 'Windex', unit: 'bottle', costPerUnit: 5.1, category: 'Glass cleaner' },
  { id: 'microfiber-cloths', name: 'Microfiber cloths', unit: 'cloth', costPerUnit: 0.85, category: 'Reusable supplies' },
  { id: 'trash-bags', name: 'Trash bags', unit: 'bag', costPerUnit: 0.38, category: 'Waste disposal' },
  { id: 'scrubbing-pads', name: 'Scrubbing pads', unit: 'pad', costPerUnit: 0.72, category: 'Abrasives' },
];

export const initialCleaners: CleanerSeed[] = [
  { id: 'maria', name: 'Maria', jobIds: ['job-1', 'job-4', 'job-7'] },
  { id: 'james', name: 'James', jobIds: ['job-2', 'job-5', 'job-8'] },
  { id: 'sofia', name: 'Sofia', jobIds: ['job-3', 'job-6'] },
];

export const initialJobs: JobSeed[] = [
  {
    id: 'job-1',
    clientName: 'Alder Apartments',
    date: '2026-06-02',
    cleanerKey: 'maria',
    jobType: 'commercial',
    chargeToClient: 420,
    supplyLines: [
      { id: 'job-1-line-1', productId: 'pine-sol', quantity: 10 },
      { id: 'job-1-line-2', productId: 'trash-bags', quantity: 6 },
      { id: 'job-1-line-3', productId: 'microfiber-cloths', quantity: 4 },
    ],
  },
  {
    id: 'job-2',
    clientName: 'Bayside Family Home',
    date: '2026-06-04',
    cleanerKey: 'james',
    jobType: 'residential',
    chargeToClient: 180,
    supplyLines: [
      { id: 'job-2-line-1', productId: 'windex', quantity: 0.5 },
      { id: 'job-2-line-2', productId: 'microfiber-cloths', quantity: 2 },
      { id: 'job-2-line-3', productId: 'trash-bags', quantity: 2 },
    ],
  },
  {
    id: 'job-3',
    clientName: 'Crown Dental Office',
    date: '2026-06-05',
    cleanerKey: 'sofia',
    jobType: 'commercial',
    chargeToClient: 260,
    supplyLines: [
      { id: 'job-3-line-1', productId: 'pine-sol', quantity: 8 },
      { id: 'job-3-line-2', productId: 'windex', quantity: 0.75 },
      { id: 'job-3-line-3', productId: 'scrubbing-pads', quantity: 3 },
    ],
  },
  {
    id: 'job-4',
    clientName: 'Dover Townhouse',
    date: '2026-06-08',
    cleanerKey: 'maria',
    jobType: 'deep clean',
    chargeToClient: 320,
    supplyLines: [
      { id: 'job-4-line-1', productId: 'pine-sol', quantity: 14 },
      { id: 'job-4-line-2', productId: 'microfiber-cloths', quantity: 5 },
      { id: 'job-4-line-3', productId: 'scrubbing-pads', quantity: 2 },
      { id: 'job-4-line-4', productId: 'trash-bags', quantity: 4 },
    ],
  },
  {
    id: 'job-5',
    clientName: 'Elm Street Condo',
    date: '2026-06-10',
    cleanerKey: 'james',
    jobType: 'move-out',
    chargeToClient: 290,
    supplyLines: [
      { id: 'job-5-line-1', productId: 'windex', quantity: 1 },
      { id: 'job-5-line-2', productId: 'trash-bags', quantity: 7 },
      { id: 'job-5-line-3', productId: 'scrubbing-pads', quantity: 5 },
    ],
  },
  {
    id: 'job-6',
    clientName: 'Fulton Retail Suite',
    date: '2026-06-11',
    cleanerKey: 'sofia',
    jobType: 'commercial',
    chargeToClient: 510,
    supplyLines: [
      { id: 'job-6-line-1', productId: 'pine-sol', quantity: 12 },
      { id: 'job-6-line-2', productId: 'windex', quantity: 1.5 },
      { id: 'job-6-line-3', productId: 'microfiber-cloths', quantity: 6 },
      { id: 'job-6-line-4', productId: 'trash-bags', quantity: 8 },
    ],
  },
  {
    id: 'job-7',
    clientName: 'Granite Home Services',
    date: '2026-06-14',
    cleanerKey: 'maria',
    jobType: 'residential',
    chargeToClient: 210,
    supplyLines: [
      { id: 'job-7-line-1', productId: 'windex', quantity: 0.5 },
      { id: 'job-7-line-2', productId: 'microfiber-cloths', quantity: 3 },
      { id: 'job-7-line-3', productId: 'trash-bags', quantity: 2 },
    ],
  },
  {
    id: 'job-8',
    clientName: 'Harbor Point Offices',
    date: '2026-06-17',
    cleanerKey: 'james',
    jobType: 'deep clean',
    chargeToClient: 640,
    supplyLines: [
      { id: 'job-8-line-1', productId: 'pine-sol', quantity: 16 },
      { id: 'job-8-line-2', productId: 'windex', quantity: 1.5 },
      { id: 'job-8-line-3', productId: 'microfiber-cloths', quantity: 8 },
      { id: 'job-8-line-4', productId: 'scrubbing-pads', quantity: 6 },
      { id: 'job-8-line-5', productId: 'trash-bags', quantity: 6 },
    ],
  },
];

export function buildSeedDataForUser(userId: string) {
  const products = initialProducts.map((product) => ({
    ...product,
    id: `${userId}-${product.id}`,
    userId,
  }));

  const productIdMap = new Map(initialProducts.map((product) => [product.id, `${userId}-${product.id}`] as const));

  const jobs = initialJobs.map((job) => ({
    id: `${userId}-${job.id}`,
    userId,
    clientName: job.clientName,
    date: job.date,
    cleanerId: `${userId}-${job.cleanerKey}`,
    jobType: job.jobType,
    chargeToClient: job.chargeToClient,
    supplyLines: job.supplyLines.map((line) => ({
      ...line,
      id: `${userId}-${line.id}`,
      productId: productIdMap.get(line.productId) ?? line.productId,
    })),
  }));

  const cleaners = initialCleaners.map((cleaner) => ({
    ...cleaner,
    id: `${userId}-${cleaner.id}`,
    userId,
    jobIds: cleaner.jobIds.map((jobId) => `${userId}-${jobId}`),
  }));

  return { products, cleaners, jobs };
}
