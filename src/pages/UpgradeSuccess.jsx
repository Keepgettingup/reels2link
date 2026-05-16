import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export default function UpgradeSuccess() {
  useEffect(() => {
    // Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      window.location.href = '/';
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Zahlung erfolgreich! 🎉</h1>
        <p className="text-gray-500 mb-6">
          Dein Upgrade wurde verarbeitet. Dein Account wird in Kürze aktualisiert.
        </p>
        <p className="text-sm text-gray-400 mb-6">
          Du wirst in 5 Sekunden weitergeleitet...
        </p>
        <Link
          to="/"
          className="inline-block bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors"
        >
          Zurück zur App
        </Link>
      </div>
    </div>
  );
}
