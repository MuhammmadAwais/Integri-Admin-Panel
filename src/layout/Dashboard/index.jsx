import { Outlet } from 'react-router-dom';

// project-imports
import Drawer from './Drawer';
import Footer from './Footer';
import Header from './Header';
import Breadcrumbs from 'components/Breadcrumbs';
import NavigationScroll from 'components/NavigationScroll';
import { useSelector } from 'react-redux';
import { useEffect } from 'react';

// ==============================|| MAIN LAYOUT ||============================== //

export default function MainLayout() {
  const isDark = useSelector((state) => state.theme.isDark);

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
    <>
      <Drawer />
      <Header />
      <div className="pc-container">
        <div className="pc-content">
          <Breadcrumbs />
          <NavigationScroll>
            <Outlet />
          </NavigationScroll>
        </div>
      </div>
      <Footer />
    </>
  );
}
