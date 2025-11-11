import axios from 'axios';
import { jsPDF } from 'jspdf';
import { FormData, Order, PharmacistFeedback } from '../types';

const API_BASE_URL = '/api';

export const generateCarePlan = async (formData: FormData): Promise<string> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/generate-careplan`, {
      formData
    });

    if (!response.data.carePlan) {
      throw new Error("Invalid response format from server");
    }

    return response.data.carePlan;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data || {};

      if (status === 401 || status === 403) {
        throw new Error("Authentication error. Please check the backend server API key configuration.");
      } else if (status === 400) {
        throw new Error("Invalid request data: " + (errorData.error || 'Please check all required fields'));
      } else {
        throw new Error(`API request failed with status ${status}: ${errorData.error || 'Unknown error'}`);
      }
    } else if (error.request) {
      throw new Error("Cannot connect to API server. Make sure the backend server is running.");
    } else {
      throw new Error(error.message || 'Unknown error occurred');
    }
  }
};

export const downloadCarePlan = (
  carePlan: string,
  patientFirstName: string,
  patientLastName: string,
  mrn: string,
  medication: string,
  diagnosis: string
) => {
  const date = new Date().toISOString().split('T')[0];
  const filename = `CarePlan_${patientFirstName}_${patientLastName}_MRN${mrn}_${date}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SPECIALTY PHARMACY CARE PLAN', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PATIENT INFORMATION', margin, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Patient Name: ${patientFirstName} ${patientLastName}`, margin, yPosition);
  yPosition += 5;
  doc.text(`MRN: ${mrn}`, margin, yPosition);
  yPosition += 5;
  doc.text(`Primary Diagnosis: ${diagnosis}`, margin, yPosition);
  yPosition += 5;
  doc.text(`Medication: ${medication}`, margin, yPosition);
  yPosition += 5;
  doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, margin, yPosition);
  yPosition += 10;

  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CARE PLAN', margin, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const lines = doc.splitTextToSize(carePlan, contentWidth);

  for (let i = 0; i < lines.length; i++) {
    if (yPosition > pageHeight - margin - 10) {
      doc.addPage();
      yPosition = margin;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Care Plan - ${patientFirstName} ${patientLastName} (MRN: ${mrn}) - Page ${doc.getCurrentPageInfo().pageNumber}`, margin, yPosition);
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }

    const line = lines[i];
    if (line.match(/^[A-Z\s]+:/) || line.match(/^\d+\./)) {
      doc.setFont('helvetica', 'bold');
      doc.text(line, margin, yPosition);
      doc.setFont('helvetica', 'normal');
    } else {
      doc.text(line, margin, yPosition);
    }

    yPosition += 5;
  }

  const totalPages = doc.getCurrentPageInfo().pageNumber;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Health Planner | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  doc.save(filename);
};

export const exportCSV = (orders: Order[]) => {
  const headers = [
    'Order ID', 'Date', 'Patient First Name', 'Patient Last Name', 'MRN',
    'Primary Diagnosis', 'Additional Diagnoses', 'Medication', 'Medication History',
    'Provider Name', 'Provider NPI'
  ];

  const rows = orders.map(order => [
    order.id || '',
    order.timestamp || '',
    order.patientFirstName,
    order.patientLastName,
    order.patientMRN,
    order.primaryDiagnosis,
    order.additionalDiagnoses?.join('; ') || '',
    order.medicationName,
    order.medicationHistory?.join('; ') || '',
    order.referringProvider,
    order.providerNPI
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy_orders_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const exportJSON = (orders: Order[]) => {
  const jsonContent = JSON.stringify(orders, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy_orders_export_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const submitPharmacistFeedback = async (
  orderId: string,
  feedback: PharmacistFeedback[],
  finalCarePlan?: string
): Promise<string> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/submit-pharmacist-feedback`, {
      orderId,
      feedback,
      finalCarePlan
    });

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to submit feedback");
    }

    return response.data.updatedCarePlan;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data || {};

      if (status === 401 || status === 403) {
        throw new Error("Authentication error.");
      } else if (status === 400) {
        throw new Error("Invalid feedback data: " + (errorData.detail || 'Please check your input'));
      } else {
        throw new Error(`API request failed with status ${status}: ${errorData.detail || 'Unknown error'}`);
      }
    } else if (error.request) {
      throw new Error("Cannot connect to API server. Make sure the backend server is running.");
    } else {
      throw new Error(error.message || 'Unknown error occurred');
    }
  }
};

export const regenerateCarePlanWithFeedback = async (
  orderId: string,
  feedback: PharmacistFeedback[]
): Promise<string> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/regenerate-careplan-with-feedback`, {
      orderId,
      feedback
    });

    if (!response.data.carePlan) {
      throw new Error("Invalid response format from server");
    }

    return response.data.carePlan;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data || {};

      if (status === 401 || status === 403) {
        throw new Error("Authentication error.");
      } else if (status === 400) {
        throw new Error("Invalid request data: " + (errorData.detail || 'Please check your input'));
      } else {
        throw new Error(`API request failed with status ${status}: ${errorData.detail || 'Unknown error'}`);
      }
    } else if (error.request) {
      throw new Error("Cannot connect to API server. Make sure the backend server is running.");
    } else {
      throw new Error(error.message || 'Unknown error occurred');
    }
  }
};
