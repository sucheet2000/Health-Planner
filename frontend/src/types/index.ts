export interface FormData {
  patientFirstName: string;
  patientLastName: string;
  patientMRN: string;
  primaryDiagnosis: string;
  referringProvider: string;
  providerNPI: string;
  medicationName: string;
  additionalDiagnoses: string[];
  medicationHistory: string[];
  patientRecords: string;
}

export interface PharmacistFeedback {
  feedbackId?: string;
  timestamp?: Date | string;
  pharmacistName: string;
  feedbackType: 'correction' | 'suggestion' | 'approval';
  sectionName: string; // e.g., "PROBLEM LIST", "PHARMACIST INTERVENTIONS"
  originalText?: string;
  correctedText?: string;
  comment?: string;
  approved: boolean;
}

export interface CorrectionHistory {
  timestamp?: Date | string;
  feedbackId?: string;
  pharmacistName: string;
  sectionName: string;
  change: string; // Description of what was changed
  before?: string;
  after?: string;
}

export interface Order extends FormData {
  id?: string;
  carePlan?: string;
  timestamp?: Date | string;
  lastUpdated?: Date | string;
  approvalStatus?: 'pending' | 'corrections_pending' | 'approved'; // AI-generated status
  pharmacistFeedback?: PharmacistFeedback[];
  correctionHistory?: CorrectionHistory[];
  finalApprovedCarePlan?: string;
  history?: Array<{
    timestamp?: Date | string;
    additionalDiagnoses: string[];
    medicationHistory: string[];
    patientRecords: string;
    carePlan: string;
  }>;
}

export interface Warning {
  type: 'patient' | 'order' | 'provider';
  message: string;
  severity: 'error' | 'warning'; // error = blocks submission, warning = allows with confirmation
}

export interface ExportStats {
  orders: number;
  patients: number;
  providers: number;
  medications: number;
}
