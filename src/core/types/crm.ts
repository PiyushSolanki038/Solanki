// CRM Type Definitions

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
export type LeadSource = 'website' | 'referral' | 'cold_call' | 'advertisement' | 'social_media' | 'trade_show' | 'other';
export type OpportunityStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
export type ActivityType = 'call' | 'email' | 'meeting' | 'task' | 'note';
export type QuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'accepted' | 'expired';

export interface Account {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  annual_revenue?: number;
  employee_count?: number;
  description?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  job_title?: string;
  department?: string;
  account_id?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  description?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  account?: Account;
}

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  status: LeadStatus;
  source?: LeadSource;
  website?: string;
  industry?: string;
  annual_revenue?: number;
  employee_count?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  description?: string;
  converted_at?: string;
  converted_account_id?: string;
  converted_contact_id?: string;
  converted_opportunity_id?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  name: string;
  account_id?: string;
  contact_id?: string;
  stage: OpportunityStage;
  amount?: number;
  probability?: number;
  expected_revenue?: number;
  close_date?: string;
  lead_source?: LeadSource;
  description?: string;
  next_step?: string;
  is_closed?: boolean;
  is_won?: boolean;
  closed_at?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  account?: Account;
  contact?: Contact;
}

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  description?: string;
  due_date?: string;
  completed_at?: string;
  is_completed?: boolean;
  priority?: string;
  lead_id?: string;
  account_id?: string;
  contact_id?: string;
  opportunity_id?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  unit_price: number;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  quote_number?: string;
  opportunity_id?: string;
  account_id?: string;
  contact_id?: string;
  status: QuoteStatus;
  subtotal?: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
  total?: number;
  valid_until?: string;
  terms?: string;
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  opportunity?: Opportunity;
  account?: Account;
  items?: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  product_id?: string;
  product_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  total?: number;
  sort_order?: number;
  created_at: string;
}



// Stage probabilities for auto-calculation
export const STAGE_PROBABILITIES: Record<OpportunityStage, number> = {
  new: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  closed_won: 100,
  closed_lost: 0,
};

// Status colors
export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-info/15 text-info',
  contacted: 'bg-warning/15 text-warning',
  qualified: 'bg-success/15 text-success',
  unqualified: 'bg-destructive/15 text-destructive',
  converted: 'bg-primary/15 text-primary',
};

export const OPPORTUNITY_STAGE_COLORS: Record<OpportunityStage, string> = {
  new: 'bg-info',
  qualified: 'bg-info',
  proposal: 'bg-warning',
  negotiation: 'bg-primary',
  closed_won: 'bg-success',
  closed_lost: 'bg-destructive',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  pending_approval: 'bg-warning/15 text-warning',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-destructive/15 text-destructive',
  sent: 'bg-info/15 text-info',
  accepted: 'bg-primary/15 text-primary',
  expired: 'bg-secondary text-secondary-foreground',
};
