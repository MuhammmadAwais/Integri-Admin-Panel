import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { gsap } from 'gsap';

// react-bootstrap
import Card from 'react-bootstrap/Card';
import Stack from 'react-bootstrap/Stack';

// ==============================|| MAIN CARD ||============================== //

/**
 * MainCard — Base card component for Integri App.
 * Wraps react-bootstrap Card with:
 *   - GSAP stagger entrance: slides up + fades in on mount
 *   - Imperial Obsidian glass styles (applied via _card.scss)
 *   - data-gsap-card attribute for global targeting
 */
export default function MainCard({
  children,
  subheader,
  footer,
  secondary,
  content = true,
  title,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
  ref
}) {
  const cardRef = useRef(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    // Stagger entrance — each card on the page triggers independently
    // Parent orchestration in Default.jsx handles cross-card stagger;
    // this handles solo instances (e.g. sub-pages, feature stubs).
    gsap.fromTo(
      el,
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.55,
        ease: 'power3.out',
        clearProps: 'transform,opacity' // clean up inline styles after animation
      }
    );
  }, []);

  return (
    <Card ref={(node) => { cardRef.current = node; if (ref) ref.current = node; }} className={className} data-gsap-card>
      {/* Header Section */}
      {title && (
        <Card.Header className={headerClassName}>
          <Stack direction="horizontal" gap={2} className="flex-wrap justify-content-between">
            <Stack className="align-self-center">
              {typeof title === 'string' ? <h5>{title}</h5> : title}
              {subheader && <small className="text-muted">{subheader}</small>}
            </Stack>
            {secondary}
          </Stack>
        </Card.Header>
      )}
      {/* Content */}
      {content && <Card.Body className={bodyClassName}>{children}</Card.Body>}
      {!content && children}
      {footer && <Card.Footer className={footerClassName}>{footer}</Card.Footer>}
    </Card>
  );
}

MainCard.propTypes = {
  children:        PropTypes.node,
  subheader:       PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  footer:          PropTypes.node,
  secondary:       PropTypes.node,
  content:         PropTypes.bool,
  title:           PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  className:       PropTypes.string,
  headerClassName: PropTypes.string,
  bodyClassName:   PropTypes.string,
  footerClassName: PropTypes.string,
  ref:             PropTypes.object
};
