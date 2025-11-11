import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, where, getDocs, serverTimestamp, increment, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { FormData, Warning } from '../types';
import { generateCarePlan, downloadCarePlan } from '../services/api';
import WarningsDisplay from './WarningsDisplay';
import { extractTextFromPDF } from '../utils/pdfExtractor';

const OrderEntry = () => {
  const [formData, setFormData] = useState<FormData>({
    patientFirstName: '',
    patientLastName: '',
    patientMRN: '',
    primaryDiagnosis: '',
    referringProvider: '',
    providerNPI: '',
    medicationName: '',
    additionalDiagnoses: [],
    medicationHistory: [],
    patientRecords: ''
  });

  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(false);
  const [carePlan, setCarePlan] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [useTextInput, setUseTextInput] = useState(true);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);

  const [duplicateFound, setDuplicateFound] = useState<any>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateFields, setUpdateFields] = useState({
    additionalDiagnoses: '',
    medicationHistory: '',
    patientRecords: ''
  });

  const checkDuplicates = useCallback(async () => {
    if (!db) return;

    const newWarnings: Warning[] = [];
    const { patientMRN, patientFirstName, patientLastName, providerNPI, referringProvider, medicationName } = formData;

    try {
      if (patientMRN && patientMRN.length === 6 && patientFirstName && patientLastName) {
        const mrnQuery = query(collection(db, 'orders'), where('patientMRN', '==', patientMRN));
        const mrnSnapshot = await getDocs(mrnQuery);

        if (!mrnSnapshot.empty) {
          const existingOrder = mrnSnapshot.docs[0].data();
          const existingFirstName = existingOrder.patientFirstName;
          const existingLastName = existingOrder.patientLastName;

          if (existingFirstName.toLowerCase() !== patientFirstName.toLowerCase() ||
              existingLastName.toLowerCase() !== patientLastName.toLowerCase()) {
            newWarnings.push({
              type: 'patient',
              severity: 'error',
              message: `MRN MISMATCH: This MRN is already registered to a different patient. Please verify the MRN is correct for this patient.`
            });
          }
        }

        const nameQuery = query(
          collection(db, 'orders'),
          where('patientFirstName', '==', patientFirstName),
          where('patientLastName', '==', patientLastName)
        );
        const nameSnapshot = await getDocs(nameQuery);

        if (!nameSnapshot.empty) {
          const existingOrder = nameSnapshot.docs[0].data();
          const existingMRN = existingOrder.patientMRN;

          if (existingMRN !== patientMRN) {
            newWarnings.push({
              type: 'patient',
              severity: 'error',
              message: `PATIENT NAME MISMATCH: This patient name is already registered with a different MRN. Please verify the patient information is correct.`
            });
          }
        }
      }

      if (patientMRN && medicationName && formData.primaryDiagnosis && formData.providerNPI &&
          patientMRN.length === 6 && formData.providerNPI.length === 10) {
        const orderQuery = query(
          collection(db, 'orders'),
          where('patientMRN', '==', patientMRN),
          where('medicationName', '==', medicationName)
        );
        const orderSnapshot = await getDocs(orderQuery);

        if (!orderSnapshot.empty) {
          const exactMatch = orderSnapshot.docs.find(doc => {
            const data = doc.data();
            return data.primaryDiagnosis === formData.primaryDiagnosis &&
                   data.providerNPI === formData.providerNPI;
          });

          if (exactMatch) {
            const matchData = exactMatch.data();
            const orderDate = matchData.timestamp?.toDate();
            const dateStr = orderDate ? orderDate.toLocaleDateString() : 'Unknown date';

            newWarnings.push({
              type: 'order',
              severity: 'warning',
              message: `POTENTIAL DUPLICATE: A similar order exists from ${dateStr}. You'll be prompted to update or create new when submitting.`
            });
          }
        }
      }

      if (referringProvider && providerNPI && providerNPI.length === 10) {
        const providerQuery = query(collection(db, 'providers'), where('name', '==', referringProvider));
        const providerSnapshot = await getDocs(providerQuery);

        if (!providerSnapshot.empty) {
          const existingNPI = providerSnapshot.docs[0].data().npi;
          if (existingNPI !== providerNPI) {
            newWarnings.push({
              type: 'provider',
              severity: 'error',
              message: `NPI MISMATCH: This provider name is already registered with a different NPI. Please verify the NPI is correct for this provider.`
            });
          }
        }

        const npiQuery = query(collection(db, 'providers'), where('npi', '==', providerNPI));
        const npiSnapshot = await getDocs(npiQuery);

        if (!npiSnapshot.empty) {
          const existingName = npiSnapshot.docs[0].data().name;
          if (existingName.toLowerCase() !== referringProvider.toLowerCase()) {
            newWarnings.push({
              type: 'provider',
              severity: 'error',
              message: `PROVIDER NAME MISMATCH: This NPI is already registered to a different provider. Please verify the provider name is correct for this NPI.`
            });
          }
        }
      }

      setWarnings(newWarnings);
    } catch (error) {
      console.error("Error checking duplicates:", error);
    }
  }, [formData]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkDuplicates();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.patientMRN, formData.patientFirstName, formData.patientLastName,
      formData.providerNPI, formData.referringProvider, formData.medicationName, checkDuplicates]);

  const validateField = (name: string, value: string): string => {
    if (!value.trim()) {
      return 'This field is required';
    }

    // Validate patient first and last names - letters only (plus spaces, hyphens, apostrophes)
    if ((name === 'patientFirstName' || name === 'patientLastName') && !/^[A-Za-z\s'-]+$/.test(value)) {
      return 'Name must contain only letters, spaces, hyphens, or apostrophes';
    }

    if (name === 'patientMRN' && !/^[0-9]{6}$/.test(value)) {
      return 'Must be exactly 6 digits';
    }

    if (name === 'primaryDiagnosis' && !/^[A-Z][0-9]{2}\.?[0-9A-Z]*$/.test(value)) {
      return 'Invalid ICD-10 format';
    }

    if (name === 'providerNPI' && !/^[0-9]{10}$/.test(value)) {
      return 'Must be exactly 10 digits';
    }

    return '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (e.type === 'blur') {
      const error = validateField(name, value);
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  };

  const handleArrayInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: 'additionalDiagnoses' | 'medicationHistory') => {
    const value = e.target.value;
    const array = value.split(',').map(item => item.trim()).filter(item => item);

    setFormData(prev => ({
      ...prev,
      [field]: array
    }));
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file only.');
      return;
    }

    setPdfExtracting(true);
    setUploadedFileName(file.name);

    try {
      const extractedText = await extractTextFromPDF(file);
      setFormData(prev => ({
        ...prev,
        patientRecords: extractedText
      }));
      alert(`PDF uploaded successfully! Extracted ${extractedText.length} characters from ${file.name}`);
    } catch (error: any) {
      console.error('Error processing PDF:', error);
      alert(`Error processing PDF: ${error.message}`);
      setUploadedFileName(null);
    } finally {
      setPdfExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required fields
    const requiredFields = ['patientFirstName', 'patientLastName', 'patientMRN', 'primaryDiagnosis', 'referringProvider', 'providerNPI', 'medicationName', 'patientRecords'];
    const newErrors: Record<string, string> = {};

    requiredFields.forEach(field => {
      const error = validateField(field, formData[field as keyof FormData] as string);
      if (error) {
        newErrors[field] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      alert('Please correct the errors in the form before submitting.');
      return;
    }

    // Check for blocking errors (MRN mismatch, provider mismatch, etc.)
    const blockingErrors = warnings.filter(w => w.severity === 'error');
    if (blockingErrors.length > 0) {
      alert('❌ SUBMISSION BLOCKED\n\nCannot submit due to critical errors:\n\n' +
        blockingErrors.map(e => `• ${e.message}`).join('\n\n') +
        '\n\nPlease correct these issues before submitting.');
      return;
    }

    // Check for exact duplicate order
    if (db) {
      const duplicateCheck = await checkForExactDuplicate();
      if (duplicateCheck) {
        // Show duplicate dialog
        setDuplicateFound(duplicateCheck);
        setShowDuplicateDialog(true);
        return;
      }
    }

    // Proceed with normal submission
    await submitOrder();
  };

  const checkForExactDuplicate = async () => {
    if (!db) return null;

    const orderQuery = query(
      collection(db, 'orders'),
      where('patientMRN', '==', formData.patientMRN),
      where('medicationName', '==', formData.medicationName)
    );
    const orderSnapshot = await getDocs(orderQuery);

    if (!orderSnapshot.empty) {
      // Check for exact match on all 4 fields
      const exactMatch = orderSnapshot.docs.find(doc => {
        const data = doc.data();
        return data.primaryDiagnosis === formData.primaryDiagnosis &&
               data.providerNPI === formData.providerNPI;
      });

      if (exactMatch) {
        return {
          id: exactMatch.id,
          data: exactMatch.data()
        };
      }
    }

    return null;
  };

  const submitOrder = async () => {
    setLoading(true);

    try {
      // Generate care plan
      const generatedCarePlan = await generateCarePlan(formData);
      setCarePlan(generatedCarePlan);

      // Save to Firestore
      if (db) {
        await addDoc(collection(db, 'orders'), {
          ...formData,
          carePlan: generatedCarePlan,
          timestamp: serverTimestamp(),
          history: [] // Initialize history array for future updates
        });

        // Update patient master record
        await updatePatientMaster(formData.patientMRN);

        // Save/update provider
        const providerQuery = query(collection(db, 'providers'), where('npi', '==', formData.providerNPI));
        const providerSnapshot = await getDocs(providerQuery);

        if (providerSnapshot.empty) {
          await addDoc(collection(db, 'providers'), {
            name: formData.referringProvider,
            npi: formData.providerNPI,
            firstOrderDate: serverTimestamp(),
            orderCount: 1
          });
        } else {
          const providerDoc = providerSnapshot.docs[0];
          await addDoc(collection(db, 'providers'), {
            orderCount: increment(1)
          });
        }
      }

      alert('✅ Care plan generated and order saved successfully!');
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error generating care plan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePatientMaster = async (mrn: string) => {
    if (!db) return;

    try {
      const patientsRef = collection(db, 'patients');
      const patientQuery = query(patientsRef, where('mrn', '==', mrn));
      const patientSnapshot = await getDocs(patientQuery);

      const patientData = {
        mrn: formData.patientMRN,
        firstName: formData.patientFirstName,
        lastName: formData.patientLastName,
        lastUpdated: serverTimestamp()
      };

      if (patientSnapshot.empty) {
        // Create new patient master record
        await addDoc(patientsRef, {
          ...patientData,
          totalOrders: 1
        });
      } else {
        // Update existing patient master record
        const patientDoc = patientSnapshot.docs[0];
        await updateDoc(doc(db, 'patients', patientDoc.id), {
          lastUpdated: serverTimestamp(),
          totalOrders: increment(1)
        });
      }
    } catch (error) {
      console.error('Error updating patient master:', error);
    }
  };

  const handleUpdateExisting = async () => {
    if (!db || !duplicateFound) return;

    setShowUpdateForm(true);
    setShowDuplicateDialog(false);

    // Pre-fill update form with existing data
    const existingData = duplicateFound.data;
    setUpdateFields({
      additionalDiagnoses: existingData.additionalDiagnoses?.join(', ') || '',
      medicationHistory: existingData.medicationHistory?.join(', ') || '',
      patientRecords: existingData.patientRecords || ''
    });
  };

  const handleSubmitUpdate = async () => {
    if (!db || !duplicateFound) return;

    setLoading(true);

    try {
      // Convert comma-separated strings to arrays
      const updatedAdditionalDiagnoses = updateFields.additionalDiagnoses
        .split(',')
        .map(item => item.trim())
        .filter(item => item);

      const updatedMedicationHistory = updateFields.medicationHistory
        .split(',')
        .map(item => item.trim())
        .filter(item => item);

      // Save current state to history before updating
      const existingData = duplicateFound.data;
      const historyEntry = {
        timestamp: Timestamp.now(),
        additionalDiagnoses: existingData.additionalDiagnoses || [],
        medicationHistory: existingData.medicationHistory || [],
        patientRecords: existingData.patientRecords || '',
        carePlan: existingData.carePlan || ''
      };

      // Combine all data for new care plan generation
      const updatedFormData = {
        ...formData,
        additionalDiagnoses: updatedAdditionalDiagnoses,
        medicationHistory: updatedMedicationHistory,
        patientRecords: updateFields.patientRecords
      };

      // Generate new care plan with updated data
      const newCarePlan = await generateCarePlan(updatedFormData);
      setCarePlan(newCarePlan);

      // Update the existing order with new data and history
      const orderRef = doc(db, 'orders', duplicateFound.id);
      await updateDoc(orderRef, {
        additionalDiagnoses: updatedAdditionalDiagnoses,
        medicationHistory: updatedMedicationHistory,
        patientRecords: updateFields.patientRecords,
        carePlan: newCarePlan,
        lastUpdated: serverTimestamp(),
        history: [...(existingData.history || []), historyEntry]
      });

      // Update patient master record
      await updatePatientMaster(formData.patientMRN);

      alert('✅ Record Updated and New Care Plan Generated!');

      // Reset states
      setShowUpdateForm(false);
      setDuplicateFound(null);
      setUpdateFields({
        additionalDiagnoses: '',
        medicationHistory: '',
        patientRecords: ''
      });

    } catch (error: any) {
      console.error('Error updating record:', error);
      alert('Error updating record: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelUpdate = () => {
    setShowDuplicateDialog(false);
    setShowUpdateForm(false);
    setDuplicateFound(null);
    setUpdateFields({
      additionalDiagnoses: '',
      medicationHistory: '',
      patientRecords: ''
    });
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to clear the form? All entered data will be lost.')) {
      setFormData({
        patientFirstName: '',
        patientLastName: '',
        patientMRN: '',
        primaryDiagnosis: '',
        referringProvider: '',
        providerNPI: '',
        medicationName: '',
        additionalDiagnoses: [],
        medicationHistory: [],
        patientRecords: ''
      });
      setWarnings([]);
      setCarePlan(null);
      setErrors({});
      setUploadedFileName(null);
      setUseTextInput(true);
    }
  };

  const handleDownload = () => {
    if (carePlan) {
      downloadCarePlan(
        carePlan,
        formData.patientFirstName,
        formData.patientLastName,
        formData.patientMRN,
        formData.medicationName,
        formData.primaryDiagnosis
      );
    }
  };

  return (
    <div>
      <WarningsDisplay warnings={warnings} />

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 space-y-6">
        {/* Patient Information Section */}
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Patient Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="patientFirstName"
                value={formData.patientFirstName}
                onChange={handleInputChange}
                onBlur={handleInputChange}
                required
                className={`w-full px-3 py-2 border ${errors.patientFirstName ? 'error-border' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Enter first name"
              />
              {errors.patientFirstName && <span className="text-red-500 text-sm">{errors.patientFirstName}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="patientLastName"
                value={formData.patientLastName}
                onChange={handleInputChange}
                onBlur={handleInputChange}
                required
                className={`w-full px-3 py-2 border ${errors.patientLastName ? 'error-border' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Enter last name"
              />
              {errors.patientLastName && <span className="text-red-500 text-sm">{errors.patientLastName}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient MRN <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="patientMRN"
                value={formData.patientMRN}
                onChange={handleInputChange}
                onBlur={handleInputChange}
                required
                maxLength={6}
                className={`w-full px-3 py-2 border ${errors.patientMRN ? 'error-border' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="6-digit unique ID"
              />
              {errors.patientMRN && <span className="text-red-500 text-sm">{errors.patientMRN}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Diagnosis (ICD-10) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="primaryDiagnosis"
                value={formData.primaryDiagnosis}
                onChange={handleInputChange}
                onBlur={handleInputChange}
                required
                className={`w-full px-3 py-2 border ${errors.primaryDiagnosis ? 'error-border' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="e.g., G70.0"
              />
              {errors.primaryDiagnosis && <span className="text-red-500 text-sm">{errors.primaryDiagnosis}</span>}
            </div>
          </div>
        </div>

        {/* Provider Information Section */}
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Provider Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referring Provider <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="referringProvider"
                value={formData.referringProvider}
                onChange={handleInputChange}
                onBlur={handleInputChange}
                required
                className={`w-full px-3 py-2 border ${errors.referringProvider ? 'error-border' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Provider name"
              />
              {errors.referringProvider && <span className="text-red-500 text-sm">{errors.referringProvider}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider NPI <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="providerNPI"
                value={formData.providerNPI}
                onChange={handleInputChange}
                onBlur={handleInputChange}
                required
                maxLength={10}
                className={`w-full px-3 py-2 border ${errors.providerNPI ? 'error-border' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="10-digit NPI number"
              />
              {errors.providerNPI && <span className="text-red-500 text-sm">{errors.providerNPI}</span>}
            </div>
          </div>
        </div>

        {/* Medication Information Section */}
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Medication Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medication Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="medicationName"
                value={formData.medicationName}
                onChange={handleInputChange}
                onBlur={handleInputChange}
                required
                className={`w-full px-3 py-2 border ${errors.medicationName ? 'error-border' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="e.g., IVIG, Privigen"
              />
              {errors.medicationName && <span className="text-red-500 text-sm">{errors.medicationName}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Diagnoses (ICD-10 codes, comma-separated)
              </label>
              <input
                type="text"
                onChange={(e) => handleArrayInputChange(e, 'additionalDiagnoses')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., I10, K21.9"
              />
              <span className="text-sm text-gray-500">Enter multiple ICD-10 codes separated by commas</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medication History (comma-separated)
              </label>
              <textarea
                rows={3}
                onChange={(e) => handleArrayInputChange(e, 'medicationHistory')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Pyridostigmine 60mg q6h, Prednisone 10mg daily"
              />
              <span className="text-sm text-gray-500">Enter previous/current medications separated by commas</span>
            </div>
          </div>
        </div>

        {/* Patient Records Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Patient Clinical Records</h2>

          {/* Toggle between Text and PDF Upload */}
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => setUseTextInput(true)}
              className={`px-4 py-2 rounded-md transition ${
                useTextInput
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Enter Text
            </button>
            <button
              type="button"
              onClick={() => setUseTextInput(false)}
              className={`px-4 py-2 rounded-md transition ${
                !useTextInput
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Upload PDF
            </button>
          </div>

          <div className="space-y-4">
            {useTextInput ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Records (Text) <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="patientRecords"
                  value={formData.patientRecords}
                  onChange={handleInputChange}
                  onBlur={handleInputChange}
                  rows={12}
                  required
                  className={`w-full px-3 py-2 border ${errors.patientRecords ? 'error-border' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm`}
                  placeholder="Paste patient clinical records here (clinic notes, lab results, history, etc.)"
                />
                {errors.patientRecords && <span className="text-red-500 text-sm">{errors.patientRecords}</span>}
                <span className="text-sm text-gray-500">Paste the complete patient record including demographics, diagnoses, medications, labs, and clinical notes</span>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Patient Records (PDF) <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePDFUpload}
                    disabled={pdfExtracting}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label
                    htmlFor="pdf-upload"
                    className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition ${
                      pdfExtracting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {pdfExtracting ? 'Extracting text...' : 'Choose PDF File'}
                  </label>
                  {uploadedFileName && (
                    <div className="mt-4 text-sm text-gray-600">
                      <p className="font-medium">Uploaded: {uploadedFileName}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.patientRecords.length} characters extracted
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-sm text-gray-500">
                    Click to upload a PDF file containing patient clinical records
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
          >
            Clear Form
          </button>
          <button
            type="submit"
            disabled={loading || warnings.some(w => w.severity === 'error')}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            title={warnings.some(w => w.severity === 'error') ? 'Cannot submit - please fix errors above' : ''}
          >
            {loading ? 'Generating...' : warnings.some(w => w.severity === 'error') ? 'Blocked - Fix Errors' : 'Generate Care Plan'}
          </button>
        </div>
      </form>

      {/* Loading State */}
      {loading && (
        <div className="mt-6 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Generating care plan...</p>
        </div>
      )}

      {/* Results Section */}
      {carePlan && (
        <div className="mt-6 bg-white shadow-md rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-700">Generated Care Plan</h2>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download as PDF
            </button>
          </div>
          <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">
            {carePlan}
          </div>
        </div>
      )}

      {/* Duplicate Warning Dialog */}
      {showDuplicateDialog && duplicateFound && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 shadow-xl">
            <div className="flex items-start mb-6">
              <div className="flex-shrink-0">
                <svg className="h-12 w-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Duplicate Entry Detected</h3>
                <p className="text-gray-700 mb-4">
                  An existing record matches the Primary Medication, Primary Diagnosis, MRN, and Provider NPI of this submission.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                  <p className="font-semibold text-gray-800 mb-2">Existing Record:</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li><strong>Patient:</strong> {duplicateFound.data.patientFirstName} {duplicateFound.data.patientLastName}</li>
                    <li><strong>MRN:</strong> {duplicateFound.data.patientMRN}</li>
                    <li><strong>Medication:</strong> {duplicateFound.data.medicationName}</li>
                    <li><strong>Diagnosis:</strong> {duplicateFound.data.primaryDiagnosis}</li>
                    <li><strong>Provider:</strong> {duplicateFound.data.referringProvider} (NPI: {duplicateFound.data.providerNPI})</li>
                    <li><strong>Date:</strong> {duplicateFound.data.timestamp?.toDate().toLocaleDateString()}</li>
                  </ul>
                </div>
                <p className="text-gray-700 font-medium mb-4">
                  Do you want to <span className="text-blue-600">Update</span> the existing record with new information?
                </p>
                <p className="text-sm text-gray-600 italic">
                  (Selecting 'Yes' will keep the existing record and allow you to update varying fields with version history.)
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-4">
              <button
                onClick={handleCancelUpdate}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateExisting}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                Yes, Update Existing Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Form Dialog */}
      {showUpdateForm && duplicateFound && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 max-w-4xl w-full mx-4 my-8 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Update Existing Record</h3>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> The following fields will remain unchanged (matching fields):
                Primary Medication, Primary Diagnosis, MRN, and Provider NPI.
                Previous values will be saved in the history.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Additional Diagnoses (ICD-10 codes, comma-separated)
                </label>
                <input
                  type="text"
                  value={updateFields.additionalDiagnoses}
                  onChange={(e) => setUpdateFields({ ...updateFields, additionalDiagnoses: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., I10, K21.9"
                />
                <span className="text-sm text-gray-500">Current: {duplicateFound.data.additionalDiagnoses?.join(', ') || 'None'}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Medication History (comma-separated)
                </label>
                <textarea
                  rows={3}
                  value={updateFields.medicationHistory}
                  onChange={(e) => setUpdateFields({ ...updateFields, medicationHistory: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Pyridostigmine 60mg q6h, Prednisone 10mg daily"
                />
                <span className="text-sm text-gray-500">Current: {duplicateFound.data.medicationHistory?.join(', ') || 'None'}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Patient Clinical Records
                </label>
                <textarea
                  rows={8}
                  value={updateFields.patientRecords}
                  onChange={(e) => setUpdateFields({ ...updateFields, patientRecords: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Updated patient clinical records..."
                />
                <span className="text-sm text-gray-500">
                  {updateFields.patientRecords.length} characters
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8">
              <button
                onClick={handleCancelUpdate}
                disabled={loading}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitUpdate}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Updating...
                  </>
                ) : (
                  'Update & Regenerate Care Plan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderEntry;
