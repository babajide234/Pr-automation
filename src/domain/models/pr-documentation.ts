export interface PRDocumentation {
    prNumber: number;
    title: string;
    author: string;
    summary: string;
    technicalDesign: string;
    dbChanges: string;
    apiChanges: string;
    breakingChanges: boolean;
    deploymentNotes: string;
    rollbackPlan: string;
    mergedAt: string;
}