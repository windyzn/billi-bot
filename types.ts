
export enum TaxCategory {
  GST = 'GST', // 5%
  GST_PST = 'GST_PST', // 12% (5+7)
  HST_13 = 'HST_13', // 13%
  CUSTOM = 'CUSTOM'
}

export interface Friend {
  id: string;
  name: string;
  partnerId?: string; // ID of another friend to group as a couple
}

export interface Venue {
  id: string;
  name: string;
  tip: number;
  tipMode: 'amount' | 'percent' | 'total';
  tipPercent: number;
  discount: number;
  discountMode: 'amount' | 'percent';
  discountPercent: number;
  manualGrandTotal: number;
}

export interface BillItem {
  id: string;
  name: string;
  price: number;
  taxCategory: TaxCategory;
  sharedWith: string[]; // Array of Friend IDs
  isTaxIncluded?: boolean; // If true, don't add tax on top
  customTaxRate?: number; // For CUSTOM category, e.g. 0.10 for 10%
  venueId: string;
}

export interface PaymentRecord {
  friendId: string;
  amount: number;
}

export interface Settlement {
  from: string; 
  to: string;   
  fromName: string;
  toName: string;
  amount: number;
}

export const GST_RATE = 0.05;
export const PST_RATE = 0.07;
