import { Link } from 'react-router-dom';

// react-bootstrap
import Image from 'react-bootstrap/Image';

// project-import
import { APP_DEFAULT_PATH } from 'config';
import Logo from 'components/Logo';

export const DrawerHeader = () => {
  return (
    <div className="m-header">
      <Link to={APP_DEFAULT_PATH} className="b-brand text-primary">
        <Logo width={120} />
      </Link>
    </div>
  );
};
