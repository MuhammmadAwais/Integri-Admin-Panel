import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from 'contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();

  if (import.meta.env.DEV) {
    return children;
  }

  if (!currentUser) {
    // If not logged in or unauthorized email, redirect to login page
    return <Navigate to="/login" replace />;
  }

  return children;
}
