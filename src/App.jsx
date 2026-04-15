import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

// project-imports
import router from 'routes';
import { getBackendToken } from 'api/backendApi';
import { AuthProvider } from 'contexts/AuthContext';

// ==============================|| APP - THEME, ROUTER, LOCAL ||============================== //

function App() {
  useEffect(() => {
    async function bootstrap() {
      const token = localStorage.getItem('integri_jwt');
      if (!token) {
        try {
          console.log('🔄 Bootstrap: No token found. Securing backend handshake...');
          await getBackendToken();
          console.log('✅ Bootstrap: Backend Sentinel Connected.');
        } catch (e) {
          console.error('❌ Bootstrap: Backend authorization failed.', e);
        }
      }
    }
    bootstrap();
  }, []);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
