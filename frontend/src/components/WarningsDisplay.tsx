import { Warning } from '../types';

interface WarningsDisplayProps {
  warnings: Warning[];
}

const WarningsDisplay = ({ warnings }: WarningsDisplayProps) => {
  if (warnings.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {warnings.map((warning, index) => {
        const isError = warning.severity === 'error';
        const boxClass = isError
          ? 'bg-red-50 border-2 border-red-500'
          : 'bg-yellow-50 border-2 border-yellow-500';
        const iconColor = isError ? 'text-red-600' : 'text-yellow-600';
        const textColor = isError ? 'text-red-900' : 'text-gray-800';

        return (
          <div key={index} className={`${boxClass} p-4 rounded-lg`}>
            <div className="flex items-start">
              {isError ? (
                // Error icon (X in circle)
                <svg className={`w-6 h-6 ${iconColor} mr-3 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
              ) : (
                // Warning icon (triangle)
                <svg className={`w-6 h-6 ${iconColor} mr-3 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
              )}
              <div className="flex-1">
                <p className={`text-sm font-semibold ${textColor} mb-1`}>
                  {isError ? '🚫 SUBMISSION BLOCKED' : '⚠️ WARNING'}
                </p>
                <p className={`text-sm ${textColor}`}>{warning.message}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WarningsDisplay;
