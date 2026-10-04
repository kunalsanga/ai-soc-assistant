import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Routing', () => {
  it('renders the Security Operations Center dashboard by default', () => {
    render(<App />);
    expect(screen.getByText('Security Operations Center')).toBeInTheDocument();
  });
});
