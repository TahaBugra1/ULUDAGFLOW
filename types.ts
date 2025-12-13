
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ComplaintCategory =
  | 'BASINC'
  | 'BASINC_DUSUK'
  | 'PATLAK'
  | 'KESINTI'
  | 'SIZINTI'
  | 'KALITE'
  | 'SAYAC'
  | 'DIGER';

export interface User {
  id: string;
  name: string;
  phone: string;
  district: string;
  neighborhood: string;
  building_no: string;
  created_at: string;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Alert {
  id: string;
  district: string;
  neighborhood?: string | null;
  start_datetime: string;
  end_datetime: string;
  risk_level: RiskLevel;
  message: string;
  source: 'AI' | 'ADMIN';
}

export interface Complaint {
  id: string;
  user_id: string;
  user_name: string;
  district: string;
  neighborhood: string;
  text: string;
  category: ComplaintCategory;
  created_at: string;
  status: 'OPEN' | 'RESOLVED';
  // Social features
  likes: number;
  likedBy: string[]; // User IDs
  adminReply?: string;
}

export interface AuthResponse {
  user?: User;
  admin?: Admin;
  token: string;
  role: 'CITIZEN' | 'ADMIN';
}

export interface DashboardStats {
  totalComplaints: number;
  activeHighRiskAlerts: number;
  complaintsByCategory: { name: string; value: number }[];
}

// --- Pipe Burst Detection Types ---
export interface BurstAnalysis {
  burst_risk: number;
  pressure_risk: number;
  is_likely_burst: boolean;
  is_pressure_issue: boolean;
}

export interface ComplaintCluster {
  location: string;
  district: string;
  neighborhood: string;
  complaints: Complaint[];
  burst_risk: number;
  pressure_risk: number;
  complaint_count: number;
}

export interface BurstPrediction {
  location: string;
  district: string;
  neighborhood: string;
  burst_probability: number;
  pressure_drop_detected: boolean;
  complaint_concentration: number;
  recommended_action: string;
}

export interface PressureEstimate {
  district: string;
  estimated_pressure: number;
  baseline_pressure: number;
  hourly_factor: number;
  burst_factor: number;
  burst_risk: number;
  is_anomaly: boolean;
  severity: 'NORMAL' | 'WARNING' | 'CRITICAL';
  timestamp: string;
}

// --- Real-Time Monitoring Types ---
export interface PressureData {
  district: string;
  current_pressure: number;
  baseline_pressure: number;
  status: 'NORMAL' | 'LOW' | 'CRITICAL';
  complaint_count: number;
  affected_neighborhoods: string[];
}

export interface OutageData {
  district: string;
  affected_percentage: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'RESOLVED' | 'PLANNED' | 'ACTIVE';
  complaint_count: number;
  affected_neighborhoods: string[];
  estimated_end: string;
}

export interface BurstAnalysisResult {
  timestamp: string;
  complaint_clusters: ComplaintCluster[];
  burst_predictions: BurstPrediction[];
  pressure_estimates: Record<string, PressureEstimate>;
  summary: {
    total_complaints: number;
    high_risk_locations: number;
    critical_pressure_zones: number;
  };
}

export type DistrictData = Record<string, string[]>;
