import type { Plan } from '../domain/Plan'
export interface PlanRepository { get(id: string): Promise<Plan | undefined> }
