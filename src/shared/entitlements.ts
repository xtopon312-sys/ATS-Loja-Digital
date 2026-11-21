export type CapabilityValue = boolean | string | number
export type LimitValue = number | null

export interface PlanDefinition {
  capabilities: Readonly<Record<string, CapabilityValue>>
  limits: Readonly<Record<string, LimitValue>>
}

export interface PlanOverrides {
  capabilities?: Readonly<Record<string, CapabilityValue>>
  limits?: Readonly<Record<string, LimitValue>>
}

export interface ResolvedEntitlements {
  capabilities: Readonly<Record<string, CapabilityValue>>
  limits: Readonly<Record<string, LimitValue>>
}

export function resolveEntitlements(
  plan: Pick<PlanDefinition, 'capabilities' | 'limits'>,
  overrides: PlanOverrides = {},
): ResolvedEntitlements {
  return {
    capabilities: { ...plan.capabilities, ...overrides.capabilities },
    limits: { ...plan.limits, ...overrides.limits },
  }
}
