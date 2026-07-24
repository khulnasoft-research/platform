import type { WorkflowStep } from '../types.js';

export type StageType = 'sequential' | 'parallel' | 'conditional';

export interface PipelineStage {
  id: string;
  name: string;
  type: StageType;
  steps: WorkflowStep[];
  condition?: string;
  timeout?: number;
}

export class Pipeline {
  private stages: PipelineStage[] = [];
  private currentIndex = -1;

  addStage(stage: PipelineStage): void {
    this.stages.push(stage);
  }

  getStages(): PipelineStage[] {
    return this.stages;
  }

  getCurrentStage(): PipelineStage | null {
    return this.currentIndex >= 0 ? this.stages[this.currentIndex] ?? null : null;
  }

  getNextStage(): PipelineStage | null {
    return this.stages[this.currentIndex + 1] ?? null;
  }

  advance(): boolean {
    if (this.currentIndex < this.stages.length - 1) {
      this.currentIndex++;
      return true;
    }
    return false;
  }

  reset(): void {
    this.currentIndex = -1;
  }

  get progress(): number {
    if (this.stages.length === 0) return 0;
    return Math.round(((this.currentIndex + 1) / this.stages.length) * 100);
  }
}
