import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toast } from '../ui/Toast'
import { eventTypeLabel, labelForEventType } from '../lib/labels'

describe('Phase 11 Step 5: Optional Polish Items', () => {
  it('5.2: eventTypeLabel correctly formats ActionReopened', () => {
    expect(eventTypeLabel['ActionReopened']).toBe('Action reopened')
    expect(labelForEventType('ActionReopened')).toBe('Action reopened')
  })

  it('5.2: Toast renders action button and fires onClick callback', () => {
    const handleUndo = vi.fn()
    render(
      <Toast
        type="success"
        title="Marked done"
        action={{ label: 'Undo', onClick: handleUndo }}
      />
    )

    expect(screen.getByText('Marked done')).toBeInTheDocument()
    const undoButton = screen.getByRole('button', { name: 'Undo' })
    expect(undoButton).toBeInTheDocument()

    fireEvent.click(undoButton)
    expect(handleUndo).toHaveBeenCalledTimes(1)
  })
})
