import { ResolvedConfig } from "../domain/models/config";
import { RuntimeContext, WorkflowMode } from "../infrastructure/context/runtime-context";

export function resolveWorkflowMode(
    ctx: RuntimeContext,
    config: ResolvedConfig,
): WorkflowMode {
    if (ctx.requestedMode) {
        return ctx.requestedMode;
    }

    if (ctx.eventName === "pull_request") {
        if (ctx.eventAction === "closed") {
            if (ctx.merged && config.triggers.archive_on === "merge") {
                return "archive";
            }
            return "noop";
        }
        if (ctx.eventAction && config.triggers.validate_on.includes(ctx.eventAction)) {
            return "validate";
        }
        return "noop";
    }

    return "noop";
}
