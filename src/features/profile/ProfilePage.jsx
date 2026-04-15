import React from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';

import MainCard from 'components/MainCard';
import { useAuth } from 'contexts/AuthContext';

export default function ProfilePage() {
  const { currentUser } = useAuth();

  return (
    <Row>
      <Col md={8} xl={6}>
        <MainCard title="Admin Profile & Settings">
          <Form>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Email address</Form.Label>
              <Form.Control type="email" placeholder="Enter email" value={currentUser?.email || ''} disabled />
              <Form.Text className="text-muted">
                Admin email is locked. You cannot change your email address.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3" controlId="formBasicRole">
              <Form.Label>Role</Form.Label>
              <Form.Control type="text" value="Super Administrator" disabled />
            </Form.Group>

            <Button variant="primary" disabled>
              Update Settings
            </Button>
          </Form>
        </MainCard>
      </Col>
    </Row>
  );
}
