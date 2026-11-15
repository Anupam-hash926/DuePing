import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isReducedMotion } from '../../lib/motion'
import { Ring } from '../../ui/Ring'

export interface LoaderProps {
  onComplete: () => void
}

export const Loader: React.FC<LoaderProps> = ({ onComplete }) => {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (isReducedMotion() || sessionStorage.getItem('dueping_loader_seen')) {
      setVisible(false)
      onComplete()
      return
    }

    const timer = setTimeout(() => {
      sessionStorage.setItem('dueping_loader_seen', '1')
      setVisible(false)
      setTimeout(onComplete, 400)
    }, 900)

    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg select-none"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex flex-col items-center gap-4"
          >
            <Ring size="lg" color="#007AFF" />
            <span className="font-light tracking-tight text-xl text-text">DuePing</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
