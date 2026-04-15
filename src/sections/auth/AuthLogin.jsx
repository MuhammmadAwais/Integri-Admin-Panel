import PropTypes from 'prop-types';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// react-bootstrap
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Image from 'react-bootstrap/Image';
import InputGroup from 'react-bootstrap/InputGroup';
import Stack from 'react-bootstrap/Stack';
import Alert from 'react-bootstrap/Alert';

// third-party
import { useForm } from 'react-hook-form';
import { signInWithEmailAndPassword } from 'firebase/auth';

// project-imports
import MainCard from 'components/MainCard';
import { emailSchema, passwordSchema } from 'utils/validationSchema';
import { auth } from 'lib/firebase/firebase';

// ==============================|| AUTH LOGIN FORM ||============================== //

export default function AuthLoginForm({ className }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm();

  const togglePasswordVisibility = () => {
    setShowPassword((prevState) => !prevState);
  };

  const onSubmit = async (data) => {
    setLoginError(null);
    setIsLoading(true);
    try {
      if (data.email.toLowerCase() !== 'integriadmin@admin.com') {
        throw new Error('Unauthorized Access: You do not have permission to access this terminal.');
      }
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // Wait a moment for auth context to pick up the state
      navigate('/');
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.message.includes('auth/invalid-credential') || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setLoginError('Invalid email address or password. Please try again.');
      } else {
        setLoginError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainCard className="mb-0">
      <div className="text-center mb-4">
        <h2 style={{ fontWeight: 700, color: 'var(--bs-heading-color)' }}>Integri AI</h2>
      </div>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <h4 className={`text-center f-w-500 mt-4 mb-3 ${className || ''}`}>Login</h4>
        
        {loginError && (
          <Alert variant="danger" className="text-center py-2" style={{ fontSize: '0.85rem' }}>
            {loginError}
          </Alert>
        )}

        <Form.Group className="mb-3" controlId="formEmail">
          <Form.Control
            type="email"
            placeholder="Email Address"
            {...register('email', emailSchema)}
            isInvalid={!!errors.email}
            style={{ backgroundColor: 'var(--bs-body-bg)', color: 'var(--bs-body-color)' }}
          />
          <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
        </Form.Group>
        
        <Form.Group className="mb-3" controlId="formPassword">
          <InputGroup>
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              {...register('password', passwordSchema)}
              isInvalid={!!errors.password}
              style={{ backgroundColor: 'var(--bs-body-bg)', color: 'var(--bs-body-color)' }}
            />
            <Button onClick={togglePasswordVisibility} variant="outline-secondary">
              {showPassword ? <i className="ti ti-eye" /> : <i className="ti ti-eye-off" />}
            </Button>
            <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
          </InputGroup>
        </Form.Group>

        <Stack direction="horizontal" className="mt-1 justify-content-between align-items-center">
          <Form.Group controlId="customCheckc1">
            <Form.Check
              type="checkbox"
              label="Remember me?"
              defaultChecked
              className={`input-primary ${className ? className : 'text-muted'}`}
            />
          </Form.Group>
        </Stack>
        
        <div className="text-center mt-4 mb-3">
          <Button type="submit" className="shadow px-sm-4 w-100" disabled={isLoading}>
            {isLoading ? 'Authenticating...' : 'Secure Login'}
          </Button>
        </div>
      </Form>
    </MainCard>
  );
}

AuthLoginForm.propTypes = { className: PropTypes.string };
