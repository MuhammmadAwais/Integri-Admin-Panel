import { createRoot } from 'react-dom/client';

// styles
import './index.scss';
import './assets/css/integri-theme.css';

// project-imports
import App from './App';

import '@fontsource/open-sans/300.css';
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/500.css';
import '@fontsource/open-sans/600.css';

import { Provider } from 'react-redux';
import { store } from './store';

const container = document.getElementById('root');
const root = createRoot(container);

// ==============================|| MAIN - REACT DOM RENDER ||============================== //

root.render(
  <Provider store={store}>
    <App />
  </Provider>
);

