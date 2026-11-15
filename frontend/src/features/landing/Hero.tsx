import React from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Button } from '../../ui/Button'
import { TextButton } from '../../ui/TextButton'
import { Ring } from '../../ui/Ring'
import { Badge } from '../../ui/Badge'
import { MoneyText } from '../../ui/MoneyText'
import { isReducedMotion } from '../../lib/motion'

export const Hero: React.FC = () => {
  const { scrollY } = useScroll()
  const reduced = isReducedMotion()
  const cardY = useTransform(scrollY, [0, 600], [0, reduced ? 0 : -80])

  const scrollToStory = () => {
    document.getElementById('story')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative min-h-[92vh] flex flex-col justify-center items-center text-center px-4 sm:px-6 pt-12 pb-20 overflow-hidden">
      {/* Background Soft Blobs & Ambient Ping Rings */}
      <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-teal/10 blur-[120px] -top-20 -left-20" />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-purple/10 blur-[140px] -bottom-40 -right-20" />
        <div className="opacity-30">
          <Ring size="hero" color="#007AFF" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8 z-10">
        {/* Giant Headline */}
        <div className="space-y-2 select-none">
          <h1 className="text-hero text-text font-extralight tracking-tight">
            Get paid.
          </h1>
          <h1 className="text-hero font-extralight tracking-tight bg-gradient-to-r from-teal via-tint to-purple bg-clip-text text-transparent">
            Not ignored.
          </h1>
        </div>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl md:text-2xl text-text-2 font-normal max-w-2xl mx-auto leading-relaxed">
          DuePing finds out why an invoice is stuck — and tells you what to do next.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4 flex-wrap pt-2">
          <Link to="/app">
            <Button size="lg" variant="primary" className="shadow-float">
              Open the app
            </Button>
          </Link>
          <TextButton size="lg" withChevron onClick={scrollToStory}>
            See how it works
          </TextButton>
        </div>

        {/* Floating Glass Action Card Mock with Parallax */}
        <motion.div
          style={{ y: cardY }}
          className="pt-8 max-w-md mx-auto w-full"
        >
          <div className="glass rounded-sheet border border-hairline p-5 shadow-float text-left space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-xs font-semibold text-text">DP-2026-0001</span>
                <span className="text-xs text-text-3">· Alpha Corp</span>
              </div>
              <Badge variant="warning" size="sm">Missing PO</Badge>
            </div>

            <div className="text-base sm:text-lg font-light text-text leading-snug">
              Obtain Purchase Order number from procurement manager before Friday.
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-hairline text-xs">
              <span className="text-text-2 font-medium">
                At stake: <MoneyText amount="120000" currency="INR" />
              </span>
              <span className="text-text-3">Playbook Action</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
