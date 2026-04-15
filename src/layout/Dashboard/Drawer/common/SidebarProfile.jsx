import React from 'react';
import { useAuth } from 'contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, MoreVertical } from 'lucide-react';
import Image from 'react-bootstrap/Image';

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
      <div className="pc-sidebar-user">
        <div className="user-avatar-wrap">
          <Image src={avatar} className="user-avatar" roundedCircle />
        </div>
        <div className="user-info">
          <h6 className="user-name">{displayName}</h6>
          <span className="user-email">{email}</span>
        </div>
        <button className="user-action-btn">
          <MoreVertical size={16} />
        </button>
      </div>
      
      <div className="px-3 pb-3">
        <button className="sidebar-logout-btn w-100 mt-2" onClick={handleLogout}>
          <LogOut size={16} className="me-2" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default SidebarProfile;
