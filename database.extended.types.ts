import type { Database } from './database.types';

// This file is not really usefull in our case but we can extend the database to force Json typing and to rename the tables for better readability
export type Inspections = Database['public']['Tables']['inspections']['Row'];
export type Levels = Database['public']['Tables']['levels']['Row'];
export type Spaces = Database['public']['Tables']['spaces']['Row'];
export type Companies = Database['public']['Tables']['companies']['Row'];
export type Agents = Database['public']['Tables']['agents']['Row'];