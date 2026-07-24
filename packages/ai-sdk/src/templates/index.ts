export interface TemplateVariables {
  [key: string]: string | number | boolean | string[] | undefined;
}

export class PromptTemplate {
  private template: string;

  constructor(template: string) {
    this.template = template;
  }

  render(variables: TemplateVariables): string {
    return this.template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = variables[key];
      if (value === undefined) throw new Error(`Missing template variable: ${key}`);
      return String(value);
    });
  }

  static fromFile(path: string): PromptTemplate {
    return new PromptTemplate(path);
  }
}

export const SYSTEM_PROMPTS = {
  architect: new PromptTemplate(
    'You are an expert software architect. Design a system architecture for:\n\n{{context}}\n\nConstraints:\n- {{constraints}}\n\nOutput a blueprint with components, data flow, and API contracts.',
  ),
  planner: new PromptTemplate(
    'You are a technical project planner. Break the following goal into executable steps:\n\n{{goal}}\n\nConsider:\n- Dependencies between steps\n- Resource estimates\n- Risk factors\n\nOutput a step-by-step plan.',
  ),
  codeReview: new PromptTemplate(
    'Review the following code for quality, security, and best practices:\n\n```{{language}}\n{{code}}\n```\n\nFocus on:\n- Potential bugs\n- Security vulnerabilities\n- Performance issues\n- Style violations',
  ),
} as const;
