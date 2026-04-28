import { DataRow } from './types';

export const SAMPLE_DATA: DataRow[] = [
  { id: '1', age: 28, gender: 'Male', race: 'White', education: 'Master', experience: 5, dept: 'Engineering', salary: 120000, hired: true },
  { id: '2', age: 34, gender: 'Female', race: 'White', education: 'PhD', experience: 8, dept: 'Engineering', salary: 145000, hired: false },
  { id: '3', age: 41, gender: 'Male', race: 'Black', education: 'Bachelor', experience: 15, dept: 'Sales', salary: 95000, hired: true },
  { id: '4', age: 25, gender: 'Female', race: 'Asian', education: 'Master', experience: 2, dept: 'Marketing', salary: 85000, hired: true },
  { id: '5', age: 45, gender: 'Male', race: 'Hispanic', education: 'Bachelor', experience: 20, dept: 'General', salary: 110000, hired: false },
  { id: '6', age: 31, gender: 'Male', race: 'White', education: 'Master', experience: 7, dept: 'Engineering', salary: 130000, hired: true },
  { id: '7', age: 29, gender: 'Female', race: 'Black', education: 'Master', experience: 5, dept: 'Engineering', salary: 125000, hired: false },
  { id: '8', age: 38, gender: 'Male', race: 'Asian', education: 'PhD', experience: 12, dept: 'Engineering', salary: 160000, hired: true },
  { id: '9', age: 22, gender: 'Female', race: 'White', education: 'Bachelor', experience: 1, dept: 'Sales', salary: 65000, hired: false },
  { id: '10', age: 52, gender: 'Male', race: 'White', education: 'Master', experience: 25, dept: 'Management', salary: 180000, hired: true },
  { id: '11', age: 27, gender: 'Female', race: 'Hispanic', education: 'Bachelor', experience: 4, dept: 'Marketing', salary: 78000, hired: false },
  { id: '12', age: 33, gender: 'Male', race: 'Black', education: 'Master', experience: 9, dept: 'Engineering', salary: 135000, hired: false },
  { id: '13', age: 26, gender: 'Female', race: 'Asian', education: 'Master', experience: 3, dept: 'Engineering', salary: 115000, hired: true },
  { id: '14', age: 40, gender: 'Male', race: 'White', education: 'PhD', experience: 14, dept: 'Engineering', salary: 170000, hired: true },
  { id: '15', age: 30, gender: 'Female', race: 'Black', education: 'Bachelor', experience: 6, dept: 'Sales', salary: 90000, hired: false },
  { id: '16', age: 24, gender: 'Male', race: 'Hispanic', education: 'Master', experience: 2, dept: 'Engineering', salary: 105000, hired: true },
  { id: '17', age: 35, gender: 'Female', race: 'White', education: 'Master', experience: 10, dept: 'General', salary: 120000, hired: false },
  { id: '18', age: 29, gender: 'Male', race: 'Black', education: 'Bachelor', experience: 5, dept: 'Sales', salary: 85000, hired: false },
  { id: '19', age: 37, gender: 'Female', race: 'Asian', education: 'PhD', experience: 11, dept: 'Engineering', salary: 155000, hired: true },
  { id: '20', age: 43, gender: 'Male', race: 'Hispanic', education: 'Master', experience: 18, dept: 'Management', salary: 175000, hired: true },
];

export const PROTECTED_ATTRIBUTES = [
  'gender', 'race', 'age', 'religion', 'ethnicity', 'disability', 'nationality', 'marital status'
];

export const DOMAINS = [
  'Hiring', 'Lending', 'Healthcare', 'Criminal Justice', 'Education', 'General'
];

export const DEMO_PRESETS = [
  {
    name: 'Hiring Experiment',
    domain: 'Hiring',
    target: 'hired',
    protected: ['gender', 'race'],
    data: SAMPLE_DATA
  },
  {
    name: 'Criminal Recidivism',
    domain: 'Criminal Justice',
    target: 'recidivated',
    protected: ['race', 'age'],
    data: [
      { id: '1', age: 22, gender: 'Male', race: 'White', recidivated: false },
      { id: '2', age: 25, gender: 'Male', race: 'Black', recidivated: true },
      { id: '3', age: 30, gender: 'Female', race: 'White', recidivated: false },
      { id: '4', age: 19, gender: 'Male', race: 'Black', recidivated: true },
      { id: '5', age: 45, gender: 'Male', race: 'White', recidivated: false },
      { id: '6', age: 28, gender: 'Male', race: 'Hispanic', recidivated: true },
      { id: '7', age: 35, gender: 'Female', race: 'Black', recidivated: false },
      { id: '8', age: 21, gender: 'Male', race: 'Hispanic', recidivated: true },
      { id: '9', age: 24, gender: 'Male', race: 'White', recidivated: false },
      { id: '10', age: 26, gender: 'Male', race: 'Black', recidivated: true },
    ]
  },
  {
    name: 'Healthcare Access',
    domain: 'Healthcare',
    target: 'approved',
    protected: ['age', 'ethnicity'],
    data: [
      { id: '1', age: 72, ethnicity: 'White', approved: true },
      { id: '2', age: 68, ethnicity: 'Hispanic', approved: false },
      { id: '3', age: 15, ethnicity: 'Black', approved: true },
      { id: '4', age: 80, ethnicity: 'Asian', approved: false },
      { id: '5', age: 41, ethnicity: 'White', approved: true },
      { id: '6', age: 65, ethnicity: 'Black', approved: false },
      { id: '7', age: 33, ethnicity: 'Hispanic', approved: true },
      { id: '8', age: 58, ethnicity: 'White', approved: true },
      { id: '9', age: 74, ethnicity: 'Asian', approved: false },
      { id: '10', age: 62, ethnicity: 'Black', approved: false },
    ]
  }
];

export const COMPLIANCE_MAP: Record<string, string[]> = {
  'Hiring': ['EEOC 80% Rule', 'EU AI Act', 'GDPR Article 22'],
  'Lending': ['Equal Credit Opportunity Act', 'Fair Housing Act', 'EU AI Act'],
  'Healthcare': ['EU AI Act', 'Section 1557 Affordable Care Act'],
  'Criminal Justice': ['EU AI Act (Prohibited Use)', 'Constitutional Due Process'],
  'Education': ['Title IX', 'FERPA Fairness Clause'],
  'General': ['EU AI Act', 'GDPR Article 22']
};

export const CASE_STUDIES = [
  {
    title: 'Amazon Recruitment AI (2018)',
    summary: 'An experimental hiring tool used machine learning to penalize resumes that included the word "women\'s," effectively replicating historical male dominance in technical roles.',
    lesson: 'Historical data often contains baked-in discrimination that ML models naturally amplify.'
  },
  {
    title: 'COMPAS Recidivism (2016)',
    summary: 'ProPublica found that black defendants were far more likely than white defendants to be incorrectly flagged as at high risk of recidivism.',
    lesson: 'Proxy variables can inadvertently mirror protected attributes in high-stakes human systems.'
  },
  {
    title: 'Optum Healthcare Algorithm (2019)',
    summary: 'A widely used algorithm prioritized healthier white patients over sicker black patients because it used "healthcare cost" as a proxy for "healthcare need."',
    lesson: 'The choice of Target Outcome (label) is often where bias is most hidden.'
  }
];
