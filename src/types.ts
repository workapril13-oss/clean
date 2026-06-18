export type ProductUnit = 'oz' | 'bottle' | 'bag' | 'cloth' | 'pad';
export type JobType = 'residential' | 'commercial' | 'deep clean' | 'move-out';

export interface Product {
  id: string;
  name: string;
  unit: ProductUnit | string;
  costPerUnit: number;
  category: string;
}

export interface Cleaner {
  id: string;
  name: string;
  jobIds: string[];
}

export interface SupplyLine {
  id: string;
  productId: string;
  quantity: number;
}

export interface Job {
  id: string;
  clientName: string;
  date: string;
  cleanerId: string;
  jobType: JobType;
  chargeToClient: number;
  supplyLines: SupplyLine[];
}
