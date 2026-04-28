export interface DataRow {
  id: string;
  age: number;
  gender: string;
  race: string;
  education: string;
  experience: number;
  dept: string;
  salary: number;
  hired: boolean;
  [key: string]: string | number | boolean;
}

export interface BiasMetric {
  attribute: string;
  group: string;
  outcomeRate: number;
  sampleSize: number;
}

export interface BiasFinding {
  attribute: string;
  metric: number; // Disparate Impact Ratio
  disparity: number; // Percentage gap
  severity: 'High' | 'Medium' | 'Low';
  groupsAffected: string[];
  mostDisadvantagedGroup: string;
  outcomeRates: { group: string; rate: number }[];
}

export interface IntersectionalFinding {
  attribute1: string;
  attribute2: string;
  matrix: {
    group1: string;
    group2: string;
    rate: number;
    sampleSize: number;
  }[];
}

export interface AnalysisSummary {
  fairnessScore: number;
  highSeverityIssues: number;
  mediumSeverityIssues: number;
  avgDisparateImpact: number;
  complianceViolations: string[];
}
