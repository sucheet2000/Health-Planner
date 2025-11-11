import { describe, it, expect } from 'vitest';
import {
  validateMRN,
  validateNPI,
  validateICD10,
  validateName,
  validateRequiredField,
  validateAllFields
} from '../utils/validation';

describe('Care Plan System - Validation Tests', () => {

  // ========================================================================
  // MRN (Medical Record Number) Validation Tests
  // ========================================================================
  describe('MRN Validation', () => {
    it('should accept valid 6-digit MRN', () => {
      expect(validateMRN('123456')).toBe(true);
      expect(validateMRN('000000')).toBe(true);
      expect(validateMRN('999999')).toBe(true);
    });

    it('should reject MRN with less than 6 digits', () => {
      expect(validateMRN('12345')).toBe(false);
      expect(validateMRN('1')).toBe(false);
      expect(validateMRN('')).toBe(false);
    });

    it('should reject MRN with more than 6 digits', () => {
      expect(validateMRN('1234567')).toBe(false);
      expect(validateMRN('12345678')).toBe(false);
    });

    it('should reject MRN with non-numeric characters', () => {
      expect(validateMRN('12345a')).toBe(false);
      expect(validateMRN('abcdef')).toBe(false);
      expect(validateMRN('12-345')).toBe(false);
    });

    it('should reject MRN with internal spaces', () => {
      expect(validateMRN('123 456')).toBe(false);
    });

    it('should accept MRN with leading/trailing spaces (gets trimmed)', () => {
      expect(validateMRN(' 123456')).toBe(true);
      expect(validateMRN('123456 ')).toBe(true);
      expect(validateMRN(' 123456 ')).toBe(true);
    });

    it('should handle whitespace-only MRN as invalid', () => {
      expect(validateMRN('      ')).toBe(false);
      expect(validateMRN('\t\t')).toBe(false);
    });
  });

  // ========================================================================
  // NPI (National Provider Identifier) Validation Tests
  // ========================================================================
  describe('NPI Validation', () => {
    it('should accept valid 10-digit NPI', () => {
      expect(validateNPI('1234567890')).toBe(true);
      expect(validateNPI('0000000000')).toBe(true);
      expect(validateNPI('9999999999')).toBe(true);
    });

    it('should reject NPI with less than 10 digits', () => {
      expect(validateNPI('123456789')).toBe(false);
      expect(validateNPI('12345')).toBe(false);
      expect(validateNPI('1')).toBe(false);
    });

    it('should reject NPI with more than 10 digits', () => {
      expect(validateNPI('12345678901')).toBe(false);
      expect(validateNPI('123456789012345')).toBe(false);
    });

    it('should reject NPI with letters or special characters', () => {
      expect(validateNPI('123456789a')).toBe(false);
      expect(validateNPI('abcdefghij')).toBe(false);
      expect(validateNPI('123-456-789')).toBe(false);
    });

    it('should reject empty or whitespace NPI', () => {
      expect(validateNPI('')).toBe(false);
      expect(validateNPI('      ')).toBe(false);
      expect(validateNPI('\t')).toBe(false);
    });

    it('should reject NPI with internal spaces', () => {
      expect(validateNPI('123 456 7890')).toBe(false);
      expect(validateNPI('1234 567890')).toBe(false);
    });
  });

  // ========================================================================
  // ICD-10 Code Validation Tests
  // ========================================================================
  describe('ICD-10 Code Validation', () => {
    it('should accept valid ICD-10 codes with standard format', () => {
      expect(validateICD10('G70.0')).toBe(true);
      expect(validateICD10('I10')).toBe(true);
      expect(validateICD10('E11.9')).toBe(true);
      expect(validateICD10('K21.9')).toBe(true);
    });

    it('should accept ICD-10 codes without decimals', () => {
      expect(validateICD10('G70')).toBe(true);
      expect(validateICD10('I10')).toBe(true);
      expect(validateICD10('E11')).toBe(true);
    });

    it('should accept ICD-10 codes with extended format', () => {
      expect(validateICD10('S72.001A')).toBe(true);
      expect(validateICD10('T36.0X1A')).toBe(true);
      expect(validateICD10('M79.601')).toBe(true);
    });

    it('should accept lowercase ICD-10 codes', () => {
      expect(validateICD10('g70.0')).toBe(true);
      expect(validateICD10('i10')).toBe(true);
      expect(validateICD10('e11.9')).toBe(true);
    });

    it('should reject ICD-10 codes starting with numbers', () => {
      expect(validateICD10('1G70.0')).toBe(false);
      expect(validateICD10('99.99')).toBe(false);
    });

    it('should reject completely invalid ICD-10 format', () => {
      expect(validateICD10('ABC')).toBe(false);
      expect(validateICD10('1234')).toBe(false);
      expect(validateICD10('G')).toBe(false);
    });

    it('should reject empty or whitespace ICD-10', () => {
      expect(validateICD10('')).toBe(false);
      expect(validateICD10('   ')).toBe(false);
    });

    it('should accept ICD-10 with mixed case', () => {
      expect(validateICD10('G70.0')).toBe(true);
      expect(validateICD10('g70.0')).toBe(true);
      expect(validateICD10('G70.0')).toBe(true);
    });
  });

  // ========================================================================
  // Name Validation Tests
  // ========================================================================
  describe('Name Validation', () => {
    it('should accept simple names with letters only', () => {
      expect(validateName('John')).toBe(true);
      expect(validateName('Sarah')).toBe(true);
      expect(validateName('Michael')).toBe(true);
    });

    it('should accept names with hyphens', () => {
      expect(validateName('Mary-Jane')).toBe(true);
      expect(validateName('Jean-Claude')).toBe(true);
      expect(validateName('Ann-Marie')).toBe(true);
    });

    it('should accept names with apostrophes', () => {
      expect(validateName("O'Brien")).toBe(true);
      expect(validateName("D'Angelo")).toBe(true);
      expect(validateName("McG'ill")).toBe(true);
    });

    it('should accept names with spaces (compound names)', () => {
      expect(validateName('Mary Ann')).toBe(true);
      expect(validateName('Van Der Berg')).toBe(true);
      expect(validateName('De La Cruz')).toBe(true);
    });

    it('should accept names with accented characters', () => {
      expect(validateName('José')).toBe(true);
      expect(validateName('François')).toBe(true);
      expect(validateName('María')).toBe(true);
    });

    it('should reject names with numbers', () => {
      expect(validateName('John123')).toBe(false);
      expect(validateName('Sarah1')).toBe(false);
      expect(validateName('99Problems')).toBe(false);
    });

    it('should reject names with special characters (except hyphen/apostrophe)', () => {
      expect(validateName('John@Doe')).toBe(false);
      expect(validateName('Sarah#Smith')).toBe(false);
      expect(validateName('Mike$Jones')).toBe(false);
      expect(validateName('Jane!Doe')).toBe(false);
    });

    it('should reject empty or whitespace-only names', () => {
      expect(validateName('')).toBe(false);
      expect(validateName('   ')).toBe(false);
      expect(validateName('\t\t')).toBe(false);
    });

    it('should trim and validate names with leading/trailing spaces', () => {
      expect(validateName(' John ')).toBe(true);
      expect(validateName('  Sarah  ')).toBe(true);
    });
  });

  // ========================================================================
  // Required Field Validation Tests
  // ========================================================================
  describe('Required Field Validation', () => {
    it('should accept non-empty strings', () => {
      expect(validateRequiredField('Valid Input')).toBe(true);
      expect(validateRequiredField('123')).toBe(true);
      expect(validateRequiredField('a')).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(validateRequiredField('')).toBe(false);
    });

    it('should reject whitespace-only strings', () => {
      expect(validateRequiredField('   ')).toBe(false);
      expect(validateRequiredField('\t\t')).toBe(false);
      expect(validateRequiredField('\n\n')).toBe(false);
    });

    it('should accept strings with leading/trailing whitespace', () => {
      expect(validateRequiredField('  Valid  ')).toBe(true);
      expect(validateRequiredField('\tValid\t')).toBe(true);
    });
  });

  // ========================================================================
  // Complete Form Validation Tests
  // ========================================================================
  describe('Complete Form Validation', () => {
    const validFormData = {
      patientFirstName: 'John',
      patientLastName: 'Doe',
      patientMRN: '123456',
      primaryDiagnosis: 'G70.0',
      referringProvider: 'Dr. Sarah Smith',
      providerNPI: '1234567890',
      medicationName: 'Privigen',
      additionalDiagnoses: ['I10', 'E11.9'],
      medicationHistory: ['Pyridostigmine 60mg q6h'],
      patientRecords: 'Patient clinical records...'
    };

    it('should return no errors for completely valid form', () => {
      const errors = validateAllFields(validFormData);
      expect(Object.keys(errors).length).toBe(0);
    });

    it('should return errors for invalid MRN', () => {
      const invalidForm = { ...validFormData, patientMRN: '12345' };
      const errors = validateAllFields(invalidForm);
      expect(errors.patientMRN).toBeDefined();
      expect(errors.patientMRN).toContain('6 digits');
    });

    it('should return errors for invalid NPI', () => {
      const invalidForm = { ...validFormData, providerNPI: '123456789' };
      const errors = validateAllFields(invalidForm);
      expect(errors.providerNPI).toBeDefined();
      expect(errors.providerNPI).toContain('10 digits');
    });

    it('should return errors for invalid ICD-10', () => {
      const invalidForm = { ...validFormData, primaryDiagnosis: '12345' };
      const errors = validateAllFields(invalidForm);
      expect(errors.primaryDiagnosis).toBeDefined();
    });

    it('should return errors for missing required fields', () => {
      const invalidForm = {
        ...validFormData,
        patientFirstName: '',
        patientLastName: '',
        medicationName: ''
      };
      const errors = validateAllFields(invalidForm);
      expect(errors.patientFirstName).toBeDefined();
      expect(errors.patientLastName).toBeDefined();
      expect(errors.medicationName).toBeDefined();
    });

    it('should return errors for invalid patient names', () => {
      const invalidForm = {
        ...validFormData,
        patientFirstName: 'John123',
        patientLastName: 'Doe@Smith'
      };
      const errors = validateAllFields(invalidForm);
      expect(errors.patientFirstName).toBeDefined();
      expect(errors.patientLastName).toBeDefined();
    });

    it('should return errors for invalid provider name - not validated currently', () => {
      // Note: Current implementation doesn't validate provider name format
      const invalidForm = {
        ...validFormData,
        referringProvider: ''
      };
      const errors = validateAllFields(invalidForm);
      expect(errors.referringProvider).toBeDefined();
    });

    it('should return multiple errors when multiple fields are invalid', () => {
      const invalidForm = {
        ...validFormData,
        patientFirstName: '',
        patientMRN: '123',
        providerNPI: '12345',
        primaryDiagnosis: 'INVALID'
      };
      const errors = validateAllFields(invalidForm);
      expect(Object.keys(errors).length).toBeGreaterThan(3);
    });

    it('should not validate additional diagnoses - handled separately', () => {
      // Note: additionalDiagnoses is not part of the validateAllFields function
      const formWithDiagnoses = {
        ...validFormData
      };
      const errors = validateAllFields(formWithDiagnoses);
      expect(errors.additionalDiagnoses).toBeUndefined();
    });

    it('should not check additional diagnoses array - handled separately', () => {
      // Note: additionalDiagnoses is not part of the validateAllFields function
      const formWithEmptyDiagnoses = {
        ...validFormData
      };
      const errors = validateAllFields(formWithEmptyDiagnoses);
      expect(errors.additionalDiagnoses).toBeUndefined();
    });
  });

  // ========================================================================
  // Edge Cases and Boundary Tests
  // ========================================================================
  describe('Edge Cases and Boundary Tests', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(validateMRN(null as any)).toBe(false);
      expect(validateMRN(undefined as any)).toBe(false);
      expect(validateNPI(null as any)).toBe(false);
      expect(validateNPI(undefined as any)).toBe(false);
      expect(validateName(null as any)).toBe(false);
      expect(validateName(undefined as any)).toBe(false);
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      expect(validateMRN(longString)).toBe(false);
      expect(validateNPI(longString)).toBe(false);
      expect(validateName(longString)).toBe(true); // Names can be long
    });

    it('should handle special Unicode characters in names', () => {
      // Note: Current regex supports À-ÿ range which includes most European accents
      // but not all Unicode characters like Chinese/Japanese
      expect(validateName('Müller')).toBe(true);
      expect(validateName('Björk')).toBe(true);
      expect(validateName('José')).toBe(true);
    });

    it('should validate form with minimal required fields', () => {
      const minimalForm = {
        patientFirstName: 'John',
        patientLastName: 'Doe',
        patientMRN: '123456',
        primaryDiagnosis: 'G70.0',
        referringProvider: 'Dr. Smith',
        providerNPI: '1234567890',
        medicationName: 'Privigen',
        patientRecords: 'Records'
      };
      const errors = validateAllFields(minimalForm);
      expect(Object.keys(errors).length).toBe(0);
    });
  });

  // ========================================================================
  // Business Logic Validation Tests
  // ========================================================================
  describe('Business Logic Validation', () => {
    it('should ensure MRN is exactly 6 digits (business requirement)', () => {
      // Business rule: MRN must be exactly 6 digits
      expect(validateMRN('123456')).toBe(true);
      expect(validateMRN('12345')).toBe(false);  // Too short
      expect(validateMRN('1234567')).toBe(false); // Too long
    });

    it('should ensure NPI is exactly 10 digits (CMS requirement)', () => {
      // Business rule: NPI must be exactly 10 digits per CMS standards
      expect(validateNPI('1234567890')).toBe(true);
      expect(validateNPI('123456789')).toBe(false);  // Too short
      expect(validateNPI('12345678901')).toBe(false); // Too long
    });

    it('should enforce ICD-10 format standards', () => {
      // Business rule: ICD-10 must start with letter, can have numbers and decimals
      expect(validateICD10('G70.0')).toBe(true);    // Standard format
      expect(validateICD10('E11.9')).toBe(true);    // Standard format
      expect(validateICD10('S72.001A')).toBe(true); // Extended format
      expect(validateICD10('123')).toBe(false);     // Invalid: starts with number
    });

    it('should allow common name formats in healthcare', () => {
      // Business rule: Support diverse name formats common in healthcare
      expect(validateName('Van Der Berg')).toBe(true);  // Dutch names
      expect(validateName("O'Brien")).toBe(true);       // Irish names
      expect(validateName('Mary-Jane')).toBe(true);     // Hyphenated names
      expect(validateName('De La Cruz')).toBe(true);    // Spanish names
    });
  });
});
