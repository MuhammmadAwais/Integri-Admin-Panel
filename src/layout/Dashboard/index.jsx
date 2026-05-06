import { Outlet } from 'react-router-dom';

// project-imports
import Drawer from './Drawer';
import Header from './Header';
import NavigationScroll from 'components/NavigationScroll';
import { useSelector } from 'react-redux';
import { useEffect } from 'react';
import { useGetMenuMaster } from 'api/menu';

// Silently pre-fetch the News collection as soon as the user is authenticated,
// so the /news page loads instantly without waiting for Firestore.
import { startPreload as preloadNews } from 'features/news/hooks/newsPreloadService';

// ==============================|| MAIN LAYOUT ||============================== //

export default function MainLayout() {
  const isDark = useSelector((state) => state.theme.isDark);
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster?.isDashboardDrawerOpened ?? false;

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark-theme');
      document.body.setAttribute('data-pc-theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      document.body.setAttribute('data-pc-theme', 'light');
    }

    // Kick the background news prefetch. The service is a singleton — this
    // call is a no-op on every re-render after the first.
    preloadNews();
  }, [isDark]);

  return (
    <div className={drawerOpen ? 'pc-sidebar-hide' : ''}>
      <Drawer />
      <Header />
      <div className="pc-container" style={{ position: 'relative', zIndex: 1 }}>
        <div className="pc-content">
          <NavigationScroll>
            <Outlet />
          </NavigationScroll>
        </div>
      </div>
    </div>
  );
}
