import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NotFound: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto mb-6 bg-moss/10 rounded-full flex items-center justify-center">
          <span className="text-moss">🚫</span>
        </div>
        <h1 className="text-3xl font-heading text-ink mb-4">
          Page Not Found
        </h1>
        <p className="text-body text-ink-soft mb-2">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <p className="text-sm text-ink-soft/70 mb-6 font-mono bg-paper-2 px-3 py-1 rounded">
          {location.pathname}
        </p>
        <Link
          to="/"
          className="bg-moss hover:bg-moss-light text-white px-6 py-3 rounded-md"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;