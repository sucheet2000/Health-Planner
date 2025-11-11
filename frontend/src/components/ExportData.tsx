import { useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Order, ExportStats } from '../types';
import { exportCSV, exportJSON } from '../services/api';

const ExportData = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [medFilter, setMedFilter] = useState('');
  const [stats, setStats] = useState<ExportStats | null>(null);

  const handleExport = async (format: 'csv' | 'json') => {
    if (!db) {
      alert('Database not connected. Cannot export data.');
      return;
    }

    try {
      const snapshot = await getDocs(query(collection(db, 'orders')));

      let orders: Order[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate().toISOString()
        } as Order;
      });

      if (startDate) {
        const startDateTime = new Date(startDate + 'T00:00:00');
        orders = orders.filter(order => {
          const orderDate = new Date(order.timestamp);
          return orderDate >= startDateTime;
        });
      }

      if (endDate) {
        const endDateTime = new Date(endDate + 'T23:59:59');
        orders = orders.filter(order => {
          const orderDate = new Date(order.timestamp);
          return orderDate <= endDateTime;
        });
      }

      if (medFilter && medFilter.trim()) {
        orders = orders.filter(order =>
          order.medicationName?.toLowerCase().includes(medFilter.toLowerCase())
        );
      }

      if (orders.length === 0) {
        const filterMsg = [];
        if (startDate || endDate) {
          const dateRange = startDate && endDate
            ? `${startDate} to ${endDate}`
            : startDate
            ? `from ${startDate}`
            : `until ${endDate}`;
          filterMsg.push(`Date range: ${dateRange}`);
        }
        if (medFilter) {
          filterMsg.push(`Medication: ${medFilter}`);
        }

        const message = filterMsg.length > 0
          ? `No data found for the specified filters:\n${filterMsg.join('\n')}\n\nTry:\n- Expanding the date range\n- Removing the medication filter\n- Clearing all filters to see all data`
          : 'No data found in the database.';

        alert(message);
        return;
      }

      const uniquePatients = new Set(orders.map(o => o.patientMRN)).size;
      const uniqueProviders = new Set(orders.map(o => o.providerNPI)).size;
      const uniqueMedications = new Set(orders.map(o => o.medicationName)).size;

      setStats({
        orders: orders.length,
        patients: uniquePatients,
        providers: uniqueProviders,
        medications: uniqueMedications
      });

      if (format === 'csv') {
        exportCSV(orders);
      } else if (format === 'json') {
        exportJSON(orders);
      }

    } catch (error: any) {
      console.error('Export error:', error);
      alert('Error exporting data: ' + error.message);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Export Data for Pharma Reporting</h2>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Medication</label>
        <input
          type="text"
          value={medFilter}
          onChange={(e) => setMedFilter(e.target.value)}
          placeholder="Leave blank for all medications"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div className="flex space-x-4">
        <button
          onClick={() => handleExport('csv')}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          Export as CSV
        </button>
        <button
          onClick={() => handleExport('json')}
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
        >
          Export as JSON
        </button>
      </div>

      {stats && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Export Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded">
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-blue-600">{stats.orders}</p>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <p className="text-sm text-gray-600">Unique Patients</p>
              <p className="text-2xl font-bold text-green-600">{stats.patients}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded">
              <p className="text-sm text-gray-600">Unique Providers</p>
              <p className="text-2xl font-bold text-purple-600">{stats.providers}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded">
              <p className="text-sm text-gray-600">Medications</p>
              <p className="text-2xl font-bold text-orange-600">{stats.medications}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportData;
