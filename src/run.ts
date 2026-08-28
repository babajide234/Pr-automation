import { ConfigurationError } from "./domain/errors";
import { PRDocWorkflow } from "./application/pr-doc.workflow";
import { RuntimeContext } from "./infrastructure/context/runtime-context";
import { EnvCredentialProvider } from "./infrastructure/credentials/env.provider";
import { CredentialResolver } from "./infrastructure/credentials/resolver";

export async function runWorkflow(ctx: RuntimeContext): Promise<number> {
    const creds = new CredentialResolver(new EnvCredentialProvider());
    const result = await new PRDocWorkflow().execute(ctx, creds);
    return result.exitCode;
}

export function handleFatal(error: unknown): never {
    if (error instanceof ConfigurationError) {
        console.error(error.message);
        process.exit(1);
    }
    console.error(error);
    process.exit(1);
}
