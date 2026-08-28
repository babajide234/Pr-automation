#!/usr/bin/env node
import "./config/env";
import fs from "fs";
import path from "path";
import { Command } from "commander";
import { generateTemplate } from "./application/template";
import { ConfigLoader } from "./infrastructure/config/loader";
import { printResolvedConfig } from "./infrastructure/config/print";
import {
    CliContextOptions,
    resolveCliContext,
    resolveWorkingDirectory,
} from "./infrastructure/context/runtime-context";
import { EnvCredentialProvider } from "./infrastructure/credentials/env.provider";
import { CredentialResolver } from "./infrastructure/credentials/resolver";
import { GithubClient } from "./infrastructure/github/github.client";
import { handleFatal, runWorkflow } from "./run";

const program = new Command();

program
    .name("pr-doc-engine")
    .description("Validate and archive pull request documentation");

addSharedOptions(
    program
        .command("validate")
        .description("Validate a pull request description")
        .requiredOption("--pr <number>", "Pull request number"),
).action(async (opts: SharedOpts & { pr: string }) => {
    const ctx = resolveCliContext(toCliOptions(opts, "validate"));
    process.exit(await runWorkflow(ctx));
});

addSharedOptions(
    program
        .command("archive")
        .description("Validate then archive a merged pull request")
        .requiredOption("--pr <number>", "Pull request number"),
).action(async (opts: SharedOpts & { pr: string }) => {
    const ctx = resolveCliContext(toCliOptions(opts, "archive"));
    process.exit(await runWorkflow(ctx));
});

addSharedOptions(
    program
        .command("config")
        .description("Inspect resolved configuration")
        .command("print")
        .description("Print resolved config with provenance (secrets redacted)"),
).action(async (opts: SharedOpts) => {
    const loaded = await loadConfigOnly(opts);
    process.stdout.write(printResolvedConfig(loaded.loaded));
});

addSharedOptions(
    program
        .command("template")
        .description("Emit a pull request template from the resolved schema")
        .option("--out <path>", "Write to a file instead of stdout"),
).action(async (opts: SharedOpts & { out?: string }) => {
    const { loaded } = await loadConfigOnly(opts);
    const markdown = generateTemplate(loaded.config);
    if (opts.out) {
        const target = path.isAbsolute(opts.out)
            ? opts.out
            : path.join(resolveWorkingDirectory(), opts.out);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, markdown);
    } else {
        process.stdout.write(markdown);
    }
});

interface SharedOpts {
    repo?: string;
    config?: string;
    base?: string;
}

function addSharedOptions(command: Command): Command {
    return command
        .option("--repo <owner/name>", "GitHub repository")
        .option("--config <path>", "Path to config file", ".pr-doc.yml")
        .option("--base <ref>", "Git ref or SHA to read config from");
}

function toCliOptions(
    opts: SharedOpts & { pr: string },
    mode: "validate" | "archive",
): CliContextOptions {
    return {
        pr: Number(opts.pr),
        repo: opts.repo,
        config: opts.config,
        base: opts.base,
        mode,
    };
}

async function loadConfigOnly(opts: SharedOpts) {
    const configPath = opts.config || ".pr-doc.yml";
    const loader = new ConfigLoader();
    if (opts.base) {
        const creds = new CredentialResolver(new EnvCredentialProvider());
        const token = creds.resolve("github_token", true) as string;
        const ctx = resolveCliContext({
            pr: 1,
            repo: opts.repo,
            config: configPath,
            base: opts.base,
            mode: "validate",
        });
        const github = new GithubClient({
            token,
            owner: ctx.owner,
            repo: ctx.repo,
        });
        return loader.load({
            configPath,
            source: "base-ref",
            workingDirectory: resolveWorkingDirectory(),
            baseSha: opts.base,
            github,
        });
    }

    return loader.load({
        configPath,
        source: "working-tree",
        workingDirectory: resolveWorkingDirectory(),
    });
}

program.parseAsync(process.argv).catch(handleFatal);
