// project-imports
import { DrawerHeader, DrawerOverlay, useDrawerLogic } from '../common';
import VerticalDrawerContent from './VerticalDrawerContent';
import SidebarProfile from '../common/SidebarProfile';

// ==============================|| VERTICAL DRAWER ||============================== //

export const VerticalDrawer = () => {
  const { drawerOpen, selectedItems, setSelectedItems, isMobile, overlayRef } = useDrawerLogic();

  return (
    <nav id="pc-sidebar" className={`pc-sidebar ${drawerOpen && 'pc-sidebar-hide mob-sidebar-active'}`}>
      <div className="navbar-wrapper d-flex flex-column" style={{ height: '100vh' }}>
        <DrawerHeader />
        <div className="navbar-content flex-grow-1">
          <VerticalDrawerContent selectedItems={selectedItems} setSelectedItems={setSelectedItems} />
        </div>
        <SidebarProfile />
      </div>
      <DrawerOverlay drawerOpen={drawerOpen} isMobile={isMobile} overlayRef={overlayRef} />
    </nav>
  );
};
