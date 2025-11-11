// Validation utility functions

export const validateMRN = (mrn: string): boolean => {
  if (!mrn || typeof mrn !== 'string') return false;
  const trimmed = mrn.trim();
  return /^[0-9]{6}$/.test(trimmed);
};

export const validateNPI = (npi: string): boolean => {
  if (!npi || typeof npi !== 'string') return false;
  const trimmed = npi.trim();
  return /^[0-9]{10}$/.test(trimmed);
};

export const validateICD10 = (code: string): boolean => {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  // ICD-10 format: Letter followed by 2 digits, optional decimal and additional characters
  return /^[A-Z][0-9]{2}\.?[0-9A-Z]*$/i.test(trimmed);
};

export const validateName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;

  // Allow letters, spaces, hyphens, apostrophes, and accented characters
  // Reject numbers and most special characters
  return /^[a-zA-ZÀ-ÿ\s'-]+$/.test(trimmed) && !/\d/.test(trimmed);
};

export const validateRequiredField = (value: string): boolean => {
  return Boolean(value && value.trim().length > 0);
};

export interface FormValidation {
  patientFirstName: string;
  patientLastName: string;
  patientMRN: string;
  primaryDiagnosis: string;
  referringProvider: string;
  providerNPI: string;
  medicationName: string;
  patientRecords: string;
}

export const validateRequiredFields = (formData: Partial<FormValidation>): boolean => {
  const requiredFields: (keyof FormValidation)[] = [
    'patientFirstName',
    'patientLastName',
    'patientMRN',
    'primaryDiagnosis',
    'referringProvider',
    'providerNPI',
    'medicationName',
    'patientRecords'
  ];

  return requiredFields.every(field => {
    const value = formData[field];
    return validateRequiredField(value || '');
  });
};

export const validateAllFields = (formData: Partial<FormValidation>): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!validateRequiredField(formData.patientFirstName || '')) {
    errors.patientFirstName = 'First name is required';
  } else if (!validateName(formData.patientFirstName || '')) {
    errors.patientFirstName = 'Invalid name format';
  }

  if (!validateRequiredField(formData.patientLastName || '')) {
    errors.patientLastName = 'Last name is required';
  } else if (!validateName(formData.patientLastName || '')) {
    errors.patientLastName = 'Invalid name format';
  }

  if (!validateRequiredField(formData.patientMRN || '')) {
    errors.patientMRN = 'MRN is required';
  } else if (!validateMRN(formData.patientMRN || '')) {
    errors.patientMRN = 'Must be exactly 6 digits';
  }

  if (!validateRequiredField(formData.primaryDiagnosis || '')) {
    errors.primaryDiagnosis = 'Primary diagnosis is required';
  } else if (!validateICD10(formData.primaryDiagnosis || '')) {
    errors.primaryDiagnosis = 'Invalid ICD-10 format';
  }

  if (!validateRequiredField(formData.providerNPI || '')) {
    errors.providerNPI = 'Provider NPI is required';
  } else if (!validateNPI(formData.providerNPI || '')) {
    errors.providerNPI = 'Must be exactly 10 digits';
  }

  if (!validateRequiredField(formData.referringProvider || '')) {
    errors.referringProvider = 'Referring provider is required';
  }

  if (!validateRequiredField(formData.medicationName || '')) {
    errors.medicationName = 'Medication name is required';
  }

  if (!validateRequiredField(formData.patientRecords || '')) {
    errors.patientRecords = 'Patient records are required';
  }

  return errors;
};
