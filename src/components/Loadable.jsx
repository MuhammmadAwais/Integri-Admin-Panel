import React, { Component, Suspense } from 'react';

// project-imports
import Loader from './Loader';

// ==============================|| ERROR BOUNDARY FOR CHUNK LOADING ||============================== //

class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Dynamic module load failure:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          maxWidth: '520px',
          margin: '60px auto',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(212,175,55,0.3)',
          borderRadius: '12px',
          backdropFilter: 'blur(8px)'
        }}>
          <h4 style={{ color: '#D4AF37', fontWeight: 800, marginBottom: '12px' }}>
            Resource Loading Update
          </h4>
          <p style={{ color: '#9ca3af', fontSize: '0.88rem', marginBottom: '20px', lineHeight: 1.5 }}>
            The module was updated or connection was briefly disconnected during reload. Please refresh to load the latest bundle.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              background: '#D4AF37',
              color: '#000',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ==============================|| LOADABLE - LAZY LOADING ||============================== //

const Loadable = (Component) => (props) => {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<Loader />}>
        <Component {...props} />
      </Suspense>
    </ChunkErrorBoundary>
  );
};

export default Loadable;
