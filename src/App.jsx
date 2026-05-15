import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// project-imports
import router from 'routes';
import { getBackendToken } from 'api/backendApi';
import { AuthProvider } from 'contexts/AuthContext';

import ParticleBackground from 'components/ParticleBackground';
import EliteToastContainer from 'components/EliteUI/EliteToastContainer';

// ==============================|| APP - THEME, ROUTER, LOCAL ||============================== //

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ParticleBackground />
        <EliteToastContainer />
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
