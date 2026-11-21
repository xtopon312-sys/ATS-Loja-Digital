// Adaptado do Animated Number do Motion Primitives (MIT), ibelick/motion-primitives.
import { motion, useReducedMotion, useSpring, useTransform, type SpringOptions } from 'motion/react'
import { useEffect } from 'react'

import { cn } from '../cn'

interface AnimatedNumberProps {
  value: number
  className?: string
  springOptions?: SpringOptions
}

export function AnimatedNumber({ value, className, springOptions = { stiffness: 260, damping: 32 } }: AnimatedNumberProps) {
  const reduced = useReducedMotion() ?? false
  const spring = useSpring(value, springOptions)
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString('pt-BR'))

  useEffect(() => {
    if (reduced) spring.jump(value)
    else spring.set(value)
  }, [reduced, spring, value])

  return <motion.span className={cn('tabular-nums', className)}>{display}</motion.span>
}
