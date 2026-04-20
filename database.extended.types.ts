import type { Database } from './database.types';

// Reserved for narrowing Json columns and table aliases; re-export Row types for readability until those extensions are needed.
export type Inspections = Database['public']['Tables']['inspections']['Row'];
export type Levels = Database['public']['Tables']['levels']['Row'];
export type Spaces = Database['public']['Tables']['spaces']['Row'];
export type Companies = Database['public']['Tables']['companies']['Row'];
export type Agents = Database['public']['Tables']['agents']['Row'];