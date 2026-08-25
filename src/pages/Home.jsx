import { useEffect } from 'react';
import { gsap } from 'gsap';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';

// sections (retained from template — UsersMap)
import { UsersMap } from 'sections/dashboard/default';

// ==============================|| INTEGRI APP — DASHBOARD PAGE ||============================== //

export default function Home() {
  // ── GSAP cross-card stagger orchestration ──
  useEffect(() => {
    const cards = document.querySelectorAll('[data-gsap-card]');
    if (!cards.length) return;

    gsap.fromTo(
      cards,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.08,
        clearProps: 'transform,opacity'
      }
    );
  }, []);

  return (
    <>
      <Row>
        {/* ── Dashboard Map ── */}
        <Col md={12} xl={12}>
          <UsersMap />
        </Col>
      </Row>
    </>
  );
}
