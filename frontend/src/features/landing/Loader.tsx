import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isReducedMotion } from '../../lib/motion'
import { PingMark } from '../../ui/PingMark'

export interface LoaderProps {
  onComplete: () => void
}

export const Loader: React.FC<LoaderProps> = ({ onComplete }) => {
  const [visible, setVisible] = useState(true)

  const handleSkip = () => {
    sessionStorage.setItem('dueping_loader_seen', '1')
    setVisible(false)
    onComplete()
  }

  useEffect(() => {
    if (isReducedMotion() || sessionStorage.getItem('dueping_loader_seen')) {
      setVisible(false)
      onComplete()
      return
    }

    const timer = setTimeout(() => {
      handleSkip()
    }, 900)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        handleSkip()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
          onClick={handleSkip}
          aria-label="Skip splash animation"
          role="button"
          tabIndex={0}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg select-none cursor-pointer"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex flex-col items-center gap-4"
          >
            <PingMark size="lg" color="#007AFF" />
            <span className="font-light tracking-tight text-xl text-text">DuePing</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
