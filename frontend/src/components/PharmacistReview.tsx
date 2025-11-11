import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Order, PharmacistFeedback } from '../types';
import { regenerateCarePlanWithFeedback } from '../services/api';

const PharmacistReview = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<PharmacistFeedback[]>([]);
  const [pharmacistName, setPharmacistName] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [improvedCarePlan, setImprovedCarePlan] = useState<string | null>(null);
  const [showImprovedPlan, setShowImprovedPlan] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    sectionName: '',
    feedbackType: 'suggestion' as 'correction' | 'suggestion' | 'approval',
    originalText: '',
    correctedText: '',
    comment: '',
    approved: false
  });

  // Fetch pending care plans
  useEffect(() => {
    const fetchPendingOrders = async () => {
      if (!db) return;
      setLoading(true);

      try {
        const q = query(
          collection(db, 'orders'),
          where('approvalStatus', '!=', 'approved')
        );
        const snapshot = await getDocs(q);
        const ordersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Order));
        setOrders(ordersList);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingOrders();
  }, []);

  const handleAddFeedback = () => {
    if (!newFeedback.sectionName || !pharmacistName) {
      alert('Please fill in pharmacist name and section name');
      return;
    }

    const feedbackItem: PharmacistFeedback = {
      feedbackId: `feedback_${Date.now()}`,
      timestamp: new Date(),
      pharmacistName,
      feedbackType: newFeedback.feedbackType,
      sectionName: newFeedback.sectionName,
      originalText: newFeedback.originalText || undefined,
      correctedText: newFeedback.correctedText || undefined,
      comment: newFeedback.comment || undefined,
      approved: newFeedback.approved
    };

    setFeedback([...feedback, feedbackItem]);

    // Reset form
    setNewFeedback({
      sectionName: '',
      feedbackType: 'suggestion',
      originalText: '',
      correctedText: '',
      comment: '',
      approved: false
    });
  };

  const handleRemoveFeedback = (index: number) => {
    setFeedback(feedback.filter((_, i) => i !== index));
  };

  const handleSubmitFeedback = async () => {
    if (!selectedOrder || !selectedOrder.id || !pharmacistName) {
      alert('Please select an order and enter pharmacist name');
      return;
    }

    if (feedback.length === 0) {
      alert('Please add at least one feedback item');
      return;
    }

    setLoading(true);

    try {
      // Determine approval status
      const allApproved = feedback.every(f => f.approved);
      const approvalStatus = allApproved ? 'approved' : 'corrections_pending';

      // Build correction history
      const correctionHistory = feedback.map(f => ({
        timestamp: f.timestamp,
        feedbackId: f.feedbackId,
        pharmacistName: f.pharmacistName,
        sectionName: f.sectionName,
        change: f.correctedText
          ? `Updated ${f.sectionName}: ${f.comment || 'Manual correction'}`
          : f.comment || `${f.feedbackType} on ${f.sectionName}`,
        before: f.originalText,
        after: f.correctedText
      }));

      // Update the order in Firestore
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, {
        approvalStatus,
        pharmacistFeedback: feedback,
        correctionHistory: [...(selectedOrder.correctionHistory || []), ...correctionHistory],
        lastUpdated: serverTimestamp()
      });

      alert('Pharmacist feedback submitted successfully!');
      setFeedback([]);
      setSelectedOrder(null);
      setPharmacistName('');

      // Refresh orders list
      const q = query(
        collection(db, 'orders'),
        where('approvalStatus', '!=', 'approved')
      );
      const snapshot = await getDocs(q);
      const ordersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Order));
      setOrders(ordersList);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Error submitting feedback: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateCarePlan = async () => {
    if (!selectedOrder || !selectedOrder.id || feedback.length === 0) {
      alert('Please select an order and add feedback first');
      return;
    }

    setRegenerating(true);

    try {
      // Call the regenerate endpoint with current feedback
      const improvedPlan = await regenerateCarePlanWithFeedback(
        selectedOrder.id,
        feedback
      );

      setImprovedCarePlan(improvedPlan);
      setShowImprovedPlan(true);
    } catch (error) {
      console.error('Error regenerating care plan:', error);
      alert('Error regenerating care plan: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setRegenerating(false);
    }
  };

  const handleAcceptImprovedPlan = async () => {
    if (!selectedOrder || !selectedOrder.id || !improvedCarePlan) {
      alert('No improved care plan to accept');
      return;
    }

    setLoading(true);

    try {
      // Update the order with the improved care plan
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, {
        carePlan: improvedCarePlan,
        pharmacistFeedback: feedback,
        approvalStatus: 'approved',
        lastUpdated: serverTimestamp()
      });

      alert('Improved care plan accepted and saved successfully!');
      setImprovedCarePlan(null);
      setShowImprovedPlan(false);
      setFeedback([]);
      setSelectedOrder(null);
      setPharmacistName('');

      // Refresh orders list
      const q = query(
        collection(db, 'orders'),
        where('approvalStatus', '!=', 'approved')
      );
      const snapshot = await getDocs(q);
      const ordersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Order));
      setOrders(ordersList);
    } catch (error) {
      console.error('Error accepting improved care plan:', error);
      alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Pharmacist Care Plan Review</h1>

      {/* Pharmacist Name Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pharmacist Name *</label>
        <input
          type="text"
          value={pharmacistName}
          onChange={(e) => setPharmacistName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Orders List */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Pending Care Plans for Review</h2>
        <div className="grid gap-4 max-h-96 overflow-y-auto">
          {loading ? (
            <p className="text-gray-500">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-gray-500">No pending care plans for review</p>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedOrder?.id === order.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {order.patientFirstName} {order.patientLastName}
                    </p>
                    <p className="text-sm text-gray-600">MRN: {order.patientMRN}</p>
                    <p className="text-sm text-gray-600">Medication: {order.medicationName}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      order.approvalStatus === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : order.approvalStatus === 'corrections_pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {order.approvalStatus || 'Pending'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Selected Order Details */}
      {selectedOrder && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">
            {selectedOrder.patientFirstName} {selectedOrder.patientLastName} - {selectedOrder.medicationName}
          </h3>

          {/* Care Plan Display */}
          <div className="mb-6 p-3 bg-white rounded border border-gray-300 max-h-64 overflow-y-auto">
            <h4 className="font-semibold text-gray-700 mb-2">Current Care Plan:</h4>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
              {selectedOrder.carePlan || 'No care plan generated'}
            </pre>
          </div>

          {/* Add New Feedback */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
            <h4 className="font-semibold text-gray-700 mb-3">Add Feedback</h4>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section Name *</label>
                <select
                  value={newFeedback.sectionName}
                  onChange={(e) => setNewFeedback({ ...newFeedback, sectionName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select section...</option>
                  <option value="PROBLEM LIST">Problem List / DTPs</option>
                  <option value="GOALS">Goals (SMART)</option>
                  <option value="PHARMACIST INTERVENTIONS">Pharmacist Interventions</option>
                  <option value="DOSING & ADMINISTRATION">Dosing & Administration</option>
                  <option value="PREMEDICATION">Premedication</option>
                  <option value="INFUSION RATES">Infusion Rates & Titration</option>
                  <option value="MONITORING PLAN">Monitoring Plan & Lab Schedule</option>
                  <option value="ADVERSE EVENT MANAGEMENT">Adverse Event Management</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Type</label>
                <select
                  value={newFeedback.feedbackType}
                  onChange={(e) => setNewFeedback({ ...newFeedback, feedbackType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="suggestion">Suggestion</option>
                  <option value="correction">Correction</option>
                  <option value="approval">Approval</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
              <textarea
                value={newFeedback.comment}
                onChange={(e) => setNewFeedback({ ...newFeedback, comment: e.target.value })}
                placeholder="Enter your feedback comment"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {newFeedback.feedbackType === 'correction' && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Original Text</label>
                  <textarea
                    value={newFeedback.originalText}
                    onChange={(e) => setNewFeedback({ ...newFeedback, originalText: e.target.value })}
                    placeholder="Original text from care plan"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Corrected Text</label>
                  <textarea
                    value={newFeedback.correctedText}
                    onChange={(e) => setNewFeedback({ ...newFeedback, correctedText: e.target.value })}
                    placeholder="Corrected text"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="approved"
                checked={newFeedback.approved}
                onChange={(e) => setNewFeedback({ ...newFeedback, approved: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="approved" className="ml-2 text-sm text-gray-700">
                Mark section as approved
              </label>
            </div>

            <button
              onClick={handleAddFeedback}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Add Feedback Item
            </button>
          </div>

          {/* Feedback List */}
          {feedback.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-700 mb-3">Feedback Summary ({feedback.length} items)</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {feedback.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      item.feedbackType === 'correction'
                        ? 'border-l-red-500 bg-red-50'
                        : item.feedbackType === 'suggestion'
                        ? 'border-l-yellow-500 bg-yellow-50'
                        : 'border-l-green-500 bg-green-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">{item.sectionName}</p>
                        <p className="text-xs text-gray-600 mb-1">
                          Type: {item.feedbackType} | {item.approved ? '✓ Approved' : '⚠ Needs Review'}
                        </p>
                        {item.comment && <p className="text-sm text-gray-700">{item.comment}</p>}
                      </div>
                      <button
                        onClick={() => handleRemoveFeedback(index)}
                        className="ml-2 px-2 py-1 text-red-600 hover:bg-red-200 rounded text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Feedback */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmitFeedback}
              disabled={loading || regenerating || feedback.length === 0}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition"
            >
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
            <button
              onClick={handleRegenerateCarePlan}
              disabled={regenerating || loading || feedback.length === 0}
              className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 transition"
              title="Use Claude AI to improve the care plan based on your feedback"
            >
              {regenerating ? 'Improving Plan...' : '✨ Improve with Claude'}
            </button>
            <button
              onClick={() => {
                setSelectedOrder(null);
                setFeedback([]);
                setImprovedCarePlan(null);
                setShowImprovedPlan(false);
              }}
              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Version History */}
      {selectedOrder && selectedOrder.correctionHistory && selectedOrder.correctionHistory.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Correction History</h3>
          <div className="space-y-3">
            {selectedOrder.correctionHistory.map((entry, index) => (
              <div key={index} className="p-3 bg-white rounded border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-gray-800">{entry.sectionName}</p>
                  <span className="text-xs text-gray-500">
                    {entry.timestamp instanceof Date
                      ? entry.timestamp.toLocaleString()
                      : new Date(entry.timestamp as string).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600">By: {entry.pharmacistName}</p>
                <p className="text-sm text-gray-700 mt-1">{entry.change}</p>
                {entry.before && entry.after && (
                  <div className="mt-2 text-xs bg-gray-100 p-2 rounded">
                    <p className="text-red-600 line-through">Before: {entry.before}</p>
                    <p className="text-green-600">After: {entry.after}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improved Care Plan Display */}
      {showImprovedPlan && improvedCarePlan && (
        <div className="mt-6 p-4 bg-purple-50 rounded-lg border-2 border-purple-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">✨ Improved Care Plan (by Claude AI)</h3>
            <button
              onClick={() => {
                setShowImprovedPlan(false);
                setImprovedCarePlan(null);
              }}
              className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded text-sm"
            >
              Hide
            </button>
          </div>

          <div className="mb-4 p-3 bg-white rounded border border-gray-300 max-h-96 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-2">
              Claude has incorporated your feedback to improve the care plan:
            </p>
            {feedback.length > 0 && (
              <div className="mb-3 p-2 bg-blue-50 rounded text-xs">
                <p className="font-semibold text-blue-900 mb-1">Applied Feedback:</p>
                <ul className="space-y-1">
                  {feedback.map((f, idx) => (
                    <li key={idx} className="text-blue-800">
                      • {f.feedbackType.toUpperCase()}: {f.sectionName}
                      {f.comment && ` - ${f.comment}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
              {improvedCarePlan}
            </pre>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAcceptImprovedPlan}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Saving...' : '✓ Accept & Save Improved Plan'}
            </button>
            <button
              onClick={() => {
                setShowImprovedPlan(false);
                setImprovedCarePlan(null);
              }}
              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Discard & Review More
            </button>
          </div>

          <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200 text-xs text-yellow-800">
            <p className="font-semibold mb-1">💡 Tip:</p>
            <p>Review the improved care plan carefully. If satisfied, click "Accept & Save" to use this as your final care plan.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacistReview;
