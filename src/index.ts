import "./config/env";
import { resolveActionContext } from "./infrastructure/context/runtime-context";
import { handleFatal, runWorkflow } from "./run";

async function main(): Promise<void> {
    const ctx = resolveActionContext();
    const code = await runWorkflow(ctx);
    process.exit(code);
}

main().catch(handleFatal);
