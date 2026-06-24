import { Outlet } from 'react-router-dom';

// project-imports
import Drawer from './Drawer';
import Header from './Header';
import NavigationScroll from 'components/NavigationScroll';
import { useSelector } from 'react-redux';
import { useEffect } from 'react';
import { useGetMenuMaster } from 'api/menu';

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
