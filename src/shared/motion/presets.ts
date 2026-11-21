import type { Transition } from 'motion/react'

export const motionPresets = {
  instant: { duration: 0 },
  fast: { duration: 0.12, ease: [0.2, 0.8, 0.2, 1] },
  normal: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] },
  slow: { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] },
  spring: { type: 'spring', stiffness: 320, damping: 28 },
} satisfies Record<string, Transition>

export function transitionFor(preferenceReduced: boolean, preset: keyof typeof motionPresets): Transition {
  return preferenceReduced ? motionPresets.instant : motionPresets[preset]
}
