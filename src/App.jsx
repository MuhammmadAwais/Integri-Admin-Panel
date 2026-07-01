import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// project-imports
import router from 'routes';
import { tokenReadyPromise } from 'api/backendApi';
import { AuthProvider } from 'contexts/AuthContext';
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
    // tokenReadyPromise already started at module-import time.
    // We just await it here to log the result — no duplicate fetch.
    console.log('⏳ [App] Awaiting backend token (started at module load)...');
    tokenReadyPromise
      .then((token) => {
        if (token) {
          console.log('✅ [App] Backend token ready. Response:', token.slice(0, 24) + '…');
        } else {
          console.warn('⚠️ [App] tokenReadyPromise resolved but no token returned.');
        }
      })
      .catch((e) => {
        console.error('❌ [App] Backend token generation failed:', e);
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EliteToastContainer />
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
