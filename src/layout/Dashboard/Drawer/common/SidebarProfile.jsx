import React from 'react';
import { useAuth } from 'contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, MoreVertical, Settings } from 'lucide-react';
import Image from 'react-bootstrap/Image';
import Dropdown from 'react-bootstrap/Dropdown';

// assets
import defaultAvatar from 'assets/images/user/avatar-2.png';

const SidebarProfile = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentUser) return null;

  // Use photoURL from Firebase, fallback to default admin avatar
  const avatar = currentUser.photoURL || defaultAvatar;
  const displayName = currentUser.displayName || 'Integri Admin';
  const email = currentUser.email || 'Admin';

  return (
    <div className="pc-sidebar-profile">
      <div className="pc-sidebar-user d-flex align-items-center flex-nowrap px-3 mb-3">
        <div className="user-avatar-wrap me-2">
          <Image src={avatar} className="user-avatar" roundedCircle style={{ width: 32, height: 32, border: '1.5px solid #D4AF37' }} />
        </div>
        <div className="user-info flex-grow-1 overflow-hidden">
          <h6 className="user-name mb-0 text-truncate" style={{ fontSize: '0.85rem' }}>{displayName}</h6>
          <span className="user-email text-truncate d-block" style={{ fontSize: '0.7rem', opacity: 0.7 }}>{email}</span>
        </div>
        
        <Dropdown drop="up" align="end">
          <Dropdown.Toggle as="button" className="user-action-btn border-0 p-0 bg-transparent ms-1">
            <MoreVertical size={16} />
          </Dropdown.Toggle>
          
          <Dropdown.Menu className="pc-h-dropdown shadow-sm border-zinc">
            <Dropdown.Item as={Link} to="/profile" className="d-flex align-items-center gap-2">
              <Settings size={16} />
              <span>Settings & Profile</span>
            </Dropdown.Item>
            <Dropdown.Divider className="border-zinc" />
            <Dropdown.Item onClick={handleLogout} className="d-flex align-items-center gap-2 text-danger">
              <LogOut size={16} />
              <span>Logout</span>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
      
      <div className="px-3 pb-2">
        <button className="sidebar-logout-btn w-100 py-2 border-0" onClick={handleLogout}>
          <LogOut size={14} className="me-2" />
          <span style={{ fontSize: '0.85rem' }}>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default SidebarProfile;
