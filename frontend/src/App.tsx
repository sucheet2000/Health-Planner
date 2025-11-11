import { useState } from 'react';
import OrderEntry from './components/OrderEntry';
import ExportData from './components/ExportData';
import PharmacistReview from './components/PharmacistReview';

type TabType = 'entry' | 'review' | 'export';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('entry');

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Health Planner
          </h1>
          <p className="text-gray-600">
            Generate automated care plans from patient records
          </p>
        </header>

        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-4">
            <button
              onClick={() => setActiveTab('entry')}
              className={`px-4 py-2 border-b-2 font-medium ${
                activeTab === 'entry'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              New Order Entry
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-4 py-2 border-b-2 font-medium ${
                activeTab === 'review'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Pharmacist Review
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`px-4 py-2 border-b-2 font-medium ${
                activeTab === 'export'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Export Data
            </button>
          </nav>
        </div>

        {activeTab === 'entry' && <OrderEntry />}
        {activeTab === 'review' && <PharmacistReview />}
        {activeTab === 'export' && <ExportData />}
      </div>
    </div>
  );
}

export default App;
