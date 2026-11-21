// Adaptado do componente Blur Fade do Magic UI (MIT), magicuidesign/magicui.
import { AnimatePresence, motion, useInView, useReducedMotion, type MotionProps, type UseInViewOptions, type Variants } from 'motion/react'
import { useRef, type ReactNode } from 'react'

import { transitionFor } from './presets'

interface BlurFadeProps extends MotionProps {
  children: ReactNode
  className?: string
  delay?: number
  offset?: number
  inView?: boolean
  inViewMargin?: UseInViewOptions['margin']
}

export function BlurFade({ children, className, delay = 0, offset = 8, inView = false, inViewMargin = '-40px', ...props }: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const observed = useInView(ref, { once: true, margin: inViewMargin })
  const reduced = useReducedMotion() ?? false
  const variants: Variants = reduced
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : { hidden: { opacity: 0, y: offset, filter: 'blur(6px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)' } }

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={!inView || observed ? 'visible' : 'hidden'}
        exit="hidden"
        variants={variants}
        transition={{ ...transitionFor(reduced, 'slow'), delay: reduced ? 0 : delay }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
